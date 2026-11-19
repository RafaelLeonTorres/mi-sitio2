// Corre el código del visitante contra un caso de un reto de SQL, en una base nueva: el esquema,
// los datos del caso, el código y, según el reto, lo que se revisa después (cómo quedó una tabla
// o el plan de la consulta). La base llega de fuera (`open`), ya con las funciones de T-SQL, para
// usar PGlite en el navegador y en las pruebas sin que este archivo dependa de él.
//
// El código corre una sentencia a la vez, como en SSMS: sin BEGIN, cada una se confirma sola, y
// una transferencia que falla a la mitad queda a medias. Así se nota para qué sirve la transacción.

import { compareResults, type Mismatch, type ResultSet } from './compare';
import { caseSql, schemaSql, type Dataset, type Rows, type SqlChallenge } from './data';
import { checkPlan, planRoot, planText, type RuleResult } from './plan-check';
import { lineAt, splitStatements, translate, type Blocked, type NoteKey } from './translate';

/**
 * Una base de PostgreSQL abierta: corre varias sentencias y devuelve un resultado por cada una.
 * Llega nueva y con las funciones de T-SQL de compat.ts ya creadas.
 */
export interface Database {
  exec(sql: string): Promise<ResultSet[]>;
  close(): Promise<void>;
}

export type OpenDatabase = () => Promise<Database>;

export interface SqlError {
  readonly message: string;
  /** El renglón del código del visitante, si PostgreSQL dijo dónde. */
  readonly line?: number;
  readonly detail?: string;
  readonly hint?: string;
}

/** Por qué no se pudo revisar: el código no corre aquí, el reto pide una sola consulta o está vacío. */
export type Refusal = 'blocked' | 'single-query' | 'empty';

export interface CaseOutcome {
  readonly index: number;
  readonly passed: boolean;
  readonly refusal?: Refusal;
  readonly blocked?: readonly Blocked[];
  readonly notes: readonly NoteKey[];
  readonly expected?: ResultSet;
  readonly actual?: ResultSet;
  readonly mismatch?: Mismatch | null;
  /** El primer error del código. En los retos de cambios de datos no reprueba por sí solo. */
  readonly error?: SqlError;
  readonly plan?: { readonly text: string; readonly rules: readonly RuleResult[] };
  /** Lo que tardó el código del visitante, en milisegundos. */
  readonly ms?: number;
}

/** Un error de PostgreSQL (o de PGlite) con el renglón donde ocurrió dentro de `source`. */
export function sqlError(error: unknown, source: string, start = 0, prefix = 0): SqlError {
  const record = (error ?? {}) as Record<string, unknown>;
  const message = typeof record['message'] === 'string' ? record['message'] : String(error);
  const position = Number(record['position']);
  const out: { message: string; line?: number; detail?: string; hint?: string } = { message };
  if (source && Number.isFinite(position) && position > prefix) {
    out.line = lineAt(source, start + position - 1 - prefix);
  }
  if (typeof record['detail'] === 'string') out.detail = record['detail'];
  if (typeof record['hint'] === 'string') out.hint = record['hint'];
  return out;
}

/** El último resultado con columnas: el de la última consulta. */
export function lastResult(results: readonly ResultSet[]): ResultSet | undefined {
  return [...results].reverse().find((result) => result.columns.length > 0);
}

const toResult = (rows: Rows): ResultSet => ({ columns: rows.columns, rows: rows.rows });
const withoutSemicolon = (sql: string) => sql.trim().replace(/;+\s*$/, '');
const EXPLAIN = 'EXPLAIN (ANALYZE, FORMAT JSON) ';

export interface RunOptions {
  /** El reloj para medir el código del visitante; en las pruebas, uno falso. */
  readonly now?: () => number;
  /**
   * Avisa justo antes de correr el código del visitante, cuando la base ya está lista. Desde ahí
   * cuenta el tiempo límite: preparar 50,000 filas es trabajo del motor, no del visitante.
   */
  readonly onCode?: () => void;
}

/** Corre el código contra un caso y dice si lo pasa. */
export async function runCase(
  open: OpenDatabase,
  challenge: SqlChallenge,
  dataset: Dataset,
  index: number,
  source: string,
  options: RunOptions = {},
): Promise<CaseOutcome> {
  const now = options.now ?? (() => performance.now());
  const data = challenge.cases[index];
  if (!data) throw new Error(`El reto no tiene un caso ${index}.`);
  const translation = translate(source);
  const base = { index, notes: translation.notes };
  const statements = splitStatements(translation.sql);
  if (statements.length === 0) return { ...base, passed: false, refusal: 'empty' };
  if (translation.blocked.length > 0) {
    return { ...base, passed: false, refusal: 'blocked', blocked: translation.blocked };
  }
  if (challenge.check === 'plan' && statements.length !== 1) {
    return { ...base, passed: false, refusal: 'single-query' };
  }

  const db = await open();
  try {
    // El esquema está en T-SQL (datetime2, nvarchar): se traduce como el código del visitante.
    await db.exec(translate(schemaSql(challenge, dataset)).sql);
    const fill = caseSql(challenge, data, dataset);
    if (fill) await db.exec(fill);
    // Con miles de filas, VACUUM marca las páginas como visibles (para los Index Only Scan) y
    // ANALYZE da al planificador las estadísticas que tendría una base de verdad.
    if (data.generate) await db.exec('VACUUM ANALYZE;');

    // Lo esperado sale del YAML o, en los de optimización, de la consulta original en esta base.
    let expected = data.expected ? toResult(data.expected) : undefined;
    if (!expected && challenge.check === 'plan') {
      expected = lastResult(await db.exec(translate(challenge.starter).sql));
    }
    if (!expected && challenge.check === 'index' && challenge.query) {
      expected = lastResult(await db.exec(challenge.query));
    }

    // Una sentencia a la vez. En los de cambios de datos, como en SSMS, un error no detiene las
    // que siguen: lo que cuenta es cómo queda la tabla.
    const keepGoing = challenge.check === 'table';
    const results: ResultSet[] = [];
    let error: SqlError | undefined;
    options.onCode?.();
    const started = now();
    for (const statement of statements) {
      try {
        results.push(...(await db.exec(statement.text)));
      } catch (caught) {
        error ??= sqlError(caught, translation.sql, statement.start);
        if (!keepGoing) break;
      }
    }
    const ms = now() - started;
    // Lo que el código dejó sin COMMIT se pierde, como al cerrar la conexión.
    await db.exec('ROLLBACK;').catch(() => undefined);
    if (error && !keepGoing) return { ...base, passed: false, error, ms };

    let actual: ResultSet | undefined;
    if (challenge.check === 'table' && challenge.verify) {
      actual = lastResult(await db.exec(challenge.verify));
    } else if (challenge.check === 'index' && challenge.query) {
      await db.exec('ANALYZE;');
      actual = lastResult(await db.exec(challenge.query));
    } else actual = lastResult(results);

    const ordered = challenge.check === 'table' || challenge.ordered === true;
    const mismatch = expected ? compareResults(expected, actual, ordered) : null;

    let plan: CaseOutcome['plan'];
    if (data.explain && challenge.plan) {
      const target = challenge.check === 'index' ? (challenge.query ?? '') : translation.sql;
      try {
        const explained = lastResult(await db.exec(EXPLAIN + withoutSemicolon(target)));
        const root = planRoot(explained?.rows[0]?.[0]);
        plan = { text: planText(root), rules: checkPlan(root, challenge.plan) };
      } catch (caught) {
        const at = challenge.check === 'index' ? '' : translation.sql;
        return { ...base, passed: false, error: sqlError(caught, at, 0, EXPLAIN.length), ms };
      }
    }

    const passed = mismatch === null && (plan?.rules.every((rule) => rule.ok) ?? true);
    return {
      ...base,
      passed,
      mismatch,
      ms,
      ...(error ? { error } : {}),
      ...(expected ? { expected } : {}),
      ...(actual ? { actual } : {}),
      ...(plan ? { plan } : {}),
    };
  } finally {
    await db.close();
  }
}
