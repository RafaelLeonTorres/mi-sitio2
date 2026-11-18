import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber, pageLang } from './format';

describe('formatNumber', () => {
  it('separa los miles con coma en los dos idiomas', () => {
    expect(formatNumber(1_234_567, 'es')).toBe('1,234,567');
    expect(formatNumber(1_234_567, 'en')).toBe('1,234,567');
  });

  it('redondea a los decimales pedidos', () => {
    expect(formatNumber(0.456, 'es', 2)).toBe('0.46');
    expect(formatNumber(2.5, 'es')).toBe('3');
  });
});

describe('formatDuration', () => {
  it('usa milisegundos con decimales por debajo de 1 ms', () => {
    expect(formatDuration(0.4, 'es')).toBe('0.4 ms');
  });

  it('usa milisegundos enteros hasta un segundo', () => {
    expect(formatDuration(38.2, 'es')).toBe('38 ms');
  });

  it('pasa a segundos desde 1000 ms, también cuando se llega por redondeo', () => {
    expect(formatDuration(1234, 'en')).toBe('1.2 s');
    expect(formatDuration(999.6, 'es')).toBe('1 s');
  });
});

describe('pageLang', () => {
  it('reconoce el inglés por el prefijo', () => {
    expect(pageLang('en')).toBe('en');
    expect(pageLang('en-US')).toBe('en');
  });

  it('usa español en cualquier otro caso', () => {
    expect(pageLang('es')).toBe('es');
    expect(pageLang('es-MX')).toBe('es');
    expect(pageLang('')).toBe('es');
  });
});
