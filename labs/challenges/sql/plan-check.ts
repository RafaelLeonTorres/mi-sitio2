// Revisa el plan de PostgreSQL (EXPLAIN (ANALYZE, FORMAT JSON)) en los retos de optimización: que
// la consulta use un índice con una condición de búsqueda y no recorra la tabla, que no ejecute
// una subconsulta por fila, que no quite duplicados de más o que lea pocas filas. También lo
// escribe como texto, parecido a la salida de EXPLAIN, para mostrarlo debajo del resultado.

import type { PlanRule } from './data';

/** Un nodo del plan en el JSON de EXPLAIN; solo los campos que se usan aquí. */
export interface PlanNode {
  readonly 'Node Type': string;
  readonly 'Relation Name'?: string;
  readonly 'Index Name'?: string;
  readonly 'Index Cond'?: string;
  readonly 'Recheck Cond'?: string;
  readonly Filter?: string;
  readonly 'Join Type'?: string;
  readonly 'Parent Relationship'?: string;
  readonly 'Subplan Name'?: string;
  readonly Strategy?: string;
  readonly 'Scan Direction'?: string;
  readonly 'Heap Fetches'?: number;
  readonly 'Actual Rows'?: number;
  readonly 'Rows Removed by Filter'?: number;
  readonly 'Rows Removed by Index Recheck'?: number;
  readonly 'Actual Loops'?: number;
  readonly Plans?: readonly PlanNode[];
}

export interface RuleResult {
  readonly rule: PlanRule;
  readonly ok: boolean;
}

const SCANS = new Set(['Seq Scan', 'Index Scan', 'Index Only Scan', 'Bitmap Heap Scan']);

/** El nodo raíz a partir de la fila de EXPLAIN (FORMAT JSON), venga como texto o ya leído. */
export function planRoot(value: unknown): PlanNode {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  const plan = (first as { Plan?: PlanNode } | undefined)?.Plan;
  if (!plan) throw new Error('EXPLAIN no devolvió un plan.');
  return plan;
}

/** Cada nodo con su padre, de arriba abajo. */
export function walk(root: PlanNode): { node: PlanNode; parent: PlanNode | null }[] {
  const out: { node: PlanNode; parent: PlanNode | null }[] = [];
  const visit = (node: PlanNode, parent: PlanNode | null) => {
    out.push({ node, parent });
    for (const child of node.Plans ?? []) visit(child, node);
  };
  visit(root, null);
  return out;
}

const on = (node: PlanNode, table: string) =>
  (node['Relation Name'] ?? '').toLowerCase() === table.toLowerCase();

/** Si la tabla se lee con un índice y una condición de búsqueda, sin recorrerla completa. */
function usesIndex(root: PlanNode, table: string): boolean {
  const nodes = walk(root);
  if (nodes.some(({ node }) => node['Node Type'] === 'Seq Scan' && on(node, table))) return false;
  return nodes.some(({ node, parent }) => {
    const type = node['Node Type'];
    if ((type === 'Index Scan' || type === 'Index Only Scan') && on(node, table)) {
      return Boolean(node['Index Cond']);
    }
    // Un Bitmap Index Scan no dice la tabla: la dice el Bitmap Heap Scan de arriba.
    if (type === 'Bitmap Index Scan' && node['Index Cond']) {
      let above = parent;
      while (above && above['Node Type'].startsWith('Bitmap') && !above['Relation Name']) {
        above =
          nodes.find(({ node: candidate }) => candidate.Plans?.includes(above as PlanNode))?.node ??
          null;
      }
      return Boolean(above && on(above, table));
    }
    return false;
  });
}

/**
 * Las filas que leyó de una tabla cada nodo que la recorre, sumadas sus vueltas: las que devolvió
 * y las que descartó su filtro. EXPLAIN da las dos por vuelta, como promedio.
 */
export function rowsRead(root: PlanNode, table: string): number {
  return walk(root)
    .filter(({ node }) => SCANS.has(node['Node Type']) && on(node, table))
    .reduce((sum, { node }) => {
      const perLoop =
        (node['Actual Rows'] ?? 0) +
        (node['Rows Removed by Filter'] ?? 0) +
        (node['Rows Removed by Index Recheck'] ?? 0);
      return sum + perLoop * (node['Actual Loops'] ?? 1);
    }, 0);
}

export function checkRule(root: PlanNode, rule: PlanRule): boolean {
  const nodes = walk(root).map(({ node }) => node);
  switch (rule.kind) {
    case 'index':
      return usesIndex(root, rule.table);
    case 'index-only':
      return nodes.some((node) => node['Node Type'] === 'Index Only Scan' && on(node, rule.table));
    case 'semi-join':
      return nodes.some((node) => node['Join Type'] === 'Semi');
    case 'no-subplan':
      return !nodes.some((node) => node['Parent Relationship'] === 'SubPlan');
    case 'no-dedupe':
      return !nodes.some(
        (node) =>
          node['Node Type'] === 'Unique' ||
          node['Node Type'] === 'SetOp' ||
          (node['Node Type'] === 'Aggregate' && node.Strategy !== 'Plain'),
      );
    case 'max-rows':
      return rowsRead(root, rule.table) <= rule.max;
  }
}

export function checkPlan(root: PlanNode, rules: readonly PlanRule[]): RuleResult[] {
  return rules.map((rule) => ({ rule, ok: checkRule(root, rule) }));
}

/** El plan como texto, parecido a EXPLAIN: un renglón por nodo con su tabla, índice y filas. */
export function planText(root: PlanNode): string {
  const lines: string[] = [];
  const visit = (node: PlanNode, depth: number) => {
    const pad = depth === 0 ? '' : `${'   '.repeat(depth - 1)}-> `;
    const extra = '   '.repeat(depth) + (depth === 0 ? '  ' : '     ');
    const join =
      node['Join Type'] && node['Join Type'] !== 'Inner' ? ` ${node['Join Type']} Join` : '';
    const backward = node['Scan Direction'] === 'Backward' ? ' Backward' : '';
    const index = node['Index Name'] ? ` using ${node['Index Name']}` : '';
    const table = node['Relation Name'] ? ` on ${node['Relation Name']}` : '';
    const rows =
      node['Actual Rows'] === undefined
        ? ''
        : `  (rows=${node['Actual Rows']}${(node['Actual Loops'] ?? 1) > 1 ? ` loops=${node['Actual Loops']}` : ''})`;
    const name = node['Subplan Name'] ? `${node['Subplan Name']}\n${extra.slice(3)}` : '';
    lines.push(`${pad}${name}${node['Node Type']}${backward}${join}${index}${table}${rows}`);
    if (node['Index Cond']) lines.push(`${extra}Index Cond: ${node['Index Cond']}`);
    if (node['Recheck Cond']) lines.push(`${extra}Recheck Cond: ${node['Recheck Cond']}`);
    if (node.Filter) lines.push(`${extra}Filter: ${node.Filter}`);
    const removed = node['Rows Removed by Filter'];
    if (removed) lines.push(`${extra}Rows Removed by Filter: ${removed}`);
    if (node['Heap Fetches'] !== undefined)
      lines.push(`${extra}Heap Fetches: ${node['Heap Fetches']}`);
    for (const child of node.Plans ?? []) visit(child, depth + 1);
  };
  visit(root, 0);
  return lines.join('\n');
}
