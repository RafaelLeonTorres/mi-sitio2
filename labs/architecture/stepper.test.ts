import { describe, expect, it } from 'vitest';
import { createStepper } from './stepper';

describe('createStepper', () => {
  it('empieza sin paso y avanza hasta el último sin pasarse', () => {
    const seen: number[] = [];
    const stepper = createStepper(3, (index) => seen.push(index));
    expect(stepper.index).toBe(0);
    stepper.next();
    stepper.next();
    stepper.next();
    stepper.next();
    expect(stepper.index).toBe(3);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('retrocede hasta el inicio sin pasarse', () => {
    const stepper = createStepper(2, () => {});
    stepper.go(2);
    stepper.prev();
    stepper.prev();
    stepper.prev();
    expect(stepper.index).toBe(0);
  });

  it('ajusta los pasos fuera de rango y no avisa si no cambia', () => {
    const seen: number[] = [];
    const stepper = createStepper(4, (index) => seen.push(index));
    stepper.go(10);
    stepper.go(4);
    stepper.go(-3);
    expect(seen).toEqual([4, 0]);
  });
});
