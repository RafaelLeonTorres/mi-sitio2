// Simulador de API REST. Toma la página que publica Jekyll (_includes/labs/rest-api.html) y la
// vuelve una consola: la barra del token, las opciones, un formulario por operación que envía la
// petición a la API simulada y la respuesta con su recorrido por el pipeline.

import { addCopyButton, type TextClipboard } from '../shared/copy';
import { h, required } from '../shared/dom';
import { formatNumber, pageLang } from '../shared/format';
import { kitStrings, readJson } from '../shared/i18n';
import { announce } from '../shared/live';
import { initTabs } from '../shared/tabs';
import { createApi, statusLine, type Api } from './api';
import type { ApiRequest, Method } from './http';
import { createKey } from './jwt';
import { seedFrom, type PageData, type TabId } from './page';
import { showExchange, type ResponseContext } from './response';
import { claimOf, createTokenBar, type TokenBar } from './token-bar';
import { fill } from './validation';

export interface LabOptions {
  /** El reloj, en milisegundos; las pruebas lo controlan. */
  readonly clock?: () => number;
  /** La llave de los tokens; si no se da, se crea una nueva para esta visita. */
  readonly key?: CryptoKey;
  readonly randomHex?: (length: number) => string;
  readonly clipboard?: TextClipboard | null;
}

export interface RestApiLab {
  readonly api: Api;
  /** Espera a que terminen las peticiones que dejaron los clics; las pruebas lo usan. */
  idle(): Promise<void>;
}

const METHODS: readonly Method[] = ['GET', 'POST', 'PUT', 'DELETE'];
const JSON_TYPE = 'application/json';

/**
 * Arranca la consola sobre `.api-app`. Sin Web Crypto (por ejemplo, fuera de HTTPS) no hay
 * tokens, así que la página se queda como documentación y devuelve `null`.
 */
export async function startRestApiLab(
  root: HTMLElement,
  options: LabOptions = {},
): Promise<RestApiLab | null> {
  const doc = root.ownerDocument;
  const kit = kitStrings(doc);
  const clipboard =
    options.clipboard === undefined ? (navigator.clipboard ?? null) : options.clipboard;

  // Las pestañas de código, Copiar y los enlaces a una operación sirven aunque falte la consola.
  for (const pre of root.querySelectorAll<HTMLElement>('pre')) addCopyButton(pre, kit, clipboard);
  for (const tablist of root.querySelectorAll<HTMLElement>('.api-section [role="tablist"]')) {
    codeTabs(tablist);
  }
  openFromHash(doc);
  doc.defaultView?.addEventListener('hashchange', () => openFromHash(doc));

  let key: CryptoKey;
  try {
    key = options.key ?? (await createKey());
  } catch {
    return null;
  }

  const data = readJson<PageData>('api-data', doc);
  const { client } = data;
  const lang = pageLang(doc.documentElement.lang);
  const clock = options.clock ?? (() => Date.now());
  const failure = required<HTMLInputElement>('.api-failure', root);
  const api = createApi({
    seed: seedFrom(data),
    messages: client.messages,
    key,
    clock,
    failing: () => failure.checked,
    ...(options.randomHex ? { randomHex: options.randomHex } : {}),
  });

  const work = new Set<Promise<unknown>>();
  const track = (promise: Promise<unknown>) => {
    work.add(promise);
    const done = () => work.delete(promise);
    promise.then(done, (error: unknown) => {
      done();
      console.error(error);
    });
  };

  const tokenSection = required('.api-token', root);
  const roleNames = new Map(
    [...tokenSection.querySelectorAll<HTMLInputElement>('input[name="api-role"]')].map((radio) => [
      radio.value,
      radio.nextElementSibling?.textContent?.trim() || radio.value,
    ]),
  );
  const roleName = (role: string) => roleNames.get(role) ?? role;
  const tokenBar = createTokenBar(tokenSection, {
    api,
    strings: client.token,
    clock,
    roleName,
    track,
    request: (role) =>
      api.send({
        method: 'POST',
        url: '/api/auth/token',
        headers: { Accept: JSON_TYPE, 'Content-Type': JSON_TYPE },
        body: JSON.stringify({ role }),
      }),
  });
  tokenSection.hidden = false;

  const optionsRow = required('.api-options', root);
  const optionsStatus = required('.api-options-status', optionsRow);
  required('[data-action="reset"]', optionsRow).addEventListener('click', () => {
    api.reset();
    optionsStatus.textContent = client.reset_done;
    announce(client.reset_done, doc);
  });
  optionsRow.hidden = false;

  const context = { client, kit, lang, clipboard, roleName };
  for (const item of root.querySelectorAll<HTMLElement>('.api-op[data-op]')) {
    operation(item, { api, tokenBar, track, context });
  }
  root.dataset['enhanced'] = '';

  return {
    api,
    idle: async () => {
      while (work.size > 0) await Promise.all([...work]);
    },
  };
}

interface OperationDeps {
  readonly api: Api;
  readonly tokenBar: TokenBar;
  readonly track: (work: Promise<unknown>) => void;
  readonly context: Omit<ResponseContext, 'prefix' | 'tab' | 'onTab'>;
}

/** Conecta el formulario de una operación con la API y con su respuesta. */
function operation(item: HTMLElement, deps: OperationDeps): void {
  const { api, tokenBar, track, context } = deps;
  const { client, lang } = context;
  const doc = item.ownerDocument;
  const id = item.dataset['op'] ?? '';
  const method = METHODS.find((candidate) => candidate === item.dataset['method']);
  if (!method) throw new Error(`La operación ${id} no tiene un método conocido.`);
  const template = item.dataset['path'] ?? '';
  const form = required<HTMLFormElement>('form.api-form', item);
  const body = form.querySelector<HTMLTextAreaElement>('textarea[name="body"]');
  const useToken = form.querySelector<HTMLInputElement>('input[name="useToken"]');

  // El aviso de JSON inválido no impide enviar: así se ve el 400 que respondería la API.
  const warning = form.querySelector<HTMLElement>('.api-json-error');
  if (body && warning) {
    warning.id = `${id}-json-error`;
    warning.textContent = client.json_error;
    const check = () => {
      const valid = isJson(body.value);
      warning.hidden = valid;
      if (valid) {
        body.removeAttribute('aria-invalid');
        body.removeAttribute('aria-describedby');
      } else {
        body.setAttribute('aria-invalid', 'true');
        body.setAttribute('aria-describedby', warning.id);
      }
    };
    body.addEventListener('input', check);
    check();
  }

  const response = h('section', {
    class: 'api-response',
    'aria-label': client.lanes.response,
    hidden: true,
  });
  required('.api-op-main', item).after(response);

  let sequence = 0;
  let tab: TabId = 'body';
  const request = (): ApiRequest => {
    let path = template;
    const query = new URLSearchParams();
    for (const input of form.querySelectorAll<HTMLInputElement>('input.api-input')) {
      const value = input.value.trim();
      if (input.dataset['in'] === 'route')
        path = path.replace(`{${input.name}}`, encodeURIComponent(value));
      else if (value !== '') query.set(input.name, value);
    }
    const search = query.toString();
    const headers: Record<string, string> = { Accept: JSON_TYPE };
    if (body) headers['Content-Type'] = JSON_TYPE;
    if (useToken?.checked && tokenBar.value) headers['Authorization'] = `Bearer ${tokenBar.value}`;
    return {
      method,
      url: search ? `${path}?${search}` : path,
      headers,
      ...(body ? { body: body.value } : {}),
    };
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const current = ++sequence;
    const sent = request();
    track(
      (async () => {
        const exchange = await api.send(sent);
        // Si se envió otra vez mientras tanto, se queda la respuesta más reciente.
        if (current !== sequence) return;
        response.hidden = false;
        showExchange(response, exchange, {
          ...context,
          prefix: id,
          tab,
          onTab: (next) => (tab = next),
        });
        const { status } = exchange.response;
        announce(
          fill(client.announce, {
            status: statusLine(status),
            time: formatNumber(exchange.ms, lang, 2),
          }),
          doc,
        );
        const accessToken = claimOf(exchange.response.body, 'accessToken');
        if (id === 'token' && status === 200 && typeof accessToken === 'string') {
          await tokenBar.set(accessToken);
        }
      })(),
    );
  });
  form.hidden = false;
}

/** Las pestañas del código del pipeline y del modelo: sin JavaScript se ven todos seguidos. */
function codeTabs(tablist: HTMLElement): void {
  const doc = tablist.ownerDocument;
  for (const tab of tablist.querySelectorAll<HTMLElement>('[role="tab"]')) {
    const panel = doc.getElementById(tab.getAttribute('aria-controls') ?? '');
    if (!panel) continue;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.querySelector('.api-code-name')?.classList.add('visually-hidden');
  }
  tablist.hidden = false;
  initTabs(tablist);
}

/** Un enlace como #op-create abre esa operación. */
function openFromHash(doc: Document): void {
  const id = decodeURIComponent(doc.location.hash.slice(1));
  if (!id.startsWith('op-')) return;
  const details = doc.getElementById(id)?.querySelector('details');
  if (details) details.open = true;
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
