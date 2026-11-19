// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import source from '../../_data/labs/sql.yml?raw';
import { startSqlLab, type LabOptions, type SqlLab } from './app';
import type { TextClipboard } from '../shared/copy';

// El laboratorio sobre una página con la misma forma que publica _includes/labs/sql.html y con
// los textos reales de _data/labs/sql.yml.

interface ScenarioTexts {
  id: string;
  name: string;
  question: string;
  labels: Record<string, string>;
  controls?: Record<string, unknown>;
  notes: { id: string; title: string }[];
}

interface Data {
  shared: { scenarios: { id: string; a: string; b: string; linq?: string[] }[] };
  es: { scenarios: ScenarioTexts[]; client: Record<string, unknown> };
  en: { scenarios: ScenarioTexts[]; client: Record<string, unknown> };
}

const data = parse(source) as Data;

function page(lang: 'es' | 'en'): string {
  const texts = data[lang];
  const json = JSON.stringify({
    client: texts.client,
    scenarios: texts.scenarios.map(({ id, labels, controls }) => ({
      id,
      labels,
      controls: controls ?? null,
    })),
  });
  const tabs = texts.scenarios
    .map(
      (scenario) =>
        `<button class="lab-tab" type="button" role="tab" id="tab-sql-${scenario.id}" aria-controls="sql-${scenario.id}">${scenario.name}</button>`,
    )
    .join('');
  const sections = texts.scenarios
    .map((scenario) => {
      const linq = (data.shared.scenarios.find((item) => item.id === scenario.id)?.linq ?? [])
        .map(
          (variant) =>
            `<div class="sql-linq" data-linq="${scenario.id}-${variant}"><div class="language-csharp highlighter-rouge"><div class="highlight"><pre class="highlight"><code>// ${variant}</code></pre></div></div></div>`,
        )
        .join('');
      const notes = scenario.notes
        .map((note) => `<li class="sql-note" data-note="${note.id}"><h4>${note.title}</h4></li>`)
        .join('');
      return `
        <section class="sql-scenario" id="sql-${scenario.id}" data-scenario="${scenario.id}">
          <h2>${scenario.question}</h2>
          <div class="sql-live" hidden></div>
          <div class="sql-static"><pre><code>SELECT 1;</code></pre>${linq}</div>
          <section class="sql-notes"><ul>${notes}</ul></section>
        </section>`;
    })
    .join('');
  return `
    <script type="application/json" id="lab-ui">{"copy_label": "Copiar", "copied": "Copiado", "copy_failed": "No se pudo copiar"}</script>
    <div class="sql-app">
      <script type="application/json" id="sql-data">${json}</script>
      <div class="lab-tablist sql-tabs" role="tablist" hidden>${tabs}</div>
      <p class="sql-nojs">Sin JavaScript</p>
      ${sections}
    </div>`;
}

const clipboard: TextClipboard = { writeText: () => Promise.resolve() };

function start(lang: 'es' | 'en' = 'es', hash = '', options: LabOptions = {}): SqlLab {
  history.replaceState(null, '', `/${hash}`);
  document.documentElement.lang = lang;
  document.body.innerHTML = page(lang);
  const root = document.querySelector<HTMLElement>('.sql-app');
  if (!root) throw new Error('Falta .sql-app');
  return startSqlLab(root, { clipboard, reducedMotion: true, ...options });
}

const section = (id: string) => {
  const element = document.getElementById(`sql-${id}`);
  if (!element) throw new Error(`Falta #sql-${id}`);
  return element;
};
const text = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
const visibleNotes = (id: string) =>
  [...section(id).querySelectorAll<HTMLElement>('.sql-note')]
    .filter((note) => !note.hidden)
    .map((note) => note.dataset['note']);
const metric = (id: string, name: string) =>
  [...section(id).querySelectorAll(`.sql-summary tr[data-metric="${name}"] td`)].map(text);

function pick(id: string, control: string, value: string): void {
  const input = section(id).querySelector<HTMLInputElement>(
    `[data-control="${control}"] input[value="${value}"]`,
  );
  if (!input) throw new Error(`Falta la opción ${value} de ${control}`);
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function toggle(id: string, control: string): void {
  const input = section(id).querySelector<HTMLInputElement>(`[data-control="${control}"] input`);
  if (!input) throw new Error(`Falta el control ${control}`);
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function tab(id: string): void {
  document.getElementById(`tab-sql-${id}`)?.click();
}

describe('laboratorio SQL: página', () => {
  it('muestra las pestañas y abre el primer escenario con sus resultados', () => {
    start();
    expect(document.querySelector<HTMLElement>('.sql-tabs')?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.sql-nojs')?.hidden).toBe(true);
    expect(document.getElementById('tab-sql-sargability')?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(section('sargability').querySelector<HTMLElement>('.sql-live')?.hidden).toBe(false);
    expect(section('sargability').querySelector<HTMLElement>('.sql-static')?.hidden).toBe(true);
    expect(section('indexes').hidden).toBe(true);
    const bars = [...section('sargability').querySelectorAll('.sql-bars .lab-bar-label')];
    expect(bars.map(text)).toEqual(['A', 'B']);
    expect(text(section('sargability').querySelector('.sql-verdict p'))).toBe(
      'B es 9.6 veces más rápida.',
    );
    expect(metric('sargability', 'logical')).toEqual(['3,720', '455']);
  });

  it('los escenarios que no se han abierto todavía no se dibujan', () => {
    start();
    expect(section('joins').querySelector('.sql-live')?.childElementCount).toBe(0);
    tab('joins');
    expect(section('joins').hidden).toBe(false);
    expect(section('joins').querySelector('.sql-live')?.childElementCount).toBeGreaterThan(0);
  });

  it('abre la pestaña de la dirección y la pone al elegir otra', () => {
    start('es', '#sql-pagination');
    expect(section('pagination').hidden).toBe(false);
    expect(section('sargability').hidden).toBe(true);
    tab('tracking');
    expect(location.hash).toBe('#sql-tracking');
  });

  it('en inglés usa los textos en inglés', () => {
    start('en');
    expect(text(section('sargability').querySelector('.sql-verdict p'))).toBe(
      'B is 9.6 times faster.',
    );
    expect(text(section('sargability').querySelector('.sql-run'))).toBe('Run both');
  });
});

describe('laboratorio SQL: controles', () => {
  it('solo quedan las notas que aplican a los valores elegidos', () => {
    start();
    expect(visibleNotes('sargability')).toEqual(['function', 'covering', 'cast']);
    pick('sargability', 'columns', 'all');
    expect(visibleNotes('sargability')).toEqual(['function', 'tipping', 'cast']);
    pick('sargability', 'range', 'day');
    expect(visibleNotes('sargability')).toEqual(['function', 'lookups', 'cast']);
    toggle('sargability', 'index');
    expect(visibleNotes('sargability')).toEqual(['function', 'no-index', 'cast']);
  });

  it('cambiar un control vuelve a calcular el plan, el resumen y el SQL', () => {
    const lab = start();
    pick('sargability', 'range', 'day');
    expect(lab.values('sargability')['range']).toBe('day');
    const sql = text(section('sargability').querySelector('.sql-column[data-side="b"] pre'));
    expect(sql).toContain("OrderDate >= '20261015'");
    expect(metric('sargability', 'rows')).toEqual(['401', '401']);
    toggle('sargability', 'index');
    expect(metric('sargability', 'access')).toEqual([
      'Clustered Index Scan en PK_Orders',
      'Clustered Index Scan en PK_Orders',
    ]);
  });

  it('los controles con condición aparecen solo cuando aplican', () => {
    start();
    tab('joins');
    const hidden = (control: string) =>
      section('joins').querySelector<HTMLElement>(`[data-control="${control}"]`)?.hidden;
    expect([hidden('subquery'), hidden('distinct'), hidden('guests')]).toEqual([
      false,
      false,
      true,
    ]);
    pick('joins', 'question', 'without');
    expect([hidden('subquery'), hidden('distinct'), hidden('guests')]).toEqual([true, true, false]);
    const lines = [...section('joins').querySelectorAll('.sql-verdict p')].map(text);
    expect(lines).toContain('No devuelven las mismas filas: 0 en A y 39,196 en B.');
    expect(visibleNotes('joins')).toEqual(['null']);
  });

  it('el deslizador de la página avanza en escala logarítmica y respeta el máximo', () => {
    start('es', '#sql-pagination');
    const input = section('pagination').querySelector<HTMLInputElement>('input[type="range"]');
    const output = section('pagination').querySelector('output');
    if (!input) throw new Error('Falta el deslizador');
    expect(text(output)).toBe('10,000 de 50,000');
    expect(input.getAttribute('aria-valuetext')).toBe('10,000 de 50,000');
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text(output)).toBe('1 de 50,000');
    expect(visibleNotes('pagination')).toEqual(['first-page', 'tuples']);
    input.value = '1000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text(output)).toBe('50,000 de 50,000');
    pick('pagination', 'orders', '10000');
    expect(text(output)).toBe('500 de 500');
    expect(input.value).toBe('1000');
  });
});

describe('laboratorio SQL: columnas', () => {
  it('el SQL lleva los DECLARE de sus parámetros y A muestra el índice sugerido', () => {
    start('es', '#sql-indexes');
    const a = section('indexes').querySelector('.sql-column[data-side="a"]');
    expect(text(a?.querySelector('pre'))).toMatch(/^DECLARE @CustomerId int = 4217;/);
    expect(text(a?.querySelector('.sql-missing'))).toMatch(/^Missing Index \(Impact 99\.\d{4}\)/);
    expect(section('indexes').querySelector('.sql-column[data-side="b"] .sql-missing')).toBeNull();
    expect(text(a?.querySelector('.sql-indexes'))).toBe('Índices: solo las claves primarias.');
    const b = section('indexes').querySelector('.sql-column[data-side="b"] .sql-indexes');
    expect(text(b)).toBe('Índices: IX_Orders_CustomerId (CustomerId) y las claves primarias.');
  });

  it('N+1 muestra el código de EF Core y la sentencia que se repite', () => {
    start('es', '#sql-n-plus-one');
    const a = section('n-plus-one').querySelector('.sql-column[data-side="a"]');
    expect(text(a?.querySelector('.highlighter-rouge code'))).toBe('// loop');
    const statements = [...(a?.querySelectorAll('.sql-statement') ?? [])].map(text);
    expect(statements).toEqual(['Sentencia 1', 'Sentencia 2 Se ejecuta 100 veces.']);
    expect(text(a?.querySelector('.sql-more'))).toBe('… y la misma sentencia 99 veces más.');
    expect(text(a?.querySelector('.lab-code pre'))).toContain('GO');
    pick('n-plus-one', 'loading', 'include');
    const b = section('n-plus-one').querySelector('.sql-column[data-side="b"]');
    expect(text(b?.querySelector('.highlighter-rouge code'))).toBe('// include');
    expect(metric('n-plus-one', 'trips')).toEqual(['101', '1']);
  });

  it('marca el operador más costoso del lado lento y cómo lee el rápido', () => {
    start('es', '#sql-pagination');
    const bad = section('pagination').querySelector(
      '.sql-column[data-side="a"] .sql-node[data-tone="bad"] .sql-op-name',
    );
    const good = section('pagination').querySelector(
      '.sql-column[data-side="b"] .sql-node[data-tone="good"] .sql-op-name',
    );
    expect(text(bad)).toBe('Index Scan');
    expect(text(good)).toBe('Index Seek');
    // Con el mismo plan en los dos lados no se marca nada.
    tab('tracking');
    expect(section('tracking').querySelectorAll('.sql-node[data-tone]')).toHaveLength(0);
  });

  it('el resumen y el veredicto cuentan la memoria en los escenarios de EF Core', () => {
    start('es', '#sql-tracking');
    expect(metric('tracking', 'memory')).toEqual(['21.9 MB', '13.4 MB']);
    const lines = [...section('tracking').querySelectorAll('.sql-verdict p')].map(text);
    expect(lines).toEqual([
      'Las dos tardan casi lo mismo.',
      'B usa 1.6 veces menos memoria en .NET.',
    ]);
  });

  it('agrega Copiar al SQL y al código de EF Core', () => {
    start('es', '#sql-n-plus-one');
    const buttons = section('n-plus-one').querySelectorAll('.sql-column .copy-btn');
    // Por lado: el código de EF Core, el SQL.
    expect(buttons).toHaveLength(4);
  });
});

describe('laboratorio SQL: ejecutar', () => {
  it('Ejecutar las dos anuncia los tiempos y el veredicto', () => {
    start();
    section('sargability').querySelector<HTMLButtonElement>('.sql-run')?.click();
    expect(text(document.getElementById('lab-live'))).toBe(
      'Consulta A: 139 ms. Consulta B: 15 ms. B es 9.6 veces más rápida.',
    );
  });

  it('la carrera llena las barras desde cero, salvo con movimiento reducido', () => {
    start('es', '', { reducedMotion: false });
    const run = section('sargability').querySelector<HTMLButtonElement>('.sql-run');
    run?.click();
    const bars = section('sargability').querySelector('.sql-bars');
    expect(bars?.classList.contains('is-racing')).toBe(true);
    const fills = [...section('sargability').querySelectorAll<HTMLElement>('.lab-bar-fill')];
    // Cada barra tarda en proporción a su consulta: A, la lenta, todo el tiempo de la carrera.
    const ms = (fill: HTMLElement) => {
      const value = fill.style.transitionDuration;
      return value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000;
    };
    expect(ms(fills[0] as HTMLElement)).toBe(2400);
    expect(ms(fills[1] as HTMLElement)).toBeCloseTo((2400 * 14.54) / 139.3, -1);
    expect(fills.every((fill) => fill.style.transitionTimingFunction === 'linear')).toBe(true);

    start('es', '', { reducedMotion: true });
    section('sargability').querySelector<HTMLButtonElement>('.sql-run')?.click();
    expect(section('sargability').querySelector('.sql-bars')?.classList.contains('is-racing')).toBe(
      false,
    );
  });
});
