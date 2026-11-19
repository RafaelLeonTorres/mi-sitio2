// Lo que tienen en común los escenarios: sus controles, la ejecución de una consulta (una o varias
// sentencias, como en N+1) y lo que mide cada lado. La parte del cliente (viajes a la base,
// materializar entidades) solo aparece en los escenarios de EF Core.

import { RANDOM_READ_MS, measure, nodes, type Cache, type PlanNode } from './plan';

export type ScenarioId =
  'sargability' | 'indexes' | 'n-plus-one' | 'joins' | 'pagination' | 'tracking';

export type Value = string | number | boolean;
export type Values = Readonly<Record<string, Value>>;

/** Un control del escenario; la página pone sus textos y el TypeScript su comportamiento. */
export type Control = (
  | { readonly kind: 'select'; readonly id: string; readonly options: readonly number[] }
  | { readonly kind: 'choice'; readonly id: string; readonly options: readonly string[] }
  | { readonly kind: 'toggle'; readonly id: string }
  | {
      readonly kind: 'range';
      readonly id: string;
      readonly min: number;
      readonly max: number | ((values: Values) => number);
      readonly step: number;
      /** Con 'log', el deslizador avanza en proporción: fino en las primeras páginas. */
      readonly scale?: 'log';
    }
) & {
  /** Solo se muestra cuando los otros controles tienen estos valores. */
  readonly when?: Values;
};

export interface Statement {
  readonly sql: string;
  readonly plan: PlanNode;
  /** Cuántas veces se ejecuta (en N+1, la consulta del cliente va una vez por pedido). */
  readonly times: number;
  /** Los valores de los parámetros, para mostrarlos junto a la consulta. */
  readonly params?: Readonly<Record<string, string | number>>;
  /** Si cada ejecución busca otra fila (otra hoja del índice), como el cliente de cada pedido. */
  readonly spread?: boolean;
}

/** Lo que pasa del lado de .NET, en los escenarios de EF Core. */
export interface Client {
  readonly roundTrips: number;
  readonly rttMs: number;
  /** Convertir las filas en objetos y, con seguimiento, registrarlas en el contexto. */
  readonly materializeMs: number;
  readonly memoryBytes: number;
  readonly rowsTransferred: number;
}

export interface QueryRun {
  /** Cómo se llama este lado, como clave de su texto (function, range, keyset…). */
  readonly label: string;
  readonly statements: readonly Statement[];
  /** Las filas que recibe la aplicación. */
  readonly rows: number;
  /** El código de EF Core que genera este SQL, como clave de su archivo (n-plus-one-loop). */
  readonly linq?: string;
  /** La sugerencia de índice que SSMS muestra arriba del plan. */
  readonly missingIndex?: string;
  /** Los índices no agrupados que existen de este lado, además de la clave primaria. */
  readonly indexes?: readonly string[];
  readonly client?: Client;
}

export interface Comparison {
  readonly a: QueryRun;
  readonly b: QueryRun;
  /** Las notas de "Por qué cambia" que aplican con estos valores, como claves de sus textos. */
  readonly notes: readonly string[];
}

// Del lado de .NET, por fila. Con seguimiento de cambios, el contexto guarda una copia de los valores
// originales y una entrada por entidad. En la documentación de EF Core, la misma consulta tarda cerca
// de 0.7 veces y usa 39 % menos memoria sin seguimiento; una proyección a un DTO evita además las
// columnas que no se usan.
export const MATERIALIZE = {
  tracked: { ms: 0.0024, bytes: 1850 },
  untracked: { ms: 0.0016, bytes: 1130 },
  projection: { ms: 0.0006, bytes: 120 },
} as const;

export interface Scenario {
  readonly id: ScenarioId;
  readonly controls: readonly Control[];
  readonly defaults: Values;
  run(values: Values): Comparison;
}

export interface RunMeasures {
  readonly logicalReads: number;
  readonly physicalReads: number;
  readonly readAheadReads: number;
  readonly rowsRead: number;
  readonly cpuMs: number;
  /** Lo que tarda la base, sumando todas las sentencias. */
  readonly serverMs: number;
  /** Viajes de ida y vuelta entre la aplicación y la base. */
  readonly roundTrips: number;
  readonly networkMs: number;
  readonly clientMs: number;
  readonly totalMs: number;
  readonly memoryBytes: number;
}

/** Lo que mide un lado, sumando todas sus sentencias y la parte del cliente. */
export function measureRun(run: QueryRun, cache: Cache): RunMeasures {
  let logicalReads = 0;
  let physicalReads = 0;
  let readAheadReads = 0;
  let rowsRead = 0;
  let cpuMs = 0;
  let serverMs = 0;
  for (const { plan, times, spread } of run.statements) {
    // Con la caché fría, la primera ejecución trae las páginas de disco y las siguientes ya las
    // encuentran, salvo la hoja de cada fila distinta que buscan.
    const first = measure(plan, cache);
    const rest = measure(plan, 'warm');
    const leaves = cache === 'cold' && spread ? times - 1 : 0;
    logicalReads += first.logicalReads * times;
    physicalReads += first.physicalReads + leaves;
    readAheadReads += first.readAheadReads;
    rowsRead += first.rowsRead * times;
    cpuMs += first.cpuMs + rest.cpuMs * (times - 1);
    serverMs += first.elapsedMs + rest.elapsedMs * (times - 1) + leaves * RANDOM_READ_MS;
  }
  const client = run.client;
  const roundTrips =
    client?.roundTrips ?? run.statements.reduce((sum, statement) => sum + statement.times, 0);
  const networkMs = client ? client.roundTrips * client.rttMs : 0;
  const clientMs = client?.materializeMs ?? 0;
  return {
    logicalReads,
    physicalReads,
    readAheadReads,
    rowsRead,
    cpuMs,
    serverMs,
    roundTrips,
    networkMs,
    clientMs,
    totalMs: serverMs + networkMs + clientMs,
    memoryBytes: client?.memoryBytes ?? 0,
  };
}

/** Cómo llega cada lado a los datos: el operador que lee la tabla principal y su índice. */
export function accessOf(plan: PlanNode): { op: string; object: string } | null {
  const reader = nodes(plan).find((node) => node.object && node.op !== 'Key Lookup');
  return reader?.object ? { op: reader.op, object: reader.object } : null;
}

export function num(values: Values, id: string): number {
  const value = values[id];
  if (typeof value !== 'number') throw new Error(`El control ${id} no es un número.`);
  return value;
}

export function text(values: Values, id: string): string {
  const value = values[id];
  if (typeof value !== 'string') throw new Error(`El control ${id} no es un texto.`);
  return value;
}

export function flag(values: Values, id: string): boolean {
  const value = values[id];
  if (typeof value !== 'boolean') throw new Error(`El control ${id} no es un sí o no.`);
  return value;
}

export function cacheOf(values: Values): Cache {
  return text(values, 'cache') === 'cold' ? 'cold' : 'warm';
}
