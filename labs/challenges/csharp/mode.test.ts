import { StringStream } from '@codemirror/language';
import { describe, expect, it } from 'vitest';
import { csharpParser, type CsharpState } from './mode';

/** Los tokens de unos renglones, con su estilo, sin los espacios. */
function tokens(lines: readonly string[], state: CsharpState = csharpParser.startState!(4)) {
  const out: [string, string | null][] = [];
  for (const line of lines) {
    const stream = new StringStream(line, 4, 4);
    while (!stream.eol()) {
      const style = csharpParser.token(stream, state);
      if (stream.current().trim() !== '') out.push([stream.current(), style]);
      stream.start = stream.pos;
    }
  }
  return out;
}

const styleOf = (lines: readonly string[], text: string) =>
  tokens(lines).find(([token]) => token === text)?.[1];

describe('el resaltado de C#', () => {
  it('distingue palabras clave, tipos, valores, funciones y propiedades', () => {
    const line = ['public static int Count(List<string> names) => names.Count + Math.Max(1, 2);'];
    expect(styleOf(line, 'public')).toBe('keyword');
    expect(styleOf(line, 'int')).toBe('typeName');
    expect(styleOf(line, 'Count')).toBe('variableName.function');
    expect(styleOf(line, 'List')).toBe('typeName');
    expect(styleOf(line, 'names')).toBe('variableName');
    expect(styleOf(line, 'Max')).toBe('variableName.function');
    expect(
      tokens(line)
        .filter(([token]) => token === 'Count')
        .map(([, style]) => style),
    ).toEqual(['variableName.function', 'propertyName']);
    expect(styleOf(['var ok = true ?? null;'], 'true')).toBe('bool');
    expect(styleOf(['var ok = true ?? null;'], 'null')).toBe('null');
  });

  it('reconoce números, caracteres, comentarios y directivas', () => {
    const lines = ['#nullable enable', "var x = 0x1F + 1_000m + 2.5e3 + 'a'; // fin"];
    expect(styleOf(lines, '#nullable enable')).toBe('meta');
    expect(styleOf(lines, '0x1F')).toBe('number');
    expect(styleOf(lines, '1_000m')).toBe('number');
    expect(styleOf(lines, '2.5e3')).toBe('number');
    expect(styleOf(lines, "'a'")).toBe('string');
    expect(styleOf(lines, '// fin')).toBe('lineComment');
  });

  it('sigue las cadenas literales, interpoladas y sin escape, y los comentarios de varios renglones', () => {
    expect(styleOf(['var s = $"Hola {name}";'], '$"Hola {name}"')).toBe('string');
    expect(styleOf(['var s = "a\\"b";'], '"a\\"b"')).toBe('string');
    const verbatim = tokens(['var p = @"C:\\temp\\', 'fin""x";', 'return p;']);
    expect(verbatim.find(([token]) => token === 'fin""x"')?.[1]).toBe('string');
    expect(verbatim.find(([token]) => token === 'return')?.[1]).toBe('keyword');
    const raw = tokens(['var j = """', '  { "a": 1 }', '  """;', 'int n;']);
    expect(raw.find(([token]) => token.includes('"a": 1'))?.[1]).toBe('string');
    expect(raw.find(([token]) => token === 'int')?.[1]).toBe('typeName');
    const comment = tokens(['/* uno', 'dos */ var a = 1;']);
    expect(comment.find(([token]) => token === 'dos */')?.[1]).toBe('blockComment');
    expect(comment.find(([token]) => token === 'var')?.[1]).toBe('keyword');
  });

  it('cuenta las llaves para la sangría', () => {
    const state = csharpParser.startState!(4);
    tokens(['class A', '{', '    void M()', '    {'], state);
    const context = { unit: 4 } as Parameters<NonNullable<typeof csharpParser.indent>>[2];
    expect(csharpParser.indent?.(state, '', context)).toBe(8);
    expect(csharpParser.indent?.(state, '}', context)).toBe(4);
  });
});
