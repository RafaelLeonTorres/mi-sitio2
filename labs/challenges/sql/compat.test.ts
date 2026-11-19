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
];

describe('funciones de T-SQL en PostgreSQL', () => {
  it('dan lo mismo que en SQL Server', async () => {
    const db = await open();
    try {
      const sql = CASES.map(([expression], index) => `SELECT ${expression} AS c${index};`).join(
        '\n',
      );
      const results = await db.exec(translate(sql).sql);
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
