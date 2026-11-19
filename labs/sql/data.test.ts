import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import source from '../../_data/labs/sql.yml?raw';
import indexesA from '../../_includes/labs/code/sql/indexes-a.sql?raw';
import indexesB from '../../_includes/labs/code/sql/indexes-b.sql?raw';
import joinsA from '../../_includes/labs/code/sql/joins-a.sql?raw';
import joinsB from '../../_includes/labs/code/sql/joins-b.sql?raw';
import nPlusOneA from '../../_includes/labs/code/sql/n-plus-one-a.sql?raw';
import nPlusOneB from '../../_includes/labs/code/sql/n-plus-one-b.sql?raw';
import nPlusOneInclude from '../../_includes/labs/code/sql/n-plus-one-include.cs?raw';
import nPlusOneLoop from '../../_includes/labs/code/sql/n-plus-one-loop.cs?raw';
import nPlusOneProjection from '../../_includes/labs/code/sql/n-plus-one-projection.cs?raw';
import paginationA from '../../_includes/labs/code/sql/pagination-a.sql?raw';
import paginationB from '../../_includes/labs/code/sql/pagination-b.sql?raw';
import sargabilityA from '../../_includes/labs/code/sql/sargability-a.sql?raw';
import sargabilityB from '../../_includes/labs/code/sql/sargability-b.sql?raw';
import trackingA from '../../_includes/labs/code/sql/tracking-a.sql?raw';
import trackingB from '../../_includes/labs/code/sql/tracking-b.sql?raw';
import trackingNoTracking from '../../_includes/labs/code/sql/tracking-no-tracking.cs?raw';
import trackingProjection from '../../_includes/labs/code/sql/tracking-projection.cs?raw';
import trackingTracked from '../../_includes/labs/code/sql/tracking-tracked.cs?raw';
import type { MetricId } from './page';
import type { Scenario, Value, Values } from './scenario';
import { SCENARIOS } from './scenarios';
import { script } from './script';

// Revisa que _data/labs/sql.yml y _includes/labs/code/sql/ cuadren con los escenarios de
// labs/sql/: los mismos escenarios en el mismo orden, un texto para cada lado, nota y control que
// el modelo puede usar (y ninguno que nunca use), el SQL inicial igual al que genera el
// TypeScript y el código de EF Core de cada variante.

interface ControlText {
  label: string;
  format?: string;
  options?: Record<string, string>;
}

interface ScenarioTexts {
  id: string;
  name: string;
  question: string;
  text: string;
  labels: Record<string, string>;
  controls?: Record<string, ControlText>;
  notes: { id: string; title: string; text: string; url?: string; link?: string }[];
}

interface Texts {
  scenarios: ScenarioTexts[];
  client: Record<string, unknown> & {
    controls: Record<string, ControlText>;
    metrics: Record<string, string>;
  };
}

interface Data {
  shared: { scenarios: { id: string; a: string; b: string; linq?: string[] }[] };
  es: Texts;
  en: Texts;
}

const data = parse(source) as Data;
const { shared } = data;

/** Las columnas que caben en un bloque de código de una de las dos columnas. */
const MAX_COLUMNS = 60;

const SQL: Record<string, string> = {
  'sargability-a': sargabilityA,
  'sargability-b': sargabilityB,
  'indexes-a': indexesA,
  'indexes-b': indexesB,
  'n-plus-one-a': nPlusOneA,
  'n-plus-one-b': nPlusOneB,
  'joins-a': joinsA,
  'joins-b': joinsB,
  'pagination-a': paginationA,
  'pagination-b': paginationB,
  'tracking-a': trackingA,
  'tracking-b': trackingB,
};

const LINQ: Record<string, string> = {
  'n-plus-one-loop': nPlusOneLoop,
  'n-plus-one-include': nPlusOneInclude,
  'n-plus-one-projection': nPlusOneProjection,
  'tracking-tracked': trackingTracked,
  'tracking-no-tracking': trackingNoTracking,
  'tracking-projection': trackingProjection,
};

const METRICS: MetricId[] = [
  'total',
  'server',
  'network',
  'client',
  'logical',
  'physical',
  'read_ahead',
  'rows_read',
  'rows',
  'trips',
  'memory',
  'access',
];

// Cada plantilla de la interfaz y los valores que el TypeScript le pone.
const TEMPLATES: Record<string, string[]> = {
  side: ['value'],
  indexes: ['value'],
  plan_cost: ['value'],
  statement: ['value'],
  repeats: ['value'],
  more_times: ['value'],
  access: ['op', 'object'],
  faster: ['side', 'value'],
  memory_less: ['side', 'value'],
  rows_differ: ['a', 'b'],
  announce: ['a', 'b', 'verdict'],
};

/** Todas las combinaciones de valores de los controles; de un deslizador, sus extremos y el medio. */
function combinations(scenario: Scenario): Values[] {
  let list: Record<string, Value>[] = [{ ...scenario.defaults }];
  for (const control of scenario.controls) {
    if (control.kind === 'range') continue;
    const options: readonly Value[] = control.kind === 'toggle' ? [true, false] : control.options;
    list = list.flatMap((values) => options.map((option) => ({ ...values, [control.id]: option })));
  }
  for (const control of scenario.controls) {
    if (control.kind !== 'range') continue;
    list = list.flatMap((values) => {
      const max = typeof control.max === 'function' ? control.max(values) : control.max;
      const points = [...new Set([control.min, control.min + 1, Math.round(max / 2), max])];
      return points
        .filter((point) => point <= max)
        .map((point) => ({ ...values, [control.id]: point }));
    });
  }
  return list;
}

/** Lo que usa un escenario en todas sus combinaciones: nombres de cada lado, notas y código. */
function used(scenario: Scenario): { labels: Set<string>; notes: Set<string>; linq: Set<string> } {
  const labels = new Set<string>();
  const notes = new Set<string>();
  const linq = new Set<string>();
  for (const values of combinations(scenario)) {
    const comparison = scenario.run(values);
    for (const run of [comparison.a, comparison.b]) {
      labels.add(run.label);
      if (run.linq) linq.add(run.linq);
    }
    for (const note of comparison.notes) notes.add(note);
  }
  return { labels, notes, linq };
}

function checkCode(name: string, code: string | undefined): void {
  expect(code, name).toBeDefined();
  const text = code ?? '';
  expect(text).not.toContain('{{');
  expect(text).not.toContain('{%');
  expect(text.endsWith('\n')).toBe(true);
  const long = text.split('\n').filter((line) => line.length > MAX_COLUMNS);
  expect(long).toEqual([]);
}

describe('SQL: escenarios', () => {
  it('van en el orden de las pestañas, en shared y en los dos idiomas', () => {
    const ids = SCENARIOS.map((scenario) => scenario.id);
    expect(shared.scenarios.map((scenario) => scenario.id)).toEqual(ids);
    expect(data.es.scenarios.map((scenario) => scenario.id)).toEqual(ids);
    expect(data.en.scenarios.map((scenario) => scenario.id)).toEqual(ids);
  });

  it('con los valores iniciales, A y B son los que la página nombra sin JavaScript', () => {
    for (const scenario of SCENARIOS) {
      const comparison = scenario.run(scenario.defaults);
      const entry = shared.scenarios.find((item) => item.id === scenario.id);
      expect([comparison.a.label, comparison.b.label]).toEqual([entry?.a, entry?.b]);
    }
  });

  it('el SQL inicial de cada lado es el que publica la página', () => {
    for (const scenario of SCENARIOS) {
      const comparison = scenario.run(scenario.defaults);
      expect(SQL[`${scenario.id}-a`]).toBe(`${script(comparison.a)}\n`);
      expect(SQL[`${scenario.id}-b`]).toBe(`${script(comparison.b)}\n`);
    }
  });

  it('el código de EF Core existe para cada variante que el modelo usa, y nada más', () => {
    for (const scenario of SCENARIOS) {
      const entry = shared.scenarios.find((item) => item.id === scenario.id);
      const listed = (entry?.linq ?? []).map((variant) => `${scenario.id}-${variant}`);
      expect([...used(scenario).linq].sort()).toEqual([...listed].sort());
    }
    expect(Object.keys(LINQ).sort()).toEqual(
      shared.scenarios.flatMap((entry) => (entry.linq ?? []).map((v) => `${entry.id}-${v}`)).sort(),
    );
  });

  it('el código cabe en su bloque y Jekyll lo puede incluir', () => {
    for (const [name, code] of Object.entries({ ...SQL, ...LINQ })) checkCode(name, code);
  });
});

for (const lang of ['es', 'en'] as const) {
  const texts = data[lang];

  describe(`SQL: textos en ${lang}`, () => {
    it('cada lado que el modelo usa tiene nombre, y no sobra ninguno', () => {
      for (const scenario of SCENARIOS) {
        const entry = texts.scenarios.find((item) => item.id === scenario.id);
        const linq = shared.scenarios.find((item) => item.id === scenario.id)?.linq ?? [];
        const named = new Set([...used(scenario).labels, ...linq]);
        expect(Object.keys(entry?.labels ?? {}).sort()).toEqual([...named].sort());
      }
    });

    it('cada nota que el modelo usa tiene texto, y ninguna queda sin usarse', () => {
      for (const scenario of SCENARIOS) {
        const entry = texts.scenarios.find((item) => item.id === scenario.id);
        const ids = (entry?.notes ?? []).map((note) => note.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect([...ids].sort()).toEqual([...used(scenario).notes].sort());
        for (const note of entry?.notes ?? []) {
          expect(Boolean(note.url)).toBe(Boolean(note.link));
          if (note.url) expect(note.url).toMatch(/^https:\/\/learn\.microsoft\.com\/[a-z]/);
        }
      }
    });

    it('cada control tiene su etiqueta y el texto de cada opción', () => {
      for (const scenario of SCENARIOS) {
        const entry = texts.scenarios.find((item) => item.id === scenario.id);
        for (const control of scenario.controls) {
          const text = entry?.controls?.[control.id] ?? texts.client.controls[control.id];
          expect(text?.label, `${scenario.id}.${control.id}`).toBeTruthy();
          if (control.kind === 'choice') {
            expect(Object.keys(text?.options ?? {}).sort()).toEqual([...control.options].sort());
          }
          if (control.kind === 'select') expect(text?.format).toContain('{value}');
          if (control.kind === 'range') {
            expect(text?.format).toContain('{value}');
            expect(text?.format).toContain('{total}');
          }
        }
        // Los textos de controles propios corresponden a controles que existen.
        const ids = scenario.controls.map((control) => control.id);
        for (const id of Object.keys(entry?.controls ?? {})) expect(ids).toContain(id);
      }
    });

    it('las plantillas de la interfaz tienen los valores que les pone el TypeScript', () => {
      for (const [key, names] of Object.entries(TEMPLATES)) {
        const template = texts.client[key];
        expect(typeof template, key).toBe('string');
        for (const name of names) expect(template).toContain(`{${name}}`);
      }
      expect(Object.keys(texts.client.metrics).sort()).toEqual([...METRICS].sort());
    });
  });
}
