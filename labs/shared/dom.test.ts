// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { h, required, svg } from './dom';

describe('h', () => {
  it('crea el elemento con sus atributos y omite false, null y undefined', () => {
    const button = h('button', {
      type: 'button',
      hidden: true,
      disabled: false,
      title: undefined,
      'aria-label': null,
      'data-step': 3,
    });
    expect(button.outerHTML).toBe('<button type="button" hidden="" data-step="3"></button>');
  });

  it('agrega texto, números y nodos, y salta los hijos vacíos', () => {
    const paragraph = h('p', {}, ['Hola ', h('strong', {}, ['mundo']), null, false, undefined, 42]);
    expect(paragraph.outerHTML).toBe('<p>Hola <strong>mundo</strong>42</p>');
  });

  it('nunca interpreta el texto como HTML', () => {
    const span = h('span', {}, ['<img src=x onerror=alert(1)>']);
    expect(span.children).toHaveLength(0);
    expect(span.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('svg', () => {
  it('crea elementos en el espacio de nombres de SVG', () => {
    const line = svg('line', { x1: 0, y1: 4, class: 'arch-edge' });
    const root = svg('svg', { viewBox: '0 0 10 10' }, [line]);
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(line.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(root.innerHTML).toBe('<line x1="0" y1="4" class="arch-edge"></line>');
  });
});

describe('required', () => {
  it('devuelve el elemento o dice cuál falta', () => {
    document.body.innerHTML = '<main><p class="nota">a</p></main>';
    expect(required('.nota').textContent).toBe('a');
    expect(() => required('.falta')).toThrow('No se encontró .falta en la página.');
  });
});
