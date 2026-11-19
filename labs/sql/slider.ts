// La escala del deslizador de la página. Con 50,000 páginas, uno lineal no deja elegir la 2 ni la
// 100; en escala logarítmica, cada paso avanza en proporción, así que las primeras páginas quedan
// a la mano y las últimas también. Los valores se redondean a dos cifras desde 100: 10,000, no 9,982.

/** Los pasos del deslizador, de 0 a STEPS. */
export const STEPS = 1000;

/** Redondea a dos cifras significativas desde 100: 9,982 → 10,000 y 1,234 → 1,200. */
export function nice(value: number): number {
  const rounded = Math.round(value);
  if (rounded < 100) return rounded;
  const unit = 10 ** (Math.floor(Math.log10(rounded)) - 1);
  return Math.round(rounded / unit) * unit;
}

/** La página para una posición del deslizador, entre 1 y `max`. */
export function fromPosition(position: number, max: number): number {
  if (max <= 1) return 1;
  const fraction = Math.min(STEPS, Math.max(0, position)) / STEPS;
  return Math.min(max, Math.max(1, nice(max ** fraction)));
}

/** La posición del deslizador más cercana a una página. */
export function toPosition(value: number, max: number): number {
  if (max <= 1) return 0;
  const clamped = Math.min(max, Math.max(1, value));
  return Math.round((Math.log(clamped) / Math.log(max)) * STEPS);
}
