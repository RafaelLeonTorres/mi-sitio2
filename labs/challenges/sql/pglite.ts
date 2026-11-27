// La base de cada caso: PGlite (PostgreSQL en WebAssembly) con la forma de `Database` que usa el
// runner. Cada caso abre una instancia nueva a partir de una plantilla: la primera vez corre initdb
// (un par de segundos), en T-SQL crea las funciones de compat.ts, y guarda la carpeta de datos; las
// siguientes arrancan de esa carpeta en unos 250 ms. Las fechas, las horas y los decimales se quedan
// como texto, igual que los escribe PostgreSQL, para compararlos y mostrarlos sin que JavaScript los
// cambie; en el curso de PostgreSQL, también los booleanos, los arreglos y el JSON (t, {a,b}).

import { COMPAT_SQL } from './compat';
import type { ResultSet } from './compare';
import type { SqlDialect } from './data';
import type { Database, OpenDatabase } from './runner';

/** Lo que se usa de una instancia de PGlite; las pruebas pueden pasar otra con la misma forma. */
export interface PGliteLike {
  exec(
    sql: string,
    options?: {
      rowMode?: 'array' | 'object';
      parsers?: Record<number, (value: string, typeId: number) => unknown>;
    },
  ): Promise<
    readonly {
      readonly rows: readonly unknown[];
      readonly fields: readonly { readonly name: string }[];
      readonly affectedRows?: number;
    }[]
  >;
  dumpDataDir(compression?: 'none' | 'gzip' | 'auto'): Promise<Blob>;
  close(): Promise<void>;
}

/** Crea una instancia con estas opciones: `PGlite.create` en el navegador y en Node. */
export type CreatePGlite = (options: Record<string, unknown>) => Promise<PGliteLike>;

// int8, numeric, date, time, timestamp, timestamptz, interval y timetz.
const AS_TEXT = [20, 1700, 1082, 1083, 1114, 1184, 1186, 1266];
// En PostgreSQL, además: boolean, json y jsonb, y los arreglos de los tipos comunes.
const NATIVE_AS_TEXT = [
  ...AS_TEXT,
  ...[16, 114, 3802, 199, 3807],
  ...[1000, 1005, 1007, 1009, 1014, 1015, 1016, 1021, 1022, 1115, 1182, 1185, 1231],
];
const asText = (oids: readonly number[]) =>
  Object.fromEntries(oids.map((oid) => [oid, (value: string) => value]));
const PARSERS = asText(AS_TEXT);
const NATIVE_PARSERS = asText(NATIVE_AS_TEXT);

/** Una instancia de PGlite como `Database`. */
export function pgliteDatabase(pg: PGliteLike, dialect?: SqlDialect): Database {
  const parsers = dialect === 'postgresql' ? NATIVE_PARSERS : PARSERS;
  return {
    async exec(sql: string): Promise<ResultSet[]> {
      const results = await pg.exec(sql, { rowMode: 'array', parsers });
      return results.map((result) => ({
        columns: result.fields.map((field) => field.name),
        rows: result.rows as readonly (readonly unknown[])[],
        ...(result.fields.length === 0 && result.affectedRows !== undefined
          ? { affected: result.affectedRows }
          : {}),
      }));
    },
    close: () => pg.close(),
  };
}

/**
 * Abre bases nuevas, cada una en su propia instancia, a partir de una plantilla por dialecto: la de
 * T-SQL, con sus funciones; la de PostgreSQL, tal cual. `options` va a cada instancia (en el
 * navegador, los módulos de WebAssembly ya compilados y los archivos de PostgreSQL).
 */
export function pgliteOpener(
  create: CreatePGlite,
  options: Record<string, unknown> = {},
): OpenDatabase {
  const templates = new Map<boolean, Promise<Blob>>();
  const build = async (native: boolean) => {
    const pg = await create({ ...options, relaxedDurability: true });
    try {
      if (!native) await pg.exec(COMPAT_SQL);
      return await pg.dumpDataDir('none');
    } finally {
      await pg.close();
    }
  };
  return async (dialect) => {
    const native = dialect === 'postgresql';
    let template = templates.get(native);
    if (!template) {
      template = build(native).catch((error: unknown) => {
        templates.delete(native);
        throw error;
      });
      templates.set(native, template);
    }
    const pg = await create({ ...options, loadDataDir: await template, relaxedDurability: true });
    return pgliteDatabase(pg, dialect);
  };
}
