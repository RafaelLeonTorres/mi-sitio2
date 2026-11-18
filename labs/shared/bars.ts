// Barras horizontales para comparar valores (tiempos, lecturas). Cada barra mide en proporción
// a la mayor, y una con valor mayor que cero nunca desaparece del todo.

import { h } from './dom';

export interface Bar {
  label: string;
  value: number;
  /** El valor ya con formato, tal como se lee junto a la barra ("412 ms"). */
  text: string;
  tone?: 'good' | 'bad';
}

/** Proporción de cada valor respecto al mayor, de 0 a 1, con un mínimo visible para los positivos. */
export function barFractions(values: readonly number[], minimum = 0.01): number[] {
  const max = Math.max(0, ...values);
  return values.map((value) => (max === 0 || value <= 0 ? 0 : Math.max(minimum, value / max)));
}

/** Dibuja las barras en una lista `<ul class="lab-bars">`, en lugar de las que tuviera. */
export function renderBars(list: HTMLElement, bars: readonly Bar[]): void {
  const fractions = barFractions(bars.map((bar) => bar.value));
  list.replaceChildren(
    ...bars.map((bar, index) => {
      const fill = h('span', { class: 'lab-bar-fill' });
      fill.style.setProperty('--w', String(fractions[index] ?? 0));
      return h('li', { class: 'lab-bar', 'data-tone': bar.tone }, [
        h('span', { class: 'lab-bar-label' }, [bar.label]),
        h('span', { class: 'lab-bar-track', 'aria-hidden': 'true' }, [fill]),
        h('span', { class: 'lab-bar-value' }, [bar.text]),
      ]);
    }),
  );
}
