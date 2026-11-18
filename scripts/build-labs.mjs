// @ts-check
// Compila cada demo del laboratorio (labs/<demo>/main.ts) a assets/js/labs/<demo>.js con esbuild.
//
//   node scripts/build-labs.mjs          compila para publicar y revisa el presupuesto de tamaño
//   node scripts/build-labs.mjs --watch  recompila al guardar, para trabajar en local

import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import * as esbuild from 'esbuild';
import { BUDGET_BYTES, demoSizes, overBudget } from './budget.mjs';

const SOURCE_DIR = 'labs';
const OUT_DIR = 'assets/js/labs';
const watch = process.argv.includes('--watch');

const entryPoints = findDemos();
if (entryPoints.length === 0) {
  console.log(`No hay demos que compilar todavía (se buscan en ${SOURCE_DIR}/<demo>/main.ts).`);
  process.exit(0);
}

rmSync(OUT_DIR, { recursive: true, force: true });

/** @type {esbuild.BuildOptions} */
const options = {
  entryPoints,
  outdir: OUT_DIR,
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2022',
  minify: !watch,
  sourcemap: true,
  chunkNames: 'chunks/[name]-[hash]',
  legalComments: 'none',
  metafile: true,
  logLevel: 'info',
};

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  const { metafile } = await esbuild.build(options);
  if (!metafile) throw new Error('esbuild no devolvió el metafile.');
  const sources = entryPoints.map((entry) => entry.in);
  const sizes = demoSizes(metafile.outputs, sources, (file) => gzipSync(readFileSync(file)).length);
  for (const { name, bytes } of sizes) console.log(`${name}: ${kb(bytes)} comprimido`);
  const heavy = overBudget(sizes);
  for (const { name, bytes } of heavy) {
    console.error(`${name} pasa del presupuesto: ${kb(bytes)} de ${kb(BUDGET_BYTES)}.`);
  }
  if (heavy.length > 0) process.exit(1);
}

/**
 * Cada carpeta de labs/ que tiene un main.ts es una demo. Las rutas van con "/" también en
 * Windows, igual que en el metafile de esbuild.
 */
function findDemos() {
  if (!existsSync(SOURCE_DIR)) return [];
  return readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((dir) => dir.isDirectory() && existsSync(`${SOURCE_DIR}/${dir.name}/main.ts`))
    .map((dir) => ({ in: `${SOURCE_DIR}/${dir.name}/main.ts`, out: dir.name }));
}

/** @param {number} bytes */
function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}
