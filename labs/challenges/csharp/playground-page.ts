// El playground de C# con JavaScript: el programa se compila con Roslyn y corre en .NET dentro de
// un worker, y se ve lo que escribió en la consola, el error si lo hubo y cuánto tardó. Guarda el
// código en el navegador, junto al de los retos.

import { required } from '../../shared/dom';
import type { Lang } from '../../shared/format';
import { announce } from '../../shared/live';
import { fill } from '../../shared/template';
import { textareaEditor, type CodeEditor, type CreateEditor } from '../../shared/editor-api';
import { warmOnIntent, type Phase } from '../../shared/engine';
import type { Progress } from '../progress';
import { renderStatus } from '../results';
import type { CsPlaygroundPageData } from '../texts';
import type { CsPlaygroundRun } from './engine';
import { renderCsPlayground, type CsContext } from './results';

/** El id con el que se guarda el código del playground junto al de los retos. */
export const CS_PLAYGROUND_ID = 'playground-csharp';

/** Lo que el playground usa del motor de C#; las pruebas pasan uno falso. */
export interface CsPlaygroundEngine {
  readonly timeoutMs: number;
  readonly loaded: boolean;
  runPlayground(source: string, onProgress?: (phase: Phase) => void): Promise<CsPlaygroundRun>;
  warm(): Promise<void>;
}

export interface CsPlaygroundDeps {
  readonly engine: CsPlaygroundEngine;
  readonly progress: Progress;
  readonly lang: Lang;
  readonly loadEditor?: () => Promise<CreateEditor>;
  readonly confirm?: (message: string) => boolean;
}

export interface CsPlaygroundController {
  readonly editor: () => CodeEditor;
  run(): Promise<void>;
  readonly editorReady: Promise<void>;
}

/** El renglón que marcar en el editor: el primer error de compilación del programa. */
function errorLine(run: CsPlaygroundRun): number | undefined {
  if (!('outcome' in run)) return undefined;
  return run.outcome.diagnostics.find((diagnostic) => diagnostic.source === 'code')?.line;
}

export function startCsPlayground(
  root: HTMLElement,
  data: CsPlaygroundPageData,
  deps: CsPlaygroundDeps,
): CsPlaygroundController {
  const { ui } = data;
  const { csharp } = ui;
  const confirm = deps.confirm ?? ((message: string) => window.confirm(message));
  const context: CsContext = {
    results: ui.results,
    csharp,
    lang: deps.lang,
    timeoutSeconds: deps.engine.timeoutMs / 1000,
  };
  const host = required<HTMLElement>('.ch-editor', root);
  const save = (code: string) => deps.progress.saveCode(CS_PLAYGROUND_ID, code);
  const options = {
    doc: deps.progress.get(CS_PLAYGROUND_ID)?.code ?? data.starter,
    label: host.dataset['label'] ?? csharp.playground.editor_label,
    language: 'csharp' as const,
    onChange: save,
    onRun: () => void controller.run(),
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
  actions.hidden = false;
  if (help) help.hidden = false;
  panel.hidden = false;
  let running = false;

  const controller: CsPlaygroundController = {
    editor: () => editor,
    editorReady,
    async run() {
      if (running) return;
      const source = editor.getValue();
      if (source.trim() === '') {
        renderStatus(body, csharp.playground.empty);
        announce(csharp.playground.empty);
        return;
      }
      running = true;
      runButton.disabled = true;
      resetButton.disabled = true;
      panel.setAttribute('aria-busy', 'true');
      editor.markLine(null);
      const progress = (phase: Phase) => {
        if (phase === 'loading')
          renderStatus(body, csharp.results.loading, csharp.results.loading_note);
        else renderStatus(body, fill(ui.results.running, { n: 1, total: 1 }));
      };
      progress(deps.engine.loaded ? 'running' : 'loading');
      try {
        const run = await deps.engine.runPlayground(source, progress);
        renderCsPlayground(body, run, context);
        const line = errorLine(run);
        if (line) editor.markLine(line);
        const first = body.querySelector('.ch-verdict-title, .ch-status');
        announce(first?.textContent ?? '');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        renderStatus(body, fill(csharp.results.engine_error, { message }), undefined, 'bad');
        announce(fill(csharp.results.engine_error, { message }));
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
    if (!confirm(csharp.playground.reset_confirm)) return;
    editor.setValue(data.starter);
    save(data.starter);
    editor.focus();
  });
  warmOnIntent(root, deps.engine);
  return controller;
}
