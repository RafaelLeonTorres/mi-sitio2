import { describe, expect, it } from 'vitest';
import { fixedWindow } from './rate-limit';

describe('fixedWindow', () => {
  it('da los permisos de la ventana y después dice cuánto esperar', () => {
    const limiter = fixedWindow(3, 10_000);
    expect(limiter.acquire(0)).toEqual({ acquired: true, remaining: 2 });
    expect(limiter.acquire(1000)).toEqual({ acquired: true, remaining: 1 });
    expect(limiter.acquire(2000)).toEqual({ acquired: true, remaining: 0 });
    expect(limiter.acquire(2500)).toEqual({ acquired: false, retryAfterSeconds: 8 });
  });

  it('una ventana nueva vuelve a dar todos los permisos', () => {
    const limiter = fixedWindow(1, 10_000);
    limiter.acquire(0);
    expect(limiter.acquire(9_999).acquired).toBe(false);
    expect(limiter.acquire(10_000)).toEqual({ acquired: true, remaining: 0 });
  });
});
