import { describe, expect, it } from 'vitest';
import { fromPosition, nice, STEPS, toPosition } from './slider';

describe('deslizador de la página', () => {
  it('redondea a dos cifras desde 100', () => {
    expect([nice(7), nice(99.6), nice(123), nice(9982), nice(49_460)]).toEqual([
      7, 100, 120, 10_000, 49_000,
    ]);
  });

  it('va de la primera página a la última', () => {
    expect(fromPosition(0, 50_000)).toBe(1);
    expect(fromPosition(STEPS, 50_000)).toBe(50_000);
    expect(fromPosition(STEPS, 500)).toBe(500);
    expect(fromPosition(-5, 500)).toBe(1);
    expect(fromPosition(STEPS + 5, 500)).toBe(500);
  });

  it('avanza en proporción: la mitad del recorrido es la raíz del máximo', () => {
    expect(fromPosition(STEPS / 2, 50_000)).toBe(nice(Math.sqrt(50_000)));
    // Las primeras páginas quedan a unos cuantos pasos.
    expect(fromPosition(100, 50_000)).toBeLessThan(10);
  });

  it('una página vuelve a la misma posición, o a la más cercana', () => {
    expect(toPosition(1, 50_000)).toBe(0);
    expect(toPosition(50_000, 50_000)).toBe(STEPS);
    expect(fromPosition(toPosition(10_000, 50_000), 50_000)).toBe(10_000);
    expect(toPosition(80_000, 500)).toBe(STEPS);
  });

  it('con una sola página no hay a dónde moverse', () => {
    expect(fromPosition(500, 1)).toBe(1);
    expect(toPosition(1, 1)).toBe(0);
  });
});
