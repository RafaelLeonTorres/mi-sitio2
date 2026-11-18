// La barra del token de demostración: pide un JWT para un rol y muestra su estado (vigente con la
// cuenta regresiva, vencido, alterado o mal formado). También deja verlo decodificado, vencerlo y
// cambiar su contenido sin volver a firmarlo, para ver cómo lo rechaza la API.

import { h, required } from '../shared/dom';
import { highlightInto } from '../shared/highlight';
import { announce } from '../shared/live';
import { statusLine, type Api, type Exchange } from './api';
import { decode, withPayloadText, type Verified } from './jwt';
import type { TokenStrings } from './page';
import { ROLES, fill, type Role } from './validation';

export interface TokenBar {
  /** El token que se envía con "Usar token", o `null` si todavía no hay uno. */
  readonly value: string | null;
  /** Pone un token nuevo, de la barra o de la operación POST /api/auth/token. */
  set(token: string): Promise<void>;
}

export interface TokenBarOptions {
  readonly api: Api;
  readonly strings: TokenStrings;
  readonly clock: () => number;
  /** El nombre de un rol en el idioma de la página (Reader → Lector). */
  readonly roleName: (role: string) => string;
  /** Pide el token como cualquier cliente: POST /api/auth/token, por todo el pipeline. */
  readonly request: (role: Role) => Promise<Exchange>;
  /** Registra el trabajo asíncrono de cada clic, para que las pruebas lo esperen. */
  readonly track: (work: Promise<unknown>) => void;
}

const VISIBLE = 10;

/** Un dato del contenido de un token o de un cuerpo JSON, si es un objeto. */
export function claimOf(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[name]
    : undefined;
}

/** Los segundos que faltan como minutos y segundos: 299 → "4:59". */
export function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function createTokenBar(section: HTMLElement, options: TokenBarOptions): TokenBar {
  const { api, strings, clock, roleName, track } = options;
  const doc = section.ownerDocument;
  const radios = [...section.querySelectorAll<HTMLInputElement>('input[name="api-role"]')];
  const value = required('.api-token-value', section);
  const status = required('.api-token-status', section);
  const message = required('.api-token-message', section);
  const view = required<HTMLButtonElement>('[data-action="view"]', section);
  const expire = required<HTMLButtonElement>('[data-action="expire"]', section);
  const decoded = required('.api-token-decoded', section);
  const header = required('.api-token-header', section);
  const payload = required<HTMLTextAreaElement>('textarea', decoded);

  let token: string | null = null;
  let version = 0;
  let expiresAt = 0;
  let role = '';
  let timer: ReturnType<typeof setInterval> | undefined;

  const selected = (): Role =>
    ROLES.find((item) => radios.some((radio) => radio.checked && radio.value === item)) ?? 'Editor';
  const show = (text: string, tone: 'ok' | 'bad' | 'none') => {
    status.textContent = text;
    status.dataset['tone'] = tone;
  };
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
  };
  const tick = () => {
    const left = expiresAt - Math.floor(clock() / 1000);
    if (left > 0) {
      show(fill(strings.valid, { role, time: countdown(left) }), 'ok');
      return;
    }
    stop();
    show(fill(strings.expired, { role }), 'bad');
  };

  const verdict = (verified: Verified, claims: unknown) => {
    const claimed = verified.ok ? verified.claims.role : claimOf(claims, 'role');
    role = typeof claimed === 'string' ? roleName(claimed) : '?';
    if (verified.ok) {
      expiresAt = verified.claims.exp;
      tick();
      if (expiresAt > Math.floor(clock() / 1000)) timer = setInterval(tick, 1000);
    } else if (verified.reason === 'expired') {
      show(fill(strings.expired, { role }), 'bad');
    } else if (verified.reason === 'malformed') {
      show(strings.malformed, 'bad');
    } else {
      // Un contenido cambiado a mano ya no coincide con la firma (emisor y audiencia van después).
      show(fill(strings.tampered, { role }), 'bad');
    }
  };

  /** Muestra el token; `text` conserva lo que se escribió en el editor del contenido. */
  const set = async (next: string, text?: string) => {
    token = next;
    const current = ++version;
    stop();
    message.hidden = true;
    const [head = '', body = '', signature = ''] = next.split('.');
    const short = (part: string) => (part.length > VISIBLE ? `${part.slice(0, VISIBLE)}…` : part);
    value.replaceChildren(
      h('span', { class: 'api-jwt-header' }, [short(head)]),
      '.',
      h('span', { class: 'api-jwt-payload' }, [short(body)]),
      '.',
      h('span', { class: 'api-jwt-signature' }, [short(signature)]),
    );
    value.title = next;
    view.disabled = false;
    expire.disabled = false;

    const parts = decode(next);
    // El encabezado no cambia al editar el contenido; si el token quedó mal formado, se conserva.
    if (parts) highlightInto(header, 'json', JSON.stringify(parts.header, null, 2));
    payload.value = text ?? (parts ? JSON.stringify(parts.payload, null, 2) : '');

    const verified = await api.inspect(next);
    if (current === version) verdict(verified, parts?.payload);
  };

  const getToken = async () => {
    const wanted = selected();
    message.hidden = true;
    const exchange = await options.request(wanted);
    const accessToken = claimOf(exchange.response.body, 'accessToken');
    if (exchange.response.status === 200 && typeof accessToken === 'string') {
      await set(accessToken);
      announce(fill(strings.got, { role: roleName(wanted) }), doc);
      return;
    }
    // Hasta el token pasa por el límite de peticiones y por la falla simulada.
    message.textContent = statusLine(exchange.response.status);
    message.hidden = false;
    announce(message.textContent, doc);
  };

  required('[data-action="token"]', section).addEventListener('click', () => track(getToken()));

  view.addEventListener('click', () => {
    const open = decoded.hidden;
    decoded.hidden = !open;
    view.setAttribute('aria-expanded', String(open));
    view.textContent = (open ? view.dataset['labelHide'] : view.dataset['labelView']) ?? '';
  });

  expire.addEventListener('click', () =>
    track(
      (async () => {
        const claimed = token ? claimOf(decode(token)?.payload, 'role') : undefined;
        const who = ROLES.find((item) => item === claimed) ?? selected();
        await set(await api.issue(who, Math.floor(clock() / 1000) - 1));
        announce(status.textContent ?? '', doc);
      })(),
    ),
  );

  required('[data-action="apply"]', decoded).addEventListener('click', () =>
    track(
      (async () => {
        if (!token) return;
        const text = payload.value;
        let compact = text;
        try {
          compact = JSON.stringify(JSON.parse(text));
        } catch {
          // Se manda tal cual: la API lo verá como un token mal formado.
        }
        await set(withPayloadText(token, compact), text);
        announce(status.textContent ?? '', doc);
      })(),
    ),
  );

  return {
    get value() {
      return token;
    },
    set: (next) => set(next),
  };
}
