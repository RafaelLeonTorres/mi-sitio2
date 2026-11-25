import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { normalizeCell } from './compare';
import { pgliteOpener, type CreatePGlite } from './pglite';
import { translate } from './translate';

// OUTPUT, UPDATE y DELETE con JOIN y las CTE recursivas, ya traducidos, en PGlite. Los valores
// esperados son los que da SQL Server 2022 con el mismo guion (con OUTPUT … INTO en una tabla
// temporal, para leerlos), en tempdb.

const open = pgliteOpener(((options) => PGlite.create(options)) as CreatePGlite);

type Rows = (string | number | null)[][];

const cellsOf = (rows: readonly (readonly unknown[])[] | undefined, sorted = false) => {
  const out = (rows ?? []).map((row) => row.map(normalizeCell));
  return sorted ? out.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : out;
};

/** Corre un guion ya traducido y compara las filas de las sentencias que traen un valor esperado. */
async function runScript(steps: readonly (readonly [string, Rows?, boolean?])[]) {
  const db = await open();
  try {
    const results = await db.exec(translate(steps.map(([sql]) => sql).join('\n')).sql);
    expect(results).toHaveLength(steps.length);
    steps.forEach(([sql, expected, sorted], index) => {
      if (expected)
        expect(cellsOf(results[index]?.rows, sorted), sql).toEqual(cellsOf(expected, sorted));
    });
  } finally {
    await db.close();
  }
}

const PRODUCTS = [
  ['CREATE TABLE cat (Id int PRIMARY KEY, Name varchar(20));'],
  ["INSERT INTO cat VALUES (1, 'Books'), (2, 'Toys'), (3, 'Food');"],
  [
    'CREATE TABLE prod (Id int PRIMARY KEY, Name varchar(20), CategoryId int, Price decimal(10, 2));',
  ],
  [
    "INSERT INTO prod VALUES (1, 'Novel', 1, 10), (2, 'Atlas', 1, 20), (3, 'Robot', 2, 30), (4, 'Bread', 3, 2), (5, 'Orphan', NULL, 5);",
  ],
] as const;

describe('OUTPUT, UPDATE y DELETE con JOIN y CTE recursivas en PostgreSQL', () => {
  it(
    'OUTPUT da las mismas filas que en SQL Server',
    () =>
      runScript([
        ['CREATE TABLE t (Id int IDENTITY(1, 1) PRIMARY KEY, Name varchar(20), Qty int);'],
        [
          "INSERT INTO t (Name, Qty) OUTPUT inserted.Id, inserted.Name VALUES ('a', 1), ('b', 2), ('c', 3);",
          [
            [1, 'a'],
            [2, 'b'],
            [3, 'c'],
          ],
        ],
        [
          'UPDATE t SET Qty = Qty + 10 OUTPUT deleted.Qty, inserted.Qty WHERE Id <= 2;',
          [
            [1, 11],
            [2, 12],
          ],
        ],
        ['DELETE FROM t OUTPUT deleted.Id, deleted.Name WHERE Qty > 11;', [[2, 'b']]],
        [
          "MERGE t AS tgt USING (VALUES (1, 'z'), (9, 'n')) AS s(Id, Name) ON tgt.Id = s.Id WHEN MATCHED THEN UPDATE SET Name = s.Name WHEN NOT MATCHED BY TARGET THEN INSERT (Name, Qty) VALUES (s.Name, 0) OUTPUT $action, inserted.Id, inserted.Name;",
          [
            ['INSERT', 4, 'n'],
            ['UPDATE', 1, 'z'],
          ],
          true,
        ],
        [
          'INSERT INTO t (Name, Qty) OUTPUT inserted.Id, inserted.Qty SELECT Name, Qty + 100 FROM t WHERE Id = 1;',
          [[5, 111]],
        ],
        [
          'SELECT Id, Name, Qty FROM t ORDER BY Id;',
          [
            [1, 'z', 11],
            [3, 'c', 3],
            [4, 'n', 0],
            [5, 'z', 111],
          ],
        ],
      ]),
    60_000,
  );

  it(
    'UPDATE y DELETE con JOIN dejan las mismas filas que en SQL Server',
    () =>
      runScript([
        ...PRODUCTS,
        [
          "UPDATE p SET p.Price = p.Price * 1.1 FROM prod AS p JOIN cat AS c ON c.Id = p.CategoryId WHERE c.Name = 'Books';",
        ],
        [
          'SELECT Id, Price FROM prod ORDER BY Id;',
          [
            [1, 11],
            [2, 22],
            [3, 30],
            [4, 2],
            [5, 5],
          ],
        ],
        [
          "UPDATE prod SET Price = Price + c.Id FROM prod INNER JOIN cat AS c ON c.Id = prod.CategoryId WHERE c.Name <> 'Toys';",
        ],
        [
          'SELECT Id, Price FROM prod ORDER BY Id;',
          [
            [1, 12],
            [2, 23],
            [3, 30],
            [4, 5],
            [5, 5],
          ],
        ],
        ['DELETE p FROM prod AS p LEFT JOIN cat AS c ON c.Id = p.CategoryId WHERE c.Id IS NULL;'],
        ['SELECT Id FROM prod ORDER BY Id;', [[1], [2], [3], [4]]],
        ["DELETE p FROM prod AS p JOIN cat AS c ON c.Id = p.CategoryId WHERE c.Name = 'Toys';"],
        ['SELECT Id FROM prod ORDER BY Id;', [[1], [2], [4]]],
        [
          "DELETE FROM p FROM prod AS p JOIN cat AS c ON c.Id = p.CategoryId WHERE c.Name = 'Food';",
        ],
        ['SELECT Id FROM prod ORDER BY Id;', [[1], [2]]],
      ]),
    60_000,
  );

  it(
    'UPDATE y DELETE con JOIN y OUTPUT devuelven las mismas filas que en SQL Server',
    () =>
      runScript([
        ...PRODUCTS,
        [
          "UPDATE p SET p.Price = p.Price * 2 OUTPUT deleted.Id, deleted.Price, inserted.Price FROM prod AS p JOIN cat AS c ON c.Id = p.CategoryId WHERE c.Name = 'Books';",
          [
            [1, 10, 20],
            [2, 20, 40],
          ],
          true,
        ],
        [
          "DELETE p OUTPUT deleted.Id, deleted.Name FROM prod AS p JOIN cat AS c ON c.Id = p.CategoryId WHERE c.Name = 'Food';",
          [[4, 'Bread']],
        ],
        [
          'DELETE p OUTPUT deleted.Id, deleted.Name FROM prod AS p LEFT JOIN cat AS c ON c.Id = p.CategoryId WHERE c.Id IS NULL;',
          [[5, 'Orphan']],
        ],
        [
          'SELECT Id, Price FROM prod ORDER BY Id;',
          [
            [1, 20],
            [2, 40],
            [3, 30],
          ],
        ],
      ]),
    60_000,
  );

  it(
    'las CTE recursivas dan lo mismo que en SQL Server',
    () =>
      runScript([
        ['CREATE TABLE emp (Id int PRIMARY KEY, Name varchar(20), ManagerId int);'],
        [
          "INSERT INTO emp VALUES (1, 'Ana', NULL), (2, 'Bruno', 1), (3, 'Carla', 1), (4, 'Diego', 2), (5, 'Elena', 4);",
        ],
        [
          'WITH n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 5) SELECT i FROM n ORDER BY i;',
          [[1], [2], [3], [4], [5]],
        ],
        [
          'WITH tree AS (SELECT Id, Name, 0 AS Lvl FROM emp WHERE ManagerId IS NULL UNION ALL SELECT e.Id, e.Name, t.Lvl + 1 FROM emp e JOIN tree t ON e.ManagerId = t.Id) SELECT Id, Name, Lvl FROM tree ORDER BY Id;',
          [
            [1, 'Ana', 0],
            [2, 'Bruno', 1],
            [3, 'Carla', 1],
            [4, 'Diego', 2],
            [5, 'Elena', 3],
          ],
        ],
        [
          "WITH d AS (SELECT CAST('2024-01-01' AS date) AS d UNION ALL SELECT DATEADD(day, 1, d) FROM d WHERE d < '2024-01-31') SELECT COUNT(*), MIN(d), MAX(d) FROM d OPTION (MAXRECURSION 400);",
          [[31, '2024-01-01', '2024-01-31']],
        ],
        [
          "WITH p AS (SELECT Id, CAST(Name AS varchar(100)) AS Path FROM emp WHERE ManagerId IS NULL UNION ALL SELECT e.Id, CAST(p.Path + ' > ' + e.Name AS varchar(100)) FROM emp e JOIN p ON e.ManagerId = p.Id) SELECT Id, Path FROM p ORDER BY Id;",
          [
            [1, 'Ana'],
            [2, 'Ana > Bruno'],
            [3, 'Ana > Carla'],
            [4, 'Ana > Bruno > Diego'],
            [5, 'Ana > Bruno > Diego > Elena'],
          ],
        ],
      ]),
    60_000,
  );
});
