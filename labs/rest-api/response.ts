// La respuesta de una petición en la consola: la línea de estado, el recorrido por el pipeline
// (la petición de ida y la respuesta de vuelta, que regresa por los mismos pasos) y las pestañas
// con el cuerpo, los encabezados, el recorrido paso a paso, el registro y el curl.

import { addCopyButton, type TextClipboard } from '../shared/copy';
import { h } from '../shared/dom';
import { formatNumber, type Lang } from '../shared/format';
import { highlightInto } from '../shared/highlight';
import type { KitStrings } from '../shared/i18n';
import { initTabs } from '../shared/tabs';
import { ORIGIN, statusLine, type Exchange, type LogLine, type Step } from './api';
import { toCurl } from './http';
import type { Client, TabId } from './page';
import { fill } from './validation';

export const TABS: readonly TabId[] = ['body', 'headers', 'trace', 'log', 'curl'];

export interface ResponseContext {
  readonly client: Client;
  readonly kit: KitStrings;
  readonly lang: Lang;
  readonly clipboard: TextClipboard | null;
  /** El nombre de un rol en el idioma de la página (Reader → Lector). */
  readonly roleName: (role: string) => string;
  /** El prefijo de los ids de las pestañas: el id de la operación. */
  readonly prefix: string;
  /** La pestaña que se elige al mostrar la respuesta. */
  readonly tab: TabId;
  /** Avisa cuando se elige otra pestaña, para que la siguiente respuesta abra en la misma. */
  readonly onTab: (tab: TabId) => void;
}

// Las notas cuyo dato es un rol o una lista de roles.
const ROLE_NOTES = new Set(['authenticated', 'allowed', 'forbidden', 'issued']);
// Las notas cuyo dato es la razón por la que el token no sirvió.
const REASON_NOTES = new Set(['invalid', 'invalidToken']);

/** La familia del código: 2 para 2xx, 4 para 4xx y 5 para 5xx. */
export const family = (status: number): string => String(Math.floor(status / 100));

/** Lo que pasó en un paso, en el idioma de la página y con su dato sustituido. */
export function stepNote(step: Step, client: Client, roleName: (role: string) => string): string {
  if (step.note === 'skipped') return client.skipped;
  const template = client.steps[step.id].notes[step.note] ?? step.note;
  const raw = step.value ?? '';
  let value = raw;
  if (ROLE_NOTES.has(step.note)) value = raw.split(', ').map(roleName).join(', ');
  if (REASON_NOTES.has(step.note)) value = client.reasons[raw] ?? raw;
  return fill(template, { value });
}

/**
 * El paso que respondió: el que se detuvo o el manejo de excepciones con un 500. Si nadie se
 * detuvo, respondió el endpoint (un 200, 201 o 204).
 */
export function answeringStep(steps: readonly Step[]): number {
  const index = steps.findIndex((step) => step.outcome === 'stopped' || step.outcome === 'handled');
  return index === -1 ? steps.findIndex((step) => step.id === 'endpoint') : index;
}

/** El último paso al que llegó la petición; de ahí regresa la respuesta. */
export function deepestStep(steps: readonly Step[]): number {
  return steps.reduce((last, step, index) => (step.outcome === 'skipped' ? last : index), 0);
}

/** El texto de los encabezados, como los mostraría una herramienta HTTP. */
export function headersText(exchange: Exchange): string {
  const { status, headers } = exchange.response;
  return [
    `HTTP/1.1 ${statusLine(status)}`,
    ...headers.map(([name, value]) => `${name}: ${value}`),
  ].join('\n');
}

/** El registro con el formato de la consola de ASP.NET Core: `info: Categoría[evento]`. */
export function logText(log: readonly LogLine[]): string {
  return log
    .map(({ level, category, eventId, message }) => {
      const lines = message.split('\n').map((line) => `      ${line}`);
      return [`${level}: ${category}[${eventId}]`, ...lines].join('\n');
    })
    .join('\n');
}

/**
 * Muestra el intercambio en `section`, en lugar de la respuesta anterior. La sección debe estar
 * en la página, porque las pestañas buscan sus paneles por id.
 */
export function showExchange(
  section: HTMLElement,
  exchange: Exchange,
  context: ResponseContext,
): void {
  const { client, lang } = context;
  const { status } = exchange.response;
  const notes: HTMLElement[] = [];
  if (exchange.ignored.length > 0) {
    notes.push(
      h('p', { class: 'api-note' }, [fill(client.ignored, { value: exchange.ignored.join(', ') })]),
    );
  }
  if (status >= 500) notes.push(h('p', { class: 'api-note' }, [client.development]));

  const tablist = h(
    'div',
    { class: 'lab-tablist', role: 'tablist', 'aria-label': client.lanes.response },
    TABS.map((tab) =>
      h(
        'button',
        {
          class: 'lab-tab',
          type: 'button',
          role: 'tab',
          id: `${context.prefix}-tab-${tab}`,
          'aria-controls': `${context.prefix}-panel-${tab}`,
          'aria-selected': tab === context.tab ? 'true' : null,
          'data-tab': tab,
        },
        [client.tabs[tab]],
      ),
    ),
  );
  const panels = TABS.map((tab) =>
    h(
      'div',
      {
        class: 'api-panel',
        id: `${context.prefix}-panel-${tab}`,
        role: 'tabpanel',
        'aria-labelledby': `${context.prefix}-tab-${tab}`,
        tabindex: 0,
      },
      panelContent(tab, exchange, context),
    ),
  );

  const track = trackOf(exchange, context);
  section.replaceChildren(
    h('div', { class: 'api-response-head' }, [
      h('p', { class: 'api-response-status', 'data-family': family(status) }, [
        h('strong', {}, [statusLine(status)]),
        h('span', { class: 'api-time' }, [
          fill(client.time, { value: formatNumber(exchange.ms, lang, 2) }),
        ]),
      ]),
      h('p', { class: 'api-response-request' }, [
        h('span', { class: 'api-method', 'data-method': exchange.request.method.toLowerCase() }, [
          exchange.request.method,
        ]),
        h('code', {}, [exchange.request.url]),
      ]),
    ]),
    track,
    ...notes,
    tablist,
    ...panels,
  );

  initTabs(tablist, (tab) => {
    const id = TABS.find((candidate) => candidate === tab.dataset['tab']);
    if (id) context.onTab(id);
  });

  // La petición avanza paso por paso y la respuesta regresa; sin movimiento reducido, se anima.
  const view = section.ownerDocument.defaultView;
  if (typeof view?.requestAnimationFrame === 'function') {
    view.requestAnimationFrame(() =>
      view.requestAnimationFrame(() => track.setAttribute('data-run', '')),
    );
  } else {
    track.setAttribute('data-run', '');
  }
}

/** El recorrido: un carril de ida (la petición) y uno de vuelta (la respuesta) por cada paso. */
function trackOf(exchange: Exchange, context: ResponseContext): HTMLElement {
  const { client } = context;
  const { steps } = exchange;
  const { status } = exchange.response;
  const deepest = deepestStep(steps);
  const answered = answeringStep(steps);
  const stages = steps.map((step, index) => {
    const outcome = client.outcomes[step.outcome];
    const mark = index === answered ? String(status) : step.outcome === 'failed' ? outcome : null;
    const spoken = index === answered ? `${outcome}, ${statusLine(status)}` : outcome;
    return h(
      'li',
      {
        class: 'api-stage',
        'data-outcome': step.outcome,
        'data-reached': index <= deepest,
        style: `--i: ${index}; --back: ${2 * deepest + 1 - index}`,
      },
      [
        h('span', { class: 'api-stage-name' }, [client.steps[step.id].name]),
        mark === null
          ? null
          : h('span', { class: 'api-stage-mark', 'aria-hidden': 'true' }, [mark]),
        h('span', { class: 'visually-hidden' }, [`: ${spoken}.`]),
      ],
    );
  });
  return h(
    'figure',
    {
      class: 'api-track',
      'data-family': family(status),
      'data-animate': '',
      style: `--answered: ${answered}`,
    },
    [
      h('ol', { class: 'api-stages', 'aria-label': client.tabs.trace }, stages),
      h('figcaption', { class: 'api-lanes' }, [
        h('span', { 'data-lane': 'request' }, [client.lanes.request]),
        h('span', { 'data-lane': 'response' }, [client.lanes.response]),
      ]),
    ],
  );
}

function panelContent(tab: TabId, exchange: Exchange, context: ResponseContext): HTMLElement[] {
  const { client, lang } = context;
  switch (tab) {
    case 'body': {
      const { body } = exchange.response;
      if (body === null) return [h('p', { class: 'api-empty' }, [client.no_body])];
      return [
        codeBlock(context, (code) => highlightInto(code, 'json', JSON.stringify(body, null, 2))),
      ];
    }
    case 'headers':
      return [
        codeBlock(context, (code) => {
          const [first = '', ...rest] = headersText(exchange).split('\n');
          code.append(h('span', { class: 'tok-k' }, [first]));
          for (const line of rest) {
            const colon = line.indexOf(':');
            code.append(
              '\n',
              h('span', { class: 'tok-t' }, [line.slice(0, colon)]),
              line.slice(colon),
            );
          }
        }),
      ];
    case 'trace':
      return [
        h(
          'ol',
          { class: 'api-trace' },
          exchange.steps.map((step) =>
            h('li', { 'data-outcome': step.outcome }, [
              h('span', { class: 'api-trace-name' }, [client.steps[step.id].name]),
              h('span', { class: 'api-trace-outcome' }, [
                client.outcomes[step.outcome],
                step.status === undefined
                  ? null
                  : h('span', { class: 'api-status', 'data-family': family(step.status) }, [
                      String(step.status),
                    ]),
              ]),
              h('span', { class: 'api-trace-note' }, [stepNote(step, client, context.roleName)]),
              h('span', { class: 'api-trace-ms' }, [
                step.outcome === 'skipped' ? '' : `${formatNumber(step.ms, lang, 2)} ms`,
              ]),
            ]),
          ),
        ),
      ];
    case 'log':
      return [
        h('p', { class: 'api-caption' }, [
          fill(client.correlation, { value: exchange.correlationId }),
        ]),
        codeBlock(context, (code) => {
          exchange.log.forEach((line, index) => {
            if (index > 0) code.append('\n');
            code.append(
              h('span', { class: `api-log-${line.level}` }, [line.level]),
              `: ${line.category}[${line.eventId}]`,
              ...line.message.split('\n').map((text) => `\n      ${text}`),
            );
          });
        }),
      ];
    case 'curl':
      return [codeBlock(context, (code) => highlightCurl(code, toCurl(exchange.request, ORIGIN)))];
  }
}

/** Un bloque de código con su botón Copiar. */
function codeBlock(context: ResponseContext, write: (code: HTMLElement) => void): HTMLElement {
  const code = h('code');
  write(code);
  const pre = h('pre', {}, [code]);
  const holder = h('div', { class: 'lab-code' }, [pre]);
  addCopyButton(pre, context.kit, context.clipboard);
  return holder;
}

/** curl con color: el comando, sus opciones y los textos entre comillas (con sus '\''). */
function highlightCurl(code: HTMLElement, command: string): void {
  const pattern = /('(?:[^']|'\\'')*')|(^curl\b)|(\s-{1,2}[A-Za-z-]+)/gm;
  let index = 0;
  for (let match = pattern.exec(command); match !== null; match = pattern.exec(command)) {
    if (match.index > index) code.append(command.slice(index, match.index));
    const kind = match[1] !== undefined ? 'tok-s' : match[2] !== undefined ? 'tok-f' : 'tok-k';
    code.append(h('span', { class: kind }, [match[0]]));
    index = match.index + match[0].length;
  }
  if (index < command.length) code.append(command.slice(index));
}
