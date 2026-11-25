// @ts-check
// Espera a que un SQL Server acepte conexiones, por ejemplo el de un contenedor que acaba de arrancar
// (tarda unos 20 segundos y antes rechaza los inicios de sesión): corre `SELECT 1` con el ejecutor de
// T-SQL hasta que responde o se acaba el tiempo. Usa MSSQL_CONNECTION, como lo demás.
//
//   node scripts/sqlserver-wait.mjs [segundos]     (por omisión, 120)

import { fileURLToPath } from 'node:url';
import { connectionString, runScripts } from './sqlserver-client.mjs';

/**
 * Intenta conectar cada pocos segundos hasta que el servidor responde o se acaba el tiempo.
 * @param {{ seconds: number, pause?: number, attempt?: () => string, log?: (line: string) => void }} options
 * @returns {Promise<{ ok: boolean, server?: string, error?: string }>}
 */
export async function waitForServer({
  seconds,
  pause = 3,
  attempt = () => runScripts([{ id: 'espera', script: 'SELECT 1;' }]).server,
  log = () => undefined,
}) {
  const deadline = Date.now() + seconds * 1000;
  let error = '';
  for (let tries = 1; ; tries++) {
    try {
      return { ok: true, server: attempt() };
    } catch (caught) {
      // Solo la primera línea: el resto del aviso de dotnet no ayuda a saber si ya arrancó.
      error = String(caught instanceof Error ? caught.message : caught).split('\n')[0] ?? '';
      log(`Intento ${tries}: todavía no responde (${error})`);
    }
    if (Date.now() + pause * 1000 > deadline) return { ok: false, error };
    await new Promise((resolve) => setTimeout(resolve, pause * 1000));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!connectionString()) {
    console.error('Falta MSSQL_CONNECTION: la cadena de conexión del SQL Server que se espera.');
    process.exit(2);
  }
  const seconds = Number(process.argv[2] ?? 120);
  const result = await waitForServer({ seconds, log: (line) => console.log(line) });
  if (result.ok) console.log(`SQL Server ${result.server} responde.`);
  else console.error(`SQL Server no respondió en ${seconds} s: ${result.error}`);
  process.exit(result.ok ? 0 : 1);
}
