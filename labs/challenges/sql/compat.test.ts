import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { normalizeCell } from './compare';
import { pgliteOpener, type CreatePGlite } from './pglite';
import { translate } from './translate';

// Las funciones de T-SQL de compat.ts en PGlite, contra lo que devuelve SQL Server con su
// configuración de siempre (DATEFIRST 7: la semana empieza en domingo). Cada expresión pasa por la
// traducción, igual que el código del visitante.

const open = pgliteOpener(((options) => PGlite.create(options)) as CreatePGlite);

const CASES: [string, string | number | null][] = [
  ["YEAR('2026-10-15')", 2026],
  ["MONTH('2026-10-15 13:45')", 10],
  ["DAY('2026-10-15')", 15],
  ["LEN('abc  ')", 3],
  ["LEN('  abc')", 5],
  ['ISNULL(NULL, 0)', 0],
  ['ISNULL(5, 0)', 5],
  ["IIF(1 > 2, 'a', 'b')", 'b'],
  ["CHARINDEX('b', 'abcb')", 2],
  ["CHARINDEX('b', 'abcb', 3)", 4],
  ["CHARINDEX('z', 'abc')", 0],
  ["REPLICATE('ab', 3)", 'ababab'],
  ["'[' + SPACE(2) + ']'", '[  ]'],
  ['DATEFROMPARTS(2026, 2, 28)', '2026-02-28'],
  ["EOMONTH('2024-02-10')", '2024-02-29'],
  ["'a' + 'b'", 'ab'],
  ["DATEADD(day, 1, '2026-12-31')", '2027-01-01'],
  ["DATEADD(month, 1, '2026-01-31')", '2026-02-28'],
  ["DATEADD(yy, -1, '2024-02-29')", '2023-02-28'],
  ["DATEADD(hour, 2, CAST('2026-10-15 23:00' AS datetime2))", '2026-10-16 01:00:00'],
  ["DATEADD(day, 1, CAST('2026-10-15' AS date))", '2026-10-16'],
  ["DATEDIFF(year, '2025-12-31', '2026-01-01')", 1],
  ["DATEDIFF(month, '2026-01-31', '2026-02-01')", 1],
  ["DATEDIFF(day, '2026-05-01 23:59', '2026-06-01 00:01')", 31],
  ["DATEDIFF(hour, '2026-01-01 10:59', '2026-01-01 11:00')", 1],
  ["DATEDIFF(week, '2026-10-17', '2026-10-18')", 1],
  ["DATEDIFF(quarter, '2026-03-31', '2026-04-01')", 1],
  ["DATEPART(weekday, '2026-10-18')", 1],
  ["DATEPART(dayofyear, '2026-02-01')", 32],
  ["DATEPART(week, '2026-01-04')", 2],
  ["DATETRUNC(month, '2026-10-15 13:00')", '2026-10-01'],
  ["DATETRUNC(week, '2026-10-15')", '2026-10-11'],
  ["CONVERT(date, '2026-10-15 13:00')", '2026-10-15'],
  // CONVERT con estilo, de fecha a texto: el valor de SQL Server 2022 para 2024-03-05 14:07:09.123.
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 23)", '2024-03-05'],
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 101)", '03/05/2024'],
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 102)", '2024.03.05'],
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 103)", '05/03/2024'],
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 104)", '05.03.2024'],
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 105)", '05-03-2024'],
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 108)", '14:07:09'],
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 110)", '03-05-2024'],
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 111)", '2024/03/05'],
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 112)", '20240305'],
  ["CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 120)", '2024-03-05 14:07:09'],
  [
    "CONVERT(varchar(30), CAST('2024-03-05 14:07:09.123' AS datetime), 121)",
    '2024-03-05 14:07:09.123',
  ],
  ["CONVERT(varchar(10), CAST('2024-03-05 14:07:09.123' AS datetime), 120)", '2024-03-05'],
  ["CONVERT(varchar(10), CAST('2024-03-05' AS date), 103)", '05/03/2024'],
  // Y de texto a fecha.
  ["CONVERT(date, '05/03/2024', 103)", '2024-03-05'],
  ["CONVERT(date, '05/03/2024', 101)", '2024-05-03'],
  ["CONVERT(date, '5/3/2024', 103)", '2024-03-05'],
  ["CONVERT(date, '05.03.2024', 104)", '2024-03-05'],
  ["CONVERT(date, '03-05-2024', 110)", '2024-03-05'],
  ["CONVERT(date, '2024/03/05', 111)", '2024-03-05'],
  ["CONVERT(date, '20240305', 112)", '2024-03-05'],
  ["CONVERT(date, '2024-03-05 14:07:09', 120)", '2024-03-05'],
  ["CONVERT(datetime, '05/03/2024 14:07:09', 103)", '2024-03-05 14:07:09'],
  ["CONVERT(datetime2, '2024-03-05 14:07:09.123', 121)", '2024-03-05 14:07:09.123'],
  // TRY_CAST y TRY_CONVERT: NULL cuando no se puede convertir, y lo raro de SQL Server con el texto vacío.
  ["TRY_CAST('x1' AS int)", null],
  ["TRY_CAST('12' AS int)", 12],
  ["TRY_CAST(' 12 ' AS int)", 12],
  ["TRY_CAST('-7' AS int)", -7],
  ["TRY_CAST('12.5' AS int)", null],
  ["TRY_CAST('1,234' AS int)", null],
  ["TRY_CAST('1e3' AS int)", null],
  ["TRY_CAST('0x10' AS int)", null],
  ["TRY_CAST('1_000' AS int)", null],
  ["TRY_CAST('3000000000' AS int)", null],
  ["TRY_CAST('3000000000' AS bigint)", 3000000000],
  ["TRY_CAST('1e3' AS float)", 1000],
  ["TRY_CAST('' AS int)", 0],
  ["TRY_CAST('   ' AS int)", 0],
  ["TRY_CAST('' AS decimal(10, 2))", null],
  ["TRY_CAST('' AS date)", '1900-01-01'],
  ["TRY_CAST('12.50' AS decimal(10, 2))", '12.50'],
  ["TRY_CAST('.5' AS decimal(10, 2))", '0.50'],
  ["TRY_CAST('1.005' AS decimal(10, 2))", '1.01'],
  ["TRY_CAST('123456' AS decimal(5, 2))", null],
  ["TRY_CAST('2024-13-45' AS date)", null],
  ["TRY_CAST('2024-02-30' AS date)", null],
  ["TRY_CAST('abc' AS date)", null],
  ["TRY_CAST('20240305' AS date)", '2024-03-05'],
  ["TRY_CAST('03/05/2024' AS date)", '2024-03-05'],
  ["TRY_CAST('13/05/2024' AS date)", null],
  ["TRY_CAST('2024-03-05 14:07:09' AS date)", '2024-03-05'],
  ["TRY_CAST('2024-03-05 14:07' AS datetime2)", '2024-03-05 14:07:00'],
  ["TRY_CAST('abcdefghij' AS varchar(5))", 'abcde'],
  ["TRY_CAST('abc' AS uniqueidentifier)", null],
  ['TRY_CAST(NULL AS int)', null],
  ['TRY_CAST(12345 AS varchar(10))', '12345'],
  ["ISNULL(TRY_CAST('x' AS int), -1)", -1],
  ["TRY_CONVERT(int, 'x1')", null],
  ["TRY_CONVERT(int, '42')", 42],
  ["TRY_CONVERT(date, '2024-03-05')", '2024-03-05'],
  ["TRY_CONVERT(nvarchar(3), 'abcdef')", 'abc'],
  // Texto, fechas y agregados que el curso usa: el valor de SQL Server 2022 con us_english.
  ["STUFF('abcdef', 2, 3, 'XYZ')", 'aXYZef'],
  ["STUFF('abc', 1, 0, 'ZZ')", 'ZZabc'],
  ["STUFF('abc', 5, 1, 'x')", null],
  ["STUFF('abc', 2, 99, 'Q')", 'aQ'],
  ["DATENAME(month, '2024-03-05')", 'March'],
  ["DATENAME(weekday, '2024-03-05')", 'Tuesday'],
  ["DATENAME(year, '2024-03-05')", '2024'],
  ["DATENAME(day, '2024-03-05')", '5'],
  ["DATENAME(quarter, '2024-03-05')", '1'],
  ["DATENAME(dayofyear, '2024-03-05')", '65'],
  ["ISDATE('2024-03-05')", 1],
  ["ISDATE('2024-02-30')", 0],
  ["ISDATE('')", 0],
  ["ISDATE('abc')", 0],
  ["ISDATE('3/5/2024')", 1],
  ['ISDATE(NULL)', 0],
  [
    "(SELECT STRING_AGG(value, '|') WITHIN GROUP (ORDER BY value) FROM STRING_SPLIT('a,b,,c', ','))",
    '|a|b|c',
  ],
  ["(SELECT COUNT(*) FROM STRING_SPLIT('a,b,,c', ','))", 4],
  ['(SELECT STDEV(x) FROM (VALUES (1), (2), (4)) AS v(x))', 1.5275252316519468],
  ['(SELECT STDEVP(x) FROM (VALUES (1), (2), (4)) AS v(x))', 1.2472191289246473],
  ['(SELECT VAR(x) FROM (VALUES (1), (2), (4)) AS v(x))', 2.333333333333334],
  ['(SELECT VARP(x) FROM (VALUES (1), (2), (4)) AS v(x))', 1.555555555555556],
];

// TOP traducido a FETCH FIRST: las filas que da SQL Server 2022 para cada consulta.
const NUMBERS = '(VALUES (3), (1), (3), (2), (3)) AS t(n)';
const TOP_CASES: [string, number[][]][] = [
  [`SELECT TOP (2) n FROM ${NUMBERS} ORDER BY n DESC;`, [[3], [3]]],
  [`SELECT TOP (2) WITH TIES n FROM ${NUMBERS} ORDER BY n DESC;`, [[3], [3], [3]]],
  [`SELECT DISTINCT TOP 2 n FROM ${NUMBERS} ORDER BY n DESC;`, [[3], [2]]],
  [`SELECT TOP (0) n FROM ${NUMBERS};`, []],
  [`SELECT * FROM (SELECT TOP 2 n FROM ${NUMBERS} ORDER BY n) AS q ORDER BY n DESC;`, [[2], [1]]],
  [
    'SELECT n, (SELECT TOP 1 m FROM (VALUES (5), (7)) AS u(m) ORDER BY m DESC) AS top_m FROM (VALUES (1), (2)) AS t(n) ORDER BY n;',
    [
      [1, 7],
      [2, 7],
    ],
  ],
  [
    'SELECT c.id, x.m FROM (VALUES (1), (2)) AS c(id) CROSS APPLY (SELECT TOP 1 m FROM (VALUES (10, 1), (20, 1), (30, 2)) AS u(m, cid) WHERE u.cid = c.id ORDER BY m DESC) AS x ORDER BY c.id;',
    [
      [1, 20],
      [2, 30],
    ],
  ],
  [
    'SELECT TOP 2 n FROM (SELECT n FROM (VALUES (3), (1), (2)) AS t(n)) AS c ORDER BY n;',
    [[1], [2]],
  ],
];

describe('funciones de T-SQL en PostgreSQL', () => {
  it('dan lo mismo que en SQL Server', async () => {
    const db = await open();
    try {
      const sql = CASES.map(([expression], index) => `SELECT ${expression} AS c${index};`).join(
        '\n',
      );
      const results = await db.exec(translate(sql).sql);
      expect(results).toHaveLength(CASES.length);
      CASES.forEach(([expression, expected], index) => {
        expect(normalizeCell(results[index]?.rows[0]?.[0]), expression).toBe(
          normalizeCell(expected),
        );
      });
      const [now, id] = await db.exec('SELECT GETDATE(); SELECT NEWID();');
      expect(now?.rows[0]?.[0]).toBeTruthy();
      expect(String(id?.rows[0]?.[0])).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      await db.close();
    }
  }, 60_000);
});

describe('TOP en PostgreSQL', () => {
  const cells = (rows: readonly (readonly unknown[])[] | undefined) =>
    (rows ?? []).map((row) => row.map(normalizeCell));

  it('da las mismas filas que en SQL Server', async () => {
    const db = await open();
    try {
      for (const [sql, expected] of TOP_CASES) {
        const [result] = await db.exec(translate(sql).sql);
        expect(cells(result?.rows), sql).toEqual(cells(expected));
      }
    } finally {
      await db.close();
    }
  }, 60_000);

  it('corre dentro de SELECT … INTO y de un DELETE con subconsulta', async () => {
    const db = await open();
    try {
      const results = await db.exec(
        translate(
          [
            'CREATE TABLE #nums (n int);',
            'INSERT INTO #nums VALUES (5), (3), (9), (1), (7);',
            'SELECT TOP 3 n INTO #top3 FROM #nums ORDER BY n DESC;',
            'SELECT n FROM #top3 ORDER BY n;',
            'DELETE FROM #nums WHERE n IN (SELECT TOP 2 n FROM #nums ORDER BY n DESC);',
            'SELECT n FROM #nums ORDER BY n;',
          ].join('\n'),
        ).sql,
      );
      expect(cells(results[3]?.rows)).toEqual(cells([[5], [7], [9]]));
      expect(cells(results[5]?.rows)).toEqual(cells([[1], [3], [5]]));
    } finally {
      await db.close();
    }
  }, 60_000);
});
