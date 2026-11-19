// Paginación: OFFSET … FETCH contra keyset. Con OFFSET, SQL Server lee todas las filas anteriores a
// la página y las descarta, así que las lecturas crecen con el número de página. Con keyset, busca
// desde la última fila de la página anterior y lee solo las 20 que entrega, en cualquier página.

import { scan, seek, select, top } from '../plan';
import {
  DEFAULT_ORDERS,
  ORDER_SIZES,
  indexDefinition,
  nonclustered,
  orderFromNewest,
  table,
} from '../schema';
import { num, type Scenario, type Values } from '../scenario';

export const PAGE_SIZE = 20;
const ORDER = 'ORDER BY OrderDate DESC, Id DESC';
const KEYSET = 'OrderDate < @LastDate OR (OrderDate = @LastDate AND Id < @LastId)';

/** Las páginas que tiene la tabla. */
export function pageCount(orders: number): number {
  return Math.max(1, Math.floor(orders / PAGE_SIZE));
}

export const pagination: Scenario = {
  id: 'pagination',
  controls: [
    { kind: 'select', id: 'orders', options: ORDER_SIZES },
    { kind: 'choice', id: 'cache', options: ['warm', 'cold'] },
    {
      kind: 'range',
      id: 'page',
      min: 1,
      max: (values) => pageCount(num(values, 'orders')),
      step: 1,
      scale: 'log',
    },
  ],
  defaults: { orders: DEFAULT_ORDERS, cache: 'warm', page: 10_000 },
  run(values: Values) {
    const orders = num(values, 'orders');
    const page = Math.min(Math.max(1, Math.round(num(values, 'page'))), pageCount(orders));
    const skip = (page - 1) * PAGE_SIZE;
    const orderTable = table('Orders', orders);
    const index = nonclustered(orderTable, 'IX_Orders_OrderDate', ['OrderDate'], ['Total']);
    const indexes = [indexDefinition(index)];

    // OFFSET: recorre el índice hacia atrás desde el pedido más reciente hasta pasar las filas que
    // salta; el Top descarta esas y entrega las 20 de la página.
    const read = skip + PAGE_SIZE;
    const planA = top(scan(index, { rows: read, backward: true, stopAfter: read }), PAGE_SIZE);

    // Keyset: en la primera página no hay una fila anterior, así que es el mismo recorrido corto.
    const last = orderFromNewest(skip - 1, orders);
    const planB =
      page === 1
        ? top(scan(index, { rows: PAGE_SIZE, backward: true, stopAfter: PAGE_SIZE }), PAGE_SIZE)
        : top(seek(index, { rows: PAGE_SIZE, seek: KEYSET, backward: true }), PAGE_SIZE);

    const sqlA = [
      'SELECT Id, OrderDate, Total',
      'FROM Orders',
      ORDER,
      `OFFSET @Skip ROWS FETCH NEXT ${PAGE_SIZE} ROWS ONLY;`,
    ].join('\n');
    const sqlB = [
      `SELECT TOP (${PAGE_SIZE}) Id, OrderDate, Total`,
      'FROM Orders',
      ...(page === 1
        ? []
        : ['WHERE OrderDate < @LastDate', '   OR (OrderDate = @LastDate AND Id < @LastId)']),
      `${ORDER};`,
    ].join('\n');

    return {
      notes: page === 1 ? ['first-page', 'tuples'] : ['offset', 'tuples'],
      a: {
        label: 'offset',
        statements: [{ sql: sqlA, plan: select(planA), times: 1, params: { Skip: skip } }],
        rows: PAGE_SIZE,
        indexes,
      },
      b: {
        label: 'keyset',
        statements: [
          {
            sql: sqlB,
            plan: select(planB),
            times: 1,
            ...(page === 1 ? {} : { params: { LastDate: `'${last.date}'`, LastId: last.id } }),
          },
        ],
        rows: PAGE_SIZE,
        indexes,
      },
    };
  },
};
