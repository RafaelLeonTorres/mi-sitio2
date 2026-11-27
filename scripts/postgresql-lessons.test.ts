import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { ResultSet } from '../labs/challenges/sql/compare';
import { sampleSql, type Dataset } from '../labs/challenges/sql/data';
import { pgliteOpener, type CreatePGlite } from '../labs/challenges/sql/pglite';
import { lastResult, runCase, sqlError, type CaseOutcome } from '../labs/challenges/sql/runner';
import { splitStatements } from '../labs/challenges/sql/translate';
import { challengeOf, type SqlStep } from '../labs/course/engines/sql-challenge';
import { LANGS, strings, type Json } from './course-lesson-checks';
import { lessonData, modules } from './course-pages.mjs';
import { diffBlocks, examples, formatTable, type Example } from './sql-examples';

// Las lecciones del curso de PostgreSQL contra el mismo motor del sitio, PGlite (PostgreSQL de
// verdad), en Node: la solución de cada ejercicio corre y pasa todos sus casos, el código inicial no,
// cada ejemplo del texto (un ```sql seguido de su ```text) da el resultado que muestra y cada código
// de errors.yml es el que PostgreSQL devuelve de verdad.

const COURSE = 'postgresql';
const open = pgliteOpener(((options) => PGlite.create(options)) as CreatePGlite);
const read = (path: string) => parse(readFileSync(path, 'utf8')) as Json;
const dataset = (read(`_data/course/${COURSE}/dataset.yml`) as { shared: Dataset }).shared;
const errors = read(`_data/course/${COURSE}/errors.yml`);

const lessons = modules('.', COURSE).flatMap((module) =>
  module.lessons.map((id) => ({
    module: module.id,
    id,
    data: lessonData('.', COURSE, module.id, id) as Json,
  })),
);

/** Por qué no pasó un caso, para el mensaje de la prueba. */
function why(outcome: CaseOutcome): string {
  return JSON.stringify({
    refusal: outcome.refusal,
    blocked: outcome.blocked,
    error: outcome.error?.message,
    mismatch: outcome.mismatch,
  });
}

/** Una base nueva con todas las tablas de ejemplo y sus filas; corre el código y da lo último. */
async function onSample(sql: string): Promise<ResultSet | undefined> {
  const db = await open('postgresql');
  try {
    await db.exec(dataset.tables.map((table) => table.ddl.trim()).join('\n\n'));
    await db.exec(sampleSql(dataset));
    const results: ResultSet[] = [];
    for (const statement of splitStatements(sql, true))
      results.push(...(await db.exec(statement.text)));
    return lastResult(results);
  } finally {
    await db.close();
  }
}

/** Lo que de una lección corre aquí: sus ejercicios de resultado y los ejemplos de su texto. */
function checksOf(data: Json) {
  const shared = data['shared'] as { steps: Json[] };
  const runnable = shared.steps.filter(
    (step) => step['kind'] === 'exercise' && ['rows', 'table'].includes(String(step['check'])),
  );
  const found = Object.fromEntries(
    LANGS.map((lang) => [lang, strings(data[lang]).flatMap((text) => examples(text).found)]),
  ) as Record<(typeof LANGS)[number], Example[]>;
  return { runnable, found };
}

const withChecks = lessons
  .map((lesson) => ({ ...lesson, ...checksOf(lesson.data) }))
  .filter(
    (lesson) => lesson.runnable.length > 0 || LANGS.some((lang) => lesson.found[lang].length > 0),
  );

describe('hay lecciones que comprobar', () => {
  it('las lecciones con ejercicios o ejemplos corren en PGlite', () => {
    expect(withChecks.length).toBeGreaterThan(0);
  });
});

describe.each(withChecks)('lección $module/$id', ({ runnable, found }) => {
  it.each(runnable.map((step) => ({ step, name: String(step['id']) })))(
    'ejercicio $name: la solución pasa todos sus casos y el código inicial no',
    async ({ step }) => {
      // El mismo reto que arma el adaptador en el navegador.
      const challenge = challengeOf(step as SqlStep, null, 'postgresql');
      for (const [index, data] of challenge.cases.entries()) {
        const outcome = await runCase(open, challenge, dataset, index, challenge.solution);
        expect(outcome.passed, `caso ${index + 1}: ${why(outcome)}`).toBe(true);
        // Un caso de ejemplo que no devuelve nada no enseña nada: casi siempre son tablas vacías.
        if (challenge.check === 'rows' && data.sample)
          expect(outcome.actual?.rows.length, `caso ${index + 1}: sin filas`).toBeGreaterThan(0);
      }
      const starter: CaseOutcome[] = [];
      for (const [index] of challenge.cases.entries())
        starter.push(await runCase(open, challenge, dataset, index, challenge.starter));
      expect(
        starter.every((outcome) => outcome.passed),
        'el código inicial ya pasa todos los casos',
      ).toBe(false);
    },
    120_000,
  );

  for (const lang of LANGS) {
    for (const [index, example] of found[lang].entries()) {
      it(`ejemplo ${index + 1} del texto (${lang}): da el resultado que muestra`, async () => {
        const result = await onSample(example.sql);
        expect(result, 'la consulta no devolvió ningún resultado').toBeDefined();
        const diff = diffBlocks(example.output, formatTable(result as ResultSet, lang));
        expect(diff, `línea ${diff?.line} del resultado del ejemplo\n${example.sql}`).toBeNull();
      }, 60_000);
    }
  }
});

// Un programa mínimo por cada código de errors.yml, sobre la base de ejemplo.
const PROGRAMS: Record<string, string> = {
  '42601': 'SELECT TOP 3 name FROM products;',
  '42P01': 'SELECT * FROM clientes;',
  '42703': 'SELECT nombre FROM customers;',
  '42702': 'SELECT id FROM customers JOIN orders ON orders.customer_id = customers.id;',
  '42712': 'SELECT * FROM employees, employees;',
  '42883': 'SELECT ISNULL(phone, name) FROM customers;',
  '42804': "SELECT CASE WHEN true THEN 1 ELSE 'x'::text END;",
  '42803': 'SELECT city, count(*) FROM customers;',
  '42P10': 'SELECT DISTINCT city FROM customers ORDER BY name;',
  '21000': 'SELECT (SELECT name FROM customers);',
  '22P02': "SELECT 'abc'::integer;",
  '22007': "SELECT 'abc'::date;",
  '22008': "SELECT '2026-02-30'::date;",
  '22003': 'SELECT 2147483647 + 1;',
  '22012': 'SELECT 1 / 0;',
};

describe('explicaciones de errores', () => {
  it('cada código de errors.yml tiene su programa, y cada programa su explicación', () => {
    expect(Object.keys(PROGRAMS).sort()).toEqual(Object.keys(errors).sort());
  });

  it.each(Object.entries(PROGRAMS))(
    '%s es el código que devuelve PostgreSQL',
    async (code, sql) => {
      const caught = await onSample(sql).then(
        () => undefined,
        (error: unknown) => sqlError(error, sql),
      );
      expect(caught?.code, caught?.message ?? 'no falló').toBe(code);
    },
    60_000,
  );
});
