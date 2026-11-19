// El playground de SQL: el código del visitante contra la base de ejemplo, sin casos que revisar.
// Cada ejecución parte de una base nueva con todas las tablas y sus filas de ejemplo o, si se
// pide, con los clientes y pedidos generados, para ver planes como con datos reales. Corre una
// sentencia a la vez, como en SSMS: un error no detiene las que siguen.

import type { ResultSet } from './compare';
import { insertSql, type Dataset } from './data';
import { planRoot, planText } from './plan-check';
import { sqlError, type OpenDatabase, type RunOptions, type SqlError } from './runner';
import { lineAt, splitStatements, translate, type Blocked, type NoteKey } from './translate';

/** Las tablas que se llenan con los generadores en lugar de sus filas de ejemplo. */
export const GENERATED: Readonly<Record<string, string>> = {
  Customers: 'customers',
  Orders: 'orders',
};

export interface PlaygroundStatement {
  /** El renglón del código donde empieza la sentencia, desde 1. */
  readonly line: number;
  readonly result?: ResultSet;
  readonly error?: SqlError;
}

export interface PlaygroundOutcome {
  readonly notes: readonly NoteKey[];
  readonly refusal?: 'blocked' | 'empty';
  readonly blocked?: readonly Blocked[];
  readonly statements: readonly PlaygroundStatement[];
  /** El plan de la última consulta, si se pidió y la última sentencia que corrió es una consulta. */
  readonly plan?: string;
  readonly planError?: SqlError;
  readonly ms?: number;
}

export interface PlaygroundOptions extends RunOptions {
  /** Mostrar el plan (EXPLAIN ANALYZE) de la última consulta. */
  readonly explain?: boolean;
  /** Llenar Customers y Orders con los generadores (miles de filas) en lugar de sus ejemplos. */
  readonly generate?: boolean;
}

/** El esquema y los datos de la base de ejemplo, en PostgreSQL. */
export function playgroundSql(dataset: Dataset, generate: boolean): string {
  const ddl = dataset.tables.map((table) => translate(table.ddl).sql.trim());
  const rows = dataset.tables.flatMap((table) => {
    const generator = generate ? GENERATED[table.id] : undefined;
    if (generator) {
      const found = dataset.generators.find((item) => item.id === generator);
      return found ? [found.sql.trim()] : [];
    }
    const insert = insertSql(table.id, table.sample, table.defaults);
    return insert ? [insert] : [];
  });
  const identity = dataset.tables
    .filter((table) => /\bIDENTITY\b/i.test(table.ddl))
    .map(
      (table) =>
        `SELECT setval(pg_get_serial_sequence('${table.id.toLowerCase()}', 'id'), COALESCE(MAX(Id), 0) + 1, false) FROM ${table.id};`,
    );
  return [...ddl, ...rows, ...identity].join('\n\n');
}

/** Si la sentencia es una consulta que se puede pasar por EXPLAIN sin cambiar datos. */
export function isQuery(statement: string): boolean {
  return /^\s*(?:SELECT|WITH|VALUES|TABLE)\b/i.test(
    statement.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*/, ''),
  );
}

export async function runPlayground(
  open: OpenDatabase,
  dataset: Dataset,
  source: string,
  options: PlaygroundOptions = {},
): Promise<PlaygroundOutcome> {
  const now = options.now ?? (() => performance.now());
  const translation = translate(source);
  const base = { notes: translation.notes, statements: [] };
  const statements = splitStatements(translation.sql);
  if (statements.length === 0) return { ...base, refusal: 'empty' };
  if (translation.blocked.length > 0) {
    return { ...base, refusal: 'blocked', blocked: translation.blocked };
  }

  const db = await open();
  try {
    await db.exec(playgroundSql(dataset, options.generate === true));
    if (options.generate) await db.exec('VACUUM ANALYZE;');

    const out: PlaygroundStatement[] = [];
    let lastQuery: string | undefined;
    options.onCode?.();
    const started = now();
    for (const statement of statements) {
      const line = lineAt(translation.sql, statement.start + (statement.text.search(/\S/) || 0));
      try {
        const results = await db.exec(statement.text);
        const result = results.at(-1);
        out.push(result ? { line, result } : { line });
        lastQuery = isQuery(statement.text) ? statement.text : undefined;
      } catch (caught) {
        out.push({ line, error: sqlError(caught, translation.sql, statement.start) });
        lastQuery = undefined;
      }
    }
    const ms = now() - started;

    let plan: string | undefined;
    let planError: SqlError | undefined;
    if (options.explain && lastQuery) {
      const prefix = 'EXPLAIN (ANALYZE, FORMAT JSON) ';
      try {
        const explained = (await db.exec(prefix + lastQuery.trim().replace(/;+\s*$/, ''))).at(-1);
        plan = planText(planRoot(explained?.rows[0]?.[0]));
      } catch (caught) {
        planError = sqlError(caught, '', 0, prefix.length);
      }
    }
    await db.exec('ROLLBACK;').catch(() => undefined);
    return {
      ...base,
      statements: out,
      ms,
      ...(plan === undefined ? {} : { plan }),
      ...(planError ? { planError } : {}),
    };
  } finally {
    await db.close();
  }
}
