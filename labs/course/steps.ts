// Qué pasos de una lección se pueden abrir y cuánto lleva el alumno. Es lógica pura: no toca el DOM.

export type StepStatus = 'done' | 'seen' | 'pending';

/**
 * Hasta qué paso se puede avanzar: el primero que no está resuelto ni visto. Si todos lo están, el
 * último. Hacia atrás siempre se puede volver.
 */
export function reachable(statuses: readonly StepStatus[]): number {
  const open = statuses.indexOf('pending');
  return open === -1 ? Math.max(0, statuses.length - 1) : open;
}

/** El avance de la lección: los pasos resueltos entre el total, de 0 a 100. Ver la solución no cuenta. */
export function percent(statuses: readonly StepStatus[]): number {
  if (statuses.length === 0) return 0;
  const done = statuses.filter((status) => status === 'done').length;
  return Math.round((done / statuses.length) * 100);
}

/** Con qué paso empieza la lección: donde se quedó el alumno, si todavía se puede abrir. */
export function startIndex(statuses: readonly StepStatus[], last: number | undefined): number {
  const limit = reachable(statuses);
  if (last === undefined || last < 0) return limit;
  return Math.min(last, limit);
}
