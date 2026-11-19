import { describe, expect, it } from 'vitest';
import { compareResults, normalizeCell } from './compare';

describe('normalizeCell', () => {
  it('compara los números por lo que valen', () => {
    expect(normalizeCell(72000)).toBe('72000');
    expect(normalizeCell('72000.00')).toBe('72000');
    expect(normalizeCell('1050.0088')).toBe('1050.0088');
    expect(normalizeCell(0.1 + 0.2)).toBe('0.3');
    expect(normalizeCell(-0)).toBe('0');
    expect(normalizeCell(10n)).toBe('10');
  });

  it('una fecha a medianoche es la misma con o sin la hora', () => {
    expect(normalizeCell('2026-10-01 00:00:00')).toBe('2026-10-01');
    expect(normalizeCell('2026-10-01')).toBe('2026-10-01');
    expect(normalizeCell(new Date('2026-10-01T00:00:00Z'))).toBe('2026-10-01');
    expect(normalizeCell('2026-10-01T10:15:00')).toBe('2026-10-01 10:15:00');
  });

  it('deja null, los booleanos y el texto', () => {
    expect(normalizeCell(null)).toBeNull();
    expect(normalizeCell(undefined)).toBeNull();
    expect(normalizeCell(true)).toBe('true');
    expect(normalizeCell('Ana Torres')).toBe('Ana Torres');
  });
});

describe('compareResults', () => {
  const expected = {
    columns: ['Id', 'Name'],
    rows: [
      [1, 'Ana'],
      [2, 'Luis'],
    ],
  };

  it('sin resultado, otras columnas u otro número de filas', () => {
    expect(compareResults(expected, undefined, false)).toEqual({ kind: 'no-result' });
    expect(compareResults(expected, { columns: ['id'], rows: [[1]] }, false)).toEqual({
      kind: 'columns',
      expected: 2,
      actual: 1,
    });
    expect(
      compareResults(expected, { columns: ['id', 'name'], rows: [[1, 'Ana']] }, false),
    ).toEqual({
      kind: 'row-count',
      expected: 2,
      actual: 1,
    });
  });

  it('las columnas cuentan por posición, no por nombre', () => {
    expect(
      compareResults(
        expected,
        {
          columns: ['id', 'name'],
          rows: [
            ['1', 'Ana'],
            ['2.00', 'Luis'],
          ],
        },
        true,
      ),
    ).toBeNull();
  });

  it('sin orden, las mismas filas en otro orden pasan', () => {
    expect(
      compareResults(
        expected,
        {
          columns: ['a', 'b'],
          rows: [
            [2, 'Luis'],
            [1, 'Ana'],
          ],
        },
        false,
      ),
    ).toBeNull();
  });

  it('con orden, dice la primera fila fuera de lugar', () => {
    expect(
      compareResults(
        expected,
        {
          columns: ['a', 'b'],
          rows: [
            [2, 'Luis'],
            [1, 'Ana'],
          ],
        },
        true,
      ),
    ).toEqual({
      kind: 'order',
      row: 0,
    });
  });

  it('dice la primera fila esperada que no aparece', () => {
    expect(
      compareResults(
        expected,
        {
          columns: ['a', 'b'],
          rows: [
            [1, 'Ana'],
            [3, 'Eva'],
          ],
        },
        false,
      ),
    ).toEqual({
      kind: 'values',
      row: 1,
    });
    expect(
      compareResults(
        expected,
        {
          columns: ['a', 'b'],
          rows: [
            [1, 'Ana'],
            [3, 'Eva'],
          ],
        },
        true,
      ),
    ).toEqual({
      kind: 'values',
      row: 1,
    });
  });
});
