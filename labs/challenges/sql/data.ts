// Los retos de SQL como los publica Jekyll (_data/labs/challenges/<id>.yml, parte `shared`) y las
// tablas de la base de ejemplo (_data/labs/challenge-datasets.yml). De aquí salen el esquema y los
// INSERT de cada caso, que el motor corre en una base nueva.

export type SqlCategory = 'queries' | 'optimization' | 'changes';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Cell = string | number | null;

/** Filas con sus columnas: los datos de una tabla en un caso o el resultado esperado. */
export interface Rows {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly Cell[])[];
}

export interface SqlCase {
  /** Los casos de ejemplo corren con Ejecutar y se muestran en el enunciado. */
  readonly sample?: boolean;
  /** Las filas de cada tabla, por nombre. */
  readonly tables?: Readonly<Record<string, Rows>>;
  /**
   * Generadores de la base de ejemplo (`generators` en challenge-datasets.yml) que llenan las
   * tablas con miles de filas, para que PostgreSQL elija los planes como con datos reales.
   */
  readonly generate?: readonly string[];
  /** Lo que debe devolver; sin él, lo que devuelve la consulta de referencia en la misma base. */
  readonly expected?: Rows;
  /** Si en este caso también se revisa el plan. */
  readonly explain?: boolean;
}

/** Lo que se revisa del plan de PostgreSQL (EXPLAIN) en los retos de optimización. */
export type PlanRule =
  | { readonly kind: 'index'; readonly table: string }
  | { readonly kind: 'index-only'; readonly table: string }
  | { readonly kind: 'semi-join' }
  | { readonly kind: 'no-subplan' }
  | { readonly kind: 'no-dedupe' }
  | { readonly kind: 'max-rows'; readonly table: string; readonly max: number };

/**
 * Cómo se revisa un reto:
 * - rows: el último resultado del código contra el esperado.
 * - table: después del código, lo que devuelve `verify` (cómo quedó la tabla).
 * - plan: una sola consulta, con el resultado de `starter` y las reglas de su plan.
 * - index: el código crea índices; `query` debe dar lo mismo y cumplir las reglas del plan.
 */
export type CheckKind = 'rows' | 'table' | 'plan' | 'index';

export interface SqlChallenge {
  readonly language: 'sql';
  readonly category: SqlCategory;
  readonly difficulty: Difficulty;
  /** Las tablas de la base de ejemplo que usa, en el orden en que se crean. */
  readonly tables: readonly string[];
  /** Índices y restricciones de más, como `CREATE INDEX IX_Orders_OrderDate …`. */
  readonly setup?: string;
  readonly check: CheckKind;
  /** Si el orden de las filas cuenta (el enunciado pide un ORDER BY). */
  readonly ordered?: boolean;
  /**
   * Los nombres que deben tener las columnas del resultado, en orden: solo en los ejercicios de
   * alias. Se comparan sin distinguir mayúsculas; sin esto, los nombres no cuentan.
   */
  readonly names?: readonly string[];
  readonly verify?: string;
  readonly query?: string;
  readonly plan?: readonly PlanRule[];
  readonly starter: string;
  readonly solution: string;
  readonly cases: readonly SqlCase[];
  /**
   * La intercalación con la que se traducen el esquema y el código (`translate`): `ci` hace que las
   * columnas de texto no distingan mayúsculas, como `SQL_Latin1_General_CP1_CI_AS`. La pide el curso
   * de SQL Server, no los retos.
   */
  readonly collation?: 'ci';
}

export interface DatasetTable {
  readonly id: string;
  readonly ddl: string;
  /** Los valores de las columnas obligatorias que un caso no trae. */
  readonly defaults?: Readonly<Record<string, Cell>>;
  /** Las filas de la base de ejemplo del playground. */
  readonly sample: Rows;
}

/** SQL de PostgreSQL que genera filas de forma determinista (generate_series, sin random()). */
export interface Generator {
  readonly id: string;
  readonly sql: string;
}

export interface Dataset {
  readonly tables: readonly DatasetTable[];
  readonly generators: readonly Generator[];
}

/** Un valor como literal de SQL: los números tal cual, las cadenas entre comillas. */
export function literal(cell: Cell): string {
  if (cell === null) return 'NULL';
  if (typeof cell === 'number') return String(cell);
  return `'${cell.replaceAll("'", "''")}'`;
}

/**
 * Un INSERT con todas las filas de una tabla; nada si no tiene filas. Las columnas obligatorias que
 * los datos no traen toman su valor de `defaults`.
 */
export function insertSql(
  table: string,
  data: Rows,
  defaults: Readonly<Record<string, Cell>> = {},
): string {
  if (data.rows.length === 0) return '';
  const given = new Set(data.columns.map((column) => column.toLowerCase()));
  const extra = Object.entries(defaults).filter(([column]) => !given.has(column.toLowerCase()));
  const columns = [...data.columns, ...extra.map(([column]) => column)];
  const values = data.rows
    .map((row) => `  (${[...row, ...extra.map(([, value]) => value)].map(literal).join(', ')})`)
    .join(',\n');
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values};`;
}

function tableOf(dataset: Dataset, name: string): DatasetTable {
  const table = dataset.tables.find((item) => item.id === name);
  if (!table) throw new Error(`No hay una tabla ${name} en la base de ejemplo.`);
  return table;
}

/** El esquema de un reto, en T-SQL: las tablas que usa y lo que agrega (índices, restricciones). */
export function schemaSql(challenge: SqlChallenge, dataset: Dataset): string {
  const ddl = challenge.tables.map((name) => tableOf(dataset, name).ddl.trim());
  return [...ddl, challenge.setup?.trim() ?? ''].filter(Boolean).join('\n\n');
}

/**
 * Después de insertar con Id explícito, el contador de una columna IDENTITY sigue en 1. Esto lo
 * mueve al siguiente Id libre, para que un INSERT sin Id funcione como en SQL Server.
 */
function identitySql(names: readonly string[], dataset: Dataset): string[] {
  return names
    .filter((name) => /\bIDENTITY\b/i.test(tableOf(dataset, name).ddl))
    .map(
      (name) =>
        `SELECT setval(pg_get_serial_sequence('${name.toLowerCase()}', 'id'), COALESCE(MAX(Id), 0) + 1, false) FROM ${name};`,
    );
}

/**
 * Un caso de ejemplo sin datos propios ni generador (`- sample: true`) corre con la base de ejemplo
 * tal cual: las filas de ejemplo de cada tabla del reto. Es el caso de ejemplo de un ejercicio de un
 * curso; los de los retos del laboratorio traen sus propias filas.
 */
export function usesSampleRows(data: SqlCase): boolean {
  return data.sample === true && data.tables === undefined && data.generate === undefined;
}

/** Los datos de un caso, en PostgreSQL: sus INSERT y su generador, en el orden de las tablas. */
export function caseSql(challenge: SqlChallenge, data: SqlCase, dataset: Dataset): string {
  const inserts = challenge.tables.flatMap((name) => {
    const table = tableOf(dataset, name);
    const rows = data.tables?.[name] ?? (usesSampleRows(data) ? table.sample : undefined);
    return rows ? [insertSql(name, rows, table.defaults)] : [];
  });
  const generated = (data.generate ?? []).map((id) => {
    const generator = dataset.generators.find((item) => item.id === id);
    if (!generator) throw new Error(`No hay un generador ${id}.`);
    return generator.sql.trim();
  });
  return [...inserts, ...generated, ...identitySql(challenge.tables, dataset)]
    .filter(Boolean)
    .join('\n\n');
}

/** Las filas de ejemplo de cada tabla, para el playground (el esquema va aparte, en T-SQL). */
export function sampleSql(dataset: Dataset): string {
  const names = dataset.tables.map((table) => table.id);
  const rows = dataset.tables
    .map((table) => insertSql(table.id, table.sample, table.defaults))
    .filter(Boolean);
  return [...rows, ...identitySql(names, dataset)].join('\n\n');
}

/** Las columnas de un CREATE TABLE, en orden, sin las restricciones de tabla (PRIMARY KEY (…)). */
export function tableColumns(ddl: string): string[] {
  const body = ddl.slice(ddl.indexOf('(') + 1, ddl.lastIndexOf(')'));
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-Za-z_]\w*\s+[A-Za-z]/.test(line))
    .filter((line) => !/^(?:PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX)\b/i.test(line))
    .map((line) => line.split(/\s+/)[0] ?? '');
}

/** El esquema para el autocompletado del editor: cada tabla con sus columnas. */
export function editorSchema(tables: readonly DatasetTable[]): Record<string, string[]> {
  return Object.fromEntries(tables.map((table) => [table.id, tableColumns(table.ddl)]));
}
