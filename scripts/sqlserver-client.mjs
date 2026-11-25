// @ts-check
// El cliente de Node del ejecutor de T-SQL (dotnet/sqlserver/Runner): corre scripts en un SQL Server de
// verdad y devuelve lo que SSMS mostraría. Lo usan scripts/sqlserver-capture.mjs (las salidas
// capturadas) y scripts/sqlserver-lessons.test.ts (las soluciones y los ejemplos de las lecciones).
//
// La conexión sale de la variable de entorno MSSQL_CONNECTION, una cadena de conexión de SqlClient:
//   - el SQL Server local con la autenticación de Windows:
//       Server=localhost;Integrated Security=true;TrustServerCertificate=true
//   - un contenedor, con usuario y contraseña:
//       Server=localhost,1433;User Id=sa;Password=...;TrustServerCertificate=true
// Sin esa variable no hay servidor: las pruebas se omiten con un aviso y el script de capturas se detiene.
// Cada corrida crea su propia base temporal, con la intercalación SQL_Latin1_General_CP1_CI_AS (la de
// referencia del curso, y no la del servidor de quien lo corra), y la borra al terminar; nunca toca
// otra base.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** La intercalación de la base temporal: la de referencia del curso. */
export const COLLATION = 'SQL_Latin1_General_CP1_CI_AS';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = 'dotnet/sqlserver/Runner';

/**
 * @typedef {{ number: number, level: number, state: number, line: number, text: string }} Message
 * @typedef {{ columns: string[], rows: unknown[][] }} ResultSet
 * @typedef {{ results: ResultSet[], messages: Message[] }} BatchOutput
 * @typedef {{ id: string, batches: BatchOutput[] }} RunOutput
 * @typedef {{ server: string, collation: string, runs: RunOutput[] }} Response
 */

/**
 * La cadena de conexión de MSSQL_CONNECTION, si hay una.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | undefined}
 */
export function connectionString(env = process.env) {
  const value = env['MSSQL_CONNECTION']?.trim();
  return value ? value : undefined;
}

/**
 * Parte un script en lotes por las líneas que solo dicen GO, como SSMS: cada lote empieza en la línea
 * que sigue al GO (sus números de línea cuentan desde ahí) y los lotes vacíos no cuentan.
 * @param {string} script
 * @returns {string[]}
 */
export function splitBatches(script) {
  /** @type {string[]} */
  const batches = [];
  /** @type {string[]} */
  let current = [];
  for (const line of script.replaceAll('\r\n', '\n').split('\n')) {
    if (/^\s*GO\s*$/i.test(line)) {
      batches.push(current.join('\n'));
      current = [];
    } else current.push(line);
  }
  batches.push(current.join('\n'));
  return batches.filter((batch) => batch.trim() !== '');
}

/**
 * Corre cada script en su propia base temporal y devuelve, por lote, los resultados y los mensajes.
 * @param {{ id: string, script: string | string[] }[]} runs un script (se parte por GO) o sus lotes
 * @param {{ connection?: string, collation?: string }} [options]
 * @returns {Response}
 */
export function runScripts(runs, options = {}) {
  const connection = options.connection ?? connectionString();
  if (!connection)
    throw new Error(
      'Falta MSSQL_CONNECTION: la cadena de conexión del SQL Server donde correr los scripts.',
    );
  const dir = mkdtempSync(join(tmpdir(), 'sqlserver-'));
  try {
    const input = join(dir, 'pedido.json');
    const output = join(dir, 'respuesta.json');
    const request = {
      connection,
      collation: options.collation ?? COLLATION,
      runs: runs.map((run) => ({
        id: run.id,
        batches: Array.isArray(run.script) ? run.script : splitBatches(run.script),
      })),
    };
    // La conexión puede llevar una contraseña: va en un archivo temporal, no en la línea de comandos.
    writeFileSync(input, JSON.stringify(request));
    const result = spawnSync(
      'dotnet',
      [
        'run',
        '--project',
        RUNNER,
        '-c',
        'Release',
        '--nologo',
        '-v',
        'q',
        '--',
        '--in',
        input,
        '--out',
        output,
      ],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    if (result.status !== 0)
      throw new Error(
        `El ejecutor de T-SQL falló (${result.status ?? result.error?.message}):\n${result.stderr}${result.stdout}`.trim(),
      );
    return JSON.parse(readFileSync(output, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
