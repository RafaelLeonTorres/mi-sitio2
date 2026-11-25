// @vitest-environment jsdom
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import lessonSource from '../../../_data/course/sqlserver/first-steps/first-query.yml?raw';
import type { CaseResult, CasesRun } from '../../challenges/engine';
import type { SqlCasesEngine } from '../../challenges/languages';
import { pgliteOpener, type CreatePGlite } from '../../challenges/sql/pglite';
import { runCase, type CaseOutcome } from '../../challenges/sql/runner';
import type { SqlChallenge } from '../../challenges/sql/data';
import { sqlCourseUi, sqlLessonPage } from '../fixtures';
import type { StepData } from '../types';
import { createSqlAdapter, type SqlLessonData } from './sql';

const step: StepData = {
  id: 'cols',
  kind: 'exercise',
  level: 'executable',
  mode: 'query',
  tables: ['Customers'],
  starter: '-- escribe',
  solution: 'SELECT Name, City FROM Customers;',
  check: 'rows',
  cases: [
    { sample: true },
    { tables: { Customers: { columns: ['Id', 'Name'], rows: [[1, 'Zoe']] } } },
  ],
};

function lesson(overrides: Partial<SqlLessonData> = {}): SqlLessonData {
  return {
    id: 'demo/sql',
    steps: [step],
    starters: {},
    ui: sqlCourseUi('es'),
    errors: {},
    engine: '/pglite/',
    worker: '/w.js',
    engineId: 'sql',
    sql: sqlLessonPage(['Customers']),
    syllabus: '/curso/sql-server/',
    next: null,
    ...overrides,
  };
}

const outcome = (index: number, rest: Partial<CaseOutcome> = {}): CaseResult => ({
  index,
  outcome: { index, passed: true, notes: [], ...rest },
});

const table = (columns: string[], rows: unknown[][]) => ({ columns, rows });

interface Call {
  readonly challenge: SqlChallenge;
  readonly indexes: readonly number[];
  readonly source: string;
}

function setup(
  answer: (call: Call) => CasesRun | Promise<CasesRun> = ({ indexes }) => ({
    results: indexes.map((index) => outcome(index, { actual: table(['Name'], [['Ana']]) })),
  }),
  data: SqlLessonData = lesson(),
) {
  const calls: Call[] = [];
  const warm = vi.fn(async () => undefined);
  const engine: SqlCasesEngine = {
    timeoutMs: 5000,
    loaded: true,
    runCases: async (challenge, _dataset, indexes, source, onProgress) => {
      const call = { challenge, indexes, source };
      calls.push(call);
      onProgress?.('running', 0);
      return answer(call);
    },
    warm,
  };
  const adapter = createSqlAdapter(engine, data, 'es');
  document.body.replaceChildren(adapter.panels.output);
  return { adapter, calls, warm, body: adapter.panels.body };
}

describe('adaptador de SQL: sus piezas', () => {
  it('trae el motor, el archivo, el panel de resultados y el autocompletado de las tablas', () => {
    const { adapter, body } = setup();
    expect(adapter.id).toBe('sql');
    expect(adapter.editorLanguage).toBe('sql');
    expect(adapter.fileLabel).toBe('consulta.sql');
    expect(adapter.editorSchema?.['Customers']).toEqual([
      'Id',
      'Name',
      'Email',
      'City',
      'CreatedAt',
      'Phone',
    ]);
    expect(adapter.panels.output.querySelector('h2')?.textContent).toBe('Resultado');
    expect(adapter.panels.output.contains(body)).toBe(true);
    expect(adapter.panels.input?.hidden).toBe(true);
  });

  it('al abrir un paso muestra sus tablas con las filas de ejemplo y deja el panel en reposo', () => {
    const { adapter, body } = setup();
    adapter.panels.open(step);
    const tables = adapter.panels.input!;
    expect(tables.hidden).toBe(false);
    expect(tables.querySelector('summary')?.textContent).toBe(
      'Tablas de este ejercicio: Customers',
    );
    expect(tables.querySelector('caption')?.textContent).toBe('Customers');
    expect(tables.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(body.textContent).toContain('Pulsa Ejecutar');
    adapter.panels.open({ id: 'none', kind: 'exercise' });
    expect(tables.hidden).toBe(true);
    adapter.panels.empty();
    expect(body.textContent).toContain('Escribe una consulta primero');
  });

  it('warm calienta el motor', async () => {
    const { adapter, warm } = setup();
    await adapter.warm();
    expect(warm).toHaveBeenCalledOnce();
  });
});

describe('adaptador de SQL: Ejecutar', () => {
  it('corre solo el caso de ejemplo, con la intercalación del curso, y enseña lo que devolvió', async () => {
    const { adapter, calls, body } = setup(() => ({
      results: [
        outcome(0, {
          actual: table(
            ['name', 'city'],
            [
              ['Ana', 'CDMX'],
              ['Luis', 'Monterrey'],
            ],
          ),
        }),
      ],
    }));
    const report = await adapter.run({ step, code: 'SELECT Name, City FROM Customers' });
    expect(calls[0]?.indexes).toEqual([0]);
    expect(calls[0]?.source).toBe('SELECT Name, City FROM Customers');
    expect(calls[0]?.challenge).toMatchObject({
      tables: ['Customers'],
      check: 'rows',
      collation: 'ci',
      solution: step.solution,
    });
    expect([...body.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual([
      'name',
      'city',
    ]);
    expect(body.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(body.textContent).toContain('2 filas');
    // Ejecutar no juzga: ni siquiera una consulta que dé lo esperado resuelve el paso.
    expect(report).toEqual({ passed: false, announcement: '2 filas' });
  });

  it('un solo renglón se dice en singular, y NULL se ve como NULL', async () => {
    const { adapter, body } = setup(() => ({
      results: [outcome(0, { actual: table(['Phone'], [[null]]) })],
    }));
    const report = await adapter.run({ step, code: 'SELECT Phone FROM Customers' });
    expect(body.textContent).toContain('1 fila');
    expect(body.querySelector('.ch-null')?.textContent).toBe('NULL');
    expect(report.announcement).toBe('1 fila');
  });

  it('el error de la base sale con su renglón, que el editor marca', async () => {
    const { adapter, body } = setup(() => ({
      results: [
        outcome(0, {
          passed: false,
          error: { message: 'column "nme" does not exist', line: 2 },
        }),
      ],
    }));
    const report = await adapter.run({ step, code: 'SELECT\n  Nme FROM Customers' });
    expect(report.line).toBe(2);
    expect(report.passed).toBe(false);
    expect(body.querySelector('.ch-error')?.textContent).toContain('column "nme" does not exist');
    expect(body.querySelector('.ch-error')?.textContent).toContain('2');
    expect(report.announcement).toBe('column "nme" does not exist');
  });

  it('lo que no se puede traducir se explica, y lo que se tradujo se avisa', async () => {
    const { adapter, body } = setup(() => ({
      results: [
        outcome(0, {
          passed: false,
          refusal: 'blocked',
          blocked: [{ line: 1, key: 'like-set' }],
          notes: ['top'],
        }),
      ],
    }));
    const report = await adapter.run({
      step,
      code: "SELECT * FROM Customers WHERE Name LIKE '[a-c]%'",
    });
    expect(body.querySelector('.ch-error li')?.textContent).toContain('LIKE');
    expect(body.querySelectorAll('.ch-notes li')).toHaveLength(1);
    expect(report.announcement).toBe('Esto no corre en PostgreSQL:');
  });

  it('un código que no hace nada visible, como un comentario, se dice así', async () => {
    const { adapter, body } = setup(() => ({
      results: [outcome(0, { passed: false, refusal: 'empty' })],
    }));
    const report = await adapter.run({ step, code: '-- nada' });
    expect(body.querySelector('.ch-error')?.textContent).toBe(
      'Escribe tu código antes de correrlo.',
    );
    expect(report.passed).toBe(false);
  });

  it('una sentencia que no devuelve tabla dice que corrió', async () => {
    const { adapter, body } = setup(() => ({ results: [outcome(0)] }));
    const report = await adapter.run({ step, code: 'UPDATE Customers SET City = 1' });
    expect(body.textContent).toContain('La consulta corrió y no devolvió ninguna tabla.');
    expect(report.announcement).toBe('La consulta corrió y no devolvió ninguna tabla.');
  });

  it('en un ejercicio de cambios enseña cómo quedó la tabla', async () => {
    const change: StepData = { ...step, mode: 'change', check: 'table', verify: 'SELECT 1' };
    const { adapter, body } = setup(() => ({
      results: [outcome(0, { actual: table(['Id'], [[1]]) })],
    }));
    await adapter.run({ step: change, code: 'DELETE FROM Customers' });
    expect(body.querySelector('caption')?.textContent).toBe('Cómo quedaron las tablas');
  });

  it('si el código se pasó del tiempo, lo dice', async () => {
    const { adapter, body } = setup(() => ({ results: [{ index: 0, timedOut: true }] }));
    const report = await adapter.run({ step, code: 'SELECT 1' });
    expect(body.textContent).toContain('5');
    expect(body.querySelector('[data-tone="bad"]')).not.toBeNull();
    expect(report.passed).toBe(false);
  });
});

describe('adaptador de SQL: Enviar', () => {
  it('corre todos los casos y, si todos pasan, el paso queda resuelto', async () => {
    const { adapter, calls, body } = setup();
    const report = await adapter.check({ step, code: step.solution ?? '' });
    expect(calls[0]?.indexes).toEqual([0, 1]);
    expect(report).toEqual({ passed: true, announcement: '¡Correcto!' });
    expect(body.querySelector('.ch-verdict')?.getAttribute('data-tone')).toBe('good');
    expect(body.querySelectorAll('.ch-case')).toHaveLength(2);
  });

  it('si un caso no pasa, dice por qué, trae la frase de la lección y marca el renglón', async () => {
    const { adapter, body } = setup(({ indexes }) => ({
      results: indexes.map((index) =>
        index === 0
          ? outcome(0)
          : outcome(1, {
              passed: false,
              mismatch: { kind: 'columns', expected: 2, actual: 6 },
              error: { message: 'x', line: 3 },
            }),
      ),
    }));
    const report = await adapter.check({
      step,
      code: 'SELECT * FROM Customers',
      failure: 'Muestra solo Name y City.',
    });
    expect(report.passed).toBe(false);
    expect(report.line).toBe(3);
    expect(report.announcement).toBe('Todavía no.');
    expect(body.querySelector('.ch-verdict')?.getAttribute('data-tone')).toBe('bad');
    expect(body.firstElementChild?.textContent).toBe('Muestra solo Name y City.');
    expect(body.textContent).toContain('Se esperaban 2 columnas y llegaron 6.');
  });

  it('si el motor falla, lo escribe y avisa que no se revisó nada', async () => {
    const { adapter, body } = setup(() => {
      throw new Error('no cargó');
    });
    const report = await adapter.check({ step, code: 'SELECT 1' });
    expect(report).toMatchObject({ passed: false, failed: true });
    expect(report.announcement).toContain('no cargó');
    expect(body.querySelector('[data-tone="bad"]')?.textContent).toContain('no cargó');
  });
});

describe('adaptador de SQL con el motor de verdad (PGlite, sin worker)', () => {
  const open = pgliteOpener(((options) => PGlite.create(options)) as CreatePGlite);
  const steps = (parse(lessonSource) as { shared: { steps: StepData[] } }).shared.steps;
  const pilot = steps.find((item) => item.id === 'some-columns')!;
  const data = lesson({ steps, sql: sqlLessonPage(['Customers', 'Products']) });

  /** El motor de los retos, pero corriendo runCase aquí mismo, como lo haría el worker. */
  const engine: SqlCasesEngine = {
    timeoutMs: 5000,
    loaded: true,
    runCases: async (challenge, dataset, indexes, source) => ({
      results: await Promise.all(
        indexes.map(async (index) => ({
          index,
          outcome: await runCase(open, challenge, dataset, index, source),
        })),
      ),
    }),
    warm: async () => undefined,
  };
  const adapter = createSqlAdapter(engine, data, 'es');

  it('Ejecutar enseña los seis clientes de la base de ejemplo', async () => {
    document.body.replaceChildren(adapter.panels.output);
    const report = await adapter.run({ step: pilot, code: 'select name, city from customers' });
    const body = adapter.panels.body;
    expect([...body.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual([
      'name',
      'city',
    ]);
    expect(body.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(report.announcement).toBe('6 filas');
  }, 60_000);

  it('Enviar da por buena la solución, aunque cambien las mayúsculas, y rechaza el código inicial', async () => {
    document.body.replaceChildren(adapter.panels.output);
    const good = await adapter.check({ step: pilot, code: 'SELECT NAME,CITY FROM CUSTOMERS' });
    expect(good.passed).toBe(true);
    const bad = await adapter.check({ step: pilot, code: pilot.starter ?? '' });
    expect(bad.passed).toBe(false);
    expect(adapter.panels.body.querySelector('.ch-verdict')?.getAttribute('data-tone')).toBe('bad');
    const swapped = await adapter.check({ step: pilot, code: 'SELECT City, Name FROM Customers' });
    expect(swapped.passed).toBe(false);
  }, 120_000);

  it('un error de sintaxis sale con su renglón', async () => {
    document.body.replaceChildren(adapter.panels.output);
    const report = await adapter.run({ step: pilot, code: 'SELECT Name,\n  Cityy FROM Customers' });
    expect(report.line).toBe(2);
    expect(adapter.panels.body.querySelector('.ch-error')).not.toBeNull();
  }, 60_000);
});
