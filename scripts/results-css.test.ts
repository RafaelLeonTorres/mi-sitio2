import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// results.css es una copia de las reglas de los resultados que están en labs.css: los retos las
// cargan dentro de labs.css, y las lecciones de SQL (que no cargan labs.css) desde results.css. Si una
// regla cambia en un archivo y no en el otro, los resultados se verían distintos en un reto y en una
// lección.

const labs = readFileSync('assets/css/labs.css', 'utf8');
const results = readFileSync('assets/css/results.css', 'utf8');

/** Lo copiado: desde las tablas hasta antes de lo propio de las lecciones. */
const copied = results.slice(
  results.indexOf('/* Tablas de datos y resultados */'),
  results.indexOf('/* En una lección'),
);

describe('results.css', () => {
  it('copia las reglas de los resultados de labs.css', () => {
    expect(copied.length).toBeGreaterThan(1000);
    const known = new Set(labs.split('\n').map((line) => line.trim()));
    const missing = copied
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !known.has(line));
    expect(missing).toEqual([]);
  });

  it('trae las reglas que dibujan una tabla, el veredicto, un caso y un error', () => {
    for (const selector of ['.ch-table', '.ch-verdict', '.ch-case', '.ch-error', '.ch-notes'])
      expect(copied).toContain(selector);
  });

  it('define el color de los errores, que en labs.css sale del inicio del archivo', () => {
    expect(results).toContain(':root { --bad:');
    expect(results).toContain(':root[data-theme="dark"] { --bad:');
    expect(labs).toContain(':root { --bad:');
  });
});
