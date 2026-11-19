import { describe, expect, it } from 'vitest';
import { createProgress, type KeyValueStorage } from './progress';

/** Un localStorage en memoria; con `broken`, cada escritura falla como con el almacenamiento lleno. */
function memoryStorage(
  initial: Record<string, string> = {},
  broken = false,
): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      if (broken) throw new Error('QuotaExceededError');
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('createProgress', () => {
  it('guarda el código, marca empezado y luego resuelto', () => {
    const storage = memoryStorage();
    const progress = createProgress(storage, 'k');
    expect(progress.get('a')).toBeUndefined();
    progress.saveCode('a', 'SELECT 1;');
    expect(progress.get('a')).toEqual({ status: 'started', code: 'SELECT 1;' });
    progress.markSolved('a', 'SELECT 2;');
    progress.saveCode('a', 'SELECT 3;');
    expect(progress.get('a')).toEqual({ status: 'solved', code: 'SELECT 3;' });
    progress.markStarted('b');
    expect(Object.keys(progress.all())).toEqual(['a', 'b']);
    expect(JSON.parse(storage.data['k'] ?? '{}')['b']).toEqual({ status: 'started' });
  });

  it('lee lo que guardó otra página e ignora lo que no entiende', () => {
    const storage = memoryStorage({
      k: JSON.stringify({ a: { status: 'solved' }, b: { status: 'raro' }, c: 3 }),
    });
    expect(createProgress(storage, 'k').all()).toEqual({ a: { status: 'solved' } });
    expect(createProgress(memoryStorage({ k: '{no es json' }), 'k').all()).toEqual({});
  });

  it('borra todo el progreso', () => {
    const storage = memoryStorage();
    const progress = createProgress(storage, 'k');
    progress.markSolved('a', 'x');
    progress.clear();
    expect(progress.all()).toEqual({});
    expect(storage.data['k']).toBeUndefined();
  });

  it('sin almacenamiento, o si falla al escribir, recuerda mientras la página está abierta', () => {
    const progress = createProgress(null);
    progress.markSolved('a', 'x');
    expect(progress.get('a')?.status).toBe('solved');
    const full = createProgress(memoryStorage({}, true), 'k');
    expect(() => full.saveCode('a', 'x')).not.toThrow();
  });
});
