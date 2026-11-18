// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { barFractions, renderBars } from './bars';

describe('barFractions', () => {
  it('mide cada valor contra el mayor', () => {
    expect(barFractions([400, 100, 0])).toEqual([1, 0.25, 0]);
  });

  it('deja visible un valor positivo muy pequeño', () => {
    expect(barFractions([1000, 1])).toEqual([1, 0.01]);
  });

  it('sin valores positivos todas quedan en cero', () => {
    expect(barFractions([0, 0])).toEqual([0, 0]);
    expect(barFractions([])).toEqual([]);
  });
});

describe('renderBars', () => {
  it('dibuja una barra por valor con su texto, su tono y su proporción', () => {
    const list = document.createElement('ul');
    renderBars(list, [
      { label: 'A', value: 412, text: '412 ms', tone: 'bad' },
      { label: 'B', value: 9, text: '9 ms', tone: 'good' },
    ]);
    const bars = [...list.querySelectorAll<HTMLElement>('.lab-bar')];
    expect(bars).toHaveLength(2);
    expect(bars.map((bar) => bar.dataset['tone'])).toEqual(['bad', 'good']);
    expect(bars[1]?.querySelector('.lab-bar-value')?.textContent).toBe('9 ms');
    const fill = bars[1]?.querySelector<HTMLElement>('.lab-bar-fill');
    expect(Number(fill?.style.getPropertyValue('--w'))).toBe(9 / 412);
  });

  it('reemplaza las barras anteriores', () => {
    const list = document.createElement('ul');
    renderBars(list, [
      { label: 'A', value: 1, text: '1' },
      { label: 'B', value: 2, text: '2' },
    ]);
    renderBars(list, [{ label: 'C', value: 3, text: '3' }]);
    expect(list.children).toHaveLength(1);
    expect(list.querySelector('.lab-bar')?.hasAttribute('data-tone')).toBe(false);
  });
});
