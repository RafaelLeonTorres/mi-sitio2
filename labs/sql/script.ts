// El SQL de un lado tal como se copiaría a SSMS para probarlo: cada sentencia con un DECLARE por
// parámetro, con el valor que usa la demo, y GO entre sentencias, porque la siguiente vuelve a
// declarar el mismo @p.

import type { QueryRun, Statement } from './scenario';

const DATE = /^'\d{4}-\d{2}-\d{2}/;

/** DECLARE @Skip int = 199980; las fechas van como datetime2(0), el tipo de OrderDate. */
export function declaration(name: string, value: string | number): string {
  const type =
    typeof value === 'number' ? 'int' : DATE.test(value) ? 'datetime2(0)' : 'nvarchar(4000)';
  return `DECLARE @${name} ${type} = ${value};`;
}

/** Una sentencia con los DECLARE de sus parámetros arriba. */
export function statementScript(statement: Statement): string {
  const declares = Object.entries(statement.params ?? {}).map(([name, value]) =>
    declaration(name, value),
  );
  return [...declares, statement.sql].join('\n');
}

/** Todas las sentencias de un lado, separadas por GO. */
export function script(run: QueryRun): string {
  return run.statements.map(statementScript).join('\nGO\n');
}
