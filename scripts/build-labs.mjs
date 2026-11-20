// @ts-check
// Compila cada demo del laboratorio (labs/<demo>/main.ts) a assets/js/labs/<demo>.js con esbuild,
// y los workers (los motores de SQL y de C# de los retos) a assets/js/labs/<nombre>.js. También copia los
// archivos de PGlite a assets/labs/pglite/, comprimidos con gzip: GitHub Pages no comprime los
// .wasm ni los .data, y el worker los descomprime.
//
//   node scripts/build-labs.mjs          compila para publicar y revisa el presupuesto de tamaño
//   node scripts/build-labs.mjs --watch  recompila al guardar, para trabajar en local

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { gzipSync } from 'node:zlib';
import * as esbuild from 'esbuild';
import {
  BUDGET_BYTES,
  ENGINE_BUDGET_BYTES,
  EXTRA_BUDGETS,
  demoSizes,
  extraSizes,
  overBudget,
} from './budget.mjs';

const SOURCE_DIR = 'labs';
const OUT_DIR = 'assets/js/labs';
const watch = process.argv.includes('--watch');

/** Los workers: cada uno es su propio archivo, que la página carga con new Worker(). */
const WORKERS = [
  { in: 'labs/challenges/sql/worker.ts', out: 'challenges-worker' },
  { in: 'labs/challenges/csharp/worker.ts', out: 'challenges-csharp-worker' },
];

/** Lo que PGlite importa solo cuando corre en Node; en el navegador nunca se carga. */
const NODE_ONLY = [
  'fs',
  'fs/promises',
  'path',
  'url',
  'util',
  'zlib',
  'stream',
  'stream/promises',
  'crypto',
  'module',
  'ws',
  'node:*',
];

const ENGINE_SOURCE = 'node_modules/@electric-sql/pglite/dist';
const ENGINE_DIR = 'assets/labs/pglite';
const ENGINE_FILES = ['pglite.wasm', 'pglite.data', 'initdb.wasm'];

const entryPoints = [...findDemos(), ...WORKERS.filter((worker) => existsSync(worker.in))];
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
  external: NODE_ONLY,
  metafile: true,
  logLevel: 'info',
};

const engineBytes = copyEngine();

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  const { metafile } = await esbuild.build(options);
  if (!metafile) throw new Error('esbuild no devolvió el metafile.');
  const sources = entryPoints.map((entry) => entry.in);
  const sizes = demoSizes(metafile.outputs, sources, (file) => gzipSync(readFileSync(file)).length);
  for (const { name, bytes } of sizes) console.log(`${name}: ${kb(bytes)} comprimido`);
  const demos = sizes.filter((size) => findDemos().some((demo) => demo.out === size.name));
  const heavy = overBudget(demos);
  for (const { name, bytes } of heavy) {
    console.error(`${name} pasa del presupuesto: ${kb(bytes)} de ${kb(BUDGET_BYTES)}.`);
  }
  const extras = extraSizes(
    metafile.outputs,
    EXTRA_BUDGETS,
    (file) => gzipSync(readFileSync(file)).length,
  );
  const heavyExtras = extras.filter((size) => size.bytes > size.limit);
  for (const { name, bytes, limit } of extras) {
    if (!sizes.some((size) => size.name === name))
      console.log(`${name}: ${kb(bytes)} comprimido (se descarga aparte)`);
    if (bytes > limit)
      console.error(`${name} pasa de su presupuesto: ${kb(bytes)} de ${kb(limit)}.`);
  }
  if (engineBytes > 0)
    console.log(`PGlite (${ENGINE_FILES.join(', ')}): ${kb(engineBytes)} comprimido`);
  const heavyEngine = engineBytes > ENGINE_BUDGET_BYTES;
  if (heavyEngine)
    console.error(
      `PGlite pasa de su presupuesto: ${kb(engineBytes)} de ${kb(ENGINE_BUDGET_BYTES)}.`,
    );
  if (heavy.length > 0 || heavyExtras.length > 0 || heavyEngine) process.exit(1);
}

/**
 * Copia los archivos de PGlite comprimidos con gzip, si no están o cambiaron. Devuelve lo que
 * pesan comprimidos; 0 si PGlite no está instalado.
 */
function copyEngine() {
  if (!existsSync(ENGINE_SOURCE)) return 0;
  mkdirSync(ENGINE_DIR, { recursive: true });
  let total = 0;
  for (const name of ENGINE_FILES) {
    const source = `${ENGINE_SOURCE}/${name}`;
    const target = `${ENGINE_DIR}/${name}.gz`;
    if (!existsSync(target) || statSync(target).mtimeMs < statSync(source).mtimeMs) {
      writeFileSync(target, gzipSync(readFileSync(source), { level: 9 }));
    }
    total += statSync(target).size;
  }
  return total;
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
