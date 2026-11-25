// @ts-check
// Graba las salidas de los pasos capturados del curso de SQL Server: corre el `script` de cada paso
// (`kind: captured`) en un SQL Server de verdad y guarda lo que SSMS mostraría (los resultados de cada
// lote y sus mensajes: PRINT y errores) en el `captured` del paso, con la versión del servidor y la
// fecha. La conexión es la de MSSQL_CONNECTION (scripts/sqlserver-client.mjs); la base es temporal y
// con la intercalación de referencia del curso.
//
//   node scripts/sqlserver-capture.mjs                       graba todos los pasos y escribe lo que cambió
//   node scripts/sqlserver-capture.mjs --check               vuelve a correrlos y compara, sin escribir
//   node scripts/sqlserver-capture.mjs --lesson modulo/leccion   solo los pasos de una lección
//   node scripts/sqlserver-capture.mjs --force               reescribe aunque la salida no haya cambiado
//
// Lo que se compara (y lo que se reescribe) son los resultados y los mensajes: la versión del servidor
// y la fecha no cuentan, así que un servidor más nuevo que da lo mismo no obliga a tocar nada. Un
// script capturado tiene que dar siempre lo mismo: sin GETDATE(), NEWID() ni nada que cambie.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'yaml';
import { modules } from './course-pages.mjs';
import { connectionString, runScripts } from './sqlserver-client.mjs';

export const COURSE = 'sqlserver';

/**
 * Lo que guarda un paso capturado: un PRINT (o un mensaje de gravedad 10 o menos) es solo su texto, y
 * un error trae además su número, su gravedad, su estado y su línea.
 * @typedef {{ number?: number, level?: number, state?: number, line?: number, text: string }} CapturedMessage
 * @typedef {{ columns: string[], rows: unknown[][] }} CapturedResult
 * @typedef {{ results: CapturedResult[], messages: CapturedMessage[] }} CapturedBatch
 * @typedef {{ server: string, date: string, batches: CapturedBatch[] }} Captured
 * @typedef {{ key: string, file: string, module: string, lesson: string, id: string, script: string, captured?: Captured }} CapturedStep
 */

/**
 * Los pasos capturados de un curso, con el archivo de su lección.
 * @param {string} [root]
 * @param {string} [course]
 * @returns {CapturedStep[]}
 */
export function capturedSteps(root = '.', course = COURSE) {
  /** @type {CapturedStep[]} */
  const steps = [];
  for (const module of modules(root, course)) {
    for (const lesson of module.lessons) {
      const file = join(root, `_data/course/${course}/${module.id}/${lesson}.yml`);
      const data = parse(readFileSync(file, 'utf8'));
      for (const step of data.shared.steps) {
        if (step.kind !== 'captured') continue;
        steps.push({
          key: `${module.id}/${lesson}/${step.id}`,
          file,
          module: module.id,
          lesson,
          id: step.id,
          script: step.script,
          captured: step.captured,
        });
      }
    }
  }
  return steps;
}

/**
 * Los mensajes de un lote como se guardan: los de gravedad 10 o menos (PRINT, "The statement has been
 * terminated.", avisos) son texto plano, como los muestra SSMS, y los errores llevan su encabezado.
 * @param {import('./sqlserver-client.mjs').Message[]} messages
 * @returns {CapturedMessage[]}
 */
export function toMessages(messages) {
  return messages.map((message) =>
    message.level > 10
      ? {
          number: message.number,
          level: message.level,
          state: message.state,
          line: message.line,
          text: message.text,
        }
      : { text: message.text },
  );
}

/**
 * Lo que devolvió el servidor en una corrida, listo para guardarlo en el paso.
 * @param {string} server la versión del servidor (`16.0.1000.6`)
 * @param {import('./sqlserver-client.mjs').RunOutput} run
 * @param {string} date `AAAA-MM-DD`
 * @returns {Captured}
 */
export function toCaptured(server, run, date) {
  return {
    server,
    date,
    batches: run.batches.map((batch) => ({
      results: batch.results.map(({ columns, rows }) => ({ columns, rows })),
      messages: toMessages(batch.messages),
    })),
  };
}

/**
 * Lo que de una captura depende del código y no de la corrida: los resultados y los mensajes. La versión
 * del servidor y la fecha no cuentan.
 * @param {Captured | undefined} captured
 */
export function comparable(captured) {
  return captured ? JSON.parse(JSON.stringify(captured.batches)) : undefined;
}

/**
 * Si dos capturas dicen lo mismo.
 * @param {Captured | undefined} stored
 * @param {Captured | undefined} fresh
 */
export function sameOutput(stored, fresh) {
  return isDeepStrictEqual(comparable(stored), comparable(fresh));
}

/** Un nombre de columna sin comillas si YAML lo lee como texto. */
const name = (/** @type {string} */ column) =>
  /^[A-Za-z_]\w*$/.test(column) && !/^(true|false|null|yes|no|on|off|y|n)$/i.test(column)
    ? column
    : JSON.stringify(column);

/** Un valor de una celda: los números como números y todo lo demás entre comillas. */
const value = (/** @type {unknown} */ cell) =>
  cell === null || cell === undefined
    ? 'null'
    : typeof cell === 'number'
      ? String(cell)
      : JSON.stringify(String(cell));

/**
 * El YAML del bloque `captured` de un paso, con la sangría que trae dentro de `shared.steps`.
 * @param {Captured} captured
 * @param {number} [indent]
 * @returns {string[]}
 */
export function captureYaml(captured, indent = 6) {
  const pad = (/** @type {number} */ extra) => ' '.repeat(indent + extra);
  const lines = [
    `${pad(0)}captured:`,
    `${pad(2)}server: ${JSON.stringify(captured.server)}`,
    `${pad(2)}date: ${JSON.stringify(captured.date)}`,
    `${pad(2)}batches:`,
  ];
  for (const batch of captured.batches) {
    lines.push(batch.results.length === 0 ? `${pad(4)}- results: []` : `${pad(4)}- results:`);
    for (const result of batch.results) {
      lines.push(`${pad(8)}- columns: [${result.columns.map(name).join(', ')}]`);
      if (result.rows.length === 0) lines.push(`${pad(10)}rows: []`);
      else {
        lines.push(`${pad(10)}rows:`);
        for (const row of result.rows) lines.push(`${pad(12)}- [${row.map(value).join(', ')}]`);
      }
    }
    // La clave `messages` va a la altura de `results`: debajo del guion del lote.
    if (batch.messages.length === 0) lines.push(`${pad(6)}messages: []`);
    else {
      lines.push(`${pad(6)}messages:`);
      for (const message of batch.messages) {
        const parts =
          message.number === undefined
            ? [`text: ${JSON.stringify(message.text)}`]
            : [
                `number: ${message.number}`,
                `level: ${message.level}`,
                `state: ${message.state}`,
                `line: ${message.line}`,
                `text: ${JSON.stringify(message.text)}`,
              ];
        lines.push(`${pad(8)}- { ${parts.join(', ')} }`);
      }
    }
  }
  return lines;
}

/**
 * El texto de una lección con el bloque `captured` de un paso reemplazado, o agregado al final del paso
 * si todavía no lo tiene. Todo lo demás del archivo queda tal cual.
 * @param {string} text el YAML de la lección
 * @param {string} stepId
 * @param {string[]} block las líneas de captureYaml
 * @returns {string}
 */
export function replaceCaptured(text, stepId, block) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === `    - id: ${stepId}`);
  if (start < 0) throw new Error(`No hay un paso ${stepId} en la lección.`);
  // El paso termina en el siguiente paso o en la siguiente clave de primer nivel (`es:`).
  let end = lines.findIndex((line, i) => i > start && /^(    - id: |\S)/.test(line));
  if (end < 0) end = lines.length;
  const existing = lines.findIndex((line, i) => i > start && i < end && line === '      captured:');
  if (existing >= 0) {
    let last = existing + 1;
    while (last < end && (lines[last] === '' || /^ {8}/.test(lines[last] ?? ''))) last++;
    // Lo que sigue al bloque (líneas en blanco antes del siguiente paso) se queda donde estaba.
    while (last > existing + 1 && lines[last - 1] === '') last--;
    lines.splice(existing, last - existing, ...block);
  } else {
    let insertAt = end;
    while (insertAt > start + 1 && lines[insertAt - 1] === '') insertAt--;
    lines.splice(insertAt, 0, ...block);
  }
  return lines.join('\n');
}

/** La fecha de hoy, `AAAA-MM-DD`, en la hora de esta máquina. */
export const today = () => new Date().toLocaleDateString('sv-SE');

/**
 * Corre los pasos y compara o escribe sus capturas.
 * @param {{ check?: boolean, force?: boolean, lesson?: string }} options
 * @param {string} [root]
 * @returns {{ ok: boolean, lines: string[] }}
 */
export function capture(options, root = '.') {
  const steps = capturedSteps(root).filter(
    (step) => !options.lesson || `${step.module}/${step.lesson}` === options.lesson,
  );
  if (steps.length === 0) return { ok: false, lines: ['No hay pasos capturados que correr.'] };
  const response = runScripts(steps.map((step) => ({ id: step.key, script: step.script })));
  /** @type {string[]} */
  const lines = [`SQL Server ${response.server}, intercalación ${response.collation}`];
  let ok = true;
  /** @type {Map<string, string>} */
  const files = new Map();
  for (const step of steps) {
    const run = response.runs.find((item) => item.id === step.key);
    if (!run) throw new Error(`El servidor no devolvió el paso ${step.key}.`);
    const fresh = toCaptured(response.server, run, today());
    const same = sameOutput(step.captured, fresh);
    if (options.check) {
      lines.push(`${same ? '✓' : '✗'} ${step.key}`);
      if (!same) ok = false;
      if (same && step.captured && step.captured.server !== response.server)
        lines.push(`  (capturado con ${step.captured.server}; el servidor es ${response.server})`);
      continue;
    }
    if (same && !options.force) {
      lines.push(`= ${step.key} (sin cambios)`);
      continue;
    }
    const current = files.get(step.file) ?? readFileSync(step.file, 'utf8');
    files.set(step.file, replaceCaptured(current, step.id, captureYaml(fresh)));
    lines.push(`${step.captured ? '↻' : '+'} ${step.key}`);
  }
  for (const [file, text] of files) writeFileSync(file, text);
  return { ok, lines };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const lessonAt = args.indexOf('--lesson');
  if (!connectionString()) {
    console.error(
      'Falta MSSQL_CONNECTION: la cadena de conexión del SQL Server donde correr los scripts.\n' +
        'Con el SQL Server local y la autenticación de Windows:\n' +
        '  $env:MSSQL_CONNECTION = "Server=localhost;Integrated Security=true;TrustServerCertificate=true"',
    );
    process.exit(2);
  }
  const { ok, lines } = capture({
    check: args.includes('--check'),
    force: args.includes('--force'),
    ...(lessonAt >= 0 && args[lessonAt + 1] ? { lesson: args[lessonAt + 1] } : {}),
  });
  console.log(lines.join('\n'));
  process.exit(ok ? 0 : 1);
}
