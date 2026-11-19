// La salida de SET STATISTICS IO, TIME ON, como la muestra SSMS en Mensajes (con el formato de SQL
// Server 2019 en adelante), con los números de la ejecución simulada. Una línea por tabla, con la
// suma de todos los operadores que la leen.

import { measure, nodes, type Cache, type PlanNode } from './plan';

export interface TableIo {
  readonly table: string;
  readonly scanCount: number;
  readonly logicalReads: number;
  readonly physicalReads: number;
  readonly readAheadReads: number;
}

/** Las lecturas de cada tabla, en el orden en que aparecen en el plan. */
export function tableIo(plan: PlanNode, cache: Cache): TableIo[] {
  const tables = new Map<
    string,
    { scanCount: number; logicalReads: number; physicalReads: number; readAheadReads: number }
  >();
  for (const node of nodes(plan)) {
    if (!node.table) continue;
    const entry = tables.get(node.table) ?? {
      scanCount: 0,
      logicalReads: 0,
      physicalReads: 0,
      readAheadReads: 0,
    };
    // Los Key Lookups y las búsquedas de igualdad sobre una clave única no cuentan como scan.
    if (node.op !== 'Key Lookup' && !node.unique) entry.scanCount += node.executions;
    entry.logicalReads += node.logicalReads;
    if (cache === 'cold') {
      entry.physicalReads += node.physicalReads;
      entry.readAheadReads += node.readAheadReads;
    }
    tables.set(node.table, entry);
  }
  return [...tables].map(([table, entry]) => ({ table, ...entry }));
}

/** El texto de la pestaña Mensajes de SSMS para el plan. */
export function statisticsText(plan: PlanNode, cache: Cache): string {
  // El plan ya está en la caché de planes: compilar no cuesta nada.
  const lines = [
    'SQL Server parse and compile time: ',
    '   CPU time = 0 ms, elapsed time = 0 ms.',
    '',
    `(${plan.rows} ${plan.rows === 1 ? 'row' : 'rows'} affected)`,
  ];
  const ops = nodes(plan).map((node) => node.op);
  // Un Hash Match o un Sort reservan memoria de trabajo; sin derrames a disco, sus líneas van en cero.
  if (ops.includes('Hash Match')) lines.push(ioLine('Workfile', 0, 0, 0, 0));
  if (ops.includes('Hash Match') || ops.includes('Sort'))
    lines.push(ioLine('Worktable', 0, 0, 0, 0));
  for (const io of tableIo(plan, cache)) {
    lines.push(
      ioLine(io.table, io.scanCount, io.logicalReads, io.physicalReads, io.readAheadReads),
    );
  }
  const { cpuMs, elapsedMs } = measure(plan, cache);
  lines.push(
    '',
    ' SQL Server Execution Times:',
    `   CPU time = ${Math.round(cpuMs)} ms,  elapsed time = ${Math.round(elapsedMs)} ms.`,
  );
  return lines.join('\n');
}

function ioLine(
  table: string,
  scans: number,
  logical: number,
  physical: number,
  readAhead: number,
): string {
  return (
    `Table '${table}'. Scan count ${scans}, logical reads ${logical}, physical reads ${physical}, ` +
    `page server reads 0, read-ahead reads ${readAhead}, page server read-ahead reads 0, ` +
    'lob logical reads 0, lob physical reads 0, lob page server reads 0, lob read-ahead reads 0, ' +
    'lob page server read-ahead reads 0.'
  );
}
