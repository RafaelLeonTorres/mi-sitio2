// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { keyLookup, nestedLoops, scan, seek, select } from './plan';
import { costShare, flowScale, operatorName, renderPlan, sameShape } from './plan-view';
import { clusteredIndex, nonclustered, table } from './schema';

const orders = table('Orders', 1_000_000);
const clustered = clusteredIndex(orders);
const byDate = nonclustered(orders, 'IX_Orders_OrderDate', ['OrderDate'], ['Total']);
const strings = {
  cost: 'Costo',
  rows: 'Filas',
  rows_read: 'Leídas',
  executions: 'Ejecuciones',
  reads: 'Lecturas',
  seek: 'Busca',
  predicate: 'Filtra',
  backward: 'Recorre el índice hacia atrás',
};
const lookups = () =>
  select(
    nestedLoops(
      seek(byDate, { rows: 400, seek: "OrderDate >= '20261015'" }),
      keyLookup(clustered, 400, 'together'),
      400,
    ),
  );

describe('vista del plan', () => {
  it('nombra cada operador como SSMS', () => {
    const plan = lookups();
    const names = [plan, ...plan.children, ...(plan.children[0]?.children ?? [])].map((node) => {
      const name = operatorName(node);
      return name.detail ? `${name.op} (${name.detail})` : name.op;
    });
    expect(names).toEqual([
      'SELECT',
      'Nested Loops (Inner Join)',
      'Index Seek (NonClustered)',
      'Key Lookup (Clustered)',
    ]);
  });

  it('el grosor va de 1 a 6 píxeles y crece con las filas', () => {
    const flow = flowScale(1_000_000);
    expect(flow(0)).toBe(1);
    expect(flow(1_000_000)).toBe(6);
    expect(flow(1000)).toBeGreaterThan(flow(10));
    expect(flow(10)).toBeGreaterThan(flow(1));
  });

  it('los porcentajes de costo suman cerca de 100', () => {
    const plan = lookups();
    const shares = [plan, ...plan.children, ...(plan.children[0]?.children ?? [])].map((node) =>
      costShare(node, plan),
    );
    const total = shares.reduce((sum, share) => sum + share, 0);
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
  });

  it('reconoce dos planes con los mismos operadores sobre los mismos índices', () => {
    expect(sameShape(lookups(), lookups())).toBe(true);
    expect(sameShape(lookups(), select(scan(clustered, { rows: 400 })))).toBe(false);
  });

  it('dibuja un árbol con un renglón por operador y el grosor de cada línea', () => {
    const plan = lookups();
    const list = renderPlan(plan, { lang: 'es', strings, flow: flowScale(1_000_000) });
    const items = [...list.querySelectorAll('.sql-node')];
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.querySelector('.sql-op-name')?.textContent)).toEqual([
      'SELECT',
      'Nested Loops',
      'Index Seek',
      'Key Lookup',
    ]);
    const seekNode = items[2] as HTMLElement;
    expect(seekNode.style.getPropertyValue('--flow')).toMatch(/px$/);
    expect(seekNode.style.getPropertyValue('--next-flow')).toMatch(/px$/);
    expect(seekNode.querySelector('.sql-op-object')?.textContent).toBe(
      '[Orders].[IX_Orders_OrderDate]',
    );
    expect(seekNode.textContent).toContain("Busca: OrderDate >= '20261015'");
    // La raíz no tiene línea hacia arriba.
    expect((items[0] as HTMLElement).style.getPropertyValue('--flow')).toBe('');
  });

  it('marca los operadores que se le piden', () => {
    const plan = lookups();
    const reader = plan.children[0]?.children[0];
    if (!reader) throw new Error('Falta el seek');
    const list = renderPlan(plan, {
      lang: 'es',
      strings,
      flow: flowScale(1000),
      tones: new Map([[reader, 'good']]),
    });
    expect(list.querySelectorAll('[data-tone="good"]')).toHaveLength(1);
  });
});
