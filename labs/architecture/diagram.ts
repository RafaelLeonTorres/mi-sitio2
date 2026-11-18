// Las flechas del diagrama. Jekyll ya puso las piezas en su cuadrícula; aquí se dibujan las
// conexiones en una capa SVG, se vuelven a dibujar cuando cambia el tamaño y se resalta la pieza
// y la conexión del paso actual.

import { svg } from '../shared/dom';
import { crossesBox, edgeSegment, type Box, type Segment } from './geometry';

export type EdgeKind = 'uses' | 'implements' | 'event';
export type Edge = readonly [from: string, to: string, kind: EdgeKind];

export interface Diagram {
  /** Las piezas por su id. */
  readonly nodes: ReadonlyMap<string, HTMLElement>;
  /** Vuelve a calcular las flechas con las posiciones actuales. */
  draw(): void;
  /** Resalta una pieza y, si se da, la conexión entre `via` y esa pieza (en cualquier sentido). */
  setActive(node: string | null, via?: string): void;
}

const GAP = 6;
const LABEL_MARGIN = 3;

const grow = (box: Box, by: number): Box => ({
  x: box.x - by,
  y: box.y - by,
  width: box.width + by * 2,
  height: box.height + by * 2,
});

/** Prepara el diagrama `root`; `id` distingue las puntas de flecha de cada diagrama. */
export function createDiagram(root: HTMLElement, edges: readonly Edge[], id: string): Diagram {
  const nodes = new Map<string, HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>('[data-node]')) {
    nodes.set(element.dataset['node'] ?? '', element);
  }
  const labels = [...root.querySelectorAll<HTMLElement>('.arch-group > span')];

  const arrow = `${id}-arrow`;
  const activeArrow = `${id}-arrow-active`;
  const lines = edges.map(([, , kind]) =>
    svg('line', { class: `arch-edge kind-${kind}`, 'marker-end': `url(#${arrow})` }),
  );
  const layer = svg('svg', { class: 'arch-edges', 'aria-hidden': 'true', focusable: 'false' }, [
    svg('defs', {}, [
      marker(arrow, 'arch-arrowhead', 10),
      marker(activeArrow, 'arch-arrowhead is-active', 12),
    ]),
    ...lines,
  ]);
  root.prepend(layer);

  const boxOf = (element: HTMLElement, origin: DOMRect): Box => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left - origin.left,
      y: rect.top - origin.top,
      width: rect.width,
      height: rect.height,
    };
  };

  return {
    nodes,
    draw() {
      // Las coordenadas son relativas a la capa SVG, que cubre el diagrama por dentro del borde.
      const origin = layer.getBoundingClientRect();
      const segments: Segment[] = [];
      edges.forEach(([from, to], index) => {
        const a = nodes.get(from);
        const b = nodes.get(to);
        const line = lines[index];
        if (!a || !b || !line) return;
        const segment = edgeSegment(boxOf(a, origin), boxOf(b, origin), GAP);
        segments.push(segment);
        line.setAttribute('x1', segment.from.x.toFixed(1));
        line.setAttribute('y1', segment.from.y.toFixed(1));
        line.setAttribute('x2', segment.to.x.toFixed(1));
        line.setAttribute('y2', segment.to.y.toFixed(1));
      });

      // Si una flecha cruza la etiqueta de un grupo, la etiqueta pasa al otro extremo del marco.
      const crossed = (label: HTMLElement) => {
        const box = grow(boxOf(label, origin), LABEL_MARGIN);
        return segments.some((segment) => crossesBox(segment, box));
      };
      for (const label of labels) {
        delete label.dataset['side'];
        if (!crossed(label)) continue;
        label.dataset['side'] = 'end';
        if (crossed(label)) delete label.dataset['side'];
      }
    },
    setActive(node, via) {
      for (const [key, element] of nodes) element.classList.toggle('is-active', key === node);
      edges.forEach(([from, to], index) => {
        const active =
          node !== null &&
          via !== undefined &&
          ((from === via && to === node) || (from === node && to === via));
        const line = lines[index];
        line?.classList.toggle('is-active', active);
        line?.setAttribute('marker-end', `url(#${active ? activeArrow : arrow})`);
      });
    },
  };
}

/**
 * Punta de flecha que sigue la dirección de la línea. Mide `size` píxeles sin importar el grosor
 * del trazo, para que la del camino activo no crezca de más.
 */
function marker(id: string, className: string, size: number): SVGMarkerElement {
  return svg(
    'marker',
    {
      id,
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: size,
      markerHeight: size,
      markerUnits: 'userSpaceOnUse',
      orient: 'auto-start-reverse',
    },
    [svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: className })],
  );
}
