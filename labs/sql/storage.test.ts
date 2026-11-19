import { describe, expect, it } from 'vitest';
import { clusteredIndex, nonclustered, table } from './schema';
import { distinctPages, indexShape, rowsPerPage, scanReads, seekReads } from './storage';

describe('páginas y árboles B', () => {
  it('caben más filas angostas que anchas en una página de 8 KB', () => {
    expect(rowsPerPage(129)).toBe(61);
    expect(rowsPerPage(28)).toBe(269);
    expect(rowsPerPage(9000)).toBe(1);
  });

  it('un índice de un millón de filas tiene tres niveles, y uno de diez mil, dos', () => {
    expect(clusteredIndex(table('Orders', 1_000_000)).shape.depth).toBe(3);
    expect(clusteredIndex(table('Orders', 10_000)).shape.depth).toBe(2);
    expect(indexShape(1, 100, 4)).toEqual({ rowsPerPage: 79, leafPages: 1, depth: 1 });
  });

  it('el índice angosto ocupa menos páginas que la tabla', () => {
    const orders = table('Orders', 1_000_000);
    const narrow = nonclustered(orders, 'IX_Orders_OrderDate', ['OrderDate'], ['Total']);
    expect(narrow.shape.leafPages * 4).toBeLessThan(clusteredIndex(orders).shape.leafPages);
  });

  it('un recorrido lee todas las hojas; una búsqueda, la ruta y las hojas del rango', () => {
    const shape = indexShape(1_000_000, 129, 4);
    expect(scanReads(shape)).toBe(shape.depth - 1 + shape.leafPages);
    expect(seekReads(1, shape)).toBe(shape.depth);
    expect(seekReads(shape.rowsPerPage * 10, shape)).toBe(shape.depth - 1 + 10);
  });

  it('las búsquedas al azar tocan cada vez menos páginas nuevas', () => {
    expect(distinctPages(0, 1000)).toBe(0);
    expect(distinctPages(10, 100_000)).toBe(10);
    expect(distinctPages(100_000, 1000)).toBe(1000);
    expect(distinctPages(2000, 1000)).toBeLessThan(2000);
  });
});
