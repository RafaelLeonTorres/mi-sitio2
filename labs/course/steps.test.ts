import { describe, expect, it } from 'vitest';
import { percent, reachable, startIndex, type StepStatus } from './steps';

const s = (...items: StepStatus[]) => items;

describe('reachable', () => {
  it('llega hasta el primer paso pendiente', () => {
    expect(reachable(s('done', 'seen', 'pending', 'pending'))).toBe(2);
    expect(reachable(s('pending', 'pending'))).toBe(0);
  });

  it('si todos están resueltos o vistos, llega al último', () => {
    expect(reachable(s('done', 'seen', 'done'))).toBe(2);
  });

  it('una lección sin pasos llega al 0', () => {
    expect(reachable([])).toBe(0);
  });
});

describe('percent', () => {
  it('cuenta solo los resueltos', () => {
    expect(percent(s('done', 'seen', 'pending', 'pending'))).toBe(25);
    expect(percent(s('done', 'done', 'done'))).toBe(100);
    expect(percent(s('pending'))).toBe(0);
  });

  it('redondea y no falla con una lección vacía', () => {
    expect(percent(s('done', 'pending', 'pending'))).toBe(33);
    expect(percent([])).toBe(0);
  });
});

describe('startIndex', () => {
  it('abre donde se quedó el alumno, sin pasar de lo que puede abrir', () => {
    expect(startIndex(s('done', 'done', 'pending', 'pending'), 1)).toBe(1);
    expect(startIndex(s('done', 'pending', 'pending'), 2)).toBe(1);
  });

  it('sin posición guardada, abre el primer paso pendiente', () => {
    expect(startIndex(s('done', 'pending'), undefined)).toBe(1);
    expect(startIndex(s('pending'), -1)).toBe(0);
  });
});
