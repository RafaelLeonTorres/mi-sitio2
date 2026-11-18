import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// Cada archivo de _data/labs/ tiene una parte `es` y otra `en` (y, si hace falta, `shared` con lo
// que no se traduce). Esta prueba revisa que `es` y `en` digan lo mismo en estructura: las mismas
// claves, listas del mismo largo, ningún texto vacío y los mismos valores en lo que no se traduce
// (ids, banderas y números). Así ninguna demo queda a medias.

const DATA_DIR = '_data/labs';

/** Los .yml de una carpeta y de sus subcarpetas. */
function yamlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return yamlFiles(path);
    return entry.name.endsWith('.yml') ? [path] : [];
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Lo que no coincide entre la parte en español y la parte en inglés; vacío si nada. */
function differences(es: unknown, en: unknown, path = ''): string[] {
  const where = path || '(raíz)';
  if (Array.isArray(es) && Array.isArray(en)) {
    if (es.length !== en.length) {
      return [`${where}: ${es.length} elementos en es y ${en.length} en en`];
    }
    return es.flatMap((item, index) => differences(item, en[index], `${path}[${index}]`));
  }
  if (isRecord(es) && isRecord(en)) {
    const keys = [...new Set([...Object.keys(es), ...Object.keys(en)])].sort();
    return keys.flatMap((key) => {
      const child = path ? `${path}.${key}` : key;
      if (!(key in es)) return [`${child}: falta en es`];
      if (!(key in en)) return [`${child}: falta en en`];
      if (key === 'id' && es[key] !== en[key]) return [`${child}: el id no coincide`];
      return differences(es[key], en[key], child);
    });
  }
  if (typeof es === 'string' && typeof en === 'string') {
    return es.trim() && en.trim() ? [] : [`${where}: texto vacío`];
  }
  return es === en ? [] : [`${where}: ${String(es)} en es y ${String(en)} en en`];
}

const files = yamlFiles(DATA_DIR);

describe('textos del laboratorio', () => {
  it('hay archivos que revisar', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} dice lo mismo en español y en inglés`, () => {
      const data: unknown = parse(readFileSync(file, 'utf8'));
      expect(isRecord(data)).toBe(true);
      if (!isRecord(data)) return;
      // `shared` guarda la estructura que no se traduce (posiciones, conexiones, archivos).
      const languages = Object.keys(data).filter((key) => key !== 'shared');
      expect(languages.sort()).toEqual(['en', 'es']);
      expect(differences(data['es'], data['en'])).toEqual([]);
    });
  }
});

describe('differences', () => {
  it('encuentra claves que faltan, listas de otro largo y textos vacíos', () => {
    const es = { title: 'Hola', demos: [{ id: 'a' }], extra: 'x' };
    const en = { title: ' ', demos: [{ id: 'a' }, { id: 'b' }] };
    expect(differences(es, en)).toEqual([
      'demos: 1 elementos en es y 2 en en',
      'extra: falta en en',
      'title: texto vacío',
    ]);
  });

  it('compara ids y banderas dentro de las listas', () => {
    const es = { demos: [{ id: 'a', ready: true }] };
    const en = { demos: [{ id: 'b', ready: false }] };
    expect(differences(es, en)).toEqual([
      'demos[0].id: el id no coincide',
      'demos[0].ready: true en es y false en en',
    ]);
  });
});
