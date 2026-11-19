// El plan de ejecución como un árbol: la raíz (SELECT) arriba y cada operador con los que le
// entregan filas debajo, como un plan gráfico de SSMS girado. Cada operador muestra su parte del
// costo estimado, el índice que usa, lo que busca o filtra y lo que midió la ejecución; el grosor
// de la línea que lo une con su padre crece con las filas que le pasa.

import { h } from '../shared/dom';
import { formatNumber, type Lang } from '../shared/format';
import { nodes, totalCost, type PlanNode } from './plan';

export interface PlanStrings {
  readonly cost: string;
  readonly rows: string;
  readonly rows_read: string;
  readonly executions: string;
  readonly reads: string;
  readonly seek: string;
  readonly predicate: string;
  readonly backward: string;
}

export type Tone = 'good' | 'bad';

export interface PlanViewOptions {
  readonly lang: Lang;
  readonly strings: PlanStrings;
  /** El grosor, en píxeles, de la línea que lleva tantas filas. */
  readonly flow: (rows: number) => number;
  /** Los operadores que se marcan: el más costoso del lado lento, el acceso del rápido. */
  readonly tones?: ReadonlyMap<PlanNode, Tone>;
}

/** De 1 a 6 píxeles, en escala logarítmica respecto al operador que más filas entrega. */
export function flowScale(maxRows: number): (rows: number) => number {
  const top = Math.log10(1 + Math.max(1, maxRows));
  return (rows) => {
    const width = 1 + (5 * Math.log10(1 + Math.max(0, rows))) / top;
    return Math.round(Math.min(6, width) * 2) / 2;
  };
}

/** El nombre como lo muestra SSMS: Index Seek (NonClustered), Hash Match (Right Semi Join)… */
export function operatorName(node: PlanNode): { op: string; detail?: string } {
  if (node.op.startsWith('Clustered Index')) return { op: node.op, detail: 'Clustered' };
  if (node.op === 'Index Seek' || node.op === 'Index Scan') {
    return { op: node.op, detail: 'NonClustered' };
  }
  return node.logical ? { op: node.op, detail: node.logical } : { op: node.op };
}

/** La parte del costo estimado del plan que toca a cada operador, en porcentaje entero. */
export function costShare(node: PlanNode, plan: PlanNode): number {
  const total = totalCost(plan);
  return total > 0 ? Math.round((node.cost / total) * 100) : 0;
}

/** Si dos planes tienen los mismos operadores sobre los mismos índices, en el mismo orden. */
export function sameShape(a: PlanNode, b: PlanNode): boolean {
  const shape = (plan: PlanNode) =>
    nodes(plan)
      .map((node) => `${node.op}|${node.logical ?? ''}|${node.object ?? ''}`)
      .join('/');
  return shape(a) === shape(b);
}

/** El árbol del plan, como una lista anidada `<ol class="sql-plan">`. */
export function renderPlan(plan: PlanNode, options: PlanViewOptions): HTMLOListElement {
  const list = h('ol', { class: 'sql-plan' });
  list.append(renderNode(plan, plan, options, null, null));
  return list;
}

function renderNode(
  node: PlanNode,
  plan: PlanNode,
  options: PlanViewOptions,
  flow: number | null,
  nextFlow: number | null,
): HTMLLIElement {
  const { lang, strings } = options;
  const name = operatorName(node);
  const count = (value: number) => formatNumber(value, lang);
  const metrics: [string, string][] = [[strings.rows, count(node.rows)]];
  if (node.rowsRead > 0 && node.rowsRead !== node.rows) {
    metrics.push([strings.rows_read, count(node.rowsRead)]);
  }
  if (node.executions > 1) metrics.push([strings.executions, count(node.executions)]);
  if (node.logicalReads > 0) metrics.push([strings.reads, count(node.logicalReads)]);

  const item = h('li', { class: 'sql-node', 'data-tone': options.tones?.get(node) }, [
    h('div', { class: 'sql-op' }, [
      h('p', { class: 'sql-op-head' }, [
        h('span', { class: 'sql-op-name' }, [name.op]),
        name.detail ? h('span', { class: 'sql-op-detail' }, [` (${name.detail})`]) : null,
        h('span', { class: 'sql-op-cost' }, [`${strings.cost} ${costShare(node, plan)} %`]),
      ]),
      node.object ? h('code', { class: 'sql-op-object' }, [node.object]) : null,
      node.seek ? line(strings.seek, node.seek) : null,
      node.predicate ? line(strings.predicate, node.predicate) : null,
      node.backward ? h('p', { class: 'sql-op-line' }, [strings.backward]) : null,
      h(
        'dl',
        { class: 'sql-op-metrics' },
        metrics.map(([label, value]) => h('div', {}, [h('dt', {}, [label]), h('dd', {}, [value])])),
      ),
    ]),
  ]);
  if (flow !== null) item.style.setProperty('--flow', `${flow}px`);
  if (nextFlow !== null) item.style.setProperty('--next-flow', `${nextFlow}px`);

  if (node.children.length > 0) {
    const widths = node.children.map((child) => options.flow(child.rows));
    item.append(
      h(
        'ol',
        {},
        node.children.map((child, index) =>
          renderNode(child, plan, options, widths[index] ?? 1, widths[index + 1] ?? null),
        ),
      ),
    );
  }
  return item;
}

function line(label: string, text: string): HTMLParagraphElement {
  return h('p', { class: 'sql-op-line' }, [
    h('span', { class: 'sql-op-label' }, [`${label}: `]),
    h('code', {}, [text]),
  ]);
}
