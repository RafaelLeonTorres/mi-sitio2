// @ts-check
// Publica el motor de C# de los retos (dotnet/challenges/Engine: .NET en WebAssembly con Roslyn) y
// lo copia a assets/labs/csharp/, que el worker carga. Los módulos de JavaScript van tal cual,
// porque GitHub Pages los comprime; lo demás (el runtime en WebAssembly y los ensamblados) va en
// gzip, porque esos no los comprime, y el worker los descomprime. Necesita el SDK de .NET 11.
//
//   node scripts/csharp-engine.mjs         publica con dotnet publish y copia
//   node scripts/csharp-engine.mjs --copy  solo copia lo que ya está publicado

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { CSHARP_ENGINE_BUDGET_BYTES } from './budget.mjs';

const PROJECT = 'dotnet/challenges/Engine';
const PUBLISHED = 'dotnet/challenges/out/engine';
const TARGET = 'assets/labs/csharp';

if (!process.argv.includes('--copy')) {
  execFileSync('dotnet', ['publish', PROJECT, '-c', 'Release', '-o', PUBLISHED], {
    stdio: 'inherit',
  });
}

const framework = [join(PUBLISHED, 'wwwroot', '_framework'), join(PUBLISHED, '_framework')].find(
  (folder) => existsSync(folder),
);
if (!framework) throw new Error(`No encontré la carpeta _framework en ${PUBLISHED}.`);

rmSync(TARGET, { recursive: true, force: true });
mkdirSync(TARGET, { recursive: true });
let files = 0;
let total = 0;
for (const name of readdirSync(framework).sort()) {
  const source = join(framework, name);
  // dotnet publish deja sus propias copias comprimidas; aquí se comprime todo igual.
  if (name.endsWith('.gz') || name.endsWith('.br') || !statSync(source).isFile()) continue;
  const bytes = readFileSync(source);
  files++;
  if (/\.m?js$/.test(name)) {
    writeFileSync(join(TARGET, name), bytes);
    total += gzipSync(bytes).length;
    continue;
  }
  const compressed = gzipSync(bytes, { level: 9 });
  writeFileSync(join(TARGET, `${name}.gz`), compressed);
  total += compressed.length;
  // Los JSON también van sin comprimir, por si dotnet.js los pide sin pasar por el worker.
  if (name.endsWith('.json')) writeFileSync(join(TARGET, name), bytes);
}

const kb = (/** @type {number} */ bytes) => `${(bytes / 1024).toFixed(1)} kB`;
console.log(`Motor de C# en ${TARGET}: ${files} archivos, ${kb(total)} comprimido`);
if (total > CSHARP_ENGINE_BUDGET_BYTES) {
  console.error(
    `El motor de C# pasa de su presupuesto: ${kb(total)} de ${kb(CSHARP_ENGINE_BUDGET_BYTES)}.`,
  );
  process.exit(1);
}
