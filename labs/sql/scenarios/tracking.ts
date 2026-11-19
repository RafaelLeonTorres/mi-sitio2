// AsNoTracking. El SQL es el mismo con y sin seguimiento de cambios; lo que cambia está en .NET: con
// seguimiento, EF Core guarda cada entidad en el contexto con una copia de sus valores originales.
// Una proyección a un DTO, además, pide solo tres columnas, y el índice basta para responderla.

import { selectList } from '../columns';
import { cheapest, keyLookup, nestedLoops, scan, seek, select } from '../plan';
import {
  DEFAULT_ORDERS,
  RANGE_BOUNDS,
  clusteredIndex,
  indexDefinition,
  nonclustered,
  rowsInRange,
  table,
  type Range,
} from '../schema';
import { MATERIALIZE, text, type Scenario, type Values } from '../scenario';
import { ORDER_COLUMNS } from './n-plus-one';

/** Un viaje a la base en la misma red. */
const RTT_MS = 1;
const WHERE = '[o].[OrderDate] >= @from AND [o].[OrderDate] < @to';

export const tracking: Scenario = {
  id: 'tracking',
  controls: [
    { kind: 'choice', id: 'range', options: ['day', 'month', 'year'] },
    { kind: 'choice', id: 'query', options: ['no-tracking', 'projection'] },
    { kind: 'choice', id: 'cache', options: ['warm', 'cold'] },
  ],
  defaults: { range: 'month', query: 'no-tracking', cache: 'warm' },
  run(values: Values) {
    const range = rangeOf(text(values, 'range'));
    const projection = text(values, 'query') === 'projection';
    const rows = rowsInRange(range, DEFAULT_ORDERS);
    const orderTable = table('Orders', DEFAULT_ORDERS);
    const clustered = clusteredIndex(orderTable);
    const byDate = nonclustered(orderTable, 'IX_Orders_OrderDate', ['OrderDate'], ['Total']);
    const indexes = [indexDefinition(byDate)];
    const { from, to } = RANGE_BOUNDS[range];
    const params = { from: `'${isoDate(from)}'`, to: `'${isoDate(to)}'` };

    // La entidad completa: el índice no tiene todas las columnas, así que el optimizador compara el
    // seek con un Key Lookup por fila contra leer la tabla (el punto de inflexión).
    const entity = () =>
      cheapest([
        scan(clustered, { rows, predicate: WHERE }),
        nestedLoops(
          seek(byDate, { rows, seek: WHERE }),
          keyLookup(clustered, rows, 'together'),
          rows,
        ),
      ]);
    const sqlEntity = [
      selectList('SELECT', ORDER_COLUMNS),
      'FROM [Orders] AS [o]',
      `WHERE ${WHERE}`,
    ].join('\n');
    const sqlProjection = [
      selectList('SELECT', ['[o].[Id]', '[o].[OrderDate]', '[o].[Total]']),
      'FROM [Orders] AS [o]',
      `WHERE ${WHERE}`,
    ].join('\n');
    const model = projection ? MATERIALIZE.projection : MATERIALIZE.untracked;

    return {
      notes: [projection ? 'projection' : 'same-sql', 'identity', 'default'],
      a: {
        label: 'tracked',
        statements: [{ sql: sqlEntity, plan: select(entity()), times: 1, params }],
        rows,
        linq: 'tracking-tracked',
        indexes,
        client: {
          roundTrips: 1,
          rttMs: RTT_MS,
          materializeMs: rows * MATERIALIZE.tracked.ms,
          memoryBytes: rows * MATERIALIZE.tracked.bytes,
          rowsTransferred: rows,
        },
      },
      b: {
        label: projection ? 'projection' : 'no-tracking',
        statements: [
          {
            sql: projection ? sqlProjection : sqlEntity,
            plan: select(projection ? seek(byDate, { rows, seek: WHERE }) : entity()),
            times: 1,
            params,
          },
        ],
        rows,
        linq: projection ? 'tracking-projection' : 'tracking-no-tracking',
        indexes,
        client: {
          roundTrips: 1,
          rttMs: RTT_MS,
          materializeMs: rows * model.ms,
          memoryBytes: rows * model.bytes,
          rowsTransferred: rows,
        },
      },
    };
  },
};

/** '20261001' → '2026-10-01T00:00:00', como EF Core muestra un parámetro datetime2 en el registro. */
function isoDate(literal: string): string {
  return `${literal.slice(0, 4)}-${literal.slice(4, 6)}-${literal.slice(6, 8)}T00:00:00`;
}

function rangeOf(value: string): Range {
  return value === 'day' || value === 'year' ? value : 'month';
}
