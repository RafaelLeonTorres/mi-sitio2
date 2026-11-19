import { describe, expect, it } from 'vitest';
import { selectList } from './columns';
import { select, scan } from './plan';
import { clusteredIndex, table } from './schema';
import type { QueryRun } from './scenario';
import { declaration, script, statementScript } from './script';

const plan = select(scan(clusteredIndex(table('Orders', 1000)), { rows: 1000 }));

describe('SQL para copiar a SSMS', () => {
  it('declara cada parámetro con su tipo', () => {
    expect(declaration('Skip', 199_980)).toBe('DECLARE @Skip int = 199980;');
    expect(declaration('LastDate', "'2025-06-19 20:23:53'")).toBe(
      "DECLARE @LastDate datetime2(0) = '2025-06-19 20:23:53';",
    );
    expect(declaration('Name', "N'Ana'")).toBe("DECLARE @Name nvarchar(4000) = N'Ana';");
  });

  it('pone los DECLARE arriba de la sentencia, y nada si no tiene parámetros', () => {
    expect(
      statementScript({ sql: 'SELECT TOP(@p) Id FROM Orders', plan, times: 1, params: { p: 20 } }),
    ).toBe('DECLARE @p int = 20;\nSELECT TOP(@p) Id FROM Orders');
    expect(statementScript({ sql: 'SELECT 1;', plan, times: 1 })).toBe('SELECT 1;');
  });

  it('separa las sentencias con GO, porque cada una vuelve a declarar @p', () => {
    const run: QueryRun = {
      label: 'loop',
      rows: 1,
      statements: [
        { sql: 'SELECT TOP(@p) Id FROM Orders', plan, times: 1, params: { p: 10 } },
        { sql: 'SELECT Name FROM Customers WHERE Id = @p', plan, times: 10, params: { p: 7 } },
      ],
    };
    expect(script(run)).toBe(
      [
        'DECLARE @p int = 10;',
        'SELECT TOP(@p) Id FROM Orders',
        'GO',
        'DECLARE @p int = 7;',
        'SELECT Name FROM Customers WHERE Id = @p',
      ].join('\n'),
    );
  });
});

describe('listas de columnas', () => {
  it('parte la lista en renglones con sangría, sin pasar del ancho', () => {
    const columns = [
      '[o].[Id]',
      '[o].[CustomerId]',
      '[o].[Notes]',
      '[o].[OrderDate]',
      '[o].[Total]',
    ];
    const text = selectList('SELECT TOP(@p)', columns, 40);
    expect(text.split('\n').every((line) => line.length <= 40)).toBe(true);
    expect(text).toBe(
      [
        'SELECT TOP(@p) [o].[Id],',
        '    [o].[CustomerId], [o].[Notes],',
        '    [o].[OrderDate], [o].[Total]',
      ].join('\n'),
    );
  });

  it('con pocas columnas queda en un renglón', () => {
    expect(selectList('SELECT', ['[o].[Id]', '[o].[Total]'])).toBe('SELECT [o].[Id], [o].[Total]');
  });
});
