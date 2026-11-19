// Compara el resultado del visitante con el esperado. Las columnas cuentan por posición, no por
// nombre (PostgreSQL escribe en minúsculas los que no van entre comillas), y los valores se
// comparan por lo que valen: 72000, 72000.00 y "72000" son el mismo número, y una fecha a
// medianoche es la misma con o sin la hora.

export interface ResultSet {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly unknown[])[];
  /** Las filas que cambió un INSERT, UPDATE, DELETE o MERGE. */
  readonly affected?: number;
}

export type Mismatch =
  | { readonly kind: 'no-result' }
  | { readonly kind: 'columns'; readonly expected: number; readonly actual: number }
  | { readonly kind: 'row-count'; readonly expected: number; readonly actual: number }
  | { readonly kind: 'values'; readonly row: number }
  | { readonly kind: 'order'; readonly row: number };

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const MIDNIGHT = /^(\d{4}-\d{2}-\d{2})[ T]00:00:00(?:\.0+)?(?:Z|[+-]00(?::?00)?)?$/;
const STAMP = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.0+)?$/;

/** El número con seis decimales como máximo, sin ceros de más: 72000.00 → 72000. */
function canonicalNumber(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Un valor de PostgreSQL o del YAML como texto comparable; null se queda en null. */
export function normalizeCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return canonicalNumber(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 19).replace('T', ' ');
  }
  const text = String(value);
  if (NUMBER.test(text.trim())) return canonicalNumber(Number(text));
  const midnight = MIDNIGHT.exec(text);
  if (midnight) return midnight[1] ?? text;
  const stamp = STAMP.exec(text);
  if (stamp) return `${stamp[1]} ${stamp[2]}`;
  return text;
}

const key = (row: readonly unknown[]) => JSON.stringify(row.map(normalizeCell));

/** Qué no coincide entre lo esperado y lo obtenido, o null si son iguales. */
export function compareResults(
  expected: ResultSet,
  actual: ResultSet | undefined,
  ordered: boolean,
): Mismatch | null {
  if (!actual) return { kind: 'no-result' };
  if (actual.columns.length !== expected.columns.length) {
    return { kind: 'columns', expected: expected.columns.length, actual: actual.columns.length };
  }
  if (actual.rows.length !== expected.rows.length) {
    return { kind: 'row-count', expected: expected.rows.length, actual: actual.rows.length };
  }
  const want = expected.rows.map(key);
  const got = actual.rows.map(key);
  if (ordered) {
    const row = want.findIndex((value, index) => value !== got[index]);
    if (row === -1) return null;
    // Las mismas filas en otro orden se dicen así, para no confundir con valores distintos.
    const sameRows = [...want].sort().join('\n') === [...got].sort().join('\n');
    return sameRows ? { kind: 'order', row } : { kind: 'values', row };
  }
  const sortedWant = [...want].sort();
  const sortedGot = [...got].sort();
  const row = sortedWant.findIndex((value, index) => value !== sortedGot[index]);
  if (row === -1) return null;
  // La primera fila esperada que no aparece en lo obtenido, en el orden del esperado.
  const missing = want.findIndex((value) => !got.includes(value));
  return { kind: 'values', row: Math.max(0, missing) };
}
