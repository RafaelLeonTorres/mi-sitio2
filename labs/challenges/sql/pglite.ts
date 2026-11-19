// La base de cada caso: PGlite (PostgreSQL en WebAssembly) con la forma de `Database` que usa el
// runner. Cada caso abre una instancia nueva a partir de una plantilla: la primera vez corre initdb
// (un par de segundos), crea las funciones de T-SQL y guarda la carpeta de datos; las siguientes
// arrancan de esa carpeta en unos 250 ms. Las fechas, las horas y los decimales se quedan como
// texto, igual que los escribe PostgreSQL, para compararlos y mostrarlos sin que JavaScript los
// cambie.

import { COMPAT_SQL } from './compat';
import type { ResultSet } from './compare';
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
const PARSERS = Object.fromEntries(AS_TEXT.map((oid) => [oid, (value: string) => value]));

/** Una instancia de PGlite como `Database`. */
export function pgliteDatabase(pg: PGliteLike): Database {
  return {
    async exec(sql: string): Promise<ResultSet[]> {
      const results = await pg.exec(sql, { rowMode: 'array', parsers: PARSERS });
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
 * Abre bases nuevas, cada una en su propia instancia, a partir de una plantilla con las funciones
 * de T-SQL. `options` va a cada instancia (en el navegador, los módulos de WebAssembly ya
 * compilados y los archivos de PostgreSQL).
 */
export function pgliteOpener(
  create: CreatePGlite,
  options: Record<string, unknown> = {},
): OpenDatabase {
  let template: Promise<Blob> | undefined;
  const build = async () => {
    const pg = await create({ ...options, relaxedDurability: true });
    try {
      await pg.exec(COMPAT_SQL);
      return await pg.dumpDataDir('none');
    } finally {
      await pg.close();
    }
  };
  return async () => {
    template ??= build().catch((error: unknown) => {
      template = undefined;
      throw error;
    });
    const pg = await create({ ...options, loadDataDir: await template, relaxedDurability: true });
    return pgliteDatabase(pg);
  };
}
