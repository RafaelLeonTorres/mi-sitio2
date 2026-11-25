import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { COVERAGE } from '../labs/challenges/sql/coverage';
import { sampleSql, type Dataset } from '../labs/challenges/sql/data';
import { pgliteOpener, type CreatePGlite } from '../labs/challenges/sql/pglite';
import type { Database } from '../labs/challenges/sql/runner';
import { translate } from '../labs/challenges/sql/translate';

// La lista de cobertura (labs/challenges/sql/coverage.ts) contra el motor de verdad: cada
// construcción de T-SQL que el curso enseña corre, se detiene con su mensaje o falla, según el
// estado que la lista le da. Así, la lista no se desactualiza: si alguien traduce lo que faltaba
// (`gap`), la prueba pide cambiar el estado, y una lección ejecutable no puede apoyarse en algo
// que no corre.

const open = pgliteOpener(((options) => PGlite.create(options)) as CreatePGlite);
const dataset = (
  parse(readFileSync('_data/labs/challenge-datasets.yml', 'utf8')) as { shared: Dataset }
).shared;
const schema = dataset.tables.map((table) => table.ddl.trim()).join('\n\n');

/** El error de PostgreSQL, o undefined si corrió. Todo se deshace: el siguiente ejemplo ve la misma base. */
async function attempt(db: Database, sql: string): Promise<string | undefined> {
  try {
    await db.exec('BEGIN;');
    await db.exec(sql);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await db.exec('ROLLBACK;').catch(() => undefined);
  }
}

describe('cobertura del T-SQL del curso', () => {
  it('la lista no repite construcciones y tiene de todo', () => {
    const names = COVERAGE.map((item) => `${item.module}. ${item.name}`);
    expect(new Set(names).size).toBe(names.length);
    for (const status of ['native', 'adapted', 'blocked', 'gap'] as const) {
      expect(
        COVERAGE.some((item) => item.status === status),
        status,
      ).toBe(true);
    }
    // Lo detenido dice con qué mensaje, y solo eso.
    for (const item of COVERAGE) {
      expect(item.blocked !== undefined, item.name).toBe(item.status === 'blocked');
    }
    // Los módulos de la versión 1 (del 1 al 5) tienen sus construcciones.
    for (const module of [1, 2, 3, 4, 5]) {
      expect(
        COVERAGE.filter((item) => item.module === module).length,
        `módulo ${module}`,
      ).toBeGreaterThan(5);
    }
  });

  it('cada construcción está donde dice la lista', async () => {
    const db = await open();
    try {
      await db.exec(translate(schema, { collation: 'ci' }).sql);
      await db.exec(sampleSql(dataset));
      const wrong: string[] = [];
      for (const item of COVERAGE) {
        const label = `${item.module}. ${item.name} (${item.status})`;
        const plain = translate(item.sql);
        const result = translate(item.sql, { collation: 'ci' });
        if (item.status === 'blocked') {
          if (!result.blocked.some((block) => block.key === item.blocked)) {
            wrong.push(
              `${label}: no se detiene con ${item.blocked}: ${JSON.stringify(result.blocked)}`,
            );
          }
          continue;
        }
        if (result.blocked.length > 0) {
          wrong.push(`${label}: se detiene: ${JSON.stringify(result.blocked)}`);
          continue;
        }
        if (item.status === 'native' && plain.sql !== item.sql) {
          wrong.push(`${label}: translate cambia el texto: ${plain.sql}`);
        }
        const error = await attempt(db, result.sql);
        if (item.status === 'gap') {
          if (error === undefined) wrong.push(`${label}: ya corre; cámbialo a native o adapted`);
        } else if (error !== undefined) {
          wrong.push(`${label}: ${error}\n    ${result.sql}`);
        }
      }
      expect(wrong, wrong.join('\n')).toEqual([]);
    } finally {
      await db.close();
    }
  }, 120_000);
});
