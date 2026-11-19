// Una traducción mínima de T-SQL a PostgreSQL, para que el código de SQL Server corra en PGlite
// sin reescribirse: la parte de fecha de DATEADD(day, …) va entre comillas, [Nombre] pasa a
// "nombre", los tipos de SQL Server cambian por los de PostgreSQL y lo que no existe allá (TOP,
// variables con @, TRY…CATCH, procedimientos) se detiene con un mensaje que dice cómo escribirlo.
// Solo toca el código: nada dentro de cadenas ni comentarios, y nunca agrega ni quita renglones,
// para que la línea de un error de PostgreSQL sea la misma que ve el visitante.

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
  | 'set-option'
  | 'temp-table'
  | 'set-alias'
  | 'convert'
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

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly note: NoteKey;
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

const BLOCKS: readonly [RegExp, BlockKey][] = [
  [/\b(?:SELECT|DELETE|UPDATE|INSERT)\s+(?:(?:ALL|DISTINCT)\s+)?TOP\b/gi, 'top'],
  [/(?:^|[^\w@#$])@@?[A-Za-z_]/g, 'variable'],
  [/\bBEGIN\s+(?:TRY|CATCH)\b|\bRAISERROR\b|\bTHROW\b/gi, 'try-catch'],
  [/\b(?:CREATE|ALTER)\s+(?:OR\s+ALTER\s+)?PROC(?:EDURE)?\b|\bEXEC(?:UTE)?\b/gi, 'procedure'],
  [/(?:^|;)\s*(?:IF|WHILE)\b/gi, 'control-flow'],
  [/\bOUTPUT\s+(?:INSERTED|DELETED)\b/gi, 'output'],
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
 * Las formas de UPDATE y DELETE que solo tiene SQL Server: con el destino como alias de un FROM con
 * JOIN, o a través de una CTE. PostgreSQL daría un error que no dice por qué.
 */
function dmlBlocks(mask: string, source: string): Blocked[] {
  const out: Blocked[] = [];
  let start = 0;
  for (let i = 0; i <= mask.length; i++) {
    if (i < mask.length && mask[i] !== ';') continue;
    const text = topLevel(mask.slice(start, i));
    const add = (key: BlockKey, index: number) =>
      out.push({
        key,
        line: lineAt(source, start + index + Math.max(0, text.slice(index).search(/\S/))),
      });

    // UPDATE p SET … FROM Products AS p JOIN …: el destino es la misma tabla del FROM o su alias.
    const update = new RegExp(`\\bUPDATE\\s+(${NAME})\\s+SET\\b`, 'i').exec(text);
    const target = update?.[1];
    if (update && target) {
      const rest = text.slice(update.index + update[0].length);
      const named = new RegExp(
        `\\b(?:FROM|JOIN)\\s+(?:${NAME}\\.)?(?:${target}|${NAME}\\s+(?:AS\\s+)?${target})\\b`,
        'i',
      );
      if (named.test(rest)) add('update-join', update.index);
    }
    // DELETE l FROM OrderLines AS l LEFT JOIN …
    const remove = new RegExp(`\\bDELETE\\s+(?!FROM\\b)${NAME}\\s+FROM\\b`, 'i').exec(text);
    if (remove) add('delete-join', remove.index);
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
    start = i + 1;
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

  // CONVERT(date, x) → CAST(x AS date). Con estilo (el tercer argumento) no hay equivalente directo.
  const claimed: (readonly [number, number])[] = [];
  const convertStyles: number[] = [];
  each(/\bCONVERT\s*\(/gi, (match, start) => {
    const open = start + match[0].length - 1;
    const close = closing(mask, open);
    if (close === -1) return;
    const commas = topCommas(mask, open + 1, close);
    const comma = commas[0];
    if (comma === undefined) return;
    if (commas.length > 1) {
      convertStyles.push(start);
      return;
    }
    const type = source.slice(open + 1, comma).trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*(?:\s*\(\s*(?:\d+|MAX)(?:\s*,\s*\d+)?\s*\))?$/i.test(type)) return;
    let after = comma + 1;
    while (source[after] === ' ' || source[after] === '\t') after++;
    claimed.push([open + 1, after]);
    edits.push({ start, end: start + 'CONVERT'.length, text: 'CAST', note: 'convert' });
    edits.push({ start: open + 1, end: after, text: '', note: 'convert' });
    edits.push({ start: close, end: close, text: ` AS ${translateTypes(type)}`, note: 'convert' });
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
  for (const [regex, key] of BLOCKS) {
    const match = regex.exec(mask);
    regex.lastIndex = 0;
    if (!match) continue;
    // Las expresiones que miran el carácter anterior empiezan uno antes de lo que importa.
    const offset = match[0].search(/[^\s;]/);
    blocked.push({ key, line: lineAt(source, match.index + Math.max(0, offset)) });
  }
  const style = convertStyles[0];
  if (style !== undefined) blocked.push({ key: 'convert-style', line: lineAt(source, style) });
  for (const block of dmlBlocks(mask, source)) {
    if (!blocked.some((item) => item.key === block.key)) blocked.push(block);
  }

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
  return { sql, notes: [...applied], blocked };
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
