// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { announce } from './live';

describe('announce', () => {
  it('usa una sola región de estado y deja el último mensaje', () => {
    document.body.innerHTML = '';
    announce('201 Created');
    announce('404 Not Found');
    const regions = document.querySelectorAll('[role="status"]');
    expect(regions).toHaveLength(1);
    expect(regions[0]?.textContent).toBe('404 Not Found');
  });

  it('cambia el texto si el mensaje se repite, para que se lea otra vez', () => {
    document.body.innerHTML = '';
    announce('Listo');
    announce('Listo');
    const text = document.getElementById('lab-live')?.textContent ?? '';
    expect(text).not.toBe('Listo');
    expect(text.trim()).toBe('Listo');
  });
});
