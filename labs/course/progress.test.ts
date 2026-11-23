import { describe, expect, it } from 'vitest';
import { createCourseProgress, MAX_CODE, STORAGE_KEY, type KeyValueStorage } from './progress';

function memoryStorage(initial?: Record<string, string>): KeyValueStorage & {
  readonly data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('progreso del curso', () => {
  it('un paso sin registro está pendiente', () => {
    const progress = createCourseProgress(memoryStorage());
    expect(progress.status('m/l', 'a')).toBe('pending');
    expect(progress.code('m/l', 'a')).toBeUndefined();
    expect(progress.hasProgress()).toBe(false);
  });

  it('guarda el código y el estado de cada paso', () => {
    const storage = memoryStorage();
    const progress = createCourseProgress(storage);
    progress.saveCode('m/l', 'a', 'x = 1;');
    progress.mark('m/l', 'a', 'done', 'x = 2;');
    expect(progress.status('m/l', 'a')).toBe('done');
    expect(progress.code('m/l', 'a')).toBe('x = 2;');
    expect(progress.hasProgress()).toBe(true);
    // Otra instancia lee lo mismo: está en el almacenamiento.
    expect(createCourseProgress(storage).status('m/l', 'a')).toBe('done');
  });

  it('resuelto se queda resuelto aunque después se vea la solución', () => {
    const progress = createCourseProgress(memoryStorage());
    progress.mark('m/l', 'a', 'done');
    progress.mark('m/l', 'a', 'seen');
    expect(progress.status('m/l', 'a')).toBe('done');
    progress.mark('m/l', 'b', 'seen');
    progress.mark('m/l', 'b', 'done');
    expect(progress.status('m/l', 'b')).toBe('done');
  });

  it('cuenta los pasos resueltos por lección, sin los vistos', () => {
    const progress = createCourseProgress(memoryStorage());
    progress.mark('m/l', 'a', 'done');
    progress.mark('m/l', 'b', 'seen');
    progress.mark('m/otra', 'a', 'done');
    expect(progress.doneCount('m/l')).toBe(1);
    expect(progress.doneCount('m/otra')).toBe(1);
    expect(progress.doneCount('m/nada')).toBe(0);
  });

  it('recuerda el último paso abierto', () => {
    const progress = createCourseProgress(memoryStorage());
    expect(progress.last()).toBeUndefined();
    progress.setLast('m/l', 'b');
    expect(progress.last()).toEqual({ lesson: 'm/l', step: 'b' });
  });

  it('recorta el código que pasa del tope', () => {
    const progress = createCourseProgress(memoryStorage());
    progress.saveCode('m/l', 'a', 'x'.repeat(MAX_CODE + 500));
    expect(progress.code('m/l', 'a')).toHaveLength(MAX_CODE);
  });

  it('ignora datos corruptos o con otra forma', () => {
    for (const raw of ['no es json', '[]', '{"lessons": 5}', '{"lessons": {"m/l": {"a": 3}}}']) {
      const progress = createCourseProgress(memoryStorage({ [STORAGE_KEY]: raw }));
      expect(progress.status('m/l', 'a')).toBe('pending');
      expect(progress.code('m/l', 'a')).toBeUndefined();
      expect(progress.doneCount('m/l')).toBe(0);
      expect(progress.last()).toBeUndefined();
    }
  });

  it('descarta un estado que no existe y deja el resto del paso', () => {
    const raw = JSON.stringify({ lessons: { 'm/l': { a: { status: 'raro', code: 'x' } } } });
    const progress = createCourseProgress(memoryStorage({ [STORAGE_KEY]: raw }));
    expect(progress.status('m/l', 'a')).toBe('pending');
    expect(progress.code('m/l', 'a')).toBe('x');
  });

  it('clear borra todo', () => {
    const storage = memoryStorage();
    const progress = createCourseProgress(storage);
    progress.mark('m/l', 'a', 'done');
    progress.clear();
    expect(progress.hasProgress()).toBe(false);
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
  });

  it('sin almacenamiento, recuerda mientras la página esté abierta', () => {
    const progress = createCourseProgress(null);
    progress.mark('m/l', 'a', 'done');
    expect(progress.status('m/l', 'a')).toBe('done');
  });

  it('exporta e importa mezclando: gana el estado más avanzado', () => {
    const source = createCourseProgress(memoryStorage());
    source.mark('m/l', 'a', 'done', 'listo');
    source.mark('m/l', 'b', 'seen');
    source.setLast('m/l', 'b');
    const target = createCourseProgress(memoryStorage());
    target.mark('m/l', 'b', 'done');
    expect(target.importJson(source.exportJson())).toBe(true);
    expect(target.status('m/l', 'a')).toBe('done');
    expect(target.code('m/l', 'a')).toBe('listo');
    expect(target.status('m/l', 'b')).toBe('done');
    expect(target.last()).toEqual({ lesson: 'm/l', step: 'b' });
  });

  it('rechaza un archivo que no es un avance', () => {
    const progress = createCourseProgress(memoryStorage());
    expect(progress.importJson('no es json')).toBe(false);
    expect(progress.importJson('{"otra": 1}')).toBe(false);
    expect(progress.importJson('3')).toBe(false);
  });
});
