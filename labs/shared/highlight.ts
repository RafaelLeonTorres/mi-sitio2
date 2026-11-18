// Resaltado de JSON y SQL para lo que las demos generan en el navegador (respuestas de la API,
// consultas con sus parámetros). El código fijo de las páginas ya llega resaltado por Rouge.
// Cada token usa una clase del sitio: tok-k (palabra clave), tok-t (tipo o nombre de campo),
// tok-s (texto), tok-n (número), tok-c (comentario) y tok-f (función).

export type TokenKind = 'k' | 't' | 's' | 'n' | 'c' | 'f' | 'text';

export interface Token {
  kind: TokenKind;
  text: string;
}

export type Language = 'json' | 'sql';

// Textos (también sin cerrar), números y literales. Lo demás (llaves, comas) queda como texto.
const JSON_TOKEN =
  /("(?:[^"\\\n]|\\.)*"?)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

// Comentarios, textos ('' es una comilla escapada), @parámetros, [nombres], números y palabras.
const SQL_TOKEN =
  /(--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(N?'(?:[^']|'')*'?)|(@@?\w+)|(\[[^\]\n]*\]?)|(\d+(?:\.\d+)?)|([A-Za-z_]\w*)/g;

const SQL_KEYWORDS = new Set(
  `ADD ALL AND APPLY AS ASC BETWEEN BY CASE CLUSTERED CREATE CROSS DECLARE DELETE DESC DISTINCT
  ELSE END EXISTS FETCH FIRST FOREIGN FROM FULL GO GROUP HAVING IN INCLUDE INDEX INNER INSERT INTO
  IO IS JOIN KEY LEFT LIKE NEXT NONCLUSTERED NOT NULL OFF OFFSET ON ONLY OPTION OR ORDER OUTER
  PRIMARY REFERENCES RIGHT ROW ROWS SELECT SET STATISTICS TABLE THEN TIME TOP UNION UNIQUE UPDATE
  VALUES WHEN WHERE WITH`.split(/\s+/),
);

const SQL_TYPES = new Set(
  `BIGINT BIT CHAR DATE DATETIME DATETIME2 DATETIMEOFFSET DECIMAL FLOAT INT MONEY NCHAR NUMERIC
  NVARCHAR REAL ROWVERSION SMALLINT TINYINT UNIQUEIDENTIFIER VARBINARY VARCHAR`.split(/\s+/),
);

// Solo cuentan como función cuando les sigue un paréntesis: una columna Year queda sin color.
const SQL_FUNCTIONS = new Set(
  `AVG CAST COALESCE CONVERT COUNT COUNT_BIG DATEADD DATEDIFF DATEFROMPARTS DAY DENSE_RANK EOMONTH
  GETDATE ISNULL LEN LOWER MAX MIN MONTH NEWID RANK ROW_NUMBER STRING_AGG SUBSTRING SUM
  SYSDATETIME TRIM UPPER YEAR`.split(/\s+/),
);

/** Divide un JSON (válido o no) en tokens; juntos reproducen el texto original tal cual. */
export function tokenizeJson(source: string): Token[] {
  return scan(source, JSON_TOKEN, (match, end) => {
    if (match[1] !== undefined) return nextChar(source, end) === ':' ? 't' : 's';
    if (match[2] !== undefined) return 'n';
    return 'k';
  });
}

/** Divide una consulta T-SQL en tokens; juntos reproducen el texto original tal cual. */
export function tokenizeSql(source: string): Token[] {
  return scan(source, SQL_TOKEN, (match, end) => {
    if (match[1] !== undefined) return 'c';
    if (match[2] !== undefined) return 's';
    if (match[3] !== undefined) return 't';
    if (match[4] !== undefined) return 'text';
    if (match[5] !== undefined) return 'n';
    const word = match[0].toUpperCase();
    if (SQL_KEYWORDS.has(word)) return 'k';
    if (SQL_TYPES.has(word)) return 't';
    if (SQL_FUNCTIONS.has(word) && nextChar(source, end) === '(') return 'f';
    return 'text';
  });
}

/** Convierte los tokens en nodos: texto suelto o `<span class="tok-…">`. */
export function renderTokens(tokens: readonly Token[], doc: Document = document): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  for (const { kind, text } of tokens) {
    if (kind === 'text') {
      fragment.append(text);
      continue;
    }
    const span = doc.createElement('span');
    span.className = `tok-${kind}`;
    span.textContent = text;
    fragment.append(span);
  }
  return fragment;
}

/** Pone `source` resaltado dentro de `code`, en lugar de lo que tuviera. */
export function highlightInto(code: HTMLElement, language: Language, source: string): void {
  const tokens = language === 'json' ? tokenizeJson(source) : tokenizeSql(source);
  code.replaceChildren(renderTokens(tokens, code.ownerDocument));
}

/** Recorre las coincidencias de `pattern`; lo que queda entre ellas es texto sin clase. */
function scan(
  source: string,
  pattern: RegExp,
  kindOf: (match: RegExpExecArray, end: number) => TokenKind,
): Token[] {
  const tokens: Token[] = [];
  const push = (kind: TokenKind, text: string) => {
    const last = tokens.at(-1);
    if (kind === 'text' && last?.kind === 'text') last.text += text;
    else tokens.push({ kind, text });
  };
  const regex = new RegExp(pattern.source, 'g');
  let index = 0;
  for (let match = regex.exec(source); match !== null; match = regex.exec(source)) {
    if (match.index > index) push('text', source.slice(index, match.index));
    const end = match.index + match[0].length;
    push(kindOf(match, end), match[0]);
    index = end;
  }
  if (index < source.length) push('text', source.slice(index));
  return tokens;
}

/** El primer carácter que no es espacio desde `from`, o '' si no hay. */
function nextChar(source: string, from: number): string {
  for (let i = from; i < source.length; i++) {
    const char = source.charAt(i);
    if (char.trim() !== '') return char;
  }
  return '';
}
