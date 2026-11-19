// Laboratorio de rendimiento SQL. Toma la página que publica Jekyll (_includes/labs/sql.html) y la
// vuelve interactiva: una pestaña por escenario con sus controles, las dos consultas en una
// carrera, un resumen de lo que mide cada una y, para cada lado, el SQL, el plan de ejecución y
// los mensajes de SET STATISTICS IO, TIME ON. Todo se calcula con el modelo de labs/sql/.

import { renderBars, type Bar } from '../shared/bars';
import { addCopyButton, type TextClipboard } from '../shared/copy';
import { h, required } from '../shared/dom';
import { formatDuration, formatNumber, pageLang, type Lang } from '../shared/format';
import { highlightInto } from '../shared/highlight';
import { kitStrings, readJson, type KitStrings } from '../shared/i18n';
import { announce } from '../shared/live';
import { initTabs } from '../shared/tabs';
import {
  controlText,
  fill,
  fillNodes,
  type ClientTexts,
  type MetricId,
  type PageData,
  type ScenarioTexts,
} from './page';
import { nodes, totalCost, type Cache, type PlanNode } from './plan';
import { flowScale, renderPlan, sameShape, type Tone } from './plan-view';
import {
  accessOf,
  cacheOf,
  measureRun,
  type Comparison,
  type Control,
  type QueryRun,
  type RunMeasures,
  type Scenario,
  type ScenarioId,
  type Value,
  type Values,
} from './scenario';
import { SCENARIOS } from './scenarios';
import { script } from './script';
import { fromPosition, STEPS, toPosition } from './slider';
import { statisticsText } from './statistics';

export interface LabOptions {
  readonly clipboard?: TextClipboard | null;
  /** Si se evita la animación; por defecto, lo que pida el sistema (prefers-reduced-motion). */
  readonly reducedMotion?: boolean;
}

export interface SqlLab {
  /** Los valores que tienen ahora los controles de un escenario. */
  values(id: ScenarioId): Values;
}

/** Lo que tarda en llenarse la barra de la consulta más lenta en la carrera. */
export const RACE_MS = 2400;
/** Desde qué diferencia una medida se marca como mejor o peor. */
const TONE_RATIO = 1.25;
/** Por debajo de esta diferencia, las dos tardan "casi lo mismo". */
const SAME_RATIO = 1.1;
/** Desde qué diferencia en la base se marcan los operadores de los planes. */
const PLAN_RATIO = 1.5;

const SIDES = ['a', 'b'] as const;
type Side = (typeof SIDES)[number];
type Measures = Readonly<Record<Side, RunMeasures>>;

interface Context {
  readonly doc: Document;
  readonly kit: KitStrings;
  readonly client: ClientTexts;
  readonly lang: Lang;
  readonly clipboard: TextClipboard | null;
  readonly reduced: boolean;
}

interface ScenarioView {
  readonly values: () => Values;
}

/** Arranca el laboratorio sobre `.sql-app`. */
export function startSqlLab(root: HTMLElement, options: LabOptions = {}): SqlLab {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const data = readJson<PageData>('sql-data', doc);
  const context: Context = {
    doc,
    kit: kitStrings(doc),
    client: data.client,
    lang: pageLang(doc.documentElement.lang),
    clipboard: options.clipboard === undefined ? (navigator.clipboard ?? null) : options.clipboard,
    reduced:
      options.reducedMotion ??
      win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false,
  };

  const views = new Map<ScenarioId, ScenarioView>();
  const sections = [...root.querySelectorAll<HTMLElement>('.sql-scenario[data-scenario]')];
  const ensure = (section: HTMLElement) => {
    const scenario = SCENARIOS.find((item) => item.id === section.dataset['scenario']);
    const texts = data.scenarios.find((item) => item.id === scenario?.id);
    if (!scenario || !texts || views.has(scenario.id)) return;
    views.set(scenario.id, buildScenario(section, scenario, texts, context));
  };

  root.querySelector<HTMLElement>('.sql-nojs')?.setAttribute('hidden', '');
  for (const section of sections) {
    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-labelledby', `tab-${section.id}`);
    required('.sql-static', section).hidden = true;
  }

  const tablist = required('.sql-tabs', root);
  const fromHash = () => sections.find((section) => `#${section.id}` === doc.location.hash);
  const target = fromHash();
  if (target) doc.getElementById(`tab-${target.id}`)?.setAttribute('aria-selected', 'true');
  tablist.hidden = false;
  const select = initTabs(tablist, (tab) => {
    const section = doc.getElementById(tab.getAttribute('aria-controls') ?? '');
    if (!section) return;
    ensure(section);
    if (doc.location.hash !== `#${section.id}`)
      win?.history.replaceState(null, '', `#${section.id}`);
  });
  const visible = sections.find((section) => !section.hidden);
  if (visible) ensure(visible);
  win?.addEventListener('hashchange', () => {
    const section = fromHash();
    const tab = section ? doc.getElementById(`tab-${section.id}`) : null;
    if (tab) select(tab);
  });
  root.dataset['enhanced'] = '';

  return {
    values: (id) => views.get(id)?.values() ?? scenarioById(id).defaults,
  };
}

function scenarioById(id: ScenarioId): Scenario {
  const found = SCENARIOS.find((item) => item.id === id);
  if (!found) throw new Error(`No hay un escenario ${id}.`);
  return found;
}

/** Los controles y los resultados de un escenario, dentro de su `.sql-live`. */
function buildScenario(
  section: HTMLElement,
  scenario: Scenario,
  texts: ScenarioTexts,
  context: Context,
): ScenarioView {
  const { client } = context;
  const state: Record<string, Value> = { ...scenario.defaults };
  const live = required('.sql-live', section);
  live.hidden = false;

  const bars = h('ul', { class: 'lab-bars sql-bars' });
  const verdict = h('div', { class: 'sql-verdict' });
  const summary = h('table', { class: 'sql-summary' });
  const columns = h('div', { class: 'sql-columns' });
  const runButton = h(
    'button',
    { class: 'lab-button lab-button-primary sql-run', type: 'button' },
    [client.run],
  );

  const fields = scenario.controls.map((control) =>
    buildControl(control, scenario.id, texts, state, context, (final) => update(final)),
  );
  live.replaceChildren(
    h('div', { class: 'sql-toolbar' }, [
      h(
        'div',
        { class: 'sql-controls' },
        fields.map((field) => field.element),
      ),
      runButton,
    ]),
    h('div', { class: 'sql-overview' }, [
      h('div', { class: 'sql-race' }, [
        bars,
        verdict,
        h('p', { class: 'sql-disclaimer' }, [client.disclaimer]),
      ]),
      h('div', { class: 'sql-summary-wrap' }, [summary]),
    ]),
    h('p', { class: 'sql-plan-hint' }, [client.plan_hint]),
    columns,
  );

  let current = render();

  function render(): { comparison: Comparison; measures: Measures } {
    for (const field of fields) field.sync();
    const comparison = scenario.run(state);
    const cache = cacheOf(state);
    const measures: Measures = {
      a: measureRun(comparison.a, cache),
      b: measureRun(comparison.b, cache),
    };
    renderBars(bars, raceBars(measures, context.lang));
    verdict.replaceChildren(
      ...verdictLines(comparison, measures, context).map((text) => h('p', {}, [text])),
    );
    renderSummary(summary, comparison, measures, cache, context);
    renderColumns(columns, comparison, measures, cache, texts, section, context);
    for (const note of section.querySelectorAll<HTMLElement>('.sql-note[data-note]')) {
      note.hidden = !comparison.notes.includes(note.dataset['note'] ?? '');
    }
    return { comparison, measures };
  }

  function update(final: boolean): void {
    current = render();
    if (final) announce(announcement(current.comparison, current.measures, context), context.doc);
  }

  runButton.addEventListener('click', () => {
    current = render();
    race(bars, context);
    announce(announcement(current.comparison, current.measures, context), context.doc);
  });

  return { values: () => ({ ...state }) };
}

interface Field {
  readonly element: HTMLElement;
  /** Muestra u oculta el control según `when` y ajusta lo que dependa de otros (el máximo). */
  sync(): void;
}

function buildControl(
  control: Control,
  scenarioId: ScenarioId,
  texts: ScenarioTexts,
  state: Record<string, Value>,
  context: Context,
  changed: (final: boolean) => void,
): Field {
  const { client, lang } = context;
  const text = controlText(client, texts, control.id);
  const name = `sql-${scenarioId}-${control.id}`;
  const visible = () =>
    Object.entries(control.when ?? {}).every(([key, value]) => state[key] === value);

  if (control.kind === 'toggle') {
    const input = h('input', { type: 'checkbox', name });
    input.checked = state[control.id] === true;
    input.addEventListener('change', () => {
      state[control.id] = input.checked;
      changed(true);
    });
    const element = h('label', { class: 'sql-check', 'data-control': control.id }, [
      input,
      h('span', {}, [text.label]),
    ]);
    return { element, sync: () => (element.hidden = !visible()) };
  }

  if (control.kind === 'range') {
    const id = `${name}-input`;
    const log = control.scale === 'log';
    const maxOf = () => (typeof control.max === 'function' ? control.max(state) : control.max);
    const input = h('input', { type: 'range', id, step: log ? 1 : control.step });
    const output = h('output', { for: id });
    const show = () => {
      const max = maxOf();
      const value = Math.min(max, Math.max(control.min, Number(state[control.id])));
      state[control.id] = value;
      input.min = String(log ? 0 : control.min);
      input.max = String(log ? STEPS : max);
      // Mientras se arrastra, el deslizador ya está en una posición que da este valor.
      const shown = log ? fromPosition(input.valueAsNumber, max) : input.valueAsNumber;
      if (shown !== value) input.value = String(log ? toPosition(value, max) : value);
      const label = fill(text.format ?? '{value}', {
        value: formatNumber(value, lang),
        total: formatNumber(max, lang),
      });
      output.value = label;
      input.setAttribute('aria-valuetext', label);
    };
    input.addEventListener('input', () => {
      const position = input.valueAsNumber;
      state[control.id] = log ? fromPosition(position, maxOf()) : position;
      changed(false);
    });
    input.addEventListener('change', () => changed(true));
    const element = h('div', { class: 'lab-field sql-range', 'data-control': control.id }, [
      h('label', { class: 'lab-label', for: id }, [text.label]),
      h('div', { class: 'lab-range-row' }, [input, output]),
    ]);
    return {
      element,
      sync: () => {
        element.hidden = !visible();
        show();
      },
    };
  }

  // select (números) y choice (textos): un control segmentado con un radio por opción.
  const options =
    control.kind === 'select'
      ? control.options.map((value) => ({
          value: String(value),
          label: fill(text.format ?? '{value}', { value: formatNumber(value, lang, 1) }),
        }))
      : control.options.map((value) => ({ value, label: text.options?.[value] ?? value }));
  const inputs = options.map((option) => {
    const input = h('input', { type: 'radio', name, value: option.value });
    input.checked = String(state[control.id]) === option.value;
    input.addEventListener('change', () => {
      if (!input.checked) return;
      state[control.id] = control.kind === 'select' ? Number(option.value) : option.value;
      changed(true);
    });
    return h('label', {}, [input, h('span', {}, [option.label])]);
  });
  const element = h('fieldset', { class: 'lab-field', 'data-control': control.id }, [
    h('legend', {}, [text.label]),
    h('div', { class: 'lab-segmented' }, inputs),
  ]);
  return { element, sync: () => (element.hidden = !visible()) };
}

/** Las dos barras de la carrera, con el lado lento en rojo y el rápido en verde. */
function raceBars(measures: Measures, lang: Lang): Bar[] {
  return SIDES.map((side) => {
    const mine = measures[side].totalMs;
    const other = measures[side === 'a' ? 'b' : 'a'].totalMs;
    const tone = toneOf(mine, other);
    const bar: Bar = { label: side.toUpperCase(), value: mine, text: formatDuration(mine, lang) };
    return tone ? { ...bar, tone } : bar;
  });
}

/** 'bad' si `mine` es claramente mayor que `other`, 'good' si es claramente menor. */
function toneOf(mine: number, other: number): Tone | undefined {
  if (mine > other * TONE_RATIO) return 'bad';
  if (other > mine * TONE_RATIO) return 'good';
  return undefined;
}

/** Llena las barras desde cero, cada una en proporción a lo que tarda su consulta. */
function race(list: HTMLElement, context: Context): void {
  if (context.reduced) return;
  const fills = [...list.querySelectorAll<HTMLElement>('.lab-bar-fill')];
  const targets = fills.map((fill) => Number(fill.style.getPropertyValue('--w')) || 0);
  list.classList.add('is-racing');
  // Propiedades sueltas y no el atajo `transition`: jsdom (las pruebas) no lo desarma.
  for (const fill of fills) {
    fill.style.transitionProperty = 'none';
    fill.style.setProperty('--w', '0');
  }
  void list.offsetWidth;
  fills.forEach((fill, index) => {
    const target = targets[index] ?? 0;
    const bar = fill.closest('.lab-bar');
    fill.style.transitionProperty = 'width';
    fill.style.transitionDuration = `${Math.max(80, Math.round(target * RACE_MS))}ms`;
    fill.style.transitionTimingFunction = 'linear';
    fill.style.setProperty('--w', String(target));
    fill.addEventListener('transitionend', () => bar?.classList.add('is-done'), { once: true });
  });
  setTimeout(() => {
    list.classList.remove('is-racing');
    for (const bar of list.querySelectorAll('.lab-bar')) bar.classList.remove('is-done');
    for (const fill of fills) {
      for (const name of [
        'transition-property',
        'transition-duration',
        'transition-timing-function',
      ]) {
        fill.style.removeProperty(name);
      }
    }
  }, RACE_MS + 200);
}

/** Cuántas veces es más rápida una que otra, el uso de memoria y si las filas no coinciden. */
function verdictLines(comparison: Comparison, measures: Measures, context: Context): string[] {
  const { client, lang } = context;
  const lines: string[] = [];
  const a = measures.a.totalMs;
  const b = measures.b.totalMs;
  const ratio = Math.max(a, b) / Math.max(Math.min(a, b), 1e-9);
  lines.push(
    ratio < SAME_RATIO
      ? client.same
      : fill(client.faster, { side: a > b ? 'B' : 'A', value: formatRatio(ratio, lang) }),
  );
  const memoryA = measures.a.memoryBytes;
  const memoryB = measures.b.memoryBytes;
  if (memoryA > 0 && memoryB > 0) {
    const memoryRatio = Math.max(memoryA, memoryB) / Math.min(memoryA, memoryB);
    if (memoryRatio >= TONE_RATIO) {
      lines.push(
        fill(client.memory_less, {
          side: memoryA > memoryB ? 'B' : 'A',
          value: formatRatio(memoryRatio, lang),
        }),
      );
    }
  }
  if (comparison.a.rows !== comparison.b.rows) {
    lines.push(
      fill(client.rows_differ, {
        a: formatNumber(comparison.a.rows, lang),
        b: formatNumber(comparison.b.rows, lang),
      }),
    );
  }
  return lines;
}

function announcement(comparison: Comparison, measures: Measures, context: Context): string {
  return fill(context.client.announce, {
    a: formatDuration(measures.a.totalMs, context.lang),
    b: formatDuration(measures.b.totalMs, context.lang),
    verdict: verdictLines(comparison, measures, context).join(' '),
  });
}

/** 9.6 con un decimal; desde 10, sin decimales: 260. */
export function formatRatio(ratio: number, lang: Lang): string {
  return ratio < 10 ? formatNumber(ratio, lang, 1) : formatNumber(Math.round(ratio), lang);
}

/** Bytes en KB o MB (de 1024), como los muestra un perfilador de memoria. */
export function formatBytes(bytes: number, lang: Lang): string {
  if (bytes >= 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024), lang, 1)} MB`;
  if (bytes >= 1024) return `${formatNumber(bytes / 1024, lang)} KB`;
  return `${formatNumber(bytes, lang)} B`;
}

interface SummaryRow {
  readonly id: MetricId;
  readonly values: readonly [string, string];
  readonly tones?: readonly [Tone | undefined, Tone | undefined];
}

/** La tabla con lo que mide cada lado; en rojo y verde, lo que es claramente peor o mejor. */
function renderSummary(
  table: HTMLTableElement,
  comparison: Comparison,
  measures: Measures,
  cache: Cache,
  context: Context,
): void {
  const { client, lang } = context;
  const rows: SummaryRow[] = [];
  const metric = (
    id: MetricId,
    pick: (m: RunMeasures) => number,
    format: (n: number) => string,
  ) => {
    const a = pick(measures.a);
    const b = pick(measures.b);
    rows.push({ id, values: [format(a), format(b)], tones: [toneOf(a, b), toneOf(b, a)] });
  };
  const time = (ms: number) => formatDuration(ms, lang);
  const count = (n: number) => formatNumber(n, lang);
  const efCore = Boolean(comparison.a.client ?? comparison.b.client);

  metric('total', (m) => m.totalMs, time);
  if (efCore) {
    metric('server', (m) => m.serverMs, time);
    metric('network', (m) => m.networkMs, time);
    metric('client', (m) => m.clientMs, time);
  }
  metric('logical', (m) => m.logicalReads, count);
  if (cache === 'cold') {
    metric('physical', (m) => m.physicalReads, count);
    metric('read_ahead', (m) => m.readAheadReads, count);
  }
  metric('rows_read', (m) => m.rowsRead, count);
  rows.push({ id: 'rows', values: [count(comparison.a.rows), count(comparison.b.rows)] });
  if (efCore || measures.a.roundTrips > 1 || measures.b.roundTrips > 1) {
    metric('trips', (m) => m.roundTrips, count);
  }
  if (efCore)
    metric(
      'memory',
      (m) => m.memoryBytes,
      (n) => formatBytes(n, lang),
    );
  rows.push({
    id: 'access',
    values: [accessText(comparison.a, context), accessText(comparison.b, context)],
  });

  table.replaceChildren(
    h('caption', {}, [client.summary]),
    h('thead', {}, [
      h('tr', {}, [
        h('td', {}),
        ...SIDES.map((side) => h('th', { scope: 'col' }, [side.toUpperCase()])),
      ]),
    ]),
    h(
      'tbody',
      {},
      rows.map((row) =>
        h('tr', { 'data-metric': row.id }, [
          h('th', { scope: 'row' }, [client.metrics[row.id]]),
          ...row.values.map((value, index) =>
            h('td', { 'data-tone': row.tones?.[index] }, [value]),
          ),
        ]),
      ),
    ),
  );
}

/** "Index Seek en IX_Orders_OrderDate": cómo lee la tabla la primera sentencia. */
function accessText(run: QueryRun, context: Context): string {
  const first = run.statements[0];
  const access = first ? accessOf(first.plan) : null;
  if (!access) return '';
  // [Orders].[IX_Orders_OrderDate] → IX_Orders_OrderDate; el plan muestra el nombre completo.
  const index = access.object.split('.').pop()?.replace(/[[\]]/g, '') ?? access.object;
  return fill(context.client.access, { op: access.op, object: index });
}

/** Las dos columnas: el código, el plan y los mensajes de cada lado. */
function renderColumns(
  container: HTMLElement,
  comparison: Comparison,
  measures: Measures,
  cache: Cache,
  texts: ScenarioTexts,
  section: HTMLElement,
  context: Context,
): void {
  const all = SIDES.flatMap((side) =>
    comparison[side].statements.flatMap((statement) => nodes(statement.plan)),
  );
  const flow = flowScale(Math.max(1, ...all.map((node) => node.rows)));
  const tones = planTones(comparison, measures);
  container.replaceChildren(
    ...SIDES.map((side) =>
      renderColumn(side, comparison[side], tones[side], flow, cache, texts, section, context),
    ),
  );
}

/**
 * Cuando una consulta es claramente más lenta en la base y su plan es otro, marca en rojo su
 * operador más costoso y en verde cómo llega a los datos la rápida.
 */
function planTones(comparison: Comparison, measures: Measures): Record<Side, Map<PlanNode, Tone>> {
  const tones: Record<Side, Map<PlanNode, Tone>> = { a: new Map(), b: new Map() };
  const [planA] = comparison.a.statements.map((statement) => statement.plan);
  const [planB] = comparison.b.statements.map((statement) => statement.plan);
  if (comparison.a.statements.length !== 1 || comparison.b.statements.length !== 1) return tones;
  if (!planA || !planB || sameShape(planA, planB)) return tones;
  const ratio = measures.a.serverMs / Math.max(measures.b.serverMs, 1e-9);
  if (ratio < PLAN_RATIO && ratio > 1 / PLAN_RATIO) return tones;
  const [slow, fast]: [Side, Side] = ratio > 1 ? ['a', 'b'] : ['b', 'a'];
  const slowPlan = slow === 'a' ? planA : planB;
  const fastPlan = fast === 'a' ? planA : planB;
  const costly = nodes(slowPlan).reduce((best, node) => (node.cost > best.cost ? node : best));
  tones[slow].set(costly, 'bad');
  const reader = nodes(fastPlan).find((node) => node.object && node.op !== 'Key Lookup');
  if (reader) tones[fast].set(reader, 'good');
  return tones;
}

function renderColumn(
  side: Side,
  run: QueryRun,
  tones: ReadonlyMap<PlanNode, Tone>,
  flow: (rows: number) => number,
  cache: Cache,
  texts: ScenarioTexts,
  section: HTMLElement,
  context: Context,
): HTMLElement {
  const { client, lang } = context;
  const parts: (Node | null)[] = [
    h('h3', { class: 'sql-side-title' }, [
      h('span', { class: 'sql-mark' }, [side.toUpperCase()]),
      ` ${texts.labels[run.label] ?? run.label}`,
    ]),
    indexesLine(run, client),
  ];

  const linq = run.linq ? linqBlock(section, run.linq, context) : null;
  if (linq) parts.push(h('h4', {}, [client.linq]), linq);
  parts.push(h('h4', {}, [run.linq ? client.sql_generated : client.sql]), sqlBlock(run, context));
  if (run.missingIndex) parts.push(h('p', { class: 'sql-missing' }, [run.missingIndex]));

  parts.push(h('h4', {}, [client.plan]));
  run.statements.forEach((statement, index) => {
    const several = run.statements.length > 1;
    if (several || statement.times > 1) {
      parts.push(
        h('p', { class: 'sql-statement' }, [
          several ? fill(client.statement, { value: index + 1 }) : null,
          several && statement.times > 1 ? ' ' : null,
          statement.times > 1
            ? fill(client.repeats, { value: formatNumber(statement.times, lang) })
            : null,
        ]),
      );
    }
    parts.push(
      h('p', { class: 'sql-plan-cost' }, [
        fill(client.plan_cost, { value: formatNumber(totalCost(statement.plan), lang, 4) }),
      ]),
      renderPlan(statement.plan, { lang, strings: client, flow, tones }),
    );
  });
  parts.push(messages(run, cache, context));
  return h('article', { class: 'sql-column', 'data-side': side }, parts);
}

/** "Índices: IX_Orders_OrderDate (OrderDate) INCLUDE (Total) y las claves primarias." */
function indexesLine(run: QueryRun, client: ClientTexts): HTMLParagraphElement {
  const indexes = run.indexes ?? [];
  if (indexes.length === 0) return h('p', { class: 'sql-indexes' }, [client.indexes_none]);
  const list = h('span', {}, []);
  indexes.forEach((index, position) => {
    if (position > 0) list.append(', ');
    list.append(h('code', {}, [index]));
  });
  return h('p', { class: 'sql-indexes' }, fillNodes(client.indexes, { value: list }));
}

/** Una copia del código de EF Core que Jekyll publicó, ya resaltado por Rouge. */
function linqBlock(section: HTMLElement, key: string, context: Context): HTMLElement | null {
  const source = section.querySelector<HTMLElement>(`[data-linq="${key}"] .highlighter-rouge`);
  if (!source) return null;
  const copy = source.cloneNode(true) as HTMLElement;
  const pre = copy.querySelector<HTMLElement>('pre');
  if (pre) addCopyButton(pre, context.kit, context.clipboard);
  return copy;
}

/** El SQL del lado con sus DECLARE, resaltado y con el botón Copiar. */
function sqlBlock(run: QueryRun, context: Context): HTMLElement {
  const code = h('code', { class: 'language-sql' });
  highlightInto(code, 'sql', script(run));
  const pre = h('pre', {}, [code]);
  const block = h('div', { class: 'lab-code' }, [pre]);
  addCopyButton(pre, context.kit, context.clipboard);
  return block;
}

/** La pestaña Mensajes de SSMS: un bloque por sentencia y, si se repite, cuántas veces más. */
function messages(run: QueryRun, cache: Cache, context: Context): HTMLDetailsElement {
  const { client, lang } = context;
  const blocks = run.statements.flatMap((statement) => {
    const code = h('code', {}, [statisticsText(statement.plan, cache)]);
    return [
      h('div', { class: 'lab-code' }, [h('pre', {}, [code])]),
      statement.times > 1
        ? h('p', { class: 'sql-more' }, [
            fill(client.more_times, { value: formatNumber(statement.times - 1, lang) }),
          ])
        : null,
    ];
  });
  return h('details', { class: 'sql-messages' }, [
    h('summary', {}, [client.messages]),
    h('p', { class: 'sql-messages-hint' }, [client.messages_hint]),
    ...blocks,
  ]);
}
