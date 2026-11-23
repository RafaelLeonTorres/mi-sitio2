// El avance del alumno, solo en su navegador (localStorage): qué pasos resolvió o vio, el último
// código de cada uno y dónde se quedó. No hay cuentas ni servidor. Si el navegador no deja guardar
// (modo privado, almacenamiento lleno), todo sigue funcionando sin recordar nada.

import { browserStorage, type KeyValueStorage } from '../challenges/progress';
import type { StepStatus } from './steps';

export { browserStorage };
export type { KeyValueStorage };

export const STORAGE_KEY = 'mi-sitio2.curso.v1';

/** Lo más que se guarda del código de un paso. */
export const MAX_CODE = 20_000;

interface StepEntry {
  readonly status?: 'done' | 'seen';
  readonly code?: string;
}

interface Stored {
  lessons: Record<string, Record<string, StepEntry>>;
  last?: { lesson: string; step: string };
}

export interface CourseProgress {
  status(lesson: string, step: string): StepStatus;
  code(lesson: string, step: string): string | undefined;
  saveCode(lesson: string, step: string, code: string): void;
  /** Resuelto se queda resuelto: ver la solución después no lo baja a visto. */
  mark(lesson: string, step: string, status: 'done' | 'seen', code?: string): void;
  last(): { readonly lesson: string; readonly step: string } | undefined;
  setLast(lesson: string, step: string): void;
  /** Los pasos resueltos de una lección. */
  doneCount(lesson: string): number;
  /** Si hay algún avance guardado. */
  hasProgress(): boolean;
  clear(): void;
  exportJson(): string;
  /** Mezcla un avance exportado; gana el estado más avanzado de cada paso. Devuelve false si no sirve. */
  importJson(text: string): boolean;
}

const isStatus = (value: unknown): value is 'done' | 'seen' => value === 'done' || value === 'seen';

/** Deja solo lo que tiene la forma esperada: el almacenamiento puede traer cualquier cosa. */
function sanitize(raw: unknown): Stored {
  const out: Stored = { lessons: {} };
  if (typeof raw !== 'object' || raw === null) return out;
  const { lessons, last } = raw as Record<string, unknown>;
  if (typeof lessons === 'object' && lessons !== null) {
    for (const [lesson, steps] of Object.entries(lessons)) {
      if (typeof steps !== 'object' || steps === null) continue;
      const clean: Record<string, StepEntry> = {};
      for (const [step, value] of Object.entries(steps)) {
        if (typeof value !== 'object' || value === null) continue;
        const entry = value as Record<string, unknown>;
        const status = entry['status'];
        const code = entry['code'];
        clean[step] = {
          ...(isStatus(status) ? { status } : {}),
          ...(typeof code === 'string' ? { code: code.slice(0, MAX_CODE) } : {}),
        };
      }
      out.lessons[lesson] = clean;
    }
  }
  if (typeof last === 'object' && last !== null) {
    const position = last as Record<string, unknown>;
    const { lesson, step } = { lesson: position['lesson'], step: position['step'] };
    if (typeof lesson === 'string' && typeof step === 'string') out.last = { lesson, step };
  }
  return out;
}

const rank = (status: 'done' | 'seen' | undefined): number =>
  status === 'done' ? 2 : status === 'seen' ? 1 : 0;

export function createCourseProgress(
  storage: KeyValueStorage | null,
  key = STORAGE_KEY,
): CourseProgress {
  // Sin almacenamiento, el avance vive solo mientras la página esté abierta.
  let memory: Stored = { lessons: {} };

  // Se lee cada vez: otra pestaña pudo cambiarlo.
  const read = (): Stored => {
    if (!storage) return memory;
    try {
      return sanitize(JSON.parse(storage.getItem(key) ?? '{}'));
    } catch {
      return { lessons: {} };
    }
  };

  const write = (stored: Stored) => {
    memory = stored;
    try {
      storage?.setItem(key, JSON.stringify(stored));
    } catch {
      // Sin espacio o sin permiso: se pierde al cerrar la página.
    }
  };

  const update = (lesson: string, step: string, change: (entry: StepEntry) => StepEntry) => {
    const stored = read();
    const steps = { ...stored.lessons[lesson] };
    steps[step] = change(steps[step] ?? {});
    write({ ...stored, lessons: { ...stored.lessons, [lesson]: steps } });
  };

  const entry = (lesson: string, step: string): StepEntry | undefined =>
    read().lessons[lesson]?.[step];

  return {
    status: (lesson, step) => entry(lesson, step)?.status ?? 'pending',
    code: (lesson, step) => entry(lesson, step)?.code,
    saveCode: (lesson, step, code) =>
      update(lesson, step, (current) => ({ ...current, code: code.slice(0, MAX_CODE) })),
    mark: (lesson, step, status, code) =>
      update(lesson, step, (current) => ({
        ...current,
        status: rank(status) >= rank(current.status) ? status : current.status!,
        ...(code === undefined ? {} : { code: code.slice(0, MAX_CODE) }),
      })),
    last: () => read().last,
    setLast: (lesson, step) => write({ ...read(), last: { lesson, step } }),
    doneCount: (lesson) =>
      Object.values(read().lessons[lesson] ?? {}).filter((item) => item.status === 'done').length,
    hasProgress: () => Object.keys(read().lessons).length > 0,
    clear: () => {
      memory = { lessons: {} };
      try {
        storage?.removeItem(key);
      } catch {
        // Igual que al escribir.
      }
    },
    exportJson: () => JSON.stringify(read(), null, 2),
    importJson: (text) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return false;
      }
      if (typeof parsed !== 'object' || parsed === null || !('lessons' in parsed)) return false;
      const incoming = sanitize(parsed);
      const stored = read();
      const lessons = { ...stored.lessons };
      for (const [lesson, steps] of Object.entries(incoming.lessons)) {
        const merged = { ...lessons[lesson] };
        for (const [step, value] of Object.entries(steps)) {
          const current = merged[step];
          merged[step] =
            current === undefined || rank(value.status) > rank(current.status) ? value : current;
        }
        lessons[lesson] = merged;
      }
      write({ ...stored, lessons, ...(incoming.last ? { last: incoming.last } : {}) });
      return true;
    },
  };
}
