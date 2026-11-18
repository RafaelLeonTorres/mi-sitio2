// Geometría del diagrama, sin DOM: dónde empieza y termina cada flecha, y qué pieza queda en
// cada dirección para moverse con las flechas del teclado.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  from: Point;
  to: Point;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const center = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/**
 * La flecha de una caja a otra: sale del borde de `a` y llega al borde de `b`, sobre la recta
 * que une sus centros, dejando `gap` píxeles libres en cada punta.
 */
export function edgeSegment(a: Box, b: Box, gap = 0): Segment {
  const ca = center(a);
  const cb = center(b);
  const length = Math.hypot(cb.x - ca.x, cb.y - ca.y);
  if (length === 0) return { from: ca, to: cb };
  const ux = (cb.x - ca.x) / length;
  const uy = (cb.y - ca.y) / length;
  const start = toBorder(a, ux, uy);
  const end = toBorder(b, -ux, -uy);
  return {
    from: { x: start.x + ux * gap, y: start.y + uy * gap },
    to: { x: end.x - ux * gap, y: end.y - uy * gap },
  };
}

/**
 * La caja más cercana en la dirección pedida, o -1 si no hay ninguna. Prefiere las que están
 * alineadas: un paso de lado cuenta el doble que un paso hacia adelante.
 */
export function neighbor(boxes: readonly Box[], from: number, direction: Direction): number {
  const origin = boxes[from];
  if (!origin) return -1;
  const o = center(origin);
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((box, index) => {
    if (index === from) return;
    const c = center(box);
    const dx = c.x - o.x;
    const dy = c.y - o.y;
    const horizontal = direction === 'left' || direction === 'right';
    const ahead = { right: dx, left: -dx, down: dy, up: -dy }[direction];
    const aside = horizontal ? Math.abs(dy) : Math.abs(dx);
    if (ahead <= 1) return;
    const score = ahead + aside * 2;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

/**
 * Si el segmento toca la caja. Recorta la recta contra los cuatro lados (Liang-Barsky): si queda
 * algún tramo dentro, la cruza.
 */
export function crossesBox({ from, to }: Segment, box: Box): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let enter = 0;
  let leave = 1;
  const sides: [p: number, q: number][] = [
    [-dx, from.x - box.x],
    [dx, box.x + box.width - from.x],
    [-dy, from.y - box.y],
    [dy, box.y + box.height - from.y],
  ];
  for (const [p, q] of sides) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter > leave) return false;
  }
  return true;
}

/** El punto donde sale de la caja una recta que parte del centro con dirección (ux, uy). */
function toBorder(box: Box, ux: number, uy: number): Point {
  const c = center(box);
  const sx = ux === 0 ? Infinity : box.width / 2 / Math.abs(ux);
  const sy = uy === 0 ? Infinity : box.height / 2 / Math.abs(uy);
  const scale = Math.min(sx, sy);
  return { x: c.x + ux * scale, y: c.y + uy * scale };
}
