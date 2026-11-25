// Una traducción mínima de T-SQL a PostgreSQL, para que el código de SQL Server corra en PGlite
// sin reescribirse: la parte de fecha de DATEADD(day, …) va entre comillas, [Nombre] pasa a
// "nombre", los tipos de SQL Server cambian por los de PostgreSQL, TOP pasa a FETCH FIRST y lo que
// no existe allá (variables con @, TRY…CATCH, procedimientos) se detiene con un mensaje que dice
// cómo escribirlo. Solo toca el código: nada dentro de cadenas ni comentarios, y nunca agrega ni
// quita renglones, para que la línea de un error de PostgreSQL sea la misma que ve el visitante.

/** Lo que se tradujo, para explicarlo debajo del resultado. */
export type NoteKey =
  | 'go'
  | 'brackets'
  | 'date-part'
  | 'types'
  | 'nonclustered'
  | 'clustered'
  | 'tran'
  | 'identity'
  | 'hints'
  | 'string-agg'
  | 'by-target'
  | 'merge'
  | 'set-option'
  | 'temp-table'
  | 'set-alias'
  | 'convert'
  | 'convert-style'
  | 'try-cast'
  | 'top'
  | 'output'
  | 'update-join'
  | 'delete-join'
  | 'recursive'
  | 'option'
  | 'apply';

/** Lo que PostgreSQL no puede correr, con su mensaje en challenge-ui.yml. */
export type BlockKey =
  | 'top'
  | 'variable'
  | 'try-catch'
  | 'procedure'
  | 'control-flow'
  | 'output'
  | 'print'
  | 'update-join'
  | 'delete-join'
  | 'cte-target'
  | 'convert-style';

export interface Blocked {
  readonly key: BlockKey;
  /** El renglón donde aparece la primera vez, desde 1. */
  readonly line: number;
}

export interface Translation {
  readonly sql: string;
  readonly notes: readonly NoteKey[];
  readonly blocked: readonly Blocked[];
}

/** Escribe un trozo del código ya traducido: el texto de `from` a `to` con sus cambios aplicados. */
type Render = (from: number, to: number) => string;

interface Edit {
  readonly start: number;
  readonly end: number;
  /** El texto nuevo; una función recibe `render`, para armarlo con trozos del código traducido. */
  readonly text: string | ((render: Render) => string);
  readonly note: NoteKey;
  /** El cambio mueve el texto que reemplaza a otro lado: se lleva los cambios que caen adentro. */
  readonly consume?: boolean;
  /** El cambio va al final de la sentencia, después de lo que otros cambios agreguen ahí. */
  readonly tail?: boolean;
}

type PlainEdit = Edit & { readonly text: string };

/** Aplica los cambios de atrás para adelante; el que se pisa con otro ya aplicado se descarta. */
function applyEdits(
  source: string,
  edits: readonly PlainEdit[],
): { sql: string; notes: NoteKey[] } {
  let sql = source;
  const applied = new Set<NoteKey>();
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let limit = Number.POSITIVE_INFINITY;
  for (const edit of sorted) {
    if (edit.end > limit) continue;
    // Un cambio que abarca varios renglones deja sus saltos de línea, para no mover los demás.
    const lost = lineAt(source.slice(edit.start, edit.end), Infinity) - lineAt(edit.text, Infinity);
    sql =
      sql.slice(0, edit.start) + edit.text + '\n'.repeat(Math.max(0, lost)) + sql.slice(edit.end);
    limit = edit.start;
    applied.add(edit.note);
  }
  return { sql, notes: [...applied] };
}

/** Si un cambio cae dentro del rango que reemplaza otro; uno que no agrega nada cuenta si termina ahí. */
function isInside(edit: Edit, owner: Edit): boolean {
  return edit.end > edit.start
    ? owner.start <= edit.start && edit.end <= owner.end
    : owner.start < edit.start && edit.start <= owner.end && edit.tail !== true;
}

/**
 * El texto con lo que no es código cambiado por espacios: el interior de las cadenas, de los
 * identificadores entre comillas dobles y de los comentarios. Las comillas y los saltos de línea
 * se quedan, así que cada posición del resultado es la misma del original.
 */
export function codeMask(source: string): string {
  const out = source.split('');
  const blank = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "'" || char === '"') {
      // Una comilla doble ('' o "") dentro de la cadena es la comilla misma.
      let end = i + 1;
      while (end < source.length) {
        if (source[end] === char) {
          if (source[end + 1] === char) end += 2;
          else break;
        } else end++;
      }
      blank(i + 1, end);
      i = end + 1;
    } else if (char === '-' && next === '-') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (char === '/' && next === '*') {
      // Los comentarios de bloque se pueden anidar, en T-SQL y en PostgreSQL.
      let depth = 1;
      let end = i + 2;
      while (end < source.length && depth > 0) {
        if (source[end] === '/' && source[end + 1] === '*') {
          depth++;
          end += 2;
        } else if (source[end] === '*' && source[end + 1] === '/') {
          depth--;
          end += 2;
        } else end++;
      }
      blank(i, end);
      i = end;
    } else i++;
  }
  return out.join('');
}

const IDENTIFIER = /\[([A-Za-z_][A-Za-z0-9_]*)\]/g;
const HINT_WORDS =
  'NOLOCK|READUNCOMMITTED|UPDLOCK|ROWLOCK|HOLDLOCK|READPAST|TABLOCKX?|PAGLOCK|SERIALIZABLE|REPEATABLEREAD|READCOMMITTED';

const TYPES: readonly [RegExp, string][] = [
  [/\bN?VARCHAR\s*\(\s*MAX\s*\)/gi, 'text'],
  [/\bNVARCHAR\b/gi, 'varchar'],
  [/\bNCHAR\b/gi, 'char'],
  [/\b(?:DATETIME2|SMALLDATETIME|DATETIME)\b/gi, 'timestamp'],
  [/\bTINYINT\b/gi, 'smallint'],
  [/\bMONEY\b/gi, 'numeric(19, 4)'],
  [/\bUNIQUEIDENTIFIER\b/gi, 'uuid'],
  [/\bBIT\b/gi, 'smallint'],
];

// El bloqueo de TOP, el de OUTPUT … INTO y los de UPDATE y DELETE no están aquí: dependen de la
// forma de la sentencia, y los decide translate().
const BLOCKS: readonly [RegExp, BlockKey][] = [
  [/(?:^|[^\w@#$])@@?[A-Za-z_]/g, 'variable'],
  [/\bBEGIN\s+(?:TRY|CATCH)\b|\bRAISERROR\b|\bTHROW\b/gi, 'try-catch'],
  [/\b(?:CREATE|ALTER)\s+(?:OR\s+ALTER\s+)?PROC(?:EDURE)?\b|\bEXEC(?:UTE)?\b/gi, 'procedure'],
  [/(?:^|;)\s*(?:IF|WHILE)\b/gi, 'control-flow'],
  [/\bPRINT\b/gi, 'print'],
];

const NAME = '[A-Za-z_][A-Za-z0-9_]*';
const SET_OPTIONS =
  'NOCOUNT|XACT_ABORT|ANSI_NULLS|ANSI_PADDING|ANSI_WARNINGS|ARITHABORT|QUOTED_IDENTIFIER|CONCAT_NULL_YIELDS_NULL';

// Lo que va antes de un SET de UPDATE: `UPDATE Products`, `UPDATE dbo.Products` o, en MERGE, `UPDATE`.
const PART = `(?:${NAME}|\\[\\s*\\]|"\\s*")`;
const UPDATE_SET = new RegExp(`\\bUPDATE(?:\\s+${PART}(?:\\s*\\.\\s*${PART})*)?\\s*$`, 'i');
// Una asignación con alias al principio: `p.Price =`. El grupo 1 es el alias; el 2, el punto.
const ASSIGNED = new RegExp(`^\\s*(${PART})(\\s*\\.\\s*)(?=${PART}\\s*=(?!=))`);
const SET_END = /^(?:FROM|WHERE|WHEN|OUTPUT|OPTION)\b/i;

/** El renglón, desde 1, de una posición del texto. */
export function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

/** El paréntesis que cierra al que abre en `open`, sobre el texto enmascarado. */
function closing(mask: string, open: number): number {
  let depth = 0;
  for (let i = open; i < mask.length; i++) {
    if (mask[i] === '(') depth++;
    else if (mask[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** El paréntesis que abre al que cierra en `close`, hacia atrás. */
function opening(mask: string, close: number): number {
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    if (mask[i] === ')') depth++;
    else if (mask[i] === '(') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Las comas que separan argumentos entre `from` y `to`, sin contar las de paréntesis internos. */
function topCommas(mask: string, from: number, to: number): number[] {
  const out: number[] = [];
  let depth = 0;
  for (let i = from; i < to; i++) {
    if (mask[i] === '(') depth++;
    else if (mask[i] === ')') depth--;
    else if (mask[i] === ',' && depth === 0) out.push(i);
  }
  return out;
}

/** Un tipo de SQL Server con el nombre que tiene en PostgreSQL, como en el resto del código. */
function translateTypes(type: string): string {
  return TYPES.reduce((text, [regex, name]) => text.replace(regex, name), type);
}

/** El texto con lo que está entre paréntesis en blanco (no los paréntesis): su nivel de arriba. */
function topLevel(text: string): string {
  let depth = 0;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? '';
    if (char === ')') depth = Math.max(0, depth - 1);
    out += depth > 0 && char !== '\n' ? ' ' : char;
    if (char === '(') depth++;
  }
  return out;
}

/**
 * Los estilos de CONVERT que se traducen: de fecha a texto (`CONVERT(varchar(10), d, 103)`) y de
 * texto a fecha (`CONVERT(date, '05/03/2024', 103)`). Su formato está en compat.ts.
 */
export const CONVERT_STYLES: readonly number[] = [
  23, 101, 102, 103, 104, 105, 108, 110, 111, 112, 120, 121,
];

// Un tipo escrito con su nombre, y su largo o precisión si los tiene: `date`, `varchar(10)`, `decimal(10, 2)`.
const TYPE_NAME = /^[A-Za-z][A-Za-z0-9_]*(?:\s*\(\s*(?:\d+|MAX)(?:\s*,\s*\d+)?\s*\))?$/i;
const SET_OPERATOR = /\b(?:UNION|INTERSECT|EXCEPT)\b/i;
// Lo que sigue a TOP: el número solo o entre paréntesis (1 y 2), PERCENT (3) y WITH TIES (4).
const TOP_OPERAND =
  /^\s*(?:\(\s*(\d+)\s*\)|(\d+)\b(?!\.))(\s+PERCENT\b)?(\s+WITH\s+TIES\b)?[ \t]*/i;
const OPTION_CLAUSE = /\bOPTION\s*\(/y;
const GO_LINE = /\n[ \t]*GO[ \t]*;?[ \t]*(?=\n|$)/y;

/** Los argumentos de la llamada que abre en `open`: dónde empieza y termina cada uno, sin espacios. */
function callArguments(mask: string, open: number, close: number): (readonly [number, number])[] {
  const bounds = [open, ...topCommas(mask, open + 1, close), close];
  return bounds.slice(0, -1).map((from, index) => {
    let start = from + 1;
    let end = bounds[index + 1] ?? close;
    while (start < end && /\s/.test(mask[start] ?? '')) start++;
    while (end > start && /\s/.test(mask[end - 1] ?? '')) end--;
    return [start, end] as const;
  });
}

/** El último `AS` que no está entre paréntesis, el que separa el valor del tipo en `CAST(x AS tipo)`. */
function lastAs(mask: string, from: number, to: number): number {
  let depth = 0;
  let found = -1;
  for (let i = from; i < to; i++) {
    const char = mask[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0 && /^AS\b/i.test(mask.slice(i, i + 3)) && !/\w/.test(mask[i - 1] ?? ''))
      found = i;
  }
  return found;
}

/** Dónde empieza la consulta que contiene a `from`: después del `;` o del `(` que la abre. */
function queryStart(mask: string, from: number): number {
  let depth = 0;
  for (let i = from - 1; i >= 0; i--) {
    const char = mask[i];
    if (char === ')') depth++;
    else if (char === '(') {
      if (depth === 0) return i + 1;
      depth--;
    } else if (depth === 0 && char === ';') return i + 1;
  }
  return 0;
}

/**
 * Dónde termina la consulta que contiene a `from`: en el `;`, en el `)` que cierra la subconsulta, en
 * una línea `GO`, en `OPTION (…)` o al final del texto.
 */
function queryEnd(mask: string, from: number): number {
  let depth = 0;
  for (let i = from; i < mask.length; i++) {
    const char = mask[i];
    if (char === '(') depth++;
    else if (char === ')') {
      if (depth === 0) return i;
      depth--;
    } else if (depth === 0) {
      GO_LINE.lastIndex = i;
      OPTION_CLAUSE.lastIndex = i;
      if (char === ';') return i;
      if (char === '\n' && GO_LINE.test(mask)) return i;
      if (/\w/.test(char ?? '') && !/\w/.test(mask[i - 1] ?? '') && OPTION_CLAUSE.test(mask))
        return i;
    }
  }
  return mask.length;
}

/** Si un tipo es de texto (`varchar(10)`), de fecha (`date`) o de fecha y hora (`datetime2`). */
function styleTarget(type: string): 'text' | 'date' | 'datetime' | undefined {
  const name = type.replace(/\s*\([\s\S]*$/, '').toLowerCase();
  if (['varchar', 'nvarchar', 'char', 'nchar'].includes(name)) return 'text';
  if (name === 'date') return 'date';
  if (['datetime', 'datetime2', 'smalldatetime'].includes(name)) return 'datetime';
  return undefined;
}

type Range = readonly [number, number];

const range = (from: number, to: number): Range => [from, to];

// Una tabla, con o sin esquema: `Products`, `dbo.Products`, `[Products]` o `#Totales`.
const TABLE_PART = `(?:#{0,2}${NAME}|\\[\\s*\\]|"\\s*")`;
const REFERENCE = `${TABLE_PART}(?:\\s*\\.\\s*${TABLE_PART})*`;
const CTE_HEAD = new RegExp(`^(\\s*)(${PART})\\s*(?:\\(\\s*\\)\\s*)?AS\\s*\\(`, 'i');
const TABLE_ITEM = new RegExp(
  `^(${REFERENCE})(?:(\\s+(?:AS\\s+)?)(${PART}))?(?:\\s+WITH\\s*\\(\\s*\\))?$`,
  'i',
);
const DERIVED_ITEM = new RegExp(`^(\\(\\s*\\)\\s*(?:AS\\s+)?)(${PART})$`, 'i');
// Lo que separa los orígenes de un FROM: la coma (1), un JOIN (2: INNER o CROSS; 3: LEFT, RIGHT o FULL)
// y el ON de su condición (4).
const FROM_BOUNDARY =
  /(,)|\b(?:(INNER|CROSS)\s+|(LEFT|RIGHT|FULL)\s+(?:OUTER\s+)?)?JOIN\b|\b(ON)\b/gi;

/** Un origen de un FROM, de una sentencia: `tabla [AS] alias` o `(subconsulta) [AS] alias`. */
interface FromItem {
  readonly start: number;
  readonly end: number;
  /** Cómo se une al anterior: `inner` y `cross` se pueden pasar al WHERE; `other` es LEFT, RIGHT o FULL. */
  readonly join: 'first' | 'comma' | 'inner' | 'cross' | 'other';
  readonly table?: Range;
  readonly alias?: Range;
  on?: Range;
}

function parseItem(
  top: string,
  start: number,
  end: number,
): Pick<FromItem, 'start' | 'end' | 'table' | 'alias'> | undefined {
  const text = top.slice(start, end);
  const table = TABLE_ITEM.exec(text);
  if (table) {
    const name = (table[1] ?? '').length;
    const at = start + name + (table[2] ?? '').length;
    return {
      start,
      end,
      table: range(start, start + name),
      ...(table[3] ? { alias: range(at, at + table[3].length) } : {}),
    };
  }
  const derived = DERIVED_ITEM.exec(text);
  if (!derived) return undefined;
  const at = start + (derived[1] ?? '').length;
  return { start, end, alias: range(at, at + (derived[2] ?? '').length) };
}

/** Los orígenes del FROM que va de `from` a `to`, o undefined si alguno no se entiende. */
function parseFrom(top: string, from: number, to: number): FromItem[] | undefined {
  const items: FromItem[] = [];
  let cursor = from;
  let expecting: 'item' | 'on' = 'item';
  let join: FromItem['join'] = 'first';
  let failed = false;
  const finish = (end: number) => {
    const raw = top.slice(cursor, end);
    const lead = raw.search(/\S/);
    if (lead === -1) {
      failed ||= expecting === 'item';
      return;
    }
    const start = cursor + lead;
    const stop = cursor + raw.trimEnd().length;
    const previous = items[items.length - 1];
    if (expecting === 'on') {
      if (previous) previous.on = range(start, stop);
      return;
    }
    const item = parseItem(top, start, stop);
    if (item) items.push({ ...item, join });
    else failed = true;
  };
  for (const match of top.slice(from, to).matchAll(FROM_BOUNDARY)) {
    const at = from + match.index;
    finish(at);
    if (match[4]) expecting = 'on';
    else {
      expecting = 'item';
      join = match[1]
        ? 'comma'
        : match[3]
          ? 'other'
          : match[2]?.toUpperCase() === 'CROSS'
            ? 'cross'
            : 'inner';
    }
    cursor = at + match[0].length;
  }
  finish(to);
  return failed || items.length === 0 ? undefined : items;
}

/** El nombre de una tabla o un alias sin corchetes ni comillas, en minúsculas. */
function nameOf(source: string, [from, to]: Range): string {
  return source
    .slice(from, to)
    .replace(/[[\]"\s]/g, '')
    .toLowerCase();
}

/** El último nombre de una referencia con esquema (`dbo.Products` es `Products`). */
function lastPart(text: string, [from, to]: Range): Range {
  const dot = text.slice(from, to).lastIndexOf('.');
  if (dot === -1) return range(from, to);
  let start = from + dot + 1;
  while (/\s/.test(text[start] ?? '')) start++;
  return range(start, to);
}

/** Las sentencias del texto enmascarado, partidas en cada `;`: dónde empieza y dónde termina cada una. */
function statementRanges(mask: string): Range[] {
  const out: Range[] = [];
  let start = 0;
  for (let i = 0; i <= mask.length; i++) {
    if (i < mask.length && mask[i] !== ';') continue;
    out.push(range(start, i));
    start = i + 1;
  }
  return out;
}

/**
 * Las sentencias que se reescriben enteras:
 * - una CTE que se nombra a sí misma: PostgreSQL pide `WITH RECURSIVE`;
 * - `OUTPUT inserted.x, deleted.x`: pasa a `RETURNING new.x, old.x`, al final de la sentencia;
 * - `UPDATE alias SET … FROM … JOIN …`: con INNER y CROSS JOIN, las demás tablas van en el FROM y las
 *   condiciones del ON en el WHERE, y la tabla que se actualiza va en el UPDATE;
 * - `DELETE alias FROM … JOIN …`: `DELETE FROM tabla WHERE ctid IN (SELECT alias.ctid FROM …)`, con
 *   el FROM tal como estaba. `ctid` es el identificador de fila de PostgreSQL.
 * Devuelve en qué sentencias reescribió un UPDATE o un DELETE (para que dmlBlocks no las detenga) y
 * dónde hay un OUTPUT … INTO, que no se traduce.
 */
function rewriteStatements(mask: string, source: string, edits: Edit[]) {
  const rewritten = new Set<number>();
  const outputInto: number[] = [];
  for (const [start, end] of statementRanges(mask)) {
    const text = mask.slice(start, end);
    const top = topLevel(text);
    const abs = (index: number) => start + index;
    const absRange = ([from, to]: Range) => range(abs(from), abs(to));
    const nameAt = (at: Range) => nameOf(source, absRange(at));

    // El final de la sentencia, sin espacios y antes de un OPTION (…).
    const option = /\bOPTION\s*\(/i.exec(top);
    let last = option ? option.index : text.length;
    while (last > 0 && /\s/.test(text[last - 1] ?? '')) last--;

    const lead = /^\s*WITH\b/i.exec(top);
    if (lead) {
      let at = lead[0].length;
      let recursive = false;
      for (;;) {
        const head = CTE_HEAD.exec(top.slice(at));
        if (!head) break;
        const open = at + head[0].length - 1;
        const close = closing(text, open);
        if (close === -1) break;
        const from = at + (head[1] ?? '').length;
        const name = nameAt(range(from, from + (head[2] ?? '').length));
        const self = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (self.test(text.slice(open + 1, close))) recursive = true;
        at = close + 1;
        const comma = /^\s*,/.exec(top.slice(at));
        if (!comma) break;
        at += comma[0].length;
      }
      if (recursive)
        edits.push({
          start: abs(lead[0].length),
          end: abs(lead[0].length),
          text: ' RECURSIVE',
          note: 'recursive',
        });
    }

    // OUTPUT inserted.x, deleted.x → RETURNING new.x, old.x al final. La lista empieza con inserted,
    // deleted o $action, para no confundirla con una columna que se llame Output.
    let returning: ((render: Render) => string) | undefined;
    const keyword = /\bOUTPUT\b/i.exec(top);
    if (keyword && /\b(?:INSERT|UPDATE|DELETE|MERGE)\b/i.test(top.slice(0, keyword.index))) {
      const after = keyword.index + keyword[0].length;
      const first = /^\s*(?=(?:inserted|deleted|\$action)\b)/i.exec(top.slice(after));
      const stop = /\b(?:INTO|VALUES|SELECT|DEFAULT|FROM|WHERE|OPTION|EXEC|EXECUTE)\b/i.exec(
        top.slice(after),
      );
      if (first && stop?.[0].toUpperCase() === 'INTO') outputInto.push(abs(keyword.index));
      else if (first) {
        const listFrom = after + first[0].length;
        // Si sigue una cláusula (VALUES, WHERE…), el OUTPUT se quita con los espacios de adelante; si
        // es lo último de la sentencia, con los de atrás.
        const clause = stop && !/^OPTION$/i.test(stop[0]) ? stop : null;
        const stopAt = clause ? after + clause.index : last;
        let listTo = stopAt;
        while (listTo > listFrom && /\s/.test(text[listTo - 1] ?? '')) listTo--;
        let removeFrom = keyword.index;
        if (!clause)
          while (removeFrom > 0 && /[ \t]/.test(text[removeFrom - 1] ?? '')) removeFrom--;
        const words = /\b(inserted|deleted)\b(?=\s*\.)|\$action\b/gi;
        for (const match of text.slice(listFrom, listTo).matchAll(words)) {
          const from = abs(listFrom + match.index);
          const word = match[0].toLowerCase();
          edits.push({
            start: from,
            end: from + word.length,
            text: word === '$action' ? 'merge_action()' : word === 'inserted' ? 'new' : 'old',
            note: 'output',
          });
        }
        edits.push({
          start: abs(removeFrom),
          end: abs(stopAt),
          text: '',
          note: 'output',
          consume: true,
        });
        returning = (render) =>
          ` RETURNING ${render(abs(listFrom), abs(listTo)).replace(/\s*\n\s*/g, ' ')}`;
      }
    }

    // UPDATE y DELETE cuyo destino es un origen del FROM. Si el destino no está en el FROM
    // (`UPDATE Products SET … FROM Categories AS c WHERE …`), PostgreSQL ya lo entiende.
    let closer = '';
    const update = new RegExp(`^(\\s*UPDATE\\s+)(${REFERENCE})(\\s+SET\\b)`, 'i').exec(top);
    const remove = new RegExp(`^(\\s*DELETE\\s+(?:FROM\\s+)?)(${REFERENCE})\\b`, 'i').exec(top);
    const head = update ?? remove;
    const targetName = head?.[2] ?? '';
    const fromMatch =
      head && !/^TOP$/i.test(targetName) ? /\bFROM\b/i.exec(top.slice(head[0].length)) : null;
    if (head && fromMatch) {
      const fromAt = head[0].length + fromMatch.index;
      const clauseFrom = fromAt + fromMatch[0].length;
      const where = /\bWHERE\b/i.exec(top.slice(clauseFrom));
      const clauseTo = where ? clauseFrom + where.index : last;
      const items = parseFrom(top, clauseFrom, clauseTo);
      const targetAt = (head[1] ?? '').length;
      const wanted = nameAt(range(targetAt, targetAt + targetName.length));
      const tableOf = (item: FromItem) =>
        item.table ? nameAt(item.table).split('.').pop() : undefined;
      const byAlias = wanted.includes('.')
        ? []
        : (items ?? []).filter((item) => item.alias && nameAt(item.alias) === wanted);
      const byTable = (items ?? []).filter((item) => tableOf(item) === wanted.split('.').pop());
      const target =
        byAlias.length === 1 ? byAlias[0] : byAlias.length === 0 ? byTable.at(0) : undefined;
      const unique = byAlias.length === 1 || byTable.length === 1;
      const table = target?.table;
      if (items && target && table && unique) {
        if (update) {
          const flat =
            items.every((item) => item.join !== 'other') &&
            !/\bAPPLY\b/i.test(top.slice(clauseFrom, clauseTo));
          if (flat) {
            rewritten.add(start);
            const alias = target.alias;
            edits.push({
              start: abs(targetAt),
              end: abs(targetAt + targetName.length),
              text: (render) =>
                render(...absRange(table)) + (alias ? ` AS ${render(...absRange(alias))}` : ''),
              note: 'update-join',
              consume: true,
            });
            edits.push({
              start: abs(fromAt),
              end: abs(last),
              text: (render) => {
                const others = items
                  .filter((item) => item !== target)
                  .map((item) => render(abs(item.start), abs(item.end)));
                const conditions = items.flatMap((item) => (item.on ? [item.on] : []));
                const written = conditions.map((on) => `(${render(...absRange(on))})`);
                if (where) {
                  const condFrom = clauseTo + where[0].length;
                  const skip = top.slice(condFrom, last).search(/\S/);
                  if (skip !== -1) written.push(`(${render(abs(condFrom + skip), abs(last))})`);
                }
                return [
                  others.length > 0 ? `FROM ${others.join(', ')}` : '',
                  written.length > 0 ? `WHERE ${written.join(' AND ')}` : '',
                ]
                  .filter((part) => part !== '')
                  .join(' ');
              },
              note: 'update-join',
              consume: true,
            });
          }
        } else {
          rewritten.add(start);
          const alias = target.alias;
          const reference = alias ?? lastPart(text, table);
          edits.push({
            start: abs((/^\s*/.exec(top)?.[0] ?? '').length),
            end: abs(clauseFrom),
            text: (render) =>
              `DELETE FROM ${render(...absRange(table))} WHERE ctid IN (SELECT ${render(...absRange(reference))}.ctid FROM`,
            note: 'delete-join',
            consume: true,
          });
          closer = ')';
        }
      }
    }
    if (closer !== '' || returning) {
      edits.push({
        start: abs(last),
        end: abs(last),
        text: (render) => closer + (returning ? returning(render) : ''),
        note: returning ? 'output' : 'delete-join',
        tail: true,
      });
    }
  }
  return { rewritten, outputInto };
}

/**
 * Las formas de UPDATE y DELETE que solo tiene SQL Server y que no se tradujeron: un UPDATE con
 * LEFT, RIGHT o FULL JOIN, un DELETE con un FROM que no se entiende, o un cambio a través de una CTE.
 * PostgreSQL daría un error que no dice por qué.
 */
function dmlBlocks(mask: string, source: string, rewritten: ReadonlySet<number>): Blocked[] {
  const out: Blocked[] = [];
  for (const [start, end] of statementRanges(mask)) {
    const text = topLevel(mask.slice(start, end));
    const add = (key: BlockKey, index: number) =>
      out.push({
        key,
        line: lineAt(source, start + index + Math.max(0, text.slice(index).search(/\S/))),
      });

    // UPDATE p SET … FROM Products AS p LEFT JOIN …: el destino es la misma tabla del FROM o su alias.
    const update = new RegExp(`\\bUPDATE\\s+(${NAME})\\s+SET\\b`, 'i').exec(text);
    const target = update?.[1];
    if (update && target && !rewritten.has(start)) {
      const rest = text.slice(update.index + update[0].length);
      const named = new RegExp(
        `\\b(?:FROM|JOIN)\\s+(?:${NAME}\\.)?(?:${target}|${NAME}\\s+(?:AS\\s+)?${target})\\b`,
        'i',
      );
      if (named.test(rest)) add('update-join', update.index);
    }
    // DELETE l FROM OrderLines AS l LEFT JOIN …
    const remove = new RegExp(`\\bDELETE\\s+(?!FROM\\b)${NAME}\\s+FROM\\b`, 'i').exec(text);
    if (remove && !rewritten.has(start)) add('delete-join', remove.index);
    // WITH d AS (…) DELETE FROM d WHERE n > 1
    if (/^\s*WITH\b/i.test(text)) {
      const names = new Set(
        [...text.matchAll(new RegExp(`(${NAME})\\s*(?:\\([^)]*\\)\\s*)?AS\\s*\\(`, 'gi'))].map(
          (match) => (match[1] ?? '').toLowerCase(),
        ),
      );
      const dml = new RegExp(`\\b(?:DELETE\\s+(?:FROM\\s+)?|UPDATE\\s+)(${NAME})`, 'i').exec(text);
      if (dml && names.has((dml[1] ?? '').toLowerCase())) add('cte-target', dml.index);
    }
  }
  return out;
}

export function translate(source: string): Translation {
  const edits: Edit[] = [];
  const outer = codeMask(source);

  // [Nombre] → "nombre": PostgreSQL guarda en minúsculas los nombres sin comillas.
  const inner = outer.split('');
  for (const match of outer.matchAll(IDENTIFIER)) {
    const start = match.index;
    const name = match[1] ?? '';
    edits.push({
      start,
      end: start + match[0].length,
      text: `"${name.toLowerCase()}"`,
      note: 'brackets',
    });
    for (let i = start + 1; i < start + match[0].length - 1; i++) inner[i] = ' ';
  }
  const mask = inner.join('');

  const each = (regex: RegExp, run: (match: RegExpMatchArray, start: number) => void) => {
    for (const match of mask.matchAll(regex)) run(match, match.index);
  };
  const replace = (regex: RegExp, text: string, note: NoteKey) =>
    each(regex, (match, start) => edits.push({ start, end: start + match[0].length, text, note }));

  // Las sentencias que se reescriben enteras (OUTPUT, UPDATE y DELETE con JOIN, CTE recursivas) y TOP
  // van primero: lo que agregan al final de una consulta tiene que quedar a la derecha de lo que
  // agregan las expresiones de adentro (como el AS date) de un CONVERT) en la misma posición.
  const { rewritten, outputInto } = rewriteStatements(mask, source, edits);

  // SELECT TOP (n) … → SELECT … FETCH FIRST n ROWS ONLY, al final de la consulta (con WITH TIES si lo
  // lleva). Se detiene lo que no se escribe así: PERCENT, un TOP que no es un número, TOP en un
  // DELETE, UPDATE o INSERT, y el de una consulta con UNION, INTERSECT o EXCEPT (el límite iría al
  // final, y TOP solo cuenta las filas de su SELECT).
  const topBlocked: number[] = [];
  each(/\b(?:DELETE|UPDATE|INSERT)\s+TOP\b/gi, (_match, start) => topBlocked.push(start));
  each(/\bSELECT(?:\s+(?:ALL|DISTINCT))?\s+TOP\b/gi, (match, start) => {
    const top = start + match[0].length - 'TOP'.length;
    const operand = TOP_OPERAND.exec(mask.slice(top + 'TOP'.length));
    const end = queryEnd(mask, top);
    const siblings = topLevel(mask.slice(queryStart(mask, start), end));
    if (!operand || operand[3] || SET_OPERATOR.test(siblings)) {
      topBlocked.push(start);
      return;
    }
    const after = top + 'TOP'.length + operand[0].length;
    let last = end;
    while (last > after && /\s/.test(mask[last - 1] ?? '')) last--;
    edits.push({ start: top, end: after, text: '', note: 'top' });
    edits.push({
      start: last,
      end: last,
      text: ` FETCH FIRST ${operand[1] ?? operand[2]} ROWS ${operand[4] ? 'WITH TIES' : 'ONLY'}`,
      note: 'top',
    });
  });

  // OPTION (MAXRECURSION 400), OPTION (RECOMPILE)…: PostgreSQL no tiene esas pistas de consulta.
  each(/[ \t]*\bOPTION\s*\(/gi, (match, start) => {
    const close = closing(mask, start + match[0].length - 1);
    if (close !== -1) edits.push({ start, end: close + 1, text: '', note: 'option' });
  });

  // GO separa lotes en SSMS; el renglón queda vacío para no mover los números de línea.
  each(/^[ \t]*GO[ \t]*;?[ \t]*$/gim, (match, start) =>
    edits.push({ start, end: start + match[0].length, text: '', note: 'go' }),
  );

  // DATEADD(day, 1, x) → DATEADD('day', 1, x): las funciones de compat.ts reciben la parte como texto.
  // También DATEDIFF, DATEPART y DATETRUNC.
  each(/\b(?:DATEADD|DATEDIFF|DATEPART|DATETRUNC)(\s*\(\s*)([A-Za-z]+)\s*,/gi, (match, start) => {
    const part = match[2] ?? '';
    const at = start + match[0].indexOf(part, match[0].indexOf('(') + 1);
    edits.push({ start: at, end: at + part.length, text: `'${part}'`, note: 'date-part' });
  });

  // CONVERT(date, x) → CAST(x AS date). Con estilo (el tercer argumento), los de CONVERT_STYLES
  // pasan por tsql_format (fecha a texto) y tsql_parse (texto a fecha) de compat.ts; los demás se detienen.
  const claimed: (readonly [number, number])[] = [];
  const convertStyles: number[] = [];
  each(/\bCONVERT\s*\(/gi, (match, start) => {
    const open = start + match[0].length - 1;
    const close = closing(mask, open);
    if (close === -1) return;
    const args = callArguments(mask, open, close);
    const [typeArg, valueArg, styleArg] = args;
    if (!typeArg || !valueArg) return;
    const type = source.slice(typeArg[0], typeArg[1]);
    const simple = TYPE_NAME.test(type);
    if (args.length === 2) {
      if (!simple) return;
      claimed.push([open + 1, valueArg[0]]);
      edits.push({ start, end: start + 'CONVERT'.length, text: 'CAST', note: 'convert' });
      edits.push({ start: open + 1, end: valueArg[0], text: '', note: 'convert' });
      edits.push({
        start: close,
        end: close,
        text: ` AS ${translateTypes(type)}`,
        note: 'convert',
      });
      return;
    }
    const styleText = styleArg ? mask.slice(styleArg[0], styleArg[1]) : '';
    const style = /^\d+$/.test(styleText) ? Number(styleText) : -1;
    const target = simple ? styleTarget(type) : undefined;
    // El estilo 108 es solo de hora: da formato a una fecha, pero no hay una fecha que leer con él.
    if (
      args.length === 3 &&
      CONVERT_STYLES.includes(style) &&
      target &&
      (target === 'text' || style !== 108)
    ) {
      const name = target === 'text' ? 'tsql_format' : 'tsql_parse';
      claimed.push([open + 1, valueArg[0]]);
      edits.push({ start, end: valueArg[0], text: `CAST(${name}(`, note: 'convert-style' });
      edits.push({
        start: close + 1,
        end: close + 1,
        text: ` AS ${translateTypes(type)})`,
        note: 'convert-style',
      });
      return;
    }
    convertStyles.push(start);
  });

  // TRY_CAST(x AS tipo) y TRY_CONVERT(tipo, x) → CAST(try_valid((x)::text, 'tipo') AS tipo): try_valid
  // (compat.ts) da NULL si el texto no es un valor del tipo, y el CAST de afuera lo deja pasar.
  const tryCast = (
    start: number,
    value: readonly [number, number],
    close: number,
    type: string,
    typeRange: readonly [number, number],
  ) => {
    const name = translateTypes(type);
    claimed.push(typeRange);
    edits.push({ start, end: value[0], text: 'CAST(try_valid((', note: 'try-cast' });
    edits.push({
      start: value[1],
      end: close,
      text: `)::text, '${name}') AS ${name}`,
      note: 'try-cast',
    });
  };
  each(/\bTRY_CAST\s*\(/gi, (match, start) => {
    const open = start + match[0].length - 1;
    const close = closing(mask, open);
    if (close === -1) return;
    const args = callArguments(mask, open, close);
    const arg = args[0];
    const asAt = lastAs(mask, open + 1, close);
    if (args.length !== 1 || !arg || asAt <= arg[0]) return;
    let valueEnd = asAt;
    while (valueEnd > arg[0] && /\s/.test(mask[valueEnd - 1] ?? '')) valueEnd--;
    const type = source.slice(asAt + 'AS'.length, close).trim();
    if (TYPE_NAME.test(type)) tryCast(start, [arg[0], valueEnd], close, type, [valueEnd, close]);
  });
  each(/\bTRY_CONVERT\s*\(/gi, (match, start) => {
    const open = start + match[0].length - 1;
    const close = closing(mask, open);
    if (close === -1) return;
    const args = callArguments(mask, open, close);
    const [typeArg, valueArg] = args;
    if (args.length === 3) convertStyles.push(start);
    if (args.length !== 2 || !typeArg || !valueArg) return;
    const type = source.slice(typeArg[0], typeArg[1]);
    if (TYPE_NAME.test(type)) tryCast(start, valueArg, close, type, [open + 1, valueArg[0]]);
  });

  // CROSS APPLY → CROSS JOIN LATERAL; OUTER APPLY (…) AS x → LEFT JOIN LATERAL (…) AS x ON TRUE.
  replace(/\bCROSS\s+APPLY\b/gi, 'CROSS JOIN LATERAL', 'apply');
  each(/\bOUTER\s+APPLY\s*\(/gi, (match, start) => {
    const open = start + match[0].length - 1;
    const close = closing(mask, open);
    if (close === -1) return;
    const alias = new RegExp(`^\\s*(?:AS\\s+)?${NAME}`, 'i').exec(mask.slice(close + 1));
    const end = close + 1 + (alias?.[0].length ?? 0);
    edits.push({ start, end: open, text: 'LEFT JOIN LATERAL ', note: 'apply' });
    edits.push({ start: end, end, text: ' ON TRUE', note: 'apply' });
  });

  for (const [regex, text] of TYPES) {
    each(regex, (match, start) => {
      const end = start + match[0].length;
      if (claimed.some(([from, to]) => start < to && end > from)) return;
      edits.push({ start, end, text, note: 'types' });
    });
  }

  each(/\bCREATE\s+(?:UNIQUE\s+)?(NON)?CLUSTERED\s+INDEX\b/gi, (match, start) => {
    const word = match[1] ? 'NONCLUSTERED' : 'CLUSTERED';
    const at = start + match[0].toUpperCase().indexOf(word);
    edits.push({
      start: at,
      end: at + word.length + 1,
      text: '',
      note: match[1] ? 'nonclustered' : 'clustered',
    });
  });

  each(/\b(?:BEGIN|COMMIT|ROLLBACK)\s+(TRAN)\b/gi, (match, start) => {
    const at = start + match[0].length - 4;
    edits.push({ start: at, end: at + 4, text: 'TRANSACTION', note: 'tran' });
  });

  replace(/\bIDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'GENERATED BY DEFAULT AS IDENTITY', 'identity');
  replace(/(?<!\bAS\s+)\bIDENTITY\b(?!\s*\()/gi, 'GENERATED BY DEFAULT AS IDENTITY', 'identity');

  replace(
    new RegExp(
      `\\s*\\bWITH\\s*\\(\\s*(?:${HINT_WORDS})(?:\\s*,\\s*(?:${HINT_WORDS}))*\\s*\\)`,
      'gi',
    ),
    '',
    'hints',
  );

  // MERGE tabla … → MERGE INTO tabla …: PostgreSQL pide el INTO, y SQL Server lo deja opcional.
  each(/\bMERGE\s+(?!INTO\b|TOP\b)/gi, (_match, start) =>
    edits.push({
      start: start + 'MERGE'.length,
      end: start + 'MERGE'.length,
      text: ' INTO',
      note: 'merge',
    }),
  );

  // MERGE … WHEN NOT MATCHED BY TARGET es lo mismo que WHEN NOT MATCHED, la forma de PostgreSQL.
  replace(/\bNOT\s+MATCHED\s+BY\s+TARGET\b/gi, 'NOT MATCHED', 'by-target');

  // SET NOCOUNT ON, SET XACT_ABORT ON…: PostgreSQL no tiene esas opciones. Se quita el renglón.
  replace(
    new RegExp(
      `^[ \\t]*SET[ \\t]+(?:${SET_OPTIONS})(?:[ \\t]*,[ \\t]*(?:${SET_OPTIONS}))*[ \\t]+(?:ON|OFF)[ \\t]*;?`,
      'gim',
    ),
    '',
    'set-option',
  );

  // #Totales → "#totales": una tabla común, porque cada ejecución usa una base nueva.
  each(/(?<![\w@#$])(#{1,2}[A-Za-z_][A-Za-z0-9_]*)/g, (match, start) => {
    const name = match[1] ?? '';
    edits.push({
      start,
      end: start + name.length,
      text: `"${name.toLowerCase()}"`,
      note: 'temp-table',
    });
  });

  // UPDATE … SET p.Price = …: en PostgreSQL la columna que se asigna va sin alias.
  each(/\bSET\b/gi, (match, start) => {
    if (!UPDATE_SET.test(mask.slice(Math.max(0, start - 300), start))) return;
    let depth = 0;
    let target = true;
    for (let at = start + match[0].length; at < mask.length; at++) {
      if (target) {
        const qualified = ASSIGNED.exec(mask.slice(at));
        if (qualified) {
          const end = at + qualified[0].length;
          const from = end - (qualified[1] ?? '').length - (qualified[2] ?? '').length;
          edits.push({ start: from, end, text: '', note: 'set-alias' });
        }
        target = false;
      }
      const char = mask[at] ?? '';
      if (char === '(') depth++;
      else if (char === ')' && --depth < 0) break;
      else if (depth === 0 && char === ',') target = true;
      else if (depth === 0 && char === ';') break;
      else if (
        depth === 0 &&
        /\w/.test(char) &&
        !/\w/.test(mask[at - 1] ?? '') &&
        SET_END.test(mask.slice(at, at + 8))
      )
        break;
    }
  });

  // STRING_AGG(x, ', ') WITHIN GROUP (ORDER BY y) → STRING_AGG(x, ', ' ORDER BY y).
  each(/\bWITHIN\s+GROUP\s*\(/gi, (match, start) => {
    const open = start + match[0].length - 1;
    const close = closing(mask, open);
    const order = /^\(\s*(ORDER\s+BY\b[\s\S]*)\)$/i.exec(source.slice(open, close + 1));
    let before = start - 1;
    while (before >= 0 && /\s/.test(mask[before] ?? '')) before--;
    const callOpen = mask[before] === ')' ? opening(mask, before) : -1;
    const name = mask.slice(0, callOpen).match(/STRING_AGG\s*$/i);
    if (close === -1 || !order || callOpen === -1 || !name) return;
    const clause = (order[1] ?? '').trim();
    edits.push({ start: before, end: before, text: ` ${clause}`, note: 'string-agg' });
    edits.push({ start: before + 1, end: close + 1, text: '', note: 'string-agg' });
  });

  const blocked: Blocked[] = [];
  if (topBlocked.length > 0)
    blocked.push({ key: 'top', line: lineAt(source, Math.min(...topBlocked)) });
  for (const [regex, key] of BLOCKS) {
    const match = regex.exec(mask);
    regex.lastIndex = 0;
    if (!match) continue;
    // Las expresiones que miran el carácter anterior empiezan uno antes de lo que importa.
    const offset = match[0].search(/[^\s;]/);
    blocked.push({ key, line: lineAt(source, match.index + Math.max(0, offset)) });
  }
  if (outputInto.length > 0)
    blocked.push({ key: 'output', line: lineAt(source, Math.min(...outputInto)) });
  const style = convertStyles[0];
  if (style !== undefined) blocked.push({ key: 'convert-style', line: lineAt(source, style) });
  for (const block of dmlBlocks(mask, source, rewritten)) {
    if (!blocked.some((item) => item.key === block.key)) blocked.push(block);
  }

  // Los cambios que arman su texto con trozos del código traducido se resuelven al final, cuando ya
  // están todos los demás; los que mueven texto se llevan los cambios que caen en lo que reemplazan.
  const plain = edits.filter((edit): edit is PlainEdit => typeof edit.text === 'string');
  const render: Render = (from, to) =>
    applyEdits(
      source.slice(from, to),
      plain
        .filter((edit) =>
          edit.end > edit.start
            ? from <= edit.start && edit.end <= to
            : from < edit.start && edit.start <= to && edit.tail !== true,
        )
        .map((edit) => ({ ...edit, start: edit.start - from, end: edit.end - from })),
    ).sql;
  const resolved = edits.map((edit): PlainEdit =>
    typeof edit.text === 'string'
      ? { ...edit, text: edit.text }
      : { ...edit, text: edit.text(render) },
  );
  const kept = resolved.filter(
    (edit) =>
      !resolved.some((owner) => owner.consume === true && owner !== edit && isInside(edit, owner)),
  );
  const { sql, notes } = applyEdits(source, kept);
  return { sql, notes, blocked };
}

export interface Statement {
  /** El texto de la sentencia, con su punto y coma si lo tenía. */
  readonly text: string;
  /** Dónde empieza en el código completo, para dar el renglón de un error. */
  readonly start: number;
}

/**
 * Las sentencias del código, partidas en cada punto y coma que no está dentro de una cadena ni de
 * un comentario. Las que quedan vacías (solo espacios o comentarios) no cuentan.
 */
export function splitStatements(source: string): Statement[] {
  const mask = codeMask(source);
  const out: Statement[] = [];
  let start = 0;
  for (let i = 0; i <= mask.length; i++) {
    if (i < mask.length && mask[i] !== ';') continue;
    const end = Math.min(i + 1, source.length);
    if (mask.slice(start, i).trim() !== '') out.push({ text: source.slice(start, end), start });
    start = end;
  }
  return out;
}

/** Cuántas sentencias tiene el código, sin contar las vacías. */
export function statementCount(source: string): number {
  return splitStatements(source).length;
}
