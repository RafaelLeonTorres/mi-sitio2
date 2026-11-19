// Los operadores de un plan de ejecución y lo que cuesta cada uno. Cada nodo lleva dos cuentas:
// el costo estimado, en las unidades del optimizador de SQL Server, con el que se elige el plan, y
// lo que mide la ejecución simulada (lecturas lógicas y físicas, filas y milisegundos).

import type { Index } from './schema';
import { distinctPages, pagesFor, scanReads, seekReads } from './storage';

export type PhysicalOp =
  | 'SELECT'
  | 'Clustered Index Scan'
  | 'Index Scan'
  | 'Clustered Index Seek'
  | 'Index Seek'
  | 'Key Lookup'
  | 'Nested Loops'
  | 'Hash Match'
  | 'Sort'
  | 'Top'
  | 'Row Count Spool'
  | 'Stream Aggregate';

export type Cache = 'warm' | 'cold';

export interface PlanNode {
  readonly op: PhysicalOp;
  /** La operación lógica, si no es la misma: Inner Join, Left Semi Join, Aggregate… */
  readonly logical?: string;
  /** El índice que usa: [Orders].[IX_Orders_OrderDate]. */
  readonly object?: string;
  readonly table?: string;
  readonly seek?: string;
  readonly predicate?: string;
  /** Si recorre el índice hacia atrás (ORDER BY … DESC sin Sort). */
  readonly backward?: boolean;
  /** Una búsqueda de igualdad en una clave única: devuelve una fila y no cuenta como scan. */
  readonly unique?: boolean;
  /** Filas que entrega el operador, en todas sus ejecuciones. */
  readonly rows: number;
  /** Filas que revisa (las que lee antes de filtrar). */
  readonly rowsRead: number;
  readonly executions: number;
  readonly logicalReads: number;
  /** Lecturas físicas una por una (bajar por el árbol, Key Lookups) con la caché fría. */
  readonly physicalReads: number;
  /** Páginas que la lectura anticipada trae en bloque con la caché fría. */
  readonly readAheadReads: number;
  /** Tiempo de CPU simulado, en milisegundos. */
  readonly cpuMs: number;
  /** Costo estimado propio, sin contar a los hijos. */
  readonly cost: number;
  readonly children: readonly PlanNode[];
}

// Costos del optimizador de SQL Server (las mismas constantes que se ven en un plan estimado).
const RANDOM_IO = 0.003125;
const SEQUENTIAL_IO = 0.000740741;
const FIRST_ROW_CPU = 0.0001581;
const ROW_CPU = 0.0000011;
const LOOP_ROW_CPU = 0.00000418;
const HASH_BUILD_CPU = 0.0000193;
const HASH_PROBE_CPU = 0.0000081;
const SORT_ROW_CPU = 0.0000049;
const SCALAR_CPU = 0.0000001;

// Tiempos simulados, en milisegundos.
export const LOGICAL_READ_MS = 0.0025;
export const SEQUENTIAL_READ_MS = 0.011;
export const RANDOM_READ_MS = 0.09;
const ROW_MS = 0.00011;
const FUNCTION_MS = 0.00002;
const LOOKUP_MS = 0.0006;
const HASH_ROW_MS = 0.00042;
const SORT_ROW_MS = 0.0003;

export interface ScanOptions {
  /** Filas que pasan el filtro. */
  readonly rows: number;
  readonly predicate?: string;
  /** Si el filtro llama a una función por fila, como YEAR(OrderDate). */
  readonly functions?: number;
  readonly backward?: boolean;
  /** Filas que lee antes de parar (un Top arriba corta el recorrido); por defecto, todas. */
  readonly stopAfter?: number;
}

/** Recorre todo el índice (o hasta que un Top lo detiene), filtrando cada fila. */
export function scan(index: Index, options: ScanOptions): PlanNode {
  const { shape } = index;
  const total = index.table.rows;
  const read = Math.min(total, options.stopAfter ?? total);
  const complete = read >= total;
  const leaves = complete ? shape.leafPages : pagesFor(read, shape);
  const logicalReads = complete ? scanReads(shape) : shape.depth - 1 + leaves;
  const functions = options.functions ?? 0;
  return {
    op: index.clustered ? 'Clustered Index Scan' : 'Index Scan',
    object: objectName(index),
    table: index.table.name,
    ...(options.predicate === undefined ? {} : { predicate: options.predicate }),
    ...(options.backward ? { backward: true } : {}),
    rows: options.rows,
    rowsRead: read,
    executions: 1,
    logicalReads,
    physicalReads: shape.depth - 1,
    readAheadReads: leaves,
    cpuMs: read * (ROW_MS + functions * FUNCTION_MS),
    cost:
      RANDOM_IO +
      SEQUENTIAL_IO * Math.max(0, leaves - 1) +
      FIRST_ROW_CPU +
      ROW_CPU * Math.max(0, read - 1) +
      SCALAR_CPU * functions * read,
    children: [],
  };
}

export interface SeekOptions {
  /** Filas que devuelve cada búsqueda. */
  readonly rows: number;
  /** Filas que revisa cada búsqueda, si un predicado residual descarta algunas. */
  readonly rowsRead?: number;
  readonly seek: string;
  readonly predicate?: string;
  /** Cuántas veces se ejecuta (el lado de adentro de un Nested Loops). */
  readonly executions?: number;
  readonly backward?: boolean;
  /** Igualdad sobre una clave única, como Id = @id. */
  readonly unique?: boolean;
}

/** Baja por el árbol hasta la primera fila y lee las del rango. */
export function seek(index: Index, options: SeekOptions): PlanNode {
  const { shape } = index;
  const executions = options.executions ?? 1;
  const read = options.rowsRead ?? options.rows;
  const each = seekReads(read, shape);
  const pages = pagesFor(read, shape);
  return {
    op: index.clustered ? 'Clustered Index Seek' : 'Index Seek',
    object: objectName(index),
    table: index.table.name,
    seek: options.seek,
    ...(options.predicate === undefined ? {} : { predicate: options.predicate }),
    ...(options.backward ? { backward: true } : {}),
    ...(options.unique ? { unique: true } : {}),
    rows: options.rows * executions,
    rowsRead: read * executions,
    executions,
    logicalReads: each * executions,
    // Con la caché fría, una búsqueda baja por el árbol leyendo de disco y trae el rango en bloque;
    // muchas búsquedas (el lado de adentro de un Nested Loops) caen en hojas repartidas.
    physicalReads:
      executions === 1
        ? shape.depth - 1
        : shape.depth - 1 + distinctPages(executions, shape.leafPages),
    readAheadReads:
      executions === 1 ? pages : Math.min(shape.leafPages, Math.max(0, pages - 1) * executions),
    cpuMs: executions * (ROW_MS * 4 + read * ROW_MS),
    cost:
      executions *
      (RANDOM_IO +
        SEQUENTIAL_IO * Math.max(0, pages - 1) +
        FIRST_ROW_CPU +
        ROW_CPU * Math.max(0, read - 1)),
    children: [],
  };
}

/**
 * Trae del índice agrupado las columnas que el no agrupado no tiene, una fila a la vez. Si las
 * filas buscadas están juntas en la tabla (pedidos de un rango de fechas, que se insertaron en
 * orden), las lecturas físicas son pocas; si están repartidas, casi una por fila.
 */
export function keyLookup(
  clustered: Index,
  executions: number,
  locality: 'together' | 'scattered',
): PlanNode {
  const { shape } = clustered;
  const physical =
    locality === 'together'
      ? pagesFor(executions, shape)
      : distinctPages(executions, shape.leafPages);
  return {
    op: 'Key Lookup',
    logical: 'Clustered',
    object: objectName(clustered),
    table: clustered.table.name,
    rows: executions,
    rowsRead: executions,
    executions,
    logicalReads: executions * shape.depth,
    physicalReads: physical + (shape.depth - 1),
    readAheadReads: 0,
    cpuMs: executions * LOOKUP_MS,
    cost: executions * (RANDOM_IO + FIRST_ROW_CPU),
    children: [],
  };
}

/** Para cada fila de afuera, ejecuta el lado de adentro. */
export function nestedLoops(
  outer: PlanNode,
  inner: PlanNode,
  rows: number,
  logical = 'Inner Join',
): PlanNode {
  return combine('Nested Loops', logical, rows, [outer, inner], {
    cpuMs: outer.rows * ROW_MS,
    cost: LOOP_ROW_CPU * outer.rows,
  });
}

/** Arma una tabla hash con la primera entrada y busca en ella cada fila de la segunda. */
export function hashMatch(
  build: PlanNode,
  probe: PlanNode,
  rows: number,
  logical: string,
): PlanNode {
  return combine('Hash Match', logical, rows, [build, probe], {
    cpuMs: (build.rows + probe.rows) * HASH_ROW_MS,
    cost: 0.0177 + build.rows * HASH_BUILD_CPU + probe.rows * HASH_PROBE_CPU,
  });
}

/** Agrupa con una tabla hash (para DISTINCT o GROUP BY sin orden previo). */
export function hashAggregate(child: PlanNode, rows: number): PlanNode {
  return combine('Hash Match', 'Aggregate', rows, [child], {
    cpuMs: child.rows * HASH_ROW_MS,
    cost: 0.0177 + child.rows * HASH_BUILD_CPU,
  });
}

/** Ordena todas las filas; con `distinct`, además quita las repetidas. */
export function sort(child: PlanNode, rows: number, distinct = false): PlanNode {
  const n = Math.max(2, child.rows);
  return combine('Sort', distinct ? 'Distinct Sort' : undefined, rows, [child], {
    cpuMs: child.rows * SORT_ROW_MS * Math.log2(n) * 0.1,
    cost: 0.0112613 + SORT_ROW_CPU * n * Math.log2(n),
  });
}

/**
 * Recuerda si su hijo devolvió alguna fila. Va del lado de adentro de un Nested Loops: el hijo se
 * ejecuta una vez y las demás ejecuciones leen lo guardado.
 */
export function rowCountSpool(child: PlanNode, executions: number, rowsEach: number): PlanNode {
  return {
    ...combine('Row Count Spool', 'Lazy Spool', rowsEach * executions, [child], {
      cpuMs: executions * ROW_MS * 0.1,
      cost: ROW_CPU * executions,
    }),
    executions,
  };
}

/** Entrega las primeras filas y detiene a su hijo. */
export function top(child: PlanNode, rows: number): PlanNode {
  return combine('Top', undefined, rows, [child], {
    cpuMs: rows * ROW_MS * 0.1,
    cost: SCALAR_CPU * rows,
  });
}

/** La raíz del plan, como en SSMS: el resultado que recibe el cliente. */
export function select(child: PlanNode): PlanNode {
  return combine('SELECT', undefined, child.rows, [child], { cpuMs: 0, cost: 0 });
}

function combine(
  op: PhysicalOp,
  logical: string | undefined,
  rows: number,
  children: readonly PlanNode[],
  own: { cpuMs: number; cost: number },
): PlanNode {
  return {
    op,
    ...(logical === undefined ? {} : { logical }),
    rows,
    rowsRead: 0,
    executions: 1,
    logicalReads: 0,
    physicalReads: 0,
    readAheadReads: 0,
    cpuMs: own.cpuMs,
    cost: own.cost,
    children,
  };
}

function objectName(index: Index): string {
  return `[${index.table.name}].[${index.name}]`;
}

/** Todos los nodos del plan, de la raíz a las hojas. */
export function nodes(plan: PlanNode): PlanNode[] {
  return [plan, ...plan.children.flatMap(nodes)];
}

/** El costo estimado del plan completo (el "Estimated Subtree Cost" de la raíz). */
export function totalCost(plan: PlanNode): number {
  return nodes(plan).reduce((sum, node) => sum + node.cost, 0);
}

/** De varios planes posibles, el que el optimizador elegiría: el de menor costo estimado. */
export function cheapest(candidates: readonly PlanNode[]): PlanNode {
  const [first, ...rest] = candidates;
  if (!first) throw new Error('No hay planes que comparar.');
  return rest.reduce((best, plan) => (totalCost(plan) < totalCost(best) ? plan : best), first);
}

export interface Measures {
  readonly logicalReads: number;
  readonly physicalReads: number;
  readonly readAheadReads: number;
  /** Filas que revisaron los operadores que leen tablas o índices. */
  readonly rowsRead: number;
  readonly cpuMs: number;
  readonly elapsedMs: number;
}

/** Lo que mide la ejecución simulada del plan, con la caché caliente o fría. */
export function measure(plan: PlanNode, cache: Cache): Measures {
  const all = nodes(plan);
  const sum = (pick: (node: PlanNode) => number) =>
    all.reduce((total, node) => total + pick(node), 0);
  const logicalReads = sum((node) => node.logicalReads);
  const physicalReads = cache === 'cold' ? sum((node) => node.physicalReads) : 0;
  const readAheadReads = cache === 'cold' ? sum((node) => node.readAheadReads) : 0;
  const cpuMs = sum((node) => node.cpuMs) + logicalReads * LOGICAL_READ_MS;
  const ioMs = physicalReads * RANDOM_READ_MS + readAheadReads * SEQUENTIAL_READ_MS;
  return {
    logicalReads,
    physicalReads,
    readAheadReads,
    rowsRead: sum((node) => node.rowsRead),
    cpuMs,
    elapsedMs: cpuMs + ioMs,
  };
}
