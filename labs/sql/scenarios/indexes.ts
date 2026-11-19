// Índices: WHERE CustomerId = @CustomerId sin índice, con un índice en la columna y con ese
// índice más INCLUDE. Sin índice hay que revisar toda la tabla; con la clave sola, un seek y un
// Key Lookup por pedido (repartidos por la tabla, porque cada cliente compra en fechas
// distintas); con INCLUDE, el seek basta. El lado A muestra la sugerencia de índice de SSMS.

import { cheapest, keyLookup, nestedLoops, scan, seek, select, totalCost } from '../plan';
import {
  DEFAULT_ORDERS,
  ORDER_SIZES,
  clusteredIndex,
  indexDefinition,
  nonclustered,
  ordersPerCustomer,
  table,
} from '../schema';
import { num, text, type Scenario, type Values } from '../scenario';

const COLUMNS = ['Id', 'OrderDate', 'Total'];
const PREDICATE = 'CustomerId = @CustomerId';
const SQL = ['SELECT Id, OrderDate, Total', 'FROM Orders', `WHERE ${PREDICATE};`].join('\n');

export const indexes: Scenario = {
  id: 'indexes',
  controls: [
    { kind: 'select', id: 'orders', options: ORDER_SIZES },
    { kind: 'choice', id: 'cache', options: ['warm', 'cold'] },
    { kind: 'choice', id: 'index', options: ['key', 'include'] },
  ],
  defaults: { orders: DEFAULT_ORDERS, cache: 'warm', index: 'key' },
  run(values: Values) {
    const orders = num(values, 'orders');
    const rows = ordersPerCustomer(orders);
    const orderTable = table('Orders', orders);
    const clustered = clusteredIndex(orderTable);
    const params = { CustomerId: 4217 };

    const full = scan(clustered, { rows, predicate: PREDICATE });
    const keyOnly = nonclustered(orderTable, 'IX_Orders_CustomerId', ['CustomerId']);
    const covering = nonclustered(
      orderTable,
      'IX_Orders_CustomerId',
      ['CustomerId'],
      ['OrderDate', 'Total'],
    );
    const index = text(values, 'index') === 'include' ? covering : keyOnly;
    const access = seek(index, { rows, seek: PREDICATE });
    const planB = cheapest([
      full,
      index === covering
        ? access
        : nestedLoops(access, keyLookup(clustered, rows, 'scattered'), rows),
    ]);

    // SSMS calcula el impacto con el costo estimado del plan que tendría con el índice sugerido.
    const best = seek(covering, { rows, seek: PREDICATE });
    const impact = (1 - totalCost(best) / totalCost(full)) * 100;
    const missingIndex =
      `Missing Index (Impact ${impact.toFixed(4)}): CREATE NONCLUSTERED INDEX ` +
      `[<Name of Missing Index, sysname,>] ON [dbo].[Orders] ([CustomerId]) ` +
      `INCLUDE ([${COLUMNS.filter((column) => column !== 'Id').join('],[')}])`;

    return {
      notes: [index === covering ? 'include' : 'lookups', 'missing'],
      a: {
        label: 'no-index',
        statements: [{ sql: SQL, plan: select(full), times: 1, params }],
        rows,
        missingIndex,
        indexes: [],
      },
      b: {
        label: index === covering ? 'include' : 'key',
        statements: [{ sql: SQL, plan: select(planB), times: 1, params }],
        rows,
        indexes: [indexDefinition(index)],
      },
    };
  },
};
