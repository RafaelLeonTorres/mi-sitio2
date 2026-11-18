// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import source from '../../_data/labs/rest-api.yml?raw';
import { startRestApiLab, type RestApiLab } from './app';
import { sequentialHex } from './fixtures';
import { createKey } from './jwt';

// La consola sobre una página con la misma forma que publica _includes/labs/rest-api.html y con
// los textos reales de _data/labs/rest-api.yml.

interface Operation {
  id: string;
  group: string;
  method: string;
  path: string;
  route?: string[];
  query?: string[];
  roles?: string[];
}

interface Texts {
  token: Record<string, string> & { roles: Record<string, string> };
  operations: { id: string; body?: string }[];
  client: { token: Record<string, string>; reset_done: string; development: string };
}

interface Data {
  shared: { operations: Operation[]; defaults: Record<string, string> };
  es: Texts;
  en: Texts;
}

const data = parse(source) as Data;
const START = Date.UTC(2026, 10, 18, 21, 0, 0);
const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

function operation(op: Operation, texts: Texts): string {
  const body = texts.operations.find((item) => item.id === op.id)?.body;
  const params = [
    ...(op.route ?? []).map((name) => [name, 'route'] as const),
    ...(op.query ?? []).map((name) => [name, 'query'] as const),
  ]
    .map(
      ([name, where]) =>
        `<label class="api-param"><input class="api-input" name="${name}" value="${data.shared.defaults[name] ?? ''}" data-in="${where}"></label>`,
    )
    .join('');
  return `
    <li class="api-op" id="op-${op.id}" data-op="${op.id}" data-method="${op.method}" data-path="${op.path}">
      <details>
        <summary>${op.method} ${op.path}</summary>
        <div class="api-op-body">
          <div class="api-op-main">
            <form class="api-form" hidden novalidate>
              ${params}
              ${body === undefined ? '' : `<textarea class="api-editor" name="body">${escape(body)}</textarea><p class="api-json-error" hidden></p>`}
              <input type="checkbox" name="useToken"${op.roles ? ' checked' : ''}>
              <button type="submit">Enviar</button>
            </form>
          </div>
          <div class="api-endpoint"><div class="highlight"><pre><code>app.MapGet();</code></pre></div></div>
        </div>
      </details>
    </li>`;
}

function page(lang: 'es' | 'en'): string {
  const texts = data[lang];
  const { token } = texts;
  const roles = ['Reader', 'Editor', 'Admin']
    .map(
      (role) =>
        `<label><input type="radio" name="api-role" value="${role}"${role === 'Editor' ? ' checked' : ''}><span>${token.roles[role]}</span></label>`,
    )
    .join('');
  return `
    <script type="application/json" id="lab-ui">{"copy_label": "Copiar", "copied": "Copiado", "copy_failed": "No se pudo copiar"}</script>
    <div class="api-app">
      <script type="application/json" id="api-data">${JSON.stringify({ shared: data.shared, client: texts.client })}</script>
      <section class="api-token" hidden>
        <div class="lab-segmented">${roles}</div>
        <button type="button" data-action="token">${token['get']}</button>
        <p><code class="api-token-value">${token['none']}</code><span class="api-token-status"></span><span class="api-token-message" hidden></span></p>
        <button type="button" data-action="view" aria-expanded="false" data-label-view="${token['view']}" data-label-hide="${token['hide']}" disabled>${token['view']}</button>
        <button type="button" data-action="expire" disabled>${token['expire']}</button>
        <div class="api-token-decoded" hidden>
          <pre><code class="api-token-header"></code></pre>
          <textarea id="api-token-payload"></textarea>
          <button type="button" data-action="apply">${token['apply']}</button>
        </div>
      </section>
      <div class="api-options" hidden>
        <input type="checkbox" class="api-failure">
        <button type="button" data-action="reset">Restablecer</button>
        <span class="api-options-status"></span>
      </div>
      <ul class="api-ops">${data.shared.operations.map((op) => operation(op, texts)).join('')}</ul>
      <section class="api-section">
        <div class="lab-tablist" role="tablist" hidden>
          <button role="tab" id="tab-pipeline-1" aria-controls="pipeline-1">Program.cs</button>
          <button role="tab" id="tab-pipeline-2" aria-controls="pipeline-2">Authentication.cs</button>
        </div>
        <div class="api-code-panel" id="pipeline-1"><h3 class="api-code-name">Program.cs</h3></div>
        <div class="api-code-panel" id="pipeline-2"><h3 class="api-code-name">Authentication.cs</h3></div>
      </section>
    </div>`;
}

interface Console {
  lab: RestApiLab;
  wait(ms: number): void;
  click(selector: string): Promise<void>;
  send(op: string): Promise<HTMLElement>;
}

async function start(lang: 'es' | 'en' = 'es', hash = ''): Promise<Console> {
  history.replaceState(null, '', `/${hash}`);
  document.documentElement.lang = lang;
  document.body.innerHTML = page(lang);
  let now = START;
  const lab = await startRestApiLab(element('.api-app'), {
    clock: () => now,
    key: await createKey(new Uint8Array(32).fill(5)),
    randomHex: sequentialHex(),
    clipboard: null,
  });
  if (!lab) throw new Error('la consola no arrancó');
  const click = async (selector: string) => {
    element(selector).click();
    await lab.idle();
  };
  return {
    lab,
    wait: (ms) => (now += ms),
    click,
    send: async (op) => {
      await click(`#op-${op} button[type="submit"]`);
      return element(`#op-${op} .api-response`);
    },
  };
}

function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`falta ${selector}`);
  return found;
}

const text = (selector: string) => element(selector).textContent?.trim() ?? '';
const stage = (response: HTMLElement, index: number) =>
  response.querySelectorAll<HTMLElement>('.api-stage')[index];
const live = () => document.getElementById('lab-live')?.textContent?.trim() ?? '';
const strings = data.es.client.token;

describe('consola de la API', () => {
  it('muestra la barra del token, las opciones y los formularios', async () => {
    await start();
    expect(element('.api-token').hidden).toBe(false);
    expect(element('.api-options').hidden).toBe(false);
    expect(element('#op-create form').hidden).toBe(false);
    expect(element('.api-app').dataset['enhanced']).toBe('');
    expect(element('#op-create .api-response').hidden).toBe(true);
  });

  it('sin token, crear responde 401 desde autorización y lo anuncia', async () => {
    const c = await start();
    const response = await c.send('create');
    expect(response.hidden).toBe(false);
    expect(text('#op-create .api-response-status strong')).toBe('401 Unauthorized');
    expect(stage(response, 5)?.dataset['outcome']).toBe('stopped');
    expect(stage(response, 5)?.querySelector('.api-stage-mark')?.textContent).toBe('401');
    expect(stage(response, 6)?.hasAttribute('data-reached')).toBe(false);
    expect(live()).toContain('401 Unauthorized');
  });

  it('Obtener token pone un token vigente del rol elegido', async () => {
    const c = await start();
    await c.click('.api-token [data-action="token"]');
    expect(text('.api-token-status')).toBe('Editor, vence en 5:00');
    expect(element('.api-token-status').dataset['tone']).toBe('ok');
    expect(element('.api-token-value').querySelectorAll('span')).toHaveLength(3);
    expect(element<HTMLButtonElement>('[data-action="view"]').disabled).toBe(false);
    expect(live()).toBe('Token de Editor listo.');
    const response = await c.send('create');
    expect(text('#op-create .api-response-status strong')).toBe('201 Created');
    expect(response.querySelector('#create-panel-headers')?.textContent).toContain(
      'Location: /api/products/26',
    );
  });

  it('el JSON inválido avisa, pero se envía y responde 400 desde la validación', async () => {
    const c = await start();
    await c.click('.api-token [data-action="token"]');
    const body = element<HTMLTextAreaElement>('#op-create textarea');
    body.value = '{ "name": ';
    body.dispatchEvent(new Event('input'));
    expect(element('#op-create .api-json-error').hidden).toBe(false);
    expect(body.getAttribute('aria-invalid')).toBe('true');
    const response = await c.send('create');
    expect(text('#op-create .api-response-status strong')).toBe('400 Bad Request');
    expect(stage(response, 6)?.dataset['outcome']).toBe('stopped');
    expect(response.querySelector('.api-trace')?.textContent).toContain('El cuerpo no es JSON.');
  });

  it('un Lector no puede borrar: 403, con el rol en su idioma', async () => {
    const c = await start();
    element<HTMLInputElement>('input[value="Reader"]').checked = true;
    await c.click('.api-token [data-action="token"]');
    expect(text('.api-token-status')).toBe('Lector, vence en 5:00');
    const response = await c.send('delete');
    expect(text('#op-delete .api-response-status strong')).toBe('403 Forbidden');
    expect(response.querySelector('.api-trace')?.textContent).toContain('Token válido de Lector.');
  });

  it('Vencer deja el token vencido y la API dice por qué lo rechaza', async () => {
    const c = await start();
    await c.click('.api-token [data-action="token"]');
    await c.click('.api-token [data-action="expire"]');
    expect(text('.api-token-status')).toBe('Editor, vencido');
    expect(element('.api-token-status').dataset['tone']).toBe('bad');
    const response = await c.send('update');
    expect(text('#op-update .api-response-status strong')).toBe('401 Unauthorized');
    expect(response.querySelector('#update-panel-headers')?.textContent).toContain(
      'error_description="The token expired at',
    );
  });

  it('con el reloj, el token vigente también vence', async () => {
    const c = await start();
    await c.click('.api-token [data-action="token"]');
    c.wait(5 * 60 * 1000);
    await c.send('create');
    expect(text('#op-create .api-response-status strong')).toBe('401 Unauthorized');
  });

  it('cambiar el contenido sin volver a firmar deja el token alterado', async () => {
    const c = await start();
    await c.click('.api-token [data-action="token"]');
    await c.click('.api-token [data-action="view"]');
    expect(element('.api-token-decoded').hidden).toBe(false);
    expect(text('[data-action="view"]')).toBe(data.es.token['hide']);
    const payload = element<HTMLTextAreaElement>('#api-token-payload');
    expect(payload.value).toContain('"role": "Editor"');
    payload.value = payload.value.replace('"Editor"', '"Admin"');
    await c.click('[data-action="apply"]');
    expect(text('.api-token-status')).toBe(strings['tampered']?.replace('{role}', 'Admin'));
    const response = await c.send('delete');
    expect(text('#op-delete .api-response-status strong')).toBe('401 Unauthorized');
    expect(response.querySelector('.api-trace')?.textContent).toContain('la firma no coincide');
  });

  it('un contenido que no es JSON deja el token mal formado', async () => {
    const c = await start();
    await c.click('.api-token [data-action="token"]');
    element<HTMLTextAreaElement>('#api-token-payload').value = '{ "role": ';
    await c.click('[data-action="apply"]');
    expect(text('.api-token-status')).toBe(strings['malformed']);
  });

  it('la operación del token también pone el token en la barra', async () => {
    const c = await start();
    const body = element<HTMLTextAreaElement>('#op-token textarea');
    body.value = '{ "role": "Admin" }';
    await c.send('token');
    expect(text('#op-token .api-response-status strong')).toBe('200 OK');
    expect(text('.api-token-status')).toBe('Admin, vence en 5:00');
  });

  it('la falla simulada responde 500 desde el manejo de excepciones', async () => {
    const c = await start();
    element<HTMLInputElement>('.api-failure').checked = true;
    const response = await c.send('list');
    expect(text('#op-list .api-response-status strong')).toBe('500 Internal Server Error');
    expect(stage(response, 0)?.querySelector('.api-stage-mark')?.textContent).toBe('500');
    expect(stage(response, 8)?.dataset['outcome']).toBe('failed');
    expect(response.querySelector('.api-note')?.textContent).toBe(data.es.client.development);
  });

  it('un id que no existe llega al repositorio y responde 404 desde el servicio', async () => {
    const c = await start();
    element<HTMLInputElement>('#op-get input[name="id"]').value = '99';
    const response = await c.send('get');
    expect(text('#op-get .api-response-status strong')).toBe('404 Not Found');
    expect(stage(response, 8)?.querySelector('.api-stage-mark')?.textContent).toBe('404');
    expect(stage(response, 9)?.hasAttribute('data-reached')).toBe(true);
    element<HTMLInputElement>('#op-get input[name="id"]').value = 'abc';
    const noRoute = await c.send('get');
    expect(stage(noRoute, 2)?.dataset['outcome']).toBe('stopped');
  });

  it('la respuesta siguiente abre en la pestaña que se eligió', async () => {
    const c = await start();
    await c.send('list');
    await c.click('#list-tab-trace');
    expect(element('#list-panel-trace').hidden).toBe(false);
    await c.send('list');
    expect(element('#list-tab-trace').getAttribute('aria-selected')).toBe('true');
    expect(element('#list-panel-body').hidden).toBe(true);
  });

  it('Restablecer vuelve al catálogo inicial', async () => {
    const c = await start();
    await c.click('.api-token [data-action="token"]');
    await c.send('create');
    expect(c.lab.api.store.list(1, 50, '').total).toBe(26);
    await c.click('[data-action="reset"]');
    expect(c.lab.api.store.list(1, 50, '').total).toBe(25);
    expect(text('.api-options-status')).toBe(data.es.client.reset_done);
  });

  it('el curl lleva el token y el cuerpo que se enviaron', async () => {
    const c = await start();
    await c.click('.api-token [data-action="token"]');
    const response = await c.send('create');
    const curl = response.querySelector('#create-panel-curl')?.textContent ?? '';
    expect(curl).toContain("curl -X POST 'https://tienda.example/api/products'");
    expect(curl).toContain("-H 'Authorization: Bearer ey");
    expect(curl).toContain('"sku":"KBD-1006"');
  });

  it('en inglés, los textos de la respuesta salen en inglés', async () => {
    const c = await start('en');
    element<HTMLInputElement>('#op-list input[name="pageSize"]').value = '80';
    const response = await c.send('list');
    expect(response.querySelector('.api-time')?.textContent).toContain('on the server');
    expect(response.querySelector('#list-panel-body')?.textContent).toContain(
      'Must be between 1 and 50.',
    );
  });

  it('las pestañas del pipeline muestran un archivo a la vez', async () => {
    await start();
    expect(element('.api-section [role="tablist"]').hidden).toBe(false);
    expect(element('#pipeline-1').hidden).toBe(false);
    expect(element('#pipeline-2').hidden).toBe(true);
    expect(element('#pipeline-1 .api-code-name').classList.contains('visually-hidden')).toBe(true);
  });

  it('un enlace a una operación la abre', async () => {
    await start('es', '#op-update');
    expect(element<HTMLDetailsElement>('#op-update details').open).toBe(true);
    expect(element<HTMLDetailsElement>('#op-list details').open).toBe(false);
  });
});
