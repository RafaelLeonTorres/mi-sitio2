// Lo que la página necesita de un editor, sea CodeMirror (editor.ts, que se descarga aparte) o el
// <textarea> que lo reemplaza mientras carga o si no carga.

import { h } from './dom';

export interface CodeEditor {
  getValue(): string;
  setValue(value: string): void;
  focus(): void;
  /** Marca el renglón de un error (desde 1), o quita la marca con null. */
  markLine(line: number | null): void;
  destroy(): void;
}

export interface EditorOptions {
  readonly doc: string;
  /** El nombre accesible del editor. */
  readonly label: string;
  readonly onChange: (value: string) => void;
  /** Ctrl+Enter. */
  readonly onRun: () => void;
  /** Ctrl+Shift+Enter; sin él, también ejecuta. */
  readonly onSubmit?: () => void;
  /** El lenguaje del resaltado y del autocompletado; SQL si falta. */
  readonly language?: 'sql' | 'csharp';
  /** Tablas y columnas para el autocompletado de SQL. */
  readonly schema?: Readonly<Record<string, readonly string[]>>;
}

export type CreateEditor = (host: HTMLElement, options: EditorOptions) => CodeEditor;

/** Un <textarea> con los mismos atajos: funciona sin descargar nada más. */
export const textareaEditor: CreateEditor = (host, options) => {
  const textarea = h('textarea', {
    class: 'ch-textarea',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    'aria-label': options.label,
    rows: Math.max(10, options.doc.split('\n').length + 2),
  });
  textarea.value = options.doc;
  textarea.addEventListener('input', () => options.onChange(textarea.value));
  textarea.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    (event.shiftKey && options.onSubmit ? options.onSubmit : options.onRun)();
  });
  host.replaceChildren(textarea);
  return {
    getValue: () => textarea.value,
    setValue: (value) => {
      textarea.value = value;
    },
    focus: () => textarea.focus(),
    markLine: () => undefined,
    destroy: () => textarea.remove(),
  };
};
