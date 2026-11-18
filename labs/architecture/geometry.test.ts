import { describe, expect, it } from 'vitest';
import { crossesBox, edgeSegment, neighbor, type Box, type Point } from './geometry';

const box = (x: number, y: number, width = 100, height = 50): Box => ({ x, y, width, height });
const round = ({ x, y }: Point): Point => ({
  x: Math.round(x * 100) / 100,
  y: Math.round(y * 100) / 100,
});

describe('edgeSegment', () => {
  it('une los bordes de dos cajas de la misma fila', () => {
    expect(edgeSegment(box(0, 0), box(200, 0))).toEqual({
      from: { x: 100, y: 25 },
      to: { x: 200, y: 25 },
    });
  });

  it('une el borde de abajo con el de arriba en la misma columna', () => {
    expect(edgeSegment(box(0, 0), box(0, 150))).toEqual({
      from: { x: 50, y: 50 },
      to: { x: 50, y: 150 },
    });
  });

  it('deja libre el espacio pedido en cada punta', () => {
    expect(edgeSegment(box(0, 0), box(200, 0), 6)).toEqual({
      from: { x: 106, y: 25 },
      to: { x: 194, y: 25 },
    });
  });

  it('en diagonal sale por la esquina que toca la recta entre los centros', () => {
    const { from, to } = edgeSegment(box(0, 0, 100, 100), box(300, 300, 100, 100));
    expect(round(from)).toEqual({ x: 100, y: 100 });
    expect(round(to)).toEqual({ x: 300, y: 300 });
  });
});

describe('neighbor', () => {
  // Tres cajas en fila y una debajo de la del medio.
  const boxes = [box(0, 0), box(200, 0), box(400, 0), box(200, 150)];

  it('encuentra la caja de al lado, la de abajo y la de arriba', () => {
    expect(neighbor(boxes, 0, 'right')).toBe(1);
    expect(neighbor(boxes, 1, 'right')).toBe(2);
    expect(neighbor(boxes, 1, 'down')).toBe(3);
    expect(neighbor(boxes, 3, 'up')).toBe(1);
  });

  it('prefiere la caja alineada aunque otra esté igual de adelante', () => {
    expect(neighbor(boxes, 0, 'right')).toBe(1);
  });

  it('si no hay una alineada, toma la que está en diagonal', () => {
    expect(neighbor(boxes, 3, 'right')).toBe(2);
  });

  it('devuelve -1 si no hay nada en esa dirección', () => {
    expect(neighbor(boxes, 0, 'left')).toBe(-1);
    expect(neighbor(boxes, 0, 'up')).toBe(-1);
    expect(neighbor(boxes, 9, 'up')).toBe(-1);
  });
});

describe('crossesBox', () => {
  const label = box(100, 100, 80, 20);
  const segment = (x1: number, y1: number, x2: number, y2: number) => ({
    from: { x: x1, y: y1 },
    to: { x: x2, y: y2 },
  });

  it('detecta una flecha vertical que pasa por la etiqueta', () => {
    expect(crossesBox(segment(140, 0, 140, 300), label)).toBe(true);
  });

  it('ignora una flecha que pasa a un lado', () => {
    expect(crossesBox(segment(200, 0, 200, 300), label)).toBe(false);
  });

  it('ignora una flecha que termina antes de llegar', () => {
    expect(crossesBox(segment(140, 0, 140, 90), label)).toBe(false);
  });

  it('detecta una diagonal que corta una esquina', () => {
    expect(crossesBox(segment(90, 130, 130, 90), label)).toBe(true);
  });

  it('ignora una diagonal que pasa junto a la esquina', () => {
    expect(crossesBox(segment(60, 110, 110, 60), label)).toBe(false);
  });
});
