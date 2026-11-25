// Los ejemplos de las lecciones de SQL: un bloque ```sql seguido de un ```text es una consulta y su
// resultado, con el formato de `psql` (el de los dos cursos de SQL). Las pruebas de lecciones corren la
// consulta en PGlite y comprueban que el texto coincide. Un ```sql sin resultado es un fragmento y no
// se corre; un ```text suelto, sin su consulta, es un error.
//
// El formato: la cabecera centrada, una línea de guiones con `+` entre las columnas, las filas con el
// texto a la izquierda y los números a la derecha, `NULL` para un dato que falta y, al final, el
// número de filas: `(6 rows)` en inglés y `(6 filas)` en español. Se comparan sin los espacios al
// final de cada línea y sin distinguir mayúsculas en la cabecera: PostgreSQL escribe en minúsculas los
// nombres que no van entre comillas, y el texto muestra los de SQL Server, tal como se escriben.

import { normalizeCell } from '../labs/challenges/sql/compare';

export interface Table {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly unknown[])[];
}

export type Language = 'es' | 'en';

/** El pie con el número de filas: `(1 row)`, `(6 rows)`, `(1 fila)`, `(6 filas)`. */
export function rowCount(count: number, lang: Language): string {
  if (lang === 'es') return count === 1 ? '(1 fila)' : `(${count} filas)`;
  return count === 1 ? '(1 row)' : `(${count} rows)`;
}

const NUMERIC = /^-?\d+(?:\.\d+)?$/;

function show(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) return normalizeCell(value) ?? 'NULL';
  return String(value);
}

const isNumber = (value: unknown) =>
  typeof value === 'number' ||
  typeof value === 'bigint' ||
  (typeof value === 'string' && NUMERIC.test(value));

/** El resultado como lo escribiría `psql`, línea por línea y sin espacios al final. */
export function formatTable(table: Table, lang: Language): string[] {
  const cells = table.rows.map((row) => row.map(show));
  // Una columna se alinea a la derecha si todos sus datos son números.
  const numeric = table.columns.map((_, index) =>
    table.rows.every((row) => row[index] === null || isNumber(row[index])),
  );
  const widths = table.columns.map((name, index) =>
    Math.max(name.length, ...cells.map((row) => (row[index] ?? '').length)),
  );
  const center = (text: string, width: number) => {
    const left = Math.floor((width - text.length) / 2);
    return ' '.repeat(left) + text + ' '.repeat(width - text.length - left);
  };
  const line = (parts: readonly string[]) => (' ' + parts.join(' | ')).trimEnd();
  const header = line(table.columns.map((name, index) => center(name, widths[index] ?? 0)));
  const rule = widths.map((width) => '-'.repeat(width + 2)).join('+');
  const body = cells.map((row) =>
    line(
      row.map((text, index) =>
        numeric[index] ? text.padStart(widths[index] ?? 0) : text.padEnd(widths[index] ?? 0),
      ),
    ),
  );
  return [header, rule, ...body, rowCount(table.rows.length, lang)];
}

/** Una línea de un bloque de resultado, lista para comparar. */
const normalizeLine = (text: string) => text.trimEnd();

/** Qué línea de `actual` no coincide con las de `expected`, o null si el bloque es el mismo. */
export function diffBlocks(
  expected: readonly string[],
  actual: readonly string[],
): { line: number; expected: string; actual: string } | null {
  const size = Math.max(expected.length, actual.length);
  for (let index = 0; index < size; index++) {
    const want = normalizeLine(expected[index] ?? '');
    const got = normalizeLine(actual[index] ?? '');
    // La cabecera (la primera línea) no distingue mayúsculas.
    const same = index === 0 ? want.toLowerCase() === got.toLowerCase() : want === got;
    if (!same) return { line: index + 1, expected: want, actual: got };
  }
  return null;
}

export interface Fence {
  readonly lang: string;
  readonly body: string;
}

/** Los bloques de código de un texto en Markdown, en orden. */
export function fences(markdown: string): Fence[] {
  return [...markdown.matchAll(/^```(\w*)[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm)].map((match) => ({
    lang: match[1] ?? '',
    body: match[2] ?? '',
  }));
}

export interface Example {
  readonly sql: string;
  /** Las líneas del bloque de resultado. */
  readonly output: readonly string[];
}

/**
 * Los ejemplos de un texto: cada ```sql seguido de su ```text. Devuelve también los ```text que
 * quedaron sin su consulta (en un ```tsql no cuentan: ese código no corre aquí).
 */
export function examples(markdown: string): { found: Example[]; orphans: string[] } {
  const blocks = fences(markdown);
  const found: Example[] = [];
  const orphans: string[] = [];
  blocks.forEach((block, index) => {
    if (block.lang !== 'text') return;
    const before = blocks[index - 1];
    if (before?.lang === 'sql') found.push({ sql: before.body, output: block.body.split('\n') });
    else orphans.push(block.body);
  });
  return { found, orphans };
}
