// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { bindRange } from './range';

describe('bindRange', () => {
  it('muestra el valor con formato al inicio y cada vez que cambia', () => {
    document.body.innerHTML = '<input type="range" min="0" max="100" value="40"><output></output>';
    const input = document.querySelector('input');
    const output = document.querySelector('output');
    if (!input || !output) throw new Error('faltan los elementos');

    bindRange(input, output, (value) => `${value} filas`);
    expect(output.value).toBe('40 filas');
    expect(input.getAttribute('aria-valuetext')).toBe('40 filas');

    input.value = '75';
    input.dispatchEvent(new Event('input'));
    expect(output.value).toBe('75 filas');
    expect(input.getAttribute('aria-valuetext')).toBe('75 filas');
  });
});
