// El playground de SQL con JavaScript: el código corre en la base de ejemplo y se ve el resultado de
// cada sentencia, con el plan de la última consulta si se pide. Guarda el código en el navegador.

import { required } from '../shared/dom';
import type { Lang } from '../shared/format';
import { announce } from '../shared/live';
import { textareaEditor, type CodeEditor, type CreateEditor } from '../shared/editor-api';
import { warmOnIntent, type Phase } from '../shared/engine';
import type { PlaygroundRun } from './engine';
import type { Progress } from './progress';
import { renderPlayground, renderStatus, type Context } from './results';
import { editorSchema, type Dataset } from './sql/data';
import type { PlaygroundPageData } from './texts';
import { fill } from '../shared/template';

/** El id con el que se guarda el código del playground junto al de los retos. */
export const PLAYGROUND_ID = 'playground-sql';

export interface PlaygroundEngine {
  readonly timeoutMs: number;
  readonly loaded: boolean;
  runPlayground(
    dataset: Dataset,
    source: string,
    flags: { readonly explain: boolean; readonly generate: boolean },
    onProgress?: (phase: Phase) => void,
  ): Promise<PlaygroundRun>;
  warm(): Promise<void>;
}

export interface PlaygroundDeps {
  readonly engine: PlaygroundEngine;
  readonly progress: Progress;
  readonly lang: Lang;
  readonly loadEditor?: () => Promise<CreateEditor>;
  readonly confirm?: (message: string) => boolean;
}

export interface PlaygroundController {
  readonly editor: () => CodeEditor;
  run(): Promise<void>;
  readonly editorReady: Promise<void>;
}

export function startPlayground(
  root: HTMLElement,
  data: PlaygroundPageData,
  deps: PlaygroundDeps,
): PlaygroundController {
  const { ui } = data;
  const confirm = deps.confirm ?? ((message: string) => window.confirm(message));
  const context: Context = {
    texts: ui,
    lang: deps.lang,
    timeoutSeconds: deps.engine.timeoutMs / 1000,
  };
  const host = required<HTMLElement>('.ch-editor', root);
  const save = (code: string) => deps.progress.saveCode(PLAYGROUND_ID, code);
  const options = {
    doc: deps.progress.get(PLAYGROUND_ID)?.code ?? data.starter,
    label: host.dataset['label'] ?? ui.challenge.editor_label,
    onChange: save,
    onRun: () => void controller.run(),
    schema: editorSchema(data.dataset.tables),
  };
  let editor = textareaEditor(host, options);
  const editorReady = (deps.loadEditor?.() ?? Promise.reject(new Error('sin CodeMirror')))
    .then((create) => {
      const code = editor.getValue();
      const focused = host.contains(document.activeElement);
      editor.destroy();
      host.replaceChildren();
      editor = create(host, { ...options, doc: code });
      if (focused) editor.focus();
    })
    .catch(() => undefined);

  const actions = required<HTMLElement>('.ch-actions', root);
  const help = root.querySelector<HTMLElement>('.ch-help');
  const panel = required<HTMLElement>('.ch-results', root);
  const body = required<HTMLElement>('.ch-results-body', panel);
  const runButton = required<HTMLButtonElement>('.ch-run', actions);
  const resetButton = required<HTMLButtonElement>('.ch-reset', actions);
  const explain = required<HTMLInputElement>('.ch-explain', actions);
  const generate = root.querySelector<HTMLInputElement>('.ch-generate');
  actions.hidden = false;
  if (help) help.hidden = false;
  panel.hidden = false;
  let running = false;

  const controller: PlaygroundController = {
    editor: () => editor,
    editorReady,
    async run() {
      if (running) return;
      running = true;
      runButton.disabled = true;
      resetButton.disabled = true;
      panel.setAttribute('aria-busy', 'true');
      editor.markLine(null);
      const { results } = ui;
      const progress = (phase: Phase) => {
        if (phase === 'loading') renderStatus(body, results.loading, results.loading_note);
        else renderStatus(body, fill(results.running, { n: 1, total: 1 }));
      };
      progress(deps.engine.loaded ? 'running' : 'loading');
      try {
        const run = await deps.engine.runPlayground(
          data.dataset,
          editor.getValue(),
          { explain: explain.checked, generate: generate?.checked === true },
          progress,
        );
        renderPlayground(body, run, context);
        if ('outcome' in run) {
          const failed = run.outcome.statements.find((statement) => statement.error);
          const line = failed?.error?.line;
          if (line) editor.markLine(line);
          const first = body.querySelector('.ch-verdict-title, .ch-error');
          announce(first?.textContent ?? '');
        } else announce(body.textContent ?? '');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        renderStatus(body, fill(results.engine_error, { message }), undefined, 'bad');
        announce(fill(results.engine_error, { message }));
      } finally {
        running = false;
        runButton.disabled = false;
        resetButton.disabled = false;
        panel.removeAttribute('aria-busy');
      }
    },
  };

  runButton.addEventListener('click', () => void controller.run());
  resetButton.addEventListener('click', () => {
    if (!confirm(ui.playground.reset_confirm)) return;
    editor.setValue(data.starter);
    save(data.starter);
    editor.focus();
  });
  warmOnIntent(root, deps.engine);
  return controller;
}
