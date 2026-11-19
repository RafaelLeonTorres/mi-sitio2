import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { tableColumns, type Dataset, type SqlChallenge } from '../labs/challenges/sql/data';

// Revisa los datos de los retos de SQL antes de correrlos: que cada reto use tablas y columnas de
// la base de ejemplo, que traiga lo que pide su forma de revisar (verify, query, reglas del plan),
// que sus casos tengan ejemplos y filas bien formadas, que sus textos estén completos y que el
// catálogo los liste a todos una sola vez. Las soluciones se corren en challenge-solutions.test.ts.

interface Texts {
  slug: string;
  title: string;
  summary: string;
  statement: string;
  hints: string[];
  explanation: string;
}
interface ChallengeFile {
  shared: SqlChallenge;
  es: Texts;
  en: Texts;
}

const CATEGORIES = ['queries', 'optimization', 'changes'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const CHECKS: Record<string, string> = { queries: 'rows', changes: 'table' };

const datasetFile = parse(readFileSync('_data/labs/challenge-datasets.yml', 'utf8')) as {
  shared: Dataset;
  es: { tables: { id: string }[]; generators: { id: string }[] };
  en: { tables: { id: string }[]; generators: { id: string }[] };
};
const dataset = datasetFile.shared;
const ui = parse(readFileSync('_data/labs/challenge-ui.yml', 'utf8')) as {
  shared: { catalog: { category: string; challenges: string[] }[] };
};
const scenarios = (
  parse(readFileSync('_data/labs/sql.yml', 'utf8')) as { shared: { scenarios: { id: string }[] } }
).shared.scenarios.map((scenario) => scenario.id);

const ids = readdirSync('_data/labs/challenges')
  .filter((name) => name.endsWith('.yml'))
  .map((name) => name.replace(/\.yml$/, ''))
  .sort();
const files = new Map(
  ids.map((id) => [
    id,
    parse(readFileSync(`_data/labs/challenges/${id}.yml`, 'utf8')) as ChallengeFile,
  ]),
);

const tableOf = (name: string) => dataset.tables.find((table) => table.id === name);
const lower = (values: readonly string[]) => values.map((value) => value.toLowerCase());

/** Las columnas que un INSERT tiene que traer: NOT NULL o clave, sin IDENTITY. */
function requiredColumns(ddl: string): string[] {
  const body = ddl.slice(ddl.indexOf('(') + 1, ddl.lastIndexOf(')'));
  const keys = [...body.matchAll(/PRIMARY KEY\s*\(([^)]*)\)/gi)].flatMap((match) =>
    (match[1] ?? '').split(',').map((column) => column.trim()),
  );
  const inline = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /\b(?:NOT NULL|PRIMARY KEY)\b/i.test(line) && !/\bIDENTITY\b/i.test(line))
    .filter((line) => !/^(?:PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(line))
    .map((line) => line.split(/\s+/)[0] ?? '');
  return [...new Set([...inline, ...keys])];
}

describe('base de ejemplo de los retos', () => {
  it('cada tabla se llama como su CREATE TABLE y sus filas tienen sus columnas', () => {
    for (const table of dataset.tables) {
      expect(new RegExp(`CREATE TABLE ${table.id}\\s*\\(`).test(table.ddl), table.id).toBe(true);
      const columns = lower(tableColumns(table.ddl));
      for (const column of [...table.sample.columns, ...Object.keys(table.defaults ?? {})]) {
        expect(columns.includes(column.toLowerCase()), `${table.id}.${column}`).toBe(true);
      }
      for (const row of table.sample.rows) expect(row).toHaveLength(table.sample.columns.length);
    }
  });

  it('los textos en español e inglés siguen el orden de las tablas y de los generadores', () => {
    const tables = dataset.tables.map((table) => table.id);
    const generators = dataset.generators.map((generator) => generator.id);
    for (const lang of [datasetFile.es, datasetFile.en]) {
      expect(lang.tables.map((table) => table.id)).toEqual(tables);
      expect(lang.generators.map((generator) => generator.id)).toEqual(generators);
    }
  });
});

describe('retos de SQL', () => {
  it('el catálogo los lista a todos una sola vez, en su categoría', () => {
    const listed = ui.shared.catalog.flatMap((group) => group.challenges);
    expect([...listed].sort()).toEqual(ids);
    for (const group of ui.shared.catalog) {
      for (const id of group.challenges) {
        expect(files.get(id)?.shared.category, id).toBe(group.category);
      }
    }
  });

  it('los slugs no se repiten y el de inglés es el id', () => {
    const es = ids.map((id) => files.get(id)?.es.slug);
    expect(new Set(es).size).toBe(ids.length);
    for (const id of ids) {
      expect(files.get(id)?.en.slug).toBe(id);
      expect(files.get(id)?.es.slug ?? '').toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  for (const id of ids) {
    const file = files.get(id);
    if (!file) continue;
    const challenge = file.shared;

    it(`${id}: forma, tablas y forma de revisar`, () => {
      expect(challenge.language).toBe('sql');
      expect(CATEGORIES).toContain(challenge.category);
      expect(DIFFICULTIES).toContain(challenge.difficulty);
      expect(challenge.tables.length).toBeGreaterThan(0);
      for (const name of challenge.tables) expect(tableOf(name), name).toBeDefined();
      expect(challenge.starter.trim()).not.toBe('');
      expect(challenge.solution.trim()).not.toBe('');
      expect(challenge.solution.trim()).not.toBe(challenge.starter.trim());
      const expectedCheck = CHECKS[challenge.category];
      if (expectedCheck) expect(challenge.check).toBe(expectedCheck);
      else expect(['plan', 'index']).toContain(challenge.check);
      if (challenge.check === 'table') expect(challenge.verify?.trim()).toBeTruthy();
      if (challenge.check === 'index') expect(challenge.query?.trim()).toBeTruthy();
      if (challenge.category === 'optimization') {
        expect(challenge.plan?.length ?? 0).toBeGreaterThan(0);
        expect(challenge.cases.some((data) => data.explain)).toBe(true);
      }
      for (const rule of challenge.plan ?? []) {
        if ('table' in rule) expect(challenge.tables).toContain(rule.table);
      }
    });

    it(`${id}: casos con ejemplos y filas bien formadas`, () => {
      expect(challenge.cases.some((data) => data.sample)).toBe(true);
      challenge.cases.forEach((data, index) => {
        const where = `caso ${index + 1}`;
        for (const [name, rows] of Object.entries(data.tables ?? {})) {
          expect(challenge.tables, where).toContain(name);
          const table = tableOf(name);
          if (!table) continue;
          const columns = lower(tableColumns(table.ddl));
          for (const column of rows.columns) {
            expect(columns.includes(column.toLowerCase()), `${where}: ${name}.${column}`).toBe(
              true,
            );
          }
          const given = lower([...rows.columns, ...Object.keys(table.defaults ?? {})]);
          if (rows.rows.length > 0) {
            for (const column of requiredColumns(table.ddl)) {
              expect(
                given.includes(column.toLowerCase()),
                `${where}: falta ${name}.${column}`,
              ).toBe(true);
            }
          }
          for (const row of rows.rows) expect(row, where).toHaveLength(rows.columns.length);
        }
        for (const generator of data.generate ?? []) {
          expect(
            dataset.generators.some((item) => item.id === generator),
            `${where}: ${generator}`,
          ).toBe(true);
        }
        if (challenge.check === 'rows' || challenge.check === 'table') {
          expect(data.expected, `${where}: sin resultado esperado`).toBeDefined();
        }
        for (const row of data.expected?.rows ?? []) {
          expect(row, where).toHaveLength(data.expected?.columns.length ?? 0);
        }
      });
    });

    it(`${id}: textos completos en los dos idiomas`, () => {
      for (const texts of [file.es, file.en]) {
        for (const key of ['title', 'summary', 'statement', 'explanation'] as const) {
          expect(texts[key].trim(), key).not.toBe('');
        }
        expect(texts.hints).toHaveLength(3);
        // Los enlaces al laboratorio de rendimiento van a un escenario que existe.
        const all = [texts.statement, texts.explanation, ...texts.hints].join('\n');
        for (const match of all.matchAll(/\]\(\.\.\/\.\.\/sql\/#sql-([a-z-]+)\)/g)) {
          expect(scenarios, `#sql-${match[1] ?? ''}`).toContain(match[1]);
        }
      }
    });
  }
});
