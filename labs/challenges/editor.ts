// El editor de los retos con CodeMirror 6: SQL con el dialecto de SQL Server y el autocompletado de
// las tablas del reto, o C# (csharp/mode.ts). Pesa más que la página, así que se descarga aparte
// (import()) y mientras tanto se escribe en un <textarea>. Los colores salen de la paleta de
// resaltado del sitio.

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { MSSQL, sql } from '@codemirror/lang-sql';
import { EditorState, Prec, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type DecorationSet,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { csharp, csharpCompletion } from './csharp/mode';
import type { CreateEditor, EditorOptions } from './editor-api';

const setErrorLine = StateEffect.define<number | null>();

/** El renglón del error marcado; se borra en cuanto el visitante edita. */
const errorLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let next = transaction.docChanged ? Decoration.none : value;
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorLine)) continue;
      const line = effect.value;
      next =
        line === null || line < 1 || line > transaction.state.doc.lines
          ? Decoration.none
          : Decoration.set([
              Decoration.line({ class: 'cm-error-line' }).range(
                transaction.state.doc.line(line).from,
              ),
            ]);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--tok-k)', fontWeight: '600' },
  { tag: [tags.typeName, tags.standard(tags.name)], color: 'var(--tok-t)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--tok-s)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--tok-n)' },
  { tag: [tags.lineComment, tags.blockComment], color: 'var(--tok-c)', fontStyle: 'italic' },
  { tag: [tags.special(tags.name), tags.function(tags.variableName)], color: 'var(--tok-f)' },
  { tag: tags.meta, color: 'var(--tok-c)' },
]);

/** El lenguaje del editor: C# o SQL con las tablas del reto. */
function language(options: EditorOptions) {
  if (options.language === 'csharp') return [csharp, csharpCompletion, indentUnit.of('    ')];
  return [
    indentUnit.of('  '),
    sql({
      dialect: MSSQL,
      upperCaseKeywords: true,
      ...(options.schema ? { schema: { ...options.schema } } : {}),
    }),
  ];
}

const theme = EditorView.theme({
  '&': {
    color: 'var(--ink)',
    backgroundColor: 'var(--code-bg)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-m)',
    fontSize: '0.9rem',
  },
  '&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65' },
  '.cm-content': { padding: '0.75rem 0', caretColor: 'var(--accent)', minHeight: '14rem' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--tok-c)',
    border: 'none',
    borderRadius: 'var(--radius-m) 0 0 var(--radius-m)',
  },
  // Los números de renglón traen 3px de cada lado; con un poco más no se pegan al código.
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 0.65rem 0 0.75rem' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 6%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '.cm-error-line': { backgroundColor: 'color-mix(in srgb, var(--bad) 14%, transparent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 24%, transparent)',
  },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-tooltip': {
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-s)',
    backgroundColor: 'var(--surface)',
    color: 'var(--ink)',
  },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-ink)',
  },
});

export const createEditor: CreateEditor = (host, options) => {
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        syntaxHighlighting(highlight),
        language(options),
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                options.onRun();
                return true;
              },
            },
            {
              key: 'Shift-Mod-Enter',
              run: () => {
                (options.onSubmit ?? options.onRun)();
                return true;
              },
            },
          ]),
        ),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.contentAttributes.of({ 'aria-label': options.label, spellcheck: 'false' }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) options.onChange(update.state.doc.toString());
        }),
        errorLine,
        theme,
      ],
    }),
  });
  return {
    getValue: () => view.state.doc.toString(),
    setValue: (value) =>
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } }),
    focus: () => view.focus(),
    markLine: (line) => view.dispatch({ effects: setErrorLine.of(line) }),
    destroy: () => view.destroy(),
  };
};
