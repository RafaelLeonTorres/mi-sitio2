import { describe, expect, it } from 'vitest';
import { diffBlocks, examples, fences, formatTable, rowCount } from './sql-examples';

describe('formatTable', () => {
  it('escribe el resultado como psql: cabecera centrada, números a la derecha y pie', () => {
    // El ejemplo de la documentación de PostgreSQL (el tutorial, `SELECT * FROM weather`), con NULL
    // en lugar del hueco que psql deja por omisión.
    const lines = formatTable(
      {
        columns: ['city', 'temp_lo', 'temp_hi', 'prcp', 'date'],
        rows: [
          ['San Francisco', 46, 50, '0.25', '1994-11-27'],
          ['San Francisco', 43, 57, 0, '1994-11-29'],
          ['Hayward', 37, 54, null, '1994-11-29'],
        ],
      },
      'en',
    );
    expect(lines).toEqual([
      '     city      | temp_lo | temp_hi | prcp |    date',
      '---------------+---------+---------+------+------------',
      ' San Francisco |      46 |      50 | 0.25 | 1994-11-27',
      ' San Francisco |      43 |      57 |    0 | 1994-11-29',
      ' Hayward       |      37 |      54 | NULL | 1994-11-29',
      '(3 rows)',
    ]);
  });

  it('alinea a la derecha las columnas que traen números como texto, y deja el texto a la izquierda', () => {
    const lines = formatTable(
      {
        columns: ['Name', 'Price'],
        rows: [
          ['Café', '189.00'],
          ['Té verde 100 g', '95.00'],
        ],
      },
      'es',
    );
    expect(lines).toEqual([
      '      Name      | Price',
      '----------------+--------',
      ' Café           | 189.00',
      ' Té verde 100 g |  95.00',
      '(2 filas)',
    ]);
  });

  it('un resultado sin filas deja la cabecera y el pie', () => {
    expect(formatTable({ columns: ['Id'], rows: [] }, 'es')).toEqual([' Id', '----', '(0 filas)']);
  });

  it('un texto con números, como un código, se queda a la izquierda', () => {
    const lines = formatTable({ columns: ['Code'], rows: [['A1'], ['22']] }, 'en');
    expect(lines.slice(2, 4)).toEqual([' A1', ' 22']);
  });
});

describe('rowCount', () => {
  it('usa el singular y el plural de cada idioma', () => {
    expect(rowCount(1, 'es')).toBe('(1 fila)');
    expect(rowCount(0, 'es')).toBe('(0 filas)');
    expect(rowCount(1, 'en')).toBe('(1 row)');
    expect(rowCount(6, 'en')).toBe('(6 rows)');
  });
});

describe('diffBlocks', () => {
  it('ignora los espacios del final y las mayúsculas de la cabecera', () => {
    expect(diffBlocks([' Name  ', '------', ' Ana'], [' name', '------  ', ' Ana  '])).toBeNull();
  });

  it('dice la primera línea que difiere', () => {
    expect(diffBlocks([' Id', '----', '  1'], [' Id', '----', '  2'])).toEqual({
      line: 3,
      expected: '  1',
      actual: '  2',
    });
  });

  it('una línea de más o de menos también es una diferencia', () => {
    expect(diffBlocks(['a', 'b'], ['a'])?.line).toBe(2);
  });

  it('las mayúsculas sí cuentan fuera de la cabecera', () => {
    expect(diffBlocks(['x', 'Ana'], ['x', 'ana'])?.line).toBe(2);
  });
});

describe('examples', () => {
  const text = [
    'Antes.',
    '',
    '```sql',
    'SELECT 1;',
    '```',
    '',
    '```text',
    ' ?column?',
    '----------',
    '        1',
    '(1 fila)',
    '```',
    '',
    '```sql',
    'SELECT Name FROM Customers',
    '```',
    '',
    '```tsql',
    'THROW;',
    '```',
  ].join('\n');

  it('lee cada consulta con su resultado y deja los fragmentos', () => {
    expect(fences(text).map((block) => block.lang)).toEqual(['sql', 'text', 'sql', 'tsql']);
    const { found, orphans } = examples(text);
    expect(found).toHaveLength(1);
    expect(found[0]?.sql).toBe('SELECT 1;');
    expect(found[0]?.output).toHaveLength(4);
    expect(orphans).toEqual([]);
  });

  it('un bloque de resultado sin su consulta queda como huérfano', () => {
    expect(examples('```text\nx\n```').orphans).toEqual(['x']);
    expect(examples('```tsql\nSELECT 1;\n```\n\n```text\nx\n```').orphans).toEqual(['x']);
  });
});
