import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { ResultSet } from '../labs/challenges/sql/compare';
import {
  sampleSql,
  type Cell,
  type Dataset,
  type SqlCase,
  type SqlChallenge,
} from '../labs/challenges/sql/data';
import { pgliteOpener, type CreatePGlite } from '../labs/challenges/sql/pglite';
import { lastResult, runCase, type CaseOutcome } from '../labs/challenges/sql/runner';
import { splitStatements, translate } from '../labs/challenges/sql/translate';
import { LANGS, strings, type Json } from './course-lesson-checks';
import { lessonData, modules } from './course-pages.mjs';
import { diffBlocks, examples, formatTable, type Example } from './sql-examples';

// Las lecciones del curso de SQL Server contra el mismo motor del sitio, PGlite, en Node: la solución de
// cada ejercicio corre y pasa todos sus casos, el código inicial no (si pasara, el ejercicio no pediría
// nada) y cada ejemplo del texto (un ```sql seguido de su ```text) da el resultado que muestra.
// Falta la otra mitad (fase 4 del plan): correr las soluciones y las capturas en un SQL Server real.
//
// Lo esperado de un caso es su `expected`, si lo trae, o lo que devuelve la solución en el mismo caso:
// la solución es la referencia, y la fase 4 la compara con SQL Server.

const COURSE = 'sqlserver';
const open = pgliteOpener(((options) => PGlite.create(options)) as CreatePGlite);
const dataset = (
  parse(readFileSync('_data/labs/challenge-datasets.yml', 'utf8')) as { shared: Dataset }
).shared;

const lessons = modules('.', COURSE).flatMap((module) =>
  module.lessons.map((id) => ({
    module: module.id,
    id,
    data: lessonData('.', COURSE, module.id, id) as Json,
  })),
);

/** Un paso de ejercicio como el reto que corre el motor de los retos. */
function challengeOf(step: Json): SqlChallenge {
  return {
    language: 'sql',
    category: step['mode'] === 'change' ? 'changes' : 'queries',
    difficulty: 'easy',
    tables: step['tables'] as string[],
    check: step['check'] as SqlChallenge['check'],
    starter: step['starter'] as string,
    solution: step['solution'] as string,
    cases: step['cases'] as SqlCase[],
    ...(step['ordered'] === true ? { ordered: true } : {}),
    ...(typeof step['verify'] === 'string' ? { verify: step['verify'] } : {}),
    ...(typeof step['setup'] === 'string' ? { setup: step['setup'] } : {}),
  };
}

/** Por qué no pasó un caso, para el mensaje de la prueba. */
function why(outcome: CaseOutcome): string {
  return JSON.stringify({
    refusal: outcome.refusal,
    blocked: outcome.blocked,
    error: outcome.error?.message,
    mismatch: outcome.mismatch,
  });
}

/** El reto con lo esperado de cada caso: el suyo, o lo que devuelve la solución en ese caso. */
async function withReference(challenge: SqlChallenge): Promise<SqlChallenge> {
  const cases: SqlCase[] = [];
  for (const [index, data] of challenge.cases.entries()) {
    if (data.expected) {
      cases.push(data);
      continue;
    }
    const reference = await runCase(open, challenge, dataset, index, challenge.solution);
    expect(reference.refusal, `caso ${index + 1}: la solución no corre aquí`).toBeUndefined();
    expect(reference.error?.message, `caso ${index + 1}: la solución falla`).toBeUndefined();
    expect(reference.actual, `caso ${index + 1}: la solución no devolvió nada`).toBeDefined();
    const actual = reference.actual as ResultSet;
    cases.push({ ...data, expected: { columns: actual.columns, rows: actual.rows as Cell[][] } });
  }
  return { ...challenge, cases };
}

/** La base de ejemplo del curso, con sus filas, y el resultado de la última consulta del código. */
async function runExample(sql: string): Promise<ResultSet | undefined> {
  const db = await open();
  try {
    await db.exec(dataset.tables.map((table) => translate(table.ddl).sql.trim()).join('\n\n'));
    await db.exec(sampleSql(dataset));
    const translation = translate(sql);
    expect(translation.blocked, 'el ejemplo no corre aquí').toEqual([]);
    const results: ResultSet[] = [];
    for (const statement of splitStatements(translation.sql))
      results.push(...(await db.exec(statement.text)));
    return lastResult(results);
  } finally {
    await db.close();
  }
}

/**
 * Lo que de una lección corre en PGlite: sus ejercicios de resultado y los ejemplos de su texto. Una
 * lección con solo pasos capturados no trae nada (su salida viene de un SQL Server: fase 4).
 */
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
      const challenge = await withReference(challengeOf(step));
      for (const [index] of challenge.cases.entries()) {
        const outcome = await runCase(open, challenge, dataset, index, challenge.solution);
        expect(outcome.passed, `caso ${index + 1}: ${why(outcome)}`).toBe(true);
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
        const result = await runExample(example.sql);
        expect(result, 'la consulta no devolvió ningún resultado').toBeDefined();
        const diff = diffBlocks(example.output, formatTable(result as ResultSet, lang));
        expect(diff, `línea ${diff?.line} del resultado del ejemplo\n${example.sql}`).toBeNull();
      }, 60_000);
    }
  }
});
