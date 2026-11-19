// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fill, inlineCode } from './template';

describe('fill', () => {
  it('cambia cada {nombre} por su valor y deja los que no tienen', () => {
    expect(fill('{n} de {total} ({x})', { n: 1, total: 3 })).toBe('1 de 3 ({x})');
  });
});

describe('inlineCode', () => {
  it('vuelve <code> lo que va entre comillas invertidas, sin leer HTML', () => {
    const parts = inlineCode('Usa `TOP` o `<b>`.');
    const span = document.createElement('span');
    span.append(...parts);
    expect(span.innerHTML).toBe('Usa <code>TOP</code> o <code>&lt;b&gt;</code>.');
  });
});
