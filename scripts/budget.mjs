// @ts-check
// Presupuesto de tamaño del laboratorio: cuánto descarga cada demo al abrir su página.
// Cuenta el archivo de la demo y los chunks compartidos que importa al cargar, comprimidos con
// gzip. Lo que se importa con import() no cuenta, porque se descarga después y solo si hace falta.

/** Límite por demo: 30 kB comprimidos. */
export const BUDGET_BYTES = 30 * 1024;

/**
 * Lo que este cálculo necesita de cada salida en `metafile.outputs` de esbuild.
 * @typedef {object} Output
 * @property {string} [entryPoint]
 * @property {{ path: string, kind: string, external?: boolean }[]} imports
 */

/**
 * Peso de una demo al cargar.
 * @typedef {{ name: string, files: string[], bytes: number }} DemoSize
 */

/**
 * Calcula el peso de cada demo: su archivo de entrada y todo lo que importa de forma estática.
 * esbuild también marca como entrada lo que se carga con import(), así que las demos se
 * reconocen por su archivo de origen.
 * @param {Record<string, Output>} outputs `metafile.outputs` de esbuild.
 * @param {string[]} entries Archivo de origen de cada demo, como en esbuild (`labs/sql/main.ts`).
 * @param {(file: string) => number} sizeOf Tamaño comprimido de un archivo de salida.
 * @returns {DemoSize[]} Ordenadas por nombre.
 */
export function demoSizes(outputs, entries, sizeOf) {
  return Object.entries(outputs)
    .filter(([file, output]) => file.endsWith('.js') && entries.includes(output.entryPoint ?? ''))
    .map(([file]) => {
      const files = staticImports(outputs, file);
      return {
        name: file.replace(/^.*[\\/]/, '').replace(/\.js$/, ''),
        files,
        bytes: files.reduce((total, path) => total + sizeOf(path), 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Las demos que pasan del límite.
 * @param {DemoSize[]} sizes
 * @param {number} [limit]
 * @returns {DemoSize[]}
 */
export function overBudget(sizes, limit = BUDGET_BYTES) {
  return sizes.filter((size) => size.bytes > limit);
}

/**
 * El archivo y, sin repetir, los chunks que importa de forma estática, directa o indirectamente.
 * @param {Record<string, Output>} outputs
 * @param {string} entry
 * @returns {string[]}
 */
function staticImports(outputs, entry) {
  const found = new Set([entry]);
  const pending = [entry];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    for (const { path, kind, external } of outputs[file]?.imports ?? []) {
      if (kind === 'import-statement' && !external && !found.has(path)) {
        found.add(path);
        pending.push(path);
      }
    }
  }
  return [...found];
}
