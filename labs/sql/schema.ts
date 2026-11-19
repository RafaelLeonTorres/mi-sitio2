// La base de la tienda: tablas, índices y cómo se reparten los datos. Todo es determinista: el
// mismo tamaño de tabla da siempre las mismas páginas, las mismas filas por rango y el mismo plan.

import { indexShape, ROW_OVERHEAD, type IndexShape } from './storage';

export const CUSTOMERS = 50_000;
export const PRODUCTS = 5_000;
export const LINES_PER_ORDER = 3;
export const DEFAULT_ORDERS = 1_000_000;
export const ORDER_SIZES = [10_000, 100_000, 1_000_000, 10_000_000] as const;

/** Los pedidos van del 1 de enero de 2020 al 31 de octubre de 2026, repartidos por igual. */
export const FIRST_DAY = '2020-01-01';
export const LAST_DAY = '2026-10-31';
export const DAYS = 2496;

export type Range = 'year' | 'month' | 'day';

/** Los días de cada rango: el año 2026 hasta octubre, octubre de 2026 y el 15 de octubre. */
export const RANGE_DAYS: Readonly<Record<Range, number>> = { year: 304, month: 31, day: 1 };

/** Las fechas de cada rango en T-SQL, como literales sin ambigüedad ('AAAAMMDD'). */
export const RANGE_BOUNDS: Readonly<Record<Range, { from: string; to: string }>> = {
  year: { from: '20260101', to: '20270101' },
  month: { from: '20261001', to: '20261101' },
  day: { from: '20261015', to: '20261016' },
};

/** Los pedidos de `orders` que caen en el rango. */
export function rowsInRange(range: Range, orders: number): number {
  return Math.round((orders * RANGE_DAYS[range]) / DAYS);
}

/**
 * El pedido en la posición `k` contando desde el más reciente (0): su Id y su fecha y hora. Los Id
 * crecen con la fecha, porque los pedidos se insertan en orden.
 */
export function orderFromNewest(k: number, orders: number): { id: number; date: string } {
  const id = orders - k;
  const days = ((id - 1) * DAYS) / orders;
  const day = Math.floor(days);
  const seconds = Math.floor((days - day) * 86_400);
  const date = new Date(Date.UTC(2020, 0, 1) + day * 86_400_000 + seconds * 1000);
  return { id, date: date.toISOString().slice(0, 19).replace('T', ' ') };
}

/** Pedidos de un cliente cualquiera, en promedio. */
export function ordersPerCustomer(orders: number): number {
  return Math.max(1, Math.round(orders / CUSTOMERS));
}

/** Clientes distintos entre `orders` pedidos repartidos al azar entre todos los clientes. */
export function distinctCustomers(orders: number): number {
  return Math.round(CUSTOMERS * (1 - Math.exp(-orders / CUSTOMERS)));
}

export interface Table {
  readonly name: string;
  readonly rows: number;
}

/** Un índice de una tabla: el agrupado guarda la fila completa; los demás, su clave y el Id. */
export interface Index {
  readonly table: Table;
  readonly name: string;
  readonly clustered: boolean;
  /** Las columnas de la clave, en orden. */
  readonly keys: readonly string[];
  /** Las columnas que guarda la hoja sin ser clave (INCLUDE). */
  readonly includes: readonly string[];
  readonly shape: IndexShape;
}

// Bytes promedio de cada columna. Orders.* suma unos 120: Id, CustomerId, OrderDate datetime2(0),
// Status, Total decimal(10,2), ShippingCity, ShippingAddress y Notes (casi siempre NULL).
const BYTES: Readonly<Record<string, number>> = {
  Id: 4,
  CustomerId: 4,
  OrderDate: 6,
  Total: 9,
};
const ROW_BYTES: Readonly<Record<string, number>> = {
  Orders: 120,
  Customers: 120,
  Products: 80,
  OrderLines: 23,
};

export function table(name: string, rows: number): Table {
  return { name, rows };
}

export function clusteredIndex(of: Table): Index {
  const rowBytes = (ROW_BYTES[of.name] ?? 100) + ROW_OVERHEAD;
  return {
    table: of,
    name: `PK_${of.name}`,
    clustered: true,
    keys: ['Id'],
    includes: [],
    shape: indexShape(of.rows, rowBytes, BYTES['Id'] ?? 4),
  };
}

/** Un índice no agrupado; su hoja lleva la clave, lo incluido y el Id para llegar a la fila. */
export function nonclustered(
  of: Table,
  name: string,
  keys: readonly string[],
  includes: readonly string[] = [],
): Index {
  const columns = [...keys, ...includes, 'Id'];
  const leafBytes = columns.reduce((sum, column) => sum + (BYTES[column] ?? 4), 0) + ROW_OVERHEAD;
  const keyBytes = [...keys, 'Id'].reduce((sum, column) => sum + (BYTES[column] ?? 4), 0);
  return {
    table: of,
    name,
    clustered: false,
    keys,
    includes,
    shape: indexShape(of.rows, leafBytes, keyBytes),
  };
}

/** Si el índice tiene todas las columnas que pide la consulta (las del agrupado, siempre). */
export function covers(index: Index, columns: readonly string[]): boolean {
  if (index.clustered) return true;
  const available = new Set([...index.keys, ...index.includes, 'Id']);
  return columns.every((column) => available.has(column));
}

/** La definición del índice en T-SQL, como la escribiría alguien a mano. */
export function indexDefinition(index: Index): string {
  const include = index.includes.length > 0 ? ` INCLUDE (${index.includes.join(', ')})` : '';
  return `${index.name} (${index.keys.join(', ')})${include}`;
}
