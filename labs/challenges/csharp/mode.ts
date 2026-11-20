// El resaltado de C# para CodeMirror: un tokenizador por renglones (StreamLanguage) con las palabras
// clave, los tipos, las cadenas (normales, literales @"…", interpoladas $"…" y sin escape """…"""),
// los números y los comentarios. La sangría sigue las llaves y el autocompletado ofrece palabras
// clave, tipos comunes y los métodos de LINQ. Va en el chunk del editor (editor.ts).

import { completeFromList, type Completion } from '@codemirror/autocomplete';
import { StreamLanguage, type StreamParser, type StringStream } from '@codemirror/language';

const KEYWORDS = new Set(
  (
    'abstract as base break case catch checked class const continue default delegate do else enum ' +
    'event explicit extern false finally fixed for foreach goto if implicit in interface internal ' +
    'is lock namespace new null operator out override params private protected public readonly ref ' +
    'return sealed sizeof stackalloc static struct switch this throw true try typeof unchecked ' +
    'unsafe using virtual volatile while add and alias ascending async await by descending equals ' +
    'extension field file from get global group init into join let managed nameof not notnull on or ' +
    'orderby partial record remove required scoped select set unmanaged value var when where with ' +
    'yield'
  ).split(' '),
);

const TYPE_KEYWORDS = new Set(
  'bool byte char decimal double dynamic float int long nint nuint object sbyte short string uint ulong ushort void'.split(
    ' ',
  ),
);

const ATOMS: Readonly<Record<string, string>> = { true: 'bool', false: 'bool', null: 'null' };

export interface CsharpState {
  /** Dentro de un comentario /* … *\/ que sigue en el renglón siguiente. */
  comment: boolean;
  /** Dentro de una cadena que sigue: literal (@"…") o sin escape ("""…""", con sus comillas). */
  string: { readonly verbatim: boolean; readonly quotes: number } | null;
  /** Cuántas llaves abiertas hay, para la sangría. */
  depth: number;
}

/** El resto de una cadena literal (@"…"), donde "" es una comilla. */
function verbatimRest(stream: StringStream, state: CsharpState): string {
  while (!stream.eol()) {
    const next = stream.next();
    if (next === '"') {
      if (stream.eat('"')) continue;
      state.string = null;
      return 'string';
    }
  }
  return 'string';
}

/** El resto de una cadena sin escape, que termina con tantas comillas como abrió. */
function rawRest(stream: StringStream, state: CsharpState, quotes: number): string {
  const close = '"'.repeat(quotes);
  while (!stream.eol()) {
    if (stream.match(close)) {
      state.string = null;
      return 'string';
    }
    stream.next();
  }
  return 'string';
}

/** Una cadena normal ("…" o $"…") en un renglón, con sus escapes. */
function quoted(stream: StringStream, end: string): string {
  let escaped = false;
  while (!stream.eol()) {
    const next = stream.next();
    if (next === end && !escaped) return 'string';
    escaped = !escaped && next === '\\';
  }
  return 'string';
}

export const csharpParser: StreamParser<CsharpState> = {
  name: 'csharp',
  startState: () => ({ comment: false, string: null, depth: 0 }),
  copyState: (state) => ({ ...state }),
  token(stream, state) {
    if (state.comment) {
      if (stream.skipTo('*/')) {
        stream.match('*/');
        state.comment = false;
      } else stream.skipToEnd();
      return 'blockComment';
    }
    if (state.string) {
      return state.string.verbatim
        ? verbatimRest(stream, state)
        : rawRest(stream, state, state.string.quotes);
    }
    if (stream.eatSpace()) return null;
    if (stream.sol() && stream.match(/^#\s*\w+/)) {
      stream.skipToEnd();
      return 'meta';
    }
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'lineComment';
    }
    if (stream.match('/*')) {
      state.comment = true;
      if (stream.skipTo('*/')) {
        stream.match('*/');
        state.comment = false;
      } else stream.skipToEnd();
      return 'blockComment';
    }
    // Cadenas: los prefijos $ y @ en cualquier orden, y las sin escape de tres o más comillas.
    const prefix = stream.match(/^(\$+@?|@\$*)?(?=")/);
    if (prefix) {
      const marks = typeof prefix === 'object' ? (prefix[1] ?? '') : '';
      const raw = stream.match(/^"{3,}/);
      if (raw && typeof raw === 'object') {
        const quotes = raw[0].length;
        state.string = { verbatim: false, quotes };
        return rawRest(stream, state, quotes);
      }
      stream.next();
      if (marks.includes('@')) {
        state.string = { verbatim: true, quotes: 1 };
        return verbatimRest(stream, state);
      }
      return quoted(stream, '"');
    }
    if (stream.eat("'")) return quoted(stream, "'");
    if (
      stream.match(/^0[xX][\da-fA-F_]+[uUlL]*/) ||
      stream.match(/^0[bB][01_]+[uUlL]*/) ||
      stream.match(/^(\d[\d_]*(\.\d[\d_]*)?|\.\d[\d_]*)([eE][+-]?\d+)?[fFdDmMuUlL]*/)
    ) {
      return 'number';
    }
    if (stream.match(/^@?[A-Za-z_][\w]*/)) {
      const word = stream.current().replace(/^@/, '');
      const atom = ATOMS[word];
      if (atom) return atom;
      if (TYPE_KEYWORDS.has(word)) return 'typeName';
      if (KEYWORDS.has(word)) return 'keyword';
      const before = stream.string.charAt(stream.start - 1);
      if (stream.match(/^\s*(<[\w\s,<>?[\]]*>)?\s*\(/, false)) return 'variableName.function';
      if (before === '.') return 'propertyName';
      return /^[A-Z]/.test(word) ? 'typeName' : 'variableName';
    }
    const char = stream.next();
    if (char === '{') state.depth++;
    else if (char === '}') state.depth = Math.max(0, state.depth - 1);
    return null;
  },
  indent(state, textAfter, context) {
    const closing = /^\s*}/.test(textAfter) ? 1 : 0;
    return Math.max(0, state.depth - closing) * context.unit;
  },
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
    indentOnInput: /^\s*}$/,
  },
};

const COMPLETIONS: readonly Completion[] = [
  ...[...KEYWORDS].map((label) => ({ label, type: 'keyword' })),
  ...[...TYPE_KEYWORDS].map((label) => ({ label, type: 'type' })),
  ...(
    'Array Console Dictionary Enumerable Exception HashSet IEnumerable IReadOnlyList Lazy LinkedList ' +
    'List Math PriorityQueue Queue SortedDictionary Stack StringBuilder String Task Tuple ValueTask ' +
    'Channel ArgumentException InvalidOperationException KeyValuePair StringComparer'
  )
    .split(' ')
    .map((label) => ({ label, type: 'class' })),
  ...(
    'Select Where OrderBy OrderByDescending ThenBy ThenByDescending GroupBy ToList ToArray ' +
    'ToDictionary ToHashSet ToLookup First FirstOrDefault Last Single Any All Count Sum Min Max ' +
    'Average Aggregate Distinct DistinctBy Skip Take Chunk Zip Concat Except Intersect Union ' +
    'SelectMany Join GroupJoin Reverse Contains MaxBy MinBy CountBy AggregateBy Index'
  )
    .split(' ')
    .map((label) => ({ label, type: 'method' })),
];

/** El lenguaje para el editor, con su autocompletado. */
export const csharp = StreamLanguage.define(csharpParser);

export const csharpCompletion = csharp.data.of({
  autocomplete: completeFromList([...COMPLETIONS]),
});
