// Las listas de columnas largas, como las que genera EF Core, partidas en renglones para que la
// consulta se lea sin desplazarse de lado. SQL Server ignora los saltos de línea.

/** Cuántos caracteres caben en un renglón del bloque de código, en una de las dos columnas. */
export const SQL_WIDTH = 60;
const INDENT = '    ';

/**
 * `head` y las columnas separadas por comas, en renglones de hasta `width` caracteres. Los que
 * siguen al primero llevan sangría: `SELECT TOP(@p) [o].[Id], …` y debajo `    [o].[Total]`.
 */
export function selectList(
  head: string,
  columns: readonly string[],
  width: number = SQL_WIDTH,
): string {
  const lines: string[] = [];
  let line = head;
  columns.forEach((column, index) => {
    const piece = index < columns.length - 1 ? `${column},` : column;
    const candidate = `${line} ${piece}`;
    if (index === 0 || candidate.length <= width) {
      line = candidate;
      return;
    }
    lines.push(line);
    line = `${INDENT}${piece}`;
  });
  lines.push(line);
  return lines.join('\n');
}
