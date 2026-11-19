import { describe, expect, it } from 'vitest';
import { checkPlan, checkRule, planRoot, planText, rowsRead, type PlanNode } from './plan-check';

const seq = (table: string, rows: number, removed = 0): PlanNode => ({
  'Node Type': 'Seq Scan',
  'Relation Name': table,
  'Actual Rows': rows,
  'Actual Loops': 1,
  ...(removed ? { 'Rows Removed by Filter': removed } : {}),
});

describe('planRoot', () => {
  it('lee el JSON de EXPLAIN como texto o ya leído', () => {
    const plan = [{ Plan: seq('orders', 1) }];
    expect(planRoot(JSON.stringify(plan))['Node Type']).toBe('Seq Scan');
    expect(planRoot(plan)['Relation Name']).toBe('orders');
    expect(() => planRoot('[]')).toThrow();
  });
});

describe('checkRule', () => {
  const indexScan: PlanNode = {
    'Node Type': 'Index Scan',
    'Relation Name': 'orders',
    'Index Name': 'ix_orders_orderdate',
    'Index Cond': "(orderdate >= '2026-10-01')",
    'Actual Rows': 620,
    'Actual Loops': 1,
  };

  it('index: un Index Scan con condición, o un Bitmap Index Scan bajo un Bitmap Heap Scan', () => {
    expect(
      checkRule(
        { 'Node Type': 'Aggregate', Plans: [indexScan] },
        { kind: 'index', table: 'Orders' },
      ),
    ).toBe(true);
    const bitmap: PlanNode = {
      'Node Type': 'Bitmap Heap Scan',
      'Relation Name': 'orders',
      Plans: [
        {
          'Node Type': 'BitmapAnd',
          Plans: [
            {
              'Node Type': 'Bitmap Index Scan',
              'Index Name': 'ix',
              'Index Cond': '(customerid = 4217)',
            },
          ],
        },
      ],
    };
    expect(checkRule(bitmap, { kind: 'index', table: 'Orders' })).toBe(true);
  });

  it('index: no cuenta un recorrido completo del índice ni una tabla leída entera', () => {
    const { 'Index Cond': _, ...fullScan } = indexScan;
    expect(checkRule(fullScan, { kind: 'index', table: 'Orders' })).toBe(false);
    expect(
      checkRule(
        { 'Node Type': 'Append', Plans: [indexScan, seq('orders', 5)] },
        { kind: 'index', table: 'Orders' },
      ),
    ).toBe(false);
  });

  it('index-only, semi-join, no-subplan y no-dedupe', () => {
    expect(
      checkRule(
        { ...indexScan, 'Node Type': 'Index Only Scan' },
        { kind: 'index-only', table: 'orders' },
      ),
    ).toBe(true);
    expect(checkRule(indexScan, { kind: 'index-only', table: 'orders' })).toBe(false);
    expect(
      checkRule({ 'Node Type': 'Hash Join', 'Join Type': 'Semi' }, { kind: 'semi-join' }),
    ).toBe(true);
    const subplan: PlanNode = {
      'Node Type': 'Seq Scan',
      Plans: [{ 'Node Type': 'Aggregate', 'Parent Relationship': 'SubPlan' }],
    };
    expect(checkRule(subplan, { kind: 'no-subplan' })).toBe(false);
    expect(checkRule({ 'Node Type': 'Aggregate', Strategy: 'Plain' }, { kind: 'no-dedupe' })).toBe(
      true,
    );
    expect(checkRule({ 'Node Type': 'Aggregate', Strategy: 'Hashed' }, { kind: 'no-dedupe' })).toBe(
      false,
    );
    expect(checkRule({ 'Node Type': 'Unique' }, { kind: 'no-dedupe' })).toBe(false);
  });

  it('max-rows suma las filas devueltas y las que descartó el filtro, en cada vuelta', () => {
    const plan: PlanNode = {
      'Node Type': 'Limit',
      Plans: [{ ...indexScan, 'Actual Rows': 20, 'Rows Removed by Filter': 10000 }],
    };
    expect(rowsRead(plan, 'Orders')).toBe(10020);
    expect(checkRule(plan, { kind: 'max-rows', table: 'Orders', max: 100 })).toBe(false);
    const loops: PlanNode = {
      'Node Type': 'Nested Loop',
      Plans: [{ ...indexScan, 'Actual Rows': 8, 'Actual Loops': 1200 }],
    };
    expect(rowsRead(loops, 'orders')).toBe(9600);
    expect(
      checkPlan(seq('orders', 50000), [{ kind: 'max-rows', table: 'Orders', max: 50000 }]),
    ).toEqual([{ rule: { kind: 'max-rows', table: 'Orders', max: 50000 }, ok: true }]);
  });
});

describe('planText', () => {
  it('escribe un renglón por nodo con su índice, sus filas, sus condiciones y lo que descartó', () => {
    const text = planText({
      'Node Type': 'Limit',
      'Actual Rows': 20,
      Plans: [
        {
          'Node Type': 'Index Scan',
          'Scan Direction': 'Backward',
          'Index Name': 'ix_orders_orderdate_id',
          'Relation Name': 'orders',
          'Index Cond': "(orderdate <= '2025-06-19')",
          Filter: '(id < 40001)',
          'Rows Removed by Filter': 1,
          'Actual Rows': 20,
          'Actual Loops': 1,
        },
      ],
    });
    expect(text).toBe(
      [
        'Limit  (rows=20)',
        '-> Index Scan Backward using ix_orders_orderdate_id on orders  (rows=20)',
        "        Index Cond: (orderdate <= '2025-06-19')",
        '        Filter: (id < 40001)',
        '        Rows Removed by Filter: 1',
      ].join('\n'),
    );
  });
});
