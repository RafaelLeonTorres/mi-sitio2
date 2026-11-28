// Corre el código del visitante contra un caso de un reto de SQL, en una base nueva: el esquema,
// los datos del caso, el código y, según el reto, lo que se revisa después (cómo quedó una tabla
// o el plan de la consulta). La base llega de fuera (`open`), ya con las funciones de T-SQL, para
// usar PGlite en el navegador y en las pruebas sin que este archivo dependa de él.
//
// El código corre una sentencia a la vez, como en SSMS: sin BEGIN, cada una se confirma sola, y
// una transferencia que falla a la mitad queda a medias. Así se nota para qué sirve la transacción.
//
// Los retos del laboratorio traen escrito lo que debe devolver cada caso (`expected`). Los ejercicios
// de un curso no: lo esperado es lo que devuelve la solución en ese mismo caso, en otra base. Un
// reto con `collation` traduce el esquema y el código con esa intercalación (el curso de SQL Server);
// uno con `dialect: 'postgresql'` (el curso de PostgreSQL) corre tal cual, sin traducir.

import { compareNames, compareResults, type Mismatch, type ResultSet } from './compare';
import {
  caseSql,
  schemaSql,
  type Dataset,
  type Rows,
  type SqlChallenge,
  type SqlDialect,
} from './data';
import { checkPlan, planRoot, planText, type RuleResult } from './plan-check';
import {
  codeMask,
  lineAt,
  splitStatements,
  translate,
  type Blocked,
  type NoteKey,
  type Translation,
} from './translate';

/**
 * Una base de PostgreSQL abierta: corre varias sentencias y devuelve un resultado por cada una.
 * Llega nueva; la de T-SQL, con las funciones de compat.ts ya creadas.
 */
export interface Database {
  /** `onMessage` recibe los avisos del servidor, como los de `RAISE NOTICE`. */
  exec(sql: string, onMessage?: (message: string) => void): Promise<ResultSet[]>;
  close(): Promise<void>;
}

export type OpenDatabase = (dialect?: SqlDialect) => Promise<Database>;

export interface SqlError {
  readonly message: string;
  /** El código SQLSTATE de PostgreSQL, como `42P01`. */
  readonly code?: string;
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
  /** Los avisos que mandó el servidor mientras corría el código (curso de PostgreSQL). */
  readonly messages?: readonly string[];
}

/** Un error de PostgreSQL (o de PGlite) con el renglón donde ocurrió dentro de `source`. */
export function sqlError(error: unknown, source: string, start = 0, prefix = 0): SqlError {
  const record = (error ?? {}) as Record<string, unknown>;
  const message = typeof record['message'] === 'string' ? record['message'] : String(error);
  const position = Number(record['position']);
  const out: { message: string; code?: string; line?: number; detail?: string; hint?: string } = {
    message,
  };
  if (typeof record['code'] === 'string') out.code = record['code'];
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

// Un renglón que empieza con una barra invertida: \dt, \d, \c… de psql.
const PSQL_COMMAND = /^[ \t]*\\/m;

/** El SQL de PostgreSQL corre tal cual; solo se avisa de los comandos de psql, que no son SQL. */
export function nativeSql(source: string): Translation {
  const found = PSQL_COMMAND.exec(codeMask(source, true));
  const blocked: Blocked[] = found ? [{ key: 'psql', line: lineAt(source, found.index) }] : [];
  return { sql: source, notes: [], blocked };
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
  /**
   * Un caso de resultado (`rows` o `table`) sin `expected` espera lo que devuelve la solución del
   * reto; `false` lo apaga. La propia ejecución de la solución lo apaga, para no pedirse a sí misma.
   */
  readonly reference?: boolean;
}

/** Lo que devuelve la solución del reto en un caso, en una base aparte: lo esperado de un ejercicio. */
async function referenceResult(
  open: OpenDatabase,
  challenge: SqlChallenge,
  dataset: Dataset,
  index: number,
): Promise<ResultSet> {
  const run = await runCase(open, challenge, dataset, index, challenge.solution, {
    reference: false,
  });
  if (run.refusal || run.error?.code !== challenge.sqlstate || !run.actual) {
    const why =
      run.refusal ??
      run.error?.message ??
      (challenge.sqlstate ? 'no dio el error esperado' : 'no devolvió ningún resultado');
    throw new Error(`La solución de referencia del caso ${index + 1} no corre: ${why}.`);
  }
  return run.actual;
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
  const native = challenge.dialect === 'postgresql';
  const translating = challenge.collation ? { collation: challenge.collation } : {};
  const toPostgres = (sql: string) => (native ? nativeSql(sql) : translate(sql, translating));
  const translation = toPostgres(source);
  const base = { index, notes: translation.notes };
  const statements = splitStatements(translation.sql, native);
  if (statements.length === 0) return { ...base, passed: false, refusal: 'empty' };
  if (translation.blocked.length > 0) {
    return { ...base, passed: false, refusal: 'blocked', blocked: translation.blocked };
  }
  if (challenge.check === 'plan' && statements.length !== 1) {
    return { ...base, passed: false, refusal: 'single-query' };
  }
  // Primero la solución, en su propia base: así nunca hay dos bases abiertas a la vez.
  const reference =
    !data.expected &&
    options.reference !== false &&
    (challenge.check === 'rows' || challenge.check === 'table')
      ? await referenceResult(open, challenge, dataset, index)
      : undefined;

  const db = await open(challenge.dialect);
  try {
    // En T-SQL el esquema (datetime2, nvarchar) se traduce como el código del visitante.
    await db.exec(toPostgres(schemaSql(challenge, dataset)).sql);
    const fill = caseSql(challenge, data, dataset);
    if (fill) await db.exec(fill);
    // Con miles de filas, VACUUM marca las páginas como visibles (para los Index Only Scan) y
    // ANALYZE da al planificador las estadísticas que tendría una base de verdad.
    if (data.generate) await db.exec('VACUUM ANALYZE;');

    // Lo esperado sale del YAML, de la solución (en los ejercicios de un curso) o, en los de
    // optimización, de la consulta original en esta base.
    let expected = data.expected ? toResult(data.expected) : reference;
    if (!expected && challenge.check === 'plan') {
      expected = lastResult(await db.exec(toPostgres(challenge.starter).sql));
    }
    if (!expected && challenge.check === 'index' && challenge.query) {
      expected = lastResult(await db.exec(challenge.query));
    }

    // Una sentencia a la vez. En los de cambios de datos, como en SSMS, un error no detiene las
    // que siguen: lo que cuenta es cómo queda la tabla.
    const keepGoing = challenge.check === 'table';
    const results: ResultSet[] = [];
    // En el curso de PostgreSQL se enseñan los avisos del servidor (RAISE NOTICE).
    const messages: string[] = [];
    const listen = native ? (message: string) => messages.push(message) : undefined;
    let error: SqlError | undefined;
    options.onCode?.();
    const started = now();
    for (const statement of statements) {
      try {
        results.push(...(await db.exec(statement.text, listen)));
      } catch (caught) {
        error ??= sqlError(caught, translation.sql, statement.start);
        if (!keepGoing) break;
      }
    }
    const ms = now() - started;
    const said = messages.length > 0 ? { messages } : {};
    // Lo que el código dejó sin COMMIT se pierde, como al cerrar la conexión.
    await db.exec('ROLLBACK;').catch(() => undefined);
    if (error && !keepGoing) return { ...base, passed: false, error, ms, ...said };

    let actual: ResultSet | undefined;
    if (challenge.check === 'table' && challenge.verify) {
      actual = lastResult(await db.exec(challenge.verify));
    } else if (challenge.check === 'index' && challenge.query) {
      await db.exec('ANALYZE;');
      actual = lastResult(await db.exec(challenge.query));
    } else actual = lastResult(results);

    const ordered = challenge.check === 'table' || challenge.ordered === true;
    let mismatch = expected ? compareResults(expected, actual, ordered) : null;
    // Los nombres solo se revisan cuando los valores ya coinciden: primero lo más grave.
    if (!mismatch && challenge.names && actual) mismatch = compareNames(challenge.names, actual);

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
      ...said,
    };
  } finally {
    await db.close();
  }
}
