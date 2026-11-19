import { describe, expect, it } from 'vitest';
import { nodes, type PlanNode } from './plan';
import { measureRun, type Comparison, type QueryRun, type Values } from './scenario';
import { ORDER_SIZES } from './schema';
import { SCENARIOS, scenario } from './scenarios';
import { pageCount } from './scenarios/pagination';

const run = (id: Parameters<typeof scenario>[0], values: Values = {}): Comparison => {
  const found = scenario(id);
  return found.run({ ...found.defaults, ...values });
};
const plan = (side: QueryRun, index = 0): PlanNode => {
  const statement = side.statements[index];
  if (!statement) throw new Error('falta la sentencia');
  return statement.plan;
};
const ops = (side: QueryRun, index = 0) => nodes(plan(side, index)).map((node) => node.op);
const reads = (side: QueryRun, cache: 'warm' | 'cold' = 'warm') =>
  measureRun(side, cache).logicalReads;
const total = (side: QueryRun, cache: 'warm' | 'cold' = 'warm') => measureRun(side, cache).totalMs;

describe('escenarios', () => {
  it('son seis, cada uno con valores para todos sus controles', () => {
    expect(SCENARIOS.map((item) => item.id)).toEqual([
      'sargability',
      'indexes',
      'n-plus-one',
      'joins',
      'pagination',
      'tracking',
    ]);
    for (const item of SCENARIOS) {
      for (const control of item.controls) expect(control.id in item.defaults).toBe(true);
      const comparison = item.run(item.defaults);
      expect(comparison.notes.length).toBeGreaterThan(0);
      for (const side of [comparison.a, comparison.b]) {
        for (const statement of side.statements) {
          expect(statement.plan.op).toBe('SELECT');
          expect(statement.sql.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('SARGabilidad', () => {
  it('la función sobre la columna nunca permite un seek; el rango sí, si el índice cubre', () => {
    for (const range of ['year', 'month', 'day']) {
      const comparison = run('sargability', { range });
      expect(ops(comparison.a)).not.toContain('Index Seek');
      expect(ops(comparison.b)).toContain('Index Seek');
      expect(reads(comparison.b)).toBeLessThan(reads(comparison.a));
    }
  });

  it('con SELECT *, el punto de inflexión cae entre el día y el mes', () => {
    expect(ops(run('sargability', { columns: 'all', range: 'day' }).b)).toContain('Key Lookup');
    for (const range of ['month', 'year']) {
      const comparison = run('sargability', { columns: 'all', range });
      expect(ops(comparison.b)).toEqual(['SELECT', 'Clustered Index Scan']);
      expect(comparison.notes).toContain('tipping');
    }
  });

  it('con índice nunca se lee más que sin él, en cualquier tamaño, rango y lista de columnas', () => {
    for (const orders of ORDER_SIZES) {
      for (const range of ['year', 'month', 'day']) {
        for (const columns of ['narrow', 'all']) {
          const values = { orders, range, columns };
          const withIndex = run('sargability', { ...values, index: true });
          const without = run('sargability', { ...values, index: false });
          expect(reads(withIndex.b)).toBeLessThanOrEqual(reads(without.b));
          expect(reads(withIndex.a)).toBeLessThanOrEqual(reads(without.a));
        }
      }
    }
  });

  it('los mismos valores dan siempre los mismos números', () => {
    expect(run('sargability')).toEqual(run('sargability'));
  });
});

describe('Índices', () => {
  it('sin índice, scan; con la clave, seek y Key Lookup; con INCLUDE, solo el seek', () => {
    const key = run('indexes', { index: 'key' });
    expect(ops(key.a)).toEqual(['SELECT', 'Clustered Index Scan']);
    expect(ops(key.b)).toEqual(['SELECT', 'Nested Loops', 'Index Seek', 'Key Lookup']);
    expect(ops(run('indexes', { index: 'include' }).b)).toEqual(['SELECT', 'Index Seek']);
  });

  it('SSMS sugiere el índice con INCLUDE y un impacto cercano al 100 %', () => {
    const { a } = run('indexes');
    expect(a.missingIndex).toContain(
      'ON [dbo].[Orders] ([CustomerId]) INCLUDE ([OrderDate],[Total])',
    );
    const impact = Number(/Impact ([\d.]+)/.exec(a.missingIndex ?? '')?.[1]);
    expect(impact).toBeGreaterThan(99);
    expect(impact).toBeLessThan(100);
  });

  it('con caché fría, los Key Lookups de un cliente leen casi una página de disco cada uno', () => {
    const { b } = run('indexes', { index: 'key', cache: 'cold' });
    const measured = measureRun(b, 'cold');
    expect(measured.physicalReads).toBeGreaterThanOrEqual(b.rows);
  });
});

describe('N+1', () => {
  it('A hace un viaje por cliente y B uno solo', () => {
    const comparison = run('n-plus-one', { count: 100 });
    expect(measureRun(comparison.a, 'warm').roundTrips).toBe(101);
    expect(measureRun(comparison.b, 'warm').roundTrips).toBe(1);
    expect(comparison.a.statements[1]?.times).toBe(100);
  });

  it('el tiempo de A crece en línea recta con N, y lo domina la red', () => {
    const at = (count: number) => measureRun(run('n-plus-one', { count, rtt: 10 }).a, 'warm');
    const small = at(100);
    const big = at(500);
    expect(big.totalMs / small.totalMs).toBeGreaterThan(4.5);
    expect(big.totalMs / small.totalMs).toBeLessThan(5.5);
    expect(big.networkMs).toBeGreaterThan(big.serverMs * 10);
  });

  it('la proyección transfiere menos y no guarda entidades en el contexto', () => {
    const projection = run('n-plus-one', { loading: 'projection' }).b;
    const include = run('n-plus-one', { loading: 'include' }).b;
    expect(projection.statements[0]?.sql).toContain('[c].[Name]');
    expect(projection.client?.memoryBytes).toBeLessThan(include.client?.memoryBytes ?? 0);
  });
});

describe('JOIN y subconsultas', () => {
  it('IN, EXISTS y JOIN con DISTINCT terminan en el mismo semi join', () => {
    const shape = (side: QueryRun) =>
      nodes(plan(side)).map((node) => `${node.op} ${node.logical ?? ''}`);
    const inPlan = shape(run('joins', { subquery: 'in' }).a);
    expect(shape(run('joins', { subquery: 'exists' }).a)).toEqual(inPlan);
    expect(shape(run('joins', { distinct: true }).b)).toEqual(inPlan);
    expect(inPlan).toContain('Hash Match Right Semi Join');
  });

  it('sin DISTINCT, el JOIN repite al cliente por cada pedido', () => {
    const comparison = run('joins', { distinct: false });
    expect(comparison.b.rows).toBeGreaterThan(comparison.a.rows);
    expect(comparison.notes).toContain('duplicates');
  });

  it('NOT IN no devuelve nada si la subconsulta trae un NULL; NOT EXISTS sí responde', () => {
    const nulls = run('joins', { question: 'without', guests: true });
    expect(nulls.a.rows).toBe(0);
    expect(nulls.b.rows).toBeGreaterThan(30_000);
    expect(ops(nulls.a)).toContain('Row Count Spool');
    const noNulls = run('joins', { question: 'without', guests: false });
    expect(noNulls.a.rows).toBe(noNulls.b.rows);
    expect(ops(noNulls.a)).not.toContain('Row Count Spool');
  });
});

describe('Paginación', () => {
  it('OFFSET lee más en cada página y keyset siempre lo mismo', () => {
    const pages = [1, 100, 1000, 10_000, 50_000];
    const a = pages.map((page) => reads(run('pagination', { page }).a));
    const b = pages.map((page) => reads(run('pagination', { page }).b));
    for (let i = 1; i < pages.length; i += 1) expect(a[i] ?? 0).toBeGreaterThan(a[i - 1] ?? 0);
    expect(new Set(b).size).toBe(1);
  });

  it('la página se limita a las que tiene la tabla, y la última lee todo el índice con OFFSET', () => {
    const last = run('pagination', { orders: 10_000, page: 1_000_000 });
    expect(last.a.statements[0]?.params?.['Skip']).toBe((pageCount(10_000) - 1) * 20);
    expect(last.b.statements[0]?.params?.['LastId']).toBe(21);
  });

  it('la primera página es la misma consulta corta en los dos lados', () => {
    const first = run('pagination', { page: 1 });
    expect(reads(first.a)).toBe(reads(first.b));
    expect(first.b.statements[0]?.sql).not.toContain('WHERE');
  });
});

describe('AsNoTracking', () => {
  it('sin seguimiento, el SQL y el plan son los mismos; cambian el tiempo y la memoria en .NET', () => {
    const comparison = run('tracking', { query: 'no-tracking' });
    expect(comparison.b.statements[0]?.sql).toBe(comparison.a.statements[0]?.sql);
    expect(reads(comparison.b)).toBe(reads(comparison.a));
    const a = measureRun(comparison.a, 'warm');
    const b = measureRun(comparison.b, 'warm');
    expect(b.clientMs / a.clientMs).toBeCloseTo(0.67, 1);
    expect(b.memoryBytes / a.memoryBytes).toBeCloseTo(0.61, 1);
  });

  it('la proyección pide tres columnas y el índice la responde sin tocar la tabla', () => {
    const comparison = run('tracking', { query: 'projection' });
    expect(ops(comparison.b)).toEqual(['SELECT', 'Index Seek']);
    expect(total(comparison.b)).toBeLessThan(total(comparison.a) / 5);
  });
});
