// El progreso del visitante, solo en su navegador (localStorage): qué retos resolvió o empezó y
// el último código de cada uno. No hay cuentas ni servidor. Si el navegador no deja guardar (modo
// privado, almacenamiento lleno), todo sigue funcionando sin recordar nada.

export type Status = 'solved' | 'started';

export interface Entry {
  readonly status: Status;
  readonly code?: string;
}

/** Lo que se usa de localStorage; las pruebas pasan uno en memoria. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const STORAGE_KEY = 'mi-sitio2.retos.v1';

export interface Progress {
  get(id: string): Entry | undefined;
  /** Los retos con progreso, por id. */
  all(): Readonly<Record<string, Entry>>;
  /** Guarda el código; un reto sin estado queda como empezado. */
  saveCode(id: string, code: string): void;
  markStarted(id: string): void;
  /** Resuelto se queda resuelto aunque el código cambie después. */
  markSolved(id: string, code: string): void;
  /** Borra todo el progreso de los retos. */
  clear(): void;
}

const isEntry = (value: unknown): value is Entry => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  const status = entry['status'];
  const code = entry['code'];
  return (
    (status === 'solved' || status === 'started') &&
    (code === undefined || typeof code === 'string')
  );
};

/** El almacenamiento del navegador, o null si no se puede usar. */
export function browserStorage(): KeyValueStorage | null {
  try {
    const storage = globalThis.localStorage;
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function createProgress(storage: KeyValueStorage | null, key = STORAGE_KEY): Progress {
  // Sin almacenamiento, el progreso vive solo mientras la página esté abierta.
  let memory: Record<string, Entry> = {};

  // Se lee cada vez: otra pestaña o la página anterior pudo cambiarlo.
  const read = (): Record<string, Entry> => {
    if (!storage) return memory;
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(storage.getItem(key) ?? '{}');
    } catch {
      parsed = {};
    }
    const out: Record<string, Entry> = {};
    if (typeof parsed === 'object' && parsed !== null) {
      for (const [id, value] of Object.entries(parsed)) if (isEntry(value)) out[id] = value;
    }
    return out;
  };

  const write = (entries: Record<string, Entry>) => {
    memory = entries;
    try {
      storage?.setItem(key, JSON.stringify(entries));
    } catch {
      // Sin espacio o sin permiso: se pierde al cerrar la página.
    }
  };

  const update = (id: string, change: (entry: Entry | undefined) => Entry) => {
    const entries = { ...read() };
    entries[id] = change(entries[id]);
    write(entries);
  };

  return {
    get: (id) => read()[id],
    all: () => read(),
    saveCode: (id, code) => update(id, (entry) => ({ status: entry?.status ?? 'started', code })),
    markStarted: (id) => update(id, (entry) => entry ?? { status: 'started' }),
    markSolved: (id, code) => update(id, () => ({ status: 'solved', code })),
    clear: () => {
      memory = {};
      try {
        storage?.removeItem(key);
      } catch {
        // Igual que al escribir.
      }
    },
  };
}
