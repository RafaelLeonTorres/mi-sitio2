// N+1 con EF Core: una consulta trae los últimos pedidos y después se pide el cliente de cada uno,
// una consulta por cliente. Cada consulta es rápida en la base; lo que suma es el viaje de ida y
// vuelta. Con Include o con una proyección a un DTO, todo sale en una sola consulta con un JOIN.

import { selectList } from '../columns';
import { keyLookup, nestedLoops, scan, seek, select, top } from '../plan';
import {
  CUSTOMERS,
  DEFAULT_ORDERS,
  clusteredIndex,
  distinctCustomers,
  indexDefinition,
  nonclustered,
  table,
} from '../schema';
import { MATERIALIZE, num, text, type Scenario, type Values } from '../scenario';

// Como las pide EF Core: primero la clave y luego las demás propiedades en orden alfabético.
export const ORDER_COLUMNS = [
  '[o].[Id]',
  '[o].[CustomerId]',
  '[o].[Notes]',
  '[o].[OrderDate]',
  '[o].[ShippingAddress]',
  '[o].[ShippingCity]',
  '[o].[Status]',
  '[o].[Total]',
];
const CUSTOMER_COLUMNS = ['[c].[Id]', '[c].[City]', '[c].[CreatedAt]', '[c].[Email]', '[c].[Name]'];
const ROW_COLUMNS = ['[o].[Id]', '[c].[Name]', '[o].[Total]'];
const JOIN = 'INNER JOIN [Customers] AS [c] ON [o].[CustomerId] = [c].[Id]';
const NEWEST = 'ORDER BY [o].[OrderDate] DESC';

export const nPlusOne: Scenario = {
  id: 'n-plus-one',
  controls: [
    { kind: 'select', id: 'count', options: [10, 50, 100, 500] },
    { kind: 'select', id: 'rtt', options: [0.5, 2, 10, 50] },
    { kind: 'choice', id: 'loading', options: ['projection', 'include'] },
    { kind: 'choice', id: 'cache', options: ['warm', 'cold'] },
  ],
  defaults: { count: 100, rtt: 2, loading: 'projection', cache: 'warm' },
  run(values: Values) {
    const count = num(values, 'count');
    const rttMs = num(values, 'rtt');
    const include = text(values, 'loading') === 'include';
    const orderTable = table('Orders', DEFAULT_ORDERS);
    const orders = clusteredIndex(orderTable);
    const byDate = nonclustered(orderTable, 'IX_Orders_OrderDate', ['OrderDate'], ['Total']);
    const customers = clusteredIndex(table('Customers', CUSTOMERS));
    // FindAsync busca primero en el contexto: un cliente que ya se cargó no vuelve a la base.
    const asked = distinctCustomers(count);

    // Los pedidos más recientes: el índice hacia atrás y un Key Lookup por las columnas que no tiene.
    const newest = () =>
      nestedLoops(
        scan(byDate, { rows: count, backward: true, stopAfter: count }),
        keyLookup(orders, count, 'together'),
        count,
      );

    const planOrders = top(newest(), count);
    const planCustomer = seek(customers, { rows: 1, seek: '[c].[Id] = @p', unique: true });
    const planJoin = top(
      nestedLoops(
        newest(),
        seek(customers, {
          rows: 1,
          seek: '[c].[Id] = [o].[CustomerId]',
          executions: count,
          unique: true,
        }),
        count,
      ),
      count,
    );

    const sqlOrders = [
      selectList('SELECT TOP(@p)', ORDER_COLUMNS),
      'FROM [Orders] AS [o]',
      NEWEST,
    ].join('\n');
    const sqlCustomer = [
      selectList('SELECT TOP(1)', CUSTOMER_COLUMNS),
      'FROM [Customers] AS [c]',
      'WHERE [c].[Id] = @p',
    ].join('\n');
    const columnsB = include ? [...ORDER_COLUMNS, ...CUSTOMER_COLUMNS] : ROW_COLUMNS;
    const sqlJoin = [
      selectList('SELECT TOP(@p)', columnsB),
      'FROM [Orders] AS [o]',
      JOIN,
      NEWEST,
    ].join('\n');

    const tracked = count + asked;
    const indexes = [indexDefinition(byDate)];
    return {
      notes: ['round-trips', include ? 'include' : 'projection', 'lazy', 'split'],
      a: {
        label: 'loop',
        statements: [
          { sql: sqlOrders, plan: select(planOrders), times: 1, params: { p: count } },
          {
            sql: sqlCustomer,
            plan: select(planCustomer),
            times: asked,
            params: { p: 4217 },
            spread: true,
          },
        ],
        rows: count,
        linq: 'n-plus-one-loop',
        indexes,
        client: {
          roundTrips: 1 + asked,
          rttMs,
          materializeMs: tracked * MATERIALIZE.tracked.ms,
          memoryBytes: tracked * MATERIALIZE.tracked.bytes,
          rowsTransferred: count + asked,
        },
      },
      b: {
        label: include ? 'include' : 'projection',
        statements: [{ sql: sqlJoin, plan: select(planJoin), times: 1, params: { p: count } }],
        rows: count,
        linq: include ? 'n-plus-one-include' : 'n-plus-one-projection',
        indexes,
        client: {
          roundTrips: 1,
          rttMs,
          // Con Include, el contexto resuelve la identidad: un cliente con dos pedidos es un objeto.
          materializeMs: include
            ? tracked * MATERIALIZE.tracked.ms
            : count * MATERIALIZE.projection.ms,
          memoryBytes: include
            ? tracked * MATERIALIZE.tracked.bytes
            : count * MATERIALIZE.projection.bytes,
          rowsTransferred: count,
        },
      },
    };
  },
};
