import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import type { Dataset, SqlChallenge } from './data';
import { pgliteOpener, type CreatePGlite } from './pglite';
import { runPlayground } from './playground';
import { runCase } from './runner';

const open = pgliteOpener(((options) => PGlite.create(options)) as CreatePGlite);

const dataset: Dataset = {
  tables: [
    {
      id: 'Customers',
      ddl: 'CREATE TABLE Customers (\n  Id int PRIMARY KEY,\n  Name nvarchar(50) NOT NULL\n);',
      sample: {
        columns: ['Id', 'Name'],
        rows: [
          [1, 'Ana'],
          [2, 'Luis'],
        ],
      },
    },
    {
      id: 'Accounts',
      ddl: 'CREATE TABLE Accounts (\n  Id int PRIMARY KEY,\n  Balance decimal(10, 2) NOT NULL CHECK (Balance >= 0)\n);',
      sample: { columns: ['Id', 'Balance'], rows: [[1, 100]] },
    },
  ],
  generators: [
    {
      id: 'customers',
      sql: "INSERT INTO Customers (Id, Name) SELECT i, 'Cliente ' || i FROM generate_series(1, 20000) AS i;",
    },
  ],
};

const base = { language: 'sql', category: 'queries', difficulty: 'easy' } as const;

const rows: SqlChallenge = {
  ...base,
  tables: ['Customers'],
  check: 'rows',
  ordered: true,
  starter: 'SELECT Id FROM Customers;',
  solution: 'SELECT Id FROM Customers ORDER BY Id DESC;',
  cases: [
    {
      sample: true,
      tables: {
        Customers: {
          columns: ['Id', 'Name'],
          rows: [
            [1, 'Ana'],
            [2, 'Luis'],
          ],
        },
      },
      expected: { columns: ['Id'], rows: [[2], [1]] },
    },
  ],
};

describe('runCase', () => {
  it('pasa con el resultado esperado, en orden, y mide el código del visitante', async () => {
    let calls = 0;
    let clock = 0;
    const outcome = await runCase(open, rows, dataset, 0, rows.solution, {
      onCode: () => calls++,
      now: () => (clock += 5),
    });
    expect(outcome.passed).toBe(true);
    expect(calls).toBe(1);
    expect(outcome.ms).toBe(5);
    expect(outcome.actual?.rows).toEqual([[2], [1]]);
  }, 30_000);

  it('dice qué no coincide y en qué renglón está un error', async () => {
    const wrong = await runCase(open, rows, dataset, 0, 'SELECT Id FROM Customers ORDER BY Id;');
    expect(wrong.mismatch).toEqual({ kind: 'order', row: 0 });
    const broken = await runCase(open, rows, dataset, 0, 'SELECT Id\nFROM Customer;');
    expect(broken.passed).toBe(false);
    expect(broken.error?.line).toBe(2);
    expect(broken.error?.message).toContain('customer');
  }, 30_000);

  it('si el ejercicio pide nombres, las columnas se llaman así, con las mayúsculas que sean', async () => {
    const named: SqlChallenge = {
      ...base,
      tables: ['Customers'],
      check: 'rows',
      ordered: true,
      names: ['Code', 'Label'],
      starter: '',
      solution: 'SELECT Id AS Code, Name AS Label FROM Customers ORDER BY Id;',
      cases: [{ sample: true }],
    };
    expect((await runCase(open, named, dataset, 0, named.solution)).passed).toBe(true);
    const lower = await runCase(
      open,
      named,
      dataset,
      0,
      'SELECT Id AS code, Name AS LABEL FROM Customers ORDER BY Id;',
    );
    expect(lower.passed).toBe(true);
    const unnamed = await runCase(
      open,
      named,
      dataset,
      0,
      'SELECT Id, Name AS Label FROM Customers ORDER BY Id;',
    );
    expect(unnamed.passed).toBe(false);
    expect(unnamed.mismatch).toEqual({
      kind: 'names',
      expected: ['Code', 'Label'],
      actual: ['id', 'label'],
    });
    // Con otros datos mal, se dice eso y no los nombres.
    const wrong = await runCase(
      open,
      named,
      dataset,
      0,
      'SELECT Id, Name FROM Customers ORDER BY Id DESC;',
    );
    expect(wrong.mismatch?.kind).toBe('order');
  }, 30_000);

  it('no corre código vacío ni lo que PostgreSQL no tiene', async () => {
    expect((await runCase(open, rows, dataset, 0, '-- nada')).refusal).toBe('empty');
    const blocked = await runCase(
      open,
      rows,
      dataset,
      0,
      'SELECT TOP 10 PERCENT Id FROM Customers;',
    );
    expect(blocked.refusal).toBe('blocked');
    expect(blocked.blocked).toEqual([{ key: 'top', line: 1 }]);
  }, 30_000);

  const table: SqlChallenge = {
    ...base,
    category: 'changes',
    tables: ['Accounts'],
    check: 'table',
    verify: 'SELECT Id, Balance FROM Accounts ORDER BY Id;',
    starter: 'SELECT 1;',
    solution: 'SELECT 1;',
    cases: [
      {
        sample: true,
        tables: {
          Accounts: {
            columns: ['Id', 'Balance'],
            rows: [
              [1, 100],
              [2, 0],
            ],
          },
        },
        expected: {
          columns: ['Id', 'Balance'],
          rows: [
            [1, 100],
            [2, 0],
          ],
        },
      },
    ],
  };

  it('en los cambios de datos sigue después de un error y revisa cómo quedó la tabla', async () => {
    const outcome = await runCase(
      open,
      table,
      dataset,
      0,
      'UPDATE Accounts SET Balance = Balance + 50 WHERE Id = 2;\nUPDATE Accounts SET Balance = Balance - 500 WHERE Id = 1;',
    );
    expect(outcome.error?.message).toContain('check');
    expect(outcome.actual?.rows.map((row) => Number(row[1]))).toEqual([100, 50]);
    expect(outcome.passed).toBe(false);
  }, 30_000);

  it('una transacción que falla se deshace, y lo que queda sin COMMIT se pierde', async () => {
    const aborted = await runCase(
      open,
      table,
      dataset,
      0,
      'BEGIN TRAN;\nUPDATE Accounts SET Balance = Balance + 50 WHERE Id = 2;\nUPDATE Accounts SET Balance = Balance - 500 WHERE Id = 1;\nCOMMIT;',
    );
    expect(aborted.passed).toBe(true);
    const uncommitted = await runCase(
      open,
      table,
      dataset,
      0,
      'BEGIN TRANSACTION;\nUPDATE Accounts SET Balance = 7;',
    );
    expect(uncommitted.passed).toBe(true);
  }, 30_000);

  const plan: SqlChallenge = {
    ...base,
    category: 'optimization',
    tables: ['Customers'],
    check: 'plan',
    plan: [{ kind: 'index', table: 'Customers' }],
    starter: 'SELECT Id FROM Customers WHERE Id + 0 = 4217;',
    solution: 'SELECT Id FROM Customers WHERE Id = 4217;',
    cases: [{ sample: true, generate: ['customers'], explain: true }],
  };

  it('en optimización compara con el código inicial y revisa el plan', async () => {
    const starter = await runCase(open, plan, dataset, 0, plan.starter);
    expect(starter.mismatch).toBeNull();
    expect(starter.plan?.rules).toEqual([
      { rule: { kind: 'index', table: 'Customers' }, ok: false },
    ]);
    const solution = await runCase(open, plan, dataset, 0, plan.solution);
    expect(solution.passed).toBe(true);
    expect(solution.plan?.text).toContain('Index');
    const two = await runCase(open, plan, dataset, 0, 'SELECT 1; SELECT 2;');
    expect(two.refusal).toBe('single-query');
  }, 60_000);
});

describe('runCase en un ejercicio de un curso', () => {
  // Sin `expected`, lo esperado de un caso es lo que devuelve la solución en ese mismo caso; con
  // `collation: 'ci'` las columnas de texto no distinguen mayúsculas, como en SQL Server.
  const lesson: SqlChallenge = {
    ...base,
    tables: ['Customers'],
    check: 'rows',
    collation: 'ci',
    starter: "SELECT Id FROM Customers WHERE Name = 'Luis' ORDER BY Id;",
    solution: "SELECT Id FROM Customers WHERE Name = 'ana' ORDER BY Id;",
    cases: [
      {
        sample: true,
        tables: {
          Customers: {
            columns: ['Id', 'Name'],
            rows: [
              [1, 'Ana'],
              [2, 'ANA'],
              [3, 'Luis'],
            ],
          },
        },
      },
    ],
  };

  it('lo esperado es lo que devuelve la solución, con la intercalación del curso', async () => {
    const solution = await runCase(open, lesson, dataset, 0, lesson.solution);
    expect(solution.passed).toBe(true);
    expect(solution.actual?.rows).toEqual([[1], [2]]);
    const wrong = await runCase(open, lesson, dataset, 0, lesson.starter);
    expect(wrong.passed).toBe(false);
    expect(wrong.mismatch).toEqual({ kind: 'row-count', expected: 2, actual: 1 });
    // Sin la intercalación, 'ana' no es 'Ana': la misma consulta encuentra otras filas.
    const { collation: _collation, ...plain } = lesson;
    const exact = await runCase(open, plain, dataset, 0, lesson.solution);
    expect(exact.actual?.rows).toEqual([]);
  }, 30_000);

  it('un caso con `expected` no corre la solución', async () => {
    const broken: SqlChallenge = {
      ...lesson,
      solution: 'SELECT Id FROM Nada;',
      cases: [{ ...lesson.cases[0]!, expected: { columns: ['Id'], rows: [[1], [2]] } }],
    };
    const outcome = await runCase(open, broken, dataset, 0, lesson.solution);
    expect(outcome.passed).toBe(true);
  }, 30_000);

  it('si la solución de referencia no corre, es un error del ejercicio y no del código', async () => {
    const broken: SqlChallenge = { ...lesson, solution: 'SELECT Id FROM Nada;' };
    await expect(runCase(open, broken, dataset, 0, lesson.starter)).rejects.toThrow(
      /solución de referencia del caso 1/,
    );
    const empty: SqlChallenge = { ...lesson, solution: '-- nada' };
    await expect(runCase(open, empty, dataset, 0, lesson.starter)).rejects.toThrow(/referencia/);
  }, 30_000);

  it('en los cambios de datos lo esperado es cómo queda la tabla con la solución', async () => {
    const change: SqlChallenge = {
      ...base,
      category: 'changes',
      tables: ['Accounts'],
      check: 'table',
      verify: 'SELECT Id, Balance FROM Accounts ORDER BY Id',
      starter: '-- escribe aquí',
      solution: 'UPDATE Accounts SET Balance = Balance + 50 WHERE Id = 1;',
      cases: [{ sample: true }],
    };
    expect((await runCase(open, change, dataset, 0, change.solution)).passed).toBe(true);
    const same = await runCase(open, change, dataset, 0, 'UPDATE Accounts SET Balance = 150;');
    expect(same.passed).toBe(true);
    const other = await runCase(open, change, dataset, 0, 'UPDATE Accounts SET Balance = 99;');
    expect(other.passed).toBe(false);
    expect(other.mismatch).toEqual({ kind: 'values', row: 0 });
  }, 30_000);
});

describe('runPlayground', () => {
  it('corre cada sentencia en la base de ejemplo y sigue después de un error', async () => {
    const outcome = await runPlayground(
      open,
      dataset,
      "UPDATE Customers SET Name = 'Eva' WHERE Id = 1;\nSELEC 1;\nSELECT Id, Name FROM Customers ORDER BY Id;",
      { explain: true },
    );
    expect(outcome.statements.map((statement) => statement.line)).toEqual([1, 2, 3]);
    expect(outcome.statements[0]?.result?.affected).toBe(1);
    expect(outcome.statements[1]?.error?.line).toBe(2);
    expect(outcome.statements[2]?.result?.rows).toEqual([
      [1, 'Eva'],
      [2, 'Luis'],
    ]);
    expect(outcome.plan).toContain('customers');
  }, 30_000);

  it('con generate llena las tablas con sus generadores', async () => {
    const outcome = await runPlayground(open, dataset, 'SELECT COUNT(*) FROM Customers;', {
      generate: true,
    });
    expect(Number(outcome.statements[0]?.result?.rows[0]?.[0])).toBe(20000);
  }, 30_000);
});
