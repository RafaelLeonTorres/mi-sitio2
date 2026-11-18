// Lectura y validación de los cuerpos JSON, como el model binding de ASP.NET Core con las
// opciones web de System.Text.Json: los nombres no distinguen mayúsculas, un número puede
// venir como texto y lo que el DTO no tiene se ignora (así se evita la asignación masiva).

import type { ProductData } from './store';

/** Mensajes de validación en el idioma de la página; `{min}`, `{max}` y `{value}` se sustituyen. */
export interface ValidationMessages {
  readonly required: string;
  readonly length: string;
  readonly positive: string;
  readonly notNegative: string;
  readonly integer: string;
  readonly number: string;
  readonly skuFormat: string;
  readonly category: string;
  readonly role: string;
  readonly page: string;
  readonly pageSize: string;
}

export type Errors = Record<string, string[]>;

export interface Read<T> {
  readonly value: T;
  readonly errors: Errors;
  /** Campos que trajo el cuerpo y el DTO no tiene, como `id` o `costPrice`. */
  readonly ignored: readonly string[];
}

export const ROLES = ['Reader', 'Editor', 'Admin'] as const;
export type Role = (typeof ROLES)[number];

export const MAX_PAGE_SIZE = 50;
const SKU = /^[A-Z]{3}-\d{4}$/;
const PRODUCT_FIELDS = ['name', 'sku', 'price', 'stock', 'categoryId'] as const;

/** Si el texto es JSON y es un objeto; si no, `null` y la API responde 400. */
export function parseObject(body: string | undefined): Record<string, unknown> | null {
  if (body === undefined || body.trim() === '') return null;
  try {
    const value: unknown = JSON.parse(body);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

/** `CreateProductRequest` y `UpdateProductRequest` tienen los mismos campos y reglas. */
export function readProduct(
  body: Readonly<Record<string, unknown>>,
  hasCategory: (id: number) => boolean,
  messages: ValidationMessages,
): Read<ProductData> {
  const errors: Errors = {};
  const add = (field: string, message: string) => (errors[field] ??= []).push(message);
  const { fields, ignored } = pick(body, PRODUCT_FIELDS);

  const name = typeof fields.name === 'string' ? fields.name.trim() : '';
  if (fields.name === undefined || fields.name === null || name === '')
    add('name', messages.required);
  else if (name.length < 3 || name.length > 100)
    add('name', fill(messages.length, { min: 3, max: 100 }));

  const sku = typeof fields.sku === 'string' ? fields.sku.trim() : '';
  if (sku === '') add('sku', messages.required);
  else if (!SKU.test(sku)) add('sku', messages.skuFormat);

  const price = toNumber(fields.price);
  if (fields.price === undefined || fields.price === null) add('price', messages.required);
  else if (Number.isNaN(price)) add('price', messages.number);
  else if (price <= 0) add('price', messages.positive);

  const stock = toNumber(fields.stock);
  if (fields.stock === undefined || fields.stock === null) add('stock', messages.required);
  else if (!Number.isInteger(stock)) add('stock', messages.integer);
  else if (stock < 0) add('stock', messages.notNegative);

  const categoryId = toNumber(fields.categoryId);
  if (fields.categoryId === undefined || fields.categoryId === null) {
    add('categoryId', messages.required);
  } else if (!Number.isInteger(categoryId)) {
    add('categoryId', messages.integer);
  } else if (!hasCategory(categoryId)) {
    add('categoryId', fill(messages.category, { value: categoryId }));
  }

  return { value: { name, sku, price, stock, categoryId }, errors, ignored };
}

/** El cuerpo de `POST /api/auth/token`: `{ "role": "Editor" }`. */
export function readTokenRequest(
  body: Readonly<Record<string, unknown>>,
  messages: ValidationMessages,
): Read<{ readonly role: Role }> {
  const { fields, ignored } = pick(body, ['role'] as const);
  const role = ROLES.find(
    (item) => typeof fields.role === 'string' && item.toLowerCase() === fields.role.toLowerCase(),
  );
  const errors: Errors = {};
  if (fields.role === undefined || fields.role === null || fields.role === '')
    errors['role'] = [messages.required];
  else if (!role) errors['role'] = [fill(messages.role, { value: ROLES.join(', ') })];
  return { value: { role: role ?? 'Reader' }, errors, ignored };
}

/** La consulta de `GET /api/products`: `page`, `pageSize` y `search`. */
export function readListQuery(
  query: URLSearchParams,
  messages: ValidationMessages,
): Read<{ readonly page: number; readonly pageSize: number; readonly search: string }> {
  const errors: Errors = {};
  const page = toNumber(query.get('page') ?? '1');
  const pageSize = toNumber(query.get('pageSize') ?? '10');
  if (!Number.isInteger(page) || page < 1) errors['page'] = [messages.page];
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    errors['pageSize'] = [fill(messages.pageSize, { max: MAX_PAGE_SIZE })];
  }
  return { value: { page, pageSize, search: query.get('search') ?? '' }, errors, ignored: [] };
}

/** Sustituye `{nombre}` por su valor. */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

/** Toma los campos conocidos sin distinguir mayúsculas y aparta los demás. */
function pick<const K extends string>(
  body: Readonly<Record<string, unknown>>,
  known: readonly K[],
): { fields: Partial<Record<K, unknown>>; ignored: string[] } {
  const fields: Partial<Record<K, unknown>> = {};
  const ignored: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    const field = known.find((name) => name.toLowerCase() === key.toLowerCase());
    if (field) fields[field] = value;
    else ignored.push(key);
  }
  return { fields, ignored };
}

/** Un número, o un texto que lo sea ("12.5"); cualquier otra cosa da `NaN`. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) return Number(value);
  return Number.NaN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
