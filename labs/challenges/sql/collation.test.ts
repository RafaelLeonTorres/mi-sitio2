import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { normalizeCell } from './compare';
import { pgliteOpener, type CreatePGlite } from './pglite';
import { translate } from './translate';

// La intercalación sin mayúsculas (collation: 'ci') y COLLATE, contra lo que da SQL Server 2022 con
// la intercalación SQL_Latin1_General_CP1_CI_AS (en tempdb, con las columnas creadas con ella). Los
// datos de Names llevan acentos y mayúsculas mezcladas, para que el orden cuente.

const open = pgliteOpener(((options) => PGlite.create(options)) as CreatePGlite);

const SCHEMA = `
CREATE TABLE People (Id int PRIMARY KEY, Name varchar(30) NOT NULL, City varchar(30) NOT NULL);
INSERT INTO People VALUES (1, 'Ana', 'Lima'), (2, 'ana', 'lima'), (3, 'ANA', 'LIMA'), (4, 'Bruno', 'Quito'),
  (5, 'bruno', 'quito'), (6, 'Carla', 'Lima'), (7, 'alberto', 'Cusco'), (8, 'Zoe', 'Bogota'),
  (9, '10 manzanas', 'Lima');
CREATE TABLE Cities (Name varchar(30) NOT NULL PRIMARY KEY, Country varchar(20));
INSERT INTO Cities VALUES ('Lima', 'Peru'), ('Quito', 'Ecuador'), ('Cusco', 'Peru');
CREATE TABLE Codes (Name varchar(10) UNIQUE);
INSERT INTO Codes VALUES ('a');
CREATE TABLE Names (Id int PRIMARY KEY, Name nvarchar(30) NOT NULL);
INSERT INTO Names VALUES (1, N'zeta'), (2, N'Éxito'), (3, N'exito'), (4, N'eagle'), (5, N'Fabian'),
  (6, N'Ñandú'), (7, N'nube'), (8, N'Nora'), (9, N'Álvaro'), (10, N'alvaro'), (11, N'abc'),
  (12, N'ABC'), (13, N'Abd'), (14, N'10 manzanas'), (15, N'a b'), (16, N'ab'), (17, N'Zoe'),
  (18, N'Zoé'), (19, N'ñu'), (20, N'nz'), (21, N'Mérida'), (22, N'merida'), (23, N'Mexico'),
  (24, N'mexico');
`;

type Rows = (string | number | null)[][];
const ids = (list: number[]): Rows => list.map((id) => [id]);

const CHECKS: [string, Rows][] = [
  ["SELECT Id FROM People WHERE Name = 'ana' ORDER BY Id;", ids([1, 2, 3])],
  ["SELECT Id FROM People WHERE Name <> 'ana' ORDER BY Id;", ids([4, 5, 6, 7, 8, 9])],
  ["SELECT Id FROM People WHERE Name IN ('ANA', 'bruno') ORDER BY Id;", ids([1, 2, 3, 4, 5])],
  ["SELECT Id FROM People WHERE Name LIKE 'a%' ORDER BY Id;", ids([1, 2, 3, 7])],
  ["SELECT Id FROM People WHERE Name LIKE '%NA' ORDER BY Id;", ids([1, 2, 3])],
  [
    'SELECT COUNT(*) FROM People GROUP BY Name ORDER BY COUNT(*) DESC, MIN(Id);',
    [[3], [2], [1], [1], [1], [1]],
  ],
  ['SELECT COUNT(DISTINCT Name) FROM People;', [[6]]],
  ['SELECT Id FROM People ORDER BY Name, Id;', ids([9, 7, 1, 2, 3, 4, 5, 6, 8])],
  ['SELECT MIN(Name), MAX(Name) FROM People;', [['10 manzanas', 'Zoe']]],
  [
    'SELECT p.Id, c.Country FROM People p JOIN Cities c ON c.Name = p.City ORDER BY p.Id;',
    [
      [1, 'Peru'],
      [2, 'Peru'],
      [3, 'Peru'],
      [4, 'Ecuador'],
      [5, 'Ecuador'],
      [6, 'Peru'],
      [7, 'Peru'],
      [9, 'Peru'],
    ],
  ],
  [
    'SELECT Id, ROW_NUMBER() OVER (PARTITION BY Name ORDER BY Id) AS rn FROM People ORDER BY Id;',
    [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 1],
      [5, 2],
      [6, 1],
      [7, 1],
      [8, 1],
      [9, 1],
    ],
  ],
  ["SELECT Id FROM People WHERE Name BETWEEN 'a' AND 'b' ORDER BY Id;", ids([1, 2, 3, 7])],
  ["SELECT Id FROM People WHERE Name > 'BRUNO' ORDER BY Id;", ids([6, 8])],
  [
    "SELECT Id, REPLACE(Name, 'A', 'x') FROM People WHERE Id <= 3 ORDER BY Id;",
    [
      [1, 'xnx'],
      [2, 'xnx'],
      [3, 'xNx'],
    ],
  ],
  [
    "SELECT Id, CHARINDEX('A', Name) FROM People WHERE Id IN (1, 3, 4, 6, 7) ORDER BY Id;",
    [
      [1, 1],
      [3, 1],
      [4, 0],
      [6, 2],
      [7, 1],
    ],
  ],
  [
    "SELECT Id FROM People WHERE CASE WHEN Name = 'ANA' THEN 1 ELSE 0 END = 1 ORDER BY Id;",
    ids([1, 2, 3]),
  ],
  [
    "SELECT Id FROM People WHERE Name = 'ana' COLLATE SQL_Latin1_General_CP1_CS_AS ORDER BY Id;",
    ids([2]),
  ],
  // Con acentos: SQL_Latin1_General_CP1_CI_AS ordena é después de e, no distingue Mérida de merida
  // por mayúsculas pero sí por el acento, y la ñ va junto a la n.
  [
    'SELECT Id FROM Names ORDER BY Name, Id;',
    ids([14, 15, 16, 11, 12, 13, 10, 9, 4, 3, 2, 5, 22, 21, 23, 24, 6, 8, 19, 7, 20, 1, 17, 18]),
  ],
  [
    'SELECT Id FROM Names ORDER BY Name COLLATE SQL_Latin1_General_CP1_CS_AS, Id;',
    ids([14, 15, 16, 11, 12, 13, 10, 9, 4, 3, 2, 5, 22, 21, 24, 23, 6, 8, 19, 7, 20, 1, 17, 18]),
  ],
  [
    'SELECT Id FROM Names ORDER BY Name COLLATE Latin1_General_CI_AI, Id;',
    ids([14, 15, 16, 11, 12, 13, 9, 10, 4, 2, 3, 5, 21, 22, 23, 24, 6, 8, 19, 7, 20, 1, 17, 18]),
  ],
  ['SELECT COUNT(DISTINCT Name) FROM Names;', [[22]]],
  ['SELECT COUNT(DISTINCT Name COLLATE Latin1_General_CI_AI) FROM Names;', [[18]]],
  ["SELECT Id FROM Names WHERE Name = N'merida' ORDER BY Id;", ids([22])],
  [
    "SELECT Id FROM Names WHERE Name COLLATE Latin1_General_CI_AI = N'merida' ORDER BY Id;",
    ids([21, 22]),
  ],
  ["SELECT Id FROM Names WHERE Name LIKE N'm%' ORDER BY Id;", ids([21, 22, 23, 24])],
  ["SELECT Id FROM Names WHERE Name LIKE N'%é%' ORDER BY Id;", ids([2, 18, 21])],
  [
    "SELECT Id FROM Names WHERE Name BETWEEN N'a' AND N'b' ORDER BY Id;",
    ids([9, 10, 11, 12, 13, 15, 16]),
  ],
];

const cells = (rows: readonly (readonly unknown[])[] | undefined) =>
  (rows ?? []).map((row) => row.map(normalizeCell));

describe('intercalación sin mayúsculas (collation: ci)', () => {
  it('da lo mismo que SQL Server con SQL_Latin1_General_CP1_CI_AS', async () => {
    const db = await open();
    try {
      await db.exec(translate(SCHEMA, { collation: 'ci' }).sql);
      for (const [sql, expected] of CHECKS) {
        const [result] = await db.exec(translate(sql, { collation: 'ci' }).sql);
        expect(cells(result?.rows), sql).toEqual(cells(expected));
      }
      // Un UNIQUE tampoco deja repetir con otras mayúsculas: el error 2627 de SQL Server.
      await expect(db.exec("INSERT INTO Codes VALUES ('A');")).rejects.toThrow(/duplicate key/);
    } finally {
      await db.close();
    }
  }, 60_000);

  it('sin la opción, PostgreSQL distingue mayúsculas: la diferencia que explica el cuadro Ojo', async () => {
    const db = await open();
    try {
      await db.exec(translate(SCHEMA).sql);
      const [equal] = await db.exec("SELECT Id FROM People WHERE Name = 'ana' ORDER BY Id;");
      expect(cells(equal?.rows)).toEqual(cells(ids([2])));
      const [groups] = await db.exec('SELECT COUNT(DISTINCT Name) FROM People;');
      expect(cells(groups?.rows)).toEqual(cells([[9]]));
    } finally {
      await db.close();
    }
  }, 60_000);

  it('las tablas que crea el código del alumno también quedan sin mayúsculas', async () => {
    const db = await open();
    try {
      const run = async (sql: string) => db.exec(translate(sql, { collation: 'ci' }).sql);
      await run('CREATE TABLE Pets (Id int PRIMARY KEY, Name nvarchar(20) NOT NULL);');
      await run("INSERT INTO Pets VALUES (1, 'Luna'), (2, 'LUNA'), (3, 'Max');");
      await run('ALTER TABLE Pets ADD Owner varchar(20);');
      await run("UPDATE Pets SET Owner = 'Ana';");
      const [byName] = await run("SELECT Id FROM Pets WHERE Name = 'luna' ORDER BY Id;");
      expect(cells(byName?.rows)).toEqual(cells(ids([1, 2])));
      const [byOwner] = await run("SELECT COUNT(*) FROM Pets WHERE Owner = 'ANA';");
      expect(cells(byOwner?.rows)).toEqual(cells([[3]]));
      // SELECT … INTO conserva la intercalación de las columnas.
      await run('SELECT Name INTO #Copy FROM Pets;');
      const [copied] = await run("SELECT COUNT(*) FROM #Copy WHERE Name = 'MAX';");
      expect(cells(copied?.rows)).toEqual(cells([[1]]));
    } finally {
      await db.close();
    }
  }, 60_000);
});
