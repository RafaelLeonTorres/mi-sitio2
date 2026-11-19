// SARGabilidad: YEAR(OrderDate) = 2026 contra un rango de fechas. La función envuelve la columna,
// así que el índice no sirve para buscar y hay que revisar cada fila; el rango sí permite un seek.
// Con SELECT * y un índice que no cubre, aparece el punto de inflexión: buscar y hacer un Key
// Lookup por fila deja de convenir frente a leer toda la tabla.

import {
  cheapest,
  keyLookup,
  nestedLoops,
  nodes,
  scan,
  seek,
  select,
  type PlanNode,
} from '../plan';
import {
  DEFAULT_ORDERS,
  ORDER_SIZES,
  RANGE_BOUNDS,
  clusteredIndex,
  covers,
  indexDefinition,
  nonclustered,
  rowsInRange,
  table,
  type Index,
  type Range,
} from '../schema';
import { flag, num, text, type Scenario, type Values } from '../scenario';

const NARROW = ['Id', 'OrderDate', 'Total'];
const ALL = ['*'];

/** Las condiciones con funciones sobre la columna, de la más larga a la más corta. */
const FUNCTIONS: Readonly<Record<Range, readonly string[]>> = {
  year: ['YEAR(OrderDate) = 2026'],
  month: ['YEAR(OrderDate) = 2026', 'MONTH(OrderDate) = 10'],
  day: ['YEAR(OrderDate) = 2026', 'MONTH(OrderDate) = 10', 'DAY(OrderDate) = 15'],
};

export const sargability: Scenario = {
  id: 'sargability',
  controls: [
    { kind: 'select', id: 'orders', options: ORDER_SIZES },
    { kind: 'choice', id: 'cache', options: ['warm', 'cold'] },
    { kind: 'choice', id: 'range', options: ['year', 'month', 'day'] },
    { kind: 'choice', id: 'columns', options: ['narrow', 'all'] },
    { kind: 'toggle', id: 'index' },
  ],
  defaults: {
    orders: DEFAULT_ORDERS,
    cache: 'warm',
    range: 'year',
    columns: 'narrow',
    index: true,
  },
  run(values: Values) {
    const orders = num(values, 'orders');
    const range = rangeOf(text(values, 'range'));
    const all = text(values, 'columns') === 'all';
    const columns = all ? ALL : NARROW;
    const list = all ? '*' : NARROW.join(', ');
    const rows = rowsInRange(range, orders);
    const { from, to } = RANGE_BOUNDS[range];
    const orderTable = table('Orders', orders);
    const clustered = clusteredIndex(orderTable);
    const index = flag(values, 'index')
      ? nonclustered(orderTable, 'IX_Orders_OrderDate', ['OrderDate'], ['Total'])
      : null;

    const conditions = FUNCTIONS[range];
    const predicateA = conditions.join(' AND ');
    const predicateB = `OrderDate >= '${from}' AND OrderDate < '${to}'`;

    const planA = cheapest([
      scan(clustered, { rows, predicate: predicateA, functions: conditions.length }),
      ...(index
        ? [
            withLookups(
              index,
              clustered,
              columns,
              rows,
              scan(index, { rows, predicate: predicateA, functions: conditions.length }),
            ),
          ]
        : []),
    ]);
    const planB = cheapest([
      scan(clustered, { rows, predicate: predicateB }),
      ...(index
        ? [withLookups(index, clustered, columns, rows, seek(index, { rows, seek: predicateB }))]
        : []),
    ]);

    const indexes = index ? [indexDefinition(index)] : [];
    const seeks = nodes(planB).some((node) => node.op === 'Index Seek');
    const lookups = nodes(planB).some((node) => node.op === 'Key Lookup');
    const notes = ['function'];
    if (!index) notes.push('no-index');
    else if (!seeks) notes.push('tipping');
    else if (lookups) notes.push('lookups');
    else notes.push('covering');
    notes.push('cast');
    return {
      notes,
      a: {
        label: 'function',
        statements: [{ sql: sqlA(list, conditions), plan: select(planA), times: 1 }],
        rows,
        indexes,
      },
      b: {
        label: 'range',
        statements: [{ sql: sqlB(list, from, to), plan: select(planB), times: 1 }],
        rows,
        indexes,
      },
    };
  },
};

/** El acceso por el índice no agrupado, con un Key Lookup por fila si no tiene todas las columnas. */
function withLookups(
  index: Index,
  clustered: Index,
  columns: readonly string[],
  rows: number,
  access: PlanNode,
): PlanNode {
  if (covers(index, columns)) return access;
  // Los pedidos de un rango de fechas se insertaron juntos, así que sus filas quedan cerca.
  return nestedLoops(access, keyLookup(clustered, rows, 'together'), rows);
}

function sqlA(list: string, conditions: readonly string[]): string {
  const [first = '', ...rest] = conditions;
  return (
    [
      `SELECT ${list}`,
      'FROM Orders',
      `WHERE ${first}`,
      ...rest.map((condition) => `  AND ${condition}`),
    ].join('\n') + ';'
  );
}

function sqlB(list: string, from: string, to: string): string {
  return [
    `SELECT ${list}`,
    'FROM Orders',
    `WHERE OrderDate >= '${from}'`,
    `  AND OrderDate <  '${to}';`,
  ].join('\n');
}

function rangeOf(value: string): Range {
  return value === 'month' || value === 'day' ? value : 'year';
}
