import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { compareNames, compareResults, type ResultSet } from '../labs/challenges/sql/compare';
import {
  sampleSql,
  usesSampleRows,
  type Cell,
  type Dataset,
  type DatasetTable,
  type Rows,
  type SqlCase,
  type SqlChallenge,
} from '../labs/challenges/sql/data';
import { pgliteOpener, type CreatePGlite } from '../labs/challenges/sql/pglite';
import { lastResult, runCase, type CaseOutcome } from '../labs/challenges/sql/runner';
import { splitStatements, translate } from '../labs/challenges/sql/translate';
import { LANGS, strings, type Json } from './course-lesson-checks';
import { lessonData, modules } from './course-pages.mjs';
import { diffBlocks, examples, formatTable, type Example } from './sql-examples';
import {
  connectionString,
  runScripts,
  splitBatches,
  type BatchOutput,
  type Response,
} from './sqlserver-client.mjs';

// Las lecciones del curso de SQL Server contra el mismo motor del sitio, PGlite, en Node: la solución de
// cada ejercicio corre y pasa todos sus casos, el código inicial no (si pasara, el ejercicio no pediría
// nada) y cada ejemplo del texto (un ```sql seguido de su ```text) da el resultado que muestra.
//
// La otra mitad corre con MSSQL_CONNECTION (scripts/sqlserver-client.mjs): cada solución, en cada caso, y
// cada ejemplo del texto, en un SQL Server de verdad, en una base temporal con la intercalación de
// referencia del curso. PGlite y SQL Server tienen que dar el mismo resultado, y el texto de un ejemplo
// tiene que ser exacto, también las mayúsculas de la cabecera. Sin la variable, esa mitad se omite.
//
// Lo esperado de un caso es su `expected`, si lo trae, o lo que devuelve la solución en el mismo caso
// (runner.ts): la solución es la referencia. El caso de ejemplo
// (`sample: true`) corre con las filas de ejemplo de la base (`caseSql`).

const COURSE = 'sqlserver';
// La intercalación del curso (courses.yml): la misma con la que traduce el adaptador en el navegador.
const collation = (
  parse(readFileSync('_data/course/courses.yml', 'utf8')) as { id: string; collation?: 'ci' }[]
).find((course) => course.id === COURSE)?.collation;
const translating = collation ? { collation } : {};
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
    ...(Array.isArray(step['names']) ? { names: step['names'] as string[] } : {}),
    ...(typeof step['verify'] === 'string' ? { verify: step['verify'] } : {}),
    ...(typeof step['setup'] === 'string' ? { setup: step['setup'] } : {}),
    ...(collation ? { collation } : {}),
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

/** La base de ejemplo del curso, con sus filas, y el resultado de la última consulta del código. */
async function runExample(sql: string): Promise<ResultSet | undefined> {
  const db = await open();
  try {
    await db.exec(
      dataset.tables.map((table) => translate(table.ddl, translating).sql.trim()).join('\n\n'),
    );
    await db.exec(sampleSql(dataset));
    const translation = translate(sql, translating);
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
      // Sin `expected`, runCase espera lo que devuelve la solución (en otra base) en cada caso.
      const challenge = challengeOf(step);
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
        const result = await runExample(example.sql);
        expect(result, 'la consulta no devolvió ningún resultado').toBeDefined();
        const diff = diffBlocks(example.output, formatTable(result as ResultSet, lang));
        expect(diff, `línea ${diff?.line} del resultado del ejemplo\n${example.sql}`).toBeNull();
      }, 60_000);
    }
  }
});

// --- Contra un SQL Server de verdad ---

/** Un valor como literal de T-SQL: los textos son Unicode (N'...'), para no depender de la página de códigos. */
const tsqlValue = (cell: Cell): string =>
  cell === null
    ? 'NULL'
    : typeof cell === 'number'
      ? String(cell)
      : `N'${cell.replaceAll("'", "''")}'`;

/** La columna IDENTITY de una tabla, por su CREATE TABLE. */
const identityColumn = (ddl: string): string | undefined =>
  /^\s*(\w+)\s+[\w()]+[^,\n]*\bIDENTITY\b/im.exec(ddl)?.[1];

/**
 * Las filas de una tabla como INSERT de T-SQL. Las columnas obligatorias que no trae toman su valor de
 * `defaults`, y una columna IDENTITY solo acepta valores explícitos con IDENTITY_INSERT.
 */
function tsqlInsert(table: DatasetTable, rows: Rows): string {
  if (rows.rows.length === 0) return '';
  const given = new Set(rows.columns.map((column) => column.toLowerCase()));
  const extra = Object.entries(table.defaults ?? {}).filter(
    ([column]) => !given.has(column.toLowerCase()),
  );
  const columns = [...rows.columns, ...extra.map(([column]) => column)];
  const values = rows.rows
    .map((row) => `(${[...row, ...extra.map(([, value]) => value)].map(tsqlValue).join(', ')})`)
    .join(',\n  ');
  const insert = `INSERT INTO ${table.id} (${columns.join(', ')}) VALUES\n  ${values};`;
  const identity = identityColumn(table.ddl);
  return identity && given.has(identity.toLowerCase())
    ? `SET IDENTITY_INSERT ${table.id} ON;\n${insert}\nSET IDENTITY_INSERT ${table.id} OFF;`
    : insert;
}

/** El esquema y los datos de un caso para SQL Server: el CREATE TABLE de cada tabla, tal como está en T-SQL, y sus filas. */
function tsqlSetup(challenge: SqlChallenge, data: SqlCase): string {
  const parts = challenge.tables.flatMap((name) => {
    const table = dataset.tables.find((item) => item.id === name);
    if (!table) throw new Error(`No hay una tabla ${name} en la base de ejemplo.`);
    const rows = data.tables?.[name] ?? (usesSampleRows(data) ? table.sample : undefined);
    return [table.ddl.trim(), ...(rows ? [tsqlInsert(table, rows)] : [])];
  });
  return [...parts, challenge.setup?.trim() ?? ''].filter(Boolean).join('\n\n');
}

describe('el montaje en T-SQL', () => {
  const products = dataset.tables.find((table) => table.id === 'Products') as DatasetTable;
  const customers = dataset.tables.find((table) => table.id === 'Customers') as DatasetTable;

  it('escribe los textos como Unicode y completa las columnas obligatorias', () => {
    expect(
      tsqlInsert(customers, {
        columns: ['Id', 'Name'],
        rows: [
          [1, "O'Brien"],
          [2, 'Iván'],
        ],
      }),
    ).toBe(
      "INSERT INTO Customers (Id, Name, Email, City, CreatedAt) VALUES\n  (1, N'O''Brien', N'cliente@example.com', N'CDMX', N'2024-01-01'),\n  (2, N'Iván', N'cliente@example.com', N'CDMX', N'2024-01-01');",
    );
    expect(tsqlInsert(customers, { columns: ['Id'], rows: [] })).toBe('');
  });

  it('una columna IDENTITY solo lleva IDENTITY_INSERT si el caso trae su valor', () => {
    expect(identityColumn(products.ddl)).toBe('Id');
    expect(tsqlInsert(products, { columns: ['Id', 'Sku'], rows: [[1, 'A']] })).toMatch(
      /^SET IDENTITY_INSERT Products ON;\nINSERT INTO Products .*\nSET IDENTITY_INSERT Products OFF;$/s,
    );
    expect(tsqlInsert(products, { columns: ['Sku'], rows: [['A']] })).not.toContain(
      'IDENTITY_INSERT',
    );
    expect(identityColumn(customers.ddl)).toBeUndefined();
  });

  it('el caso de ejemplo lleva las filas de ejemplo de cada tabla del ejercicio, y uno con datos propios, solo las suyas', () => {
    const challenge: SqlChallenge = {
      language: 'sql',
      category: 'queries',
      difficulty: 'easy',
      tables: ['Customers'],
      check: 'rows',
      starter: '',
      solution: 'SELECT 1',
      cases: [],
    };
    const sample = tsqlSetup(challenge, { sample: true });
    expect(sample.startsWith('CREATE TABLE Customers')).toBe(true);
    expect(sample).toContain("N'Ana Torres'");
    expect(sample.match(/N'Mérida'/g)).toHaveLength(1);
    const own = tsqlSetup(challenge, { tables: { Customers: { columns: ['Id'], rows: [[9]] } } });
    expect(own).not.toContain('Ana Torres');
    expect(own).toContain('(9, N');
  });
});

/** El último resultado con columnas de lo que devolvió el servidor, empezando por el último lote. */
function lastServerResult(batches: readonly BatchOutput[]): ResultSet | undefined {
  for (const batch of [...batches].reverse()) {
    const found = [...batch.results].reverse().find((result) => result.columns.length > 0);
    if (found) return found;
  }
  return undefined;
}

/** Los errores (gravedad mayor que 10) de unos lotes, para el mensaje de la prueba. */
const errorsOf = (batches: readonly BatchOutput[]) =>
  batches.flatMap((batch) => batch.messages).filter((message) => message.level > 10);

describe.skipIf(!connectionString())('las lecciones contra un SQL Server de verdad', () => {
  // Todas las corridas en una sola llamada al ejecutor: cada una crea y borra su propia base temporal.
  const runs = withChecks.flatMap((lesson) => [
    ...lesson.runnable.flatMap((step) => {
      const challenge = challengeOf(step);
      return challenge.cases.map((data, index) => ({
        id: `${lesson.module}/${lesson.id}/${String(step['id'])}/${index}`,
        script: [
          tsqlSetup(challenge, data),
          ...splitBatches(challenge.solution),
          ...(challenge.check === 'table' && challenge.verify ? [challenge.verify] : []),
        ],
      }));
    }),
    ...LANGS.flatMap((lang) =>
      lesson.found[lang].map((example, index) => ({
        id: `${lesson.module}/${lesson.id}/ejemplo/${lang}/${index}`,
        script: [
          dataset.tables
            .flatMap((table) => [table.ddl.trim(), tsqlInsert(table, table.sample)])
            .filter(Boolean)
            .join('\n\n'),
          ...splitBatches(example.sql),
        ],
      })),
    ),
  ]);
  let response: Response;
  beforeAll(() => {
    response = runScripts(runs);
  }, 600_000);
  const batchesOf = (id: string): BatchOutput[] => {
    const run = response.runs.find((item) => item.id === id);
    if (!run) throw new Error(`El servidor no devolvió la corrida ${id}.`);
    return run.batches;
  };

  it('usa la intercalación de referencia del curso, y no la del servidor', () => {
    expect(response.collation).toBe('SQL_Latin1_General_CP1_CI_AS');
    expect(response.server).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  describe.each(withChecks)('lección $module/$id', ({ module, id, runnable, found }) => {
    it.each(runnable.map((step) => ({ step, name: String(step['id']) })))(
      'ejercicio $name: PGlite y SQL Server dan lo mismo en cada caso',
      async ({ step }) => {
        const challenge = challengeOf(step);
        for (const [index] of challenge.cases.entries()) {
          const batches = batchesOf(`${module}/${id}/${String(step['id'])}/${index}`);
          const where = `caso ${index + 1}`;
          expect(errorsOf(batches.slice(0, 1)), `${where}: el montaje falló en SQL Server`).toEqual(
            [],
          );
          expect(errorsOf(batches.slice(1)), `${where}: la solución falla en SQL Server`).toEqual(
            [],
          );
          const server = lastServerResult(batches.slice(1));
          expect(server, `${where}: SQL Server no devolvió ningún resultado`).toBeDefined();
          const local = (await runCase(open, challenge, dataset, index, challenge.solution)).actual;
          const ordered = challenge.ordered === true || challenge.check === 'table';
          expect(
            compareResults(server as ResultSet, local, ordered),
            `${where}: SQL Server y PGlite no coinciden\n${JSON.stringify({ server, local })}`,
          ).toBeNull();
          // Si el ejercicio pide nombres, la solución también los da en SQL Server.
          if (challenge.names)
            expect(
              compareNames(challenge.names, server as ResultSet),
              `${where}: nombres`,
            ).toBeNull();
        }
      },
      120_000,
    );

    for (const lang of LANGS) {
      for (const [index, example] of found[lang].entries()) {
        it(`ejemplo ${index + 1} del texto (${lang}): SQL Server da el resultado que muestra, con la cabecera exacta`, () => {
          const batches = batchesOf(`${module}/${id}/ejemplo/${lang}/${index}`);
          expect(errorsOf(batches), 'el ejemplo falla en SQL Server').toEqual([]);
          const result = lastServerResult(batches.slice(1));
          expect(result, 'la consulta no devolvió ningún resultado').toBeDefined();
          const shown = formatTable(result as ResultSet, lang).map((line) => line.trimEnd());
          expect(shown).toEqual(example.output.map((line) => line.trimEnd()));
        });
      }
    }
  });
});
