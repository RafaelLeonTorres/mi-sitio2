// JOIN y subconsultas. Para "clientes con pedidos en octubre", IN y EXISTS dan el mismo semi join,
// y un JOIN con DISTINCT suele terminar en ese mismo plan; sin DISTINCT, el JOIN repite al cliente
// por cada pedido. Para "clientes sin pedidos en octubre", NOT IN no devuelve nada si la subconsulta
// puede traer un NULL y lo trae, y NOT EXISTS responde lo que se pregunta.

import {
  cheapest,
  hashAggregate,
  hashMatch,
  nestedLoops,
  rowCountSpool,
  scan,
  seek,
  select,
} from '../plan';
import {
  CUSTOMERS,
  DEFAULT_ORDERS,
  RANGE_BOUNDS,
  clusteredIndex,
  distinctCustomers,
  indexDefinition,
  nonclustered,
  rowsInRange,
  table,
} from '../schema';
import { flag, text, type Scenario, type Values } from '../scenario';

/** Los pedidos de invitados, sin cliente, cuando la columna admite NULL. */
export const GUEST_SHARE = 0.02;

const { from, to } = RANGE_BOUNDS.month;
const RANGE = `OrderDate >= '${from}' AND OrderDate < '${to}'`;
/** El resto de la subconsulta de IN o NOT IN, alineado bajo su SELECT. */
function ordersInRange(opening: string): string[] {
  const pad = ' '.repeat(opening.length);
  return [
    `${pad}FROM Orders AS o`,
    `${pad}WHERE o.OrderDate >= '${from}'`,
    `${pad}  AND o.OrderDate <  '${to}');`,
  ];
}

export const joins: Scenario = {
  id: 'joins',
  controls: [
    { kind: 'choice', id: 'question', options: ['with', 'without'] },
    { kind: 'choice', id: 'subquery', options: ['in', 'exists'], when: { question: 'with' } },
    { kind: 'toggle', id: 'distinct', when: { question: 'with' } },
    { kind: 'toggle', id: 'guests', when: { question: 'without' } },
    { kind: 'choice', id: 'cache', options: ['warm', 'cold'] },
  ],
  defaults: { question: 'with', subquery: 'in', distinct: false, guests: true, cache: 'warm' },
  run(values: Values) {
    const without = text(values, 'question') === 'without';
    const month = rowsInRange('month', DEFAULT_ORDERS);
    const orderTable = table('Orders', DEFAULT_ORDERS);
    const byDate = nonclustered(orderTable, 'IX_Orders_OrderDate', ['OrderDate'], ['CustomerId']);
    const customers = clusteredIndex(table('Customers', CUSTOMERS));
    const indexes = [indexDefinition(byDate)];

    // Con invitados, una parte de los pedidos no tiene cliente y la columna admite NULL.
    const guests = without && flag(values, 'guests');
    const withCustomer = guests ? Math.round(month * (1 - GUEST_SHARE)) : month;
    const matched = distinctCustomers(withCustomer);
    const unmatched = CUSTOMERS - matched;

    // La tabla hash se arma con los pedidos de octubre y se prueba con cada cliente.
    const october = () => seek(byDate, { rows: month, seek: RANGE });
    const everyone = () => scan(customers, { rows: CUSTOMERS });

    if (!without) {
      const exists = text(values, 'subquery') === 'exists';
      const distinct = flag(values, 'distinct');
      const semi = () => hashMatch(october(), everyone(), matched, 'Right Semi Join');
      const join = () => hashMatch(october(), everyone(), withCustomer, 'Inner Join');
      // Con DISTINCT, el optimizador compara agrupar el resultado del JOIN con el semi join.
      const planB = distinct ? cheapest([hashAggregate(join(), matched), semi()]) : join();
      const sqlA = exists
        ? [
            'SELECT c.Id, c.Name',
            'FROM Customers AS c',
            'WHERE EXISTS (SELECT 1',
            '              FROM Orders AS o',
            '              WHERE o.CustomerId = c.Id',
            `                AND o.OrderDate >= '${from}'`,
            `                AND o.OrderDate <  '${to}');`,
          ]
        : [
            'SELECT c.Id, c.Name',
            'FROM Customers AS c',
            'WHERE c.Id IN (SELECT o.CustomerId',
            ...ordersInRange('WHERE c.Id IN ('),
          ];
      const sqlB = [
        `SELECT ${distinct ? 'DISTINCT ' : ''}c.Id, c.Name`,
        'FROM Customers AS c',
        'JOIN Orders AS o ON o.CustomerId = c.Id',
        `WHERE o.OrderDate >= '${from}'`,
        `  AND o.OrderDate <  '${to}';`,
      ];
      return {
        notes: ['semi', distinct ? 'same-plan' : 'duplicates'],
        a: {
          label: exists ? 'exists' : 'in',
          statements: [{ sql: sqlA.join('\n'), plan: select(semi()), times: 1 }],
          rows: matched,
          indexes,
        },
        b: {
          label: distinct ? 'join-distinct' : 'join',
          statements: [{ sql: sqlB.join('\n'), plan: select(planB), times: 1 }],
          rows: distinct ? matched : withCustomer,
          indexes,
        },
      };
    }

    const anti = () => hashMatch(october(), everyone(), unmatched, 'Right Anti Semi Join');
    // NOT IN sobre una columna que admite NULL: además de comparar, revisa si la subconsulta trae
    // algún NULL; si lo trae, ninguna fila cumple la condición. El spool guarda esa respuesta.
    const nullCheck = rowCountSpool(
      seek(byDate, {
        rows: 1,
        rowsRead: Math.round(1 / GUEST_SHARE),
        seek: RANGE,
        predicate: 'CustomerId IS NULL',
      }),
      unmatched,
      1,
    );
    const planA = guests ? nestedLoops(anti(), nullCheck, 0, 'Left Anti Semi Join') : anti();
    const sqlA = [
      'SELECT c.Id, c.Name',
      'FROM Customers AS c',
      'WHERE c.Id NOT IN (SELECT o.CustomerId',
      ...ordersInRange('WHERE c.Id NOT IN ('),
    ];
    const sqlB = [
      'SELECT c.Id, c.Name',
      'FROM Customers AS c',
      'WHERE NOT EXISTS (SELECT 1',
      '                  FROM Orders AS o',
      '                  WHERE o.CustomerId = c.Id',
      `                    AND o.OrderDate >= '${from}'`,
      `                    AND o.OrderDate <  '${to}');`,
    ];
    return {
      notes: [guests ? 'null' : 'not-null'],
      a: {
        label: 'not-in',
        statements: [{ sql: sqlA.join('\n'), plan: select(planA), times: 1 }],
        rows: guests ? 0 : unmatched,
        indexes,
      },
      b: {
        label: 'not-exists',
        statements: [{ sql: sqlB.join('\n'), plan: select(anti()), times: 1 }],
        rows: unmatched,
        indexes,
      },
    };
  },
};
