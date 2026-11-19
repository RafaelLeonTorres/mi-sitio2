import { describe, expect, it } from 'vitest';
import {
  cheapest,
  keyLookup,
  measure,
  nestedLoops,
  nodes,
  scan,
  seek,
  select,
  top,
  totalCost,
} from './plan';
import { clusteredIndex, nonclustered, rowsInRange, table, type Range } from './schema';

const orders = table('Orders', 1_000_000);
const clustered = clusteredIndex(orders);
const byDate = nonclustered(orders, 'IX_Orders_OrderDate', ['OrderDate']);

/** Lo que el optimizador elige para traer filas completas por fecha: scan o seek con Key Lookup. */
function choose(rows: number) {
  return cheapest([
    scan(clustered, { rows, predicate: 'OrderDate en el rango' }),
    nestedLoops(
      seek(byDate, { rows, seek: 'OrderDate en el rango' }),
      keyLookup(clustered, rows, 'together'),
      rows,
    ),
  ]);
}

describe('costos y operadores', () => {
  it('el punto de inflexión cae entre un día y un mes de pedidos', () => {
    const ops = (range: Range) =>
      nodes(choose(rowsInRange(range, orders.rows))).map((node) => node.op);
    expect(ops('day')).toContain('Key Lookup');
    expect(ops('month')).toEqual(['Clustered Index Scan']);
    expect(ops('year')).toEqual(['Clustered Index Scan']);
  });

  it('el punto de inflexión queda cerca de una cuarta parte de las páginas de la tabla', () => {
    // La regla conocida: el seek con lookups deja de convenir entre 1/4 y 1/3 de las páginas.
    let rows = 1;
    while (nodes(choose(rows)).some((node) => node.op === 'Key Lookup')) rows += 50;
    const share = rows / clustered.shape.leafPages;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.34);
  });

  it('un Key Lookup cuesta tantas lecturas como niveles tiene la tabla, por fila', () => {
    const lookups = keyLookup(clustered, 100, 'scattered');
    expect(lookups.logicalReads).toBe(100 * clustered.shape.depth);
    expect(lookups.executions).toBe(100);
  });

  it('un Top detiene el recorrido: leer 20 filas cuesta lo mismo en cualquier tabla grande', () => {
    const big = nonclustered(table('Orders', 10_000_000), 'IX', ['OrderDate']);
    const first = top(scan(byDate, { rows: 20, stopAfter: 20, backward: true }), 20);
    const firstBig = top(scan(big, { rows: 20, stopAfter: 20, backward: true }), 20);
    expect(measure(first, 'warm').logicalReads).toBe(byDate.shape.depth);
    expect(measure(firstBig, 'warm').logicalReads).toBe(big.shape.depth);
  });

  it('con la caché fría el mismo plan tarda más, pero lee las mismas páginas', () => {
    const plan = select(scan(clustered, { rows: 1000 }));
    const warm = measure(plan, 'warm');
    const cold = measure(plan, 'cold');
    expect(cold.logicalReads).toBe(warm.logicalReads);
    expect(warm.physicalReads + warm.readAheadReads).toBe(0);
    expect(cold.readAheadReads).toBe(clustered.shape.leafPages);
    expect(cold.elapsedMs).toBeGreaterThan(warm.elapsedMs);
  });

  it('el costo del plan suma el de todos sus operadores', () => {
    const plan = select(
      nestedLoops(seek(byDate, { rows: 10, seek: 's' }), keyLookup(clustered, 10, 'together'), 10),
    );
    const sum = nodes(plan).reduce((total, node) => total + node.cost, 0);
    expect(totalCost(plan)).toBeCloseTo(sum, 10);
  });
});
