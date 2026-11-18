// El recorrido paso a paso de una petición. El paso 0 es "sin empezar"; del 1 al último se
// resalta una pieza a la vez.

export interface Stepper {
  readonly index: number;
  readonly count: number;
  next(): void;
  prev(): void;
  go(index: number): void;
}

/** Crea el recorrido de `count` pasos; `onChange` avisa cada vez que cambia el paso. */
export function createStepper(count: number, onChange: (index: number) => void): Stepper {
  let index = 0;
  const go = (target: number) => {
    const next = Math.max(0, Math.min(count, Math.trunc(target)));
    if (next === index) return;
    index = next;
    onChange(index);
  };
  return {
    get index() {
      return index;
    },
    count,
    next: () => go(index + 1),
    prev: () => go(index - 1),
    go,
  };
}
