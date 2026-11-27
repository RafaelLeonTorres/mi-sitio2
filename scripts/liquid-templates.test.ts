import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Revisa la sintaxis de Liquid de las plantillas del laboratorio y de la sección Entrevista con el
// mismo tokenizador de Liquid 4, el de Jekyll 3 y GitHub Pages: una etiqueta de salida termina en la
// primera llave que cierra, así que `{{ x | replace: "{value}", y }}` rompe el build. También revisa
// que cada bloque (if, for, capture…) tenga su cierre.

const TEMPLATES = [
  '_includes/labs',
  '_includes/interview',
  '_layouts/lab.html',
  '_layouts/interview.html',
  'laboratorio',
  'en/lab',
];
// Como TemplateParser en liquid/template.rb: {% … %} entero, {{ … } o {{ … }}, o un inicio suelto.
const TOKEN = /\{%.*?%\}|\{\{.*?\}\}?|\{%|\{\{/gs;
const BLOCKS = new Set(['if', 'unless', 'case', 'for', 'capture', 'comment', 'raw', 'tablerow']);

function htmlFiles(path: string): string[] {
  if (path.endsWith('.html')) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return htmlFiles(child);
    return entry.name.endsWith('.html') ? [child] : [];
  });
}

/** Los errores que daría Liquid al leer la plantilla; vacío si no hay. */
function liquidErrors(source: string): string[] {
  const errors: string[] = [];
  const open: string[] = [];
  for (const [token] of source.matchAll(TOKEN)) {
    if (open.at(-1) === 'raw' && !/^\{%-?\s*endraw\b/.test(token)) continue;
    if (token.startsWith('{{')) {
      if (!token.endsWith('}}')) errors.push(`etiqueta de salida sin cerrar: ${token}`);
      continue;
    }
    const name = /^\{%-?\s*(\w+)/.exec(token)?.[1];
    if (!token.endsWith('%}') || !name) {
      errors.push(`etiqueta sin cerrar: ${token}`);
      continue;
    }
    if (BLOCKS.has(name)) open.push(name);
    else if (name.startsWith('end')) {
      const expected = open.pop();
      if (expected !== name.slice(3)) errors.push(`${name} cierra ${expected ?? 'nada'}`);
    }
  }
  for (const name of open) errors.push(`falta end${name}`);
  return errors;
}

describe('plantillas de Liquid del laboratorio', () => {
  it('detecta una llave dentro de una etiqueta de salida y un bloque sin cerrar', () => {
    expect(liquidErrors('{{ a | replace: "{value}", b }}')).toHaveLength(1);
    expect(liquidErrors('{% if a %}<p>{% endfor %}')).toEqual(['endfor cierra if']);
    expect(liquidErrors('{% assign b = a | replace: "{value}", c %}{{ b }}')).toEqual([]);
    expect(liquidErrors('{"a": {{ a | jsonify }}}')).toEqual([]);
  });

  for (const file of TEMPLATES.flatMap(htmlFiles)) {
    it(`${file} se puede leer`, () => {
      expect(liquidErrors(readFileSync(file, 'utf8'))).toEqual([]);
    });
  }
});
