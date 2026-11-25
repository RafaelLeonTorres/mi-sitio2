// La página de un reto con JavaScript: las pistas se abren una a una, el código inicial se vuelve
// un editor que guarda en el navegador, Ejecutar corre los ejemplos y Enviar todos los casos, y
// los resultados salen en su panel. Lo que cambia entre SQL y C# (el motor, el editor y los
// resultados) llega en `language` (languages.ts). Sin JavaScript la página ya se lee completa.

import { h, required } from '../shared/dom';
import { fill } from '../shared/template';
import { announce } from '../shared/live';
import type { Lang } from '../shared/format';
import { textareaEditor, type CodeEditor, type CreateEditor } from '../shared/editor-api';
import { EngineError, warmOnIntent, type Phase } from '../shared/engine';
import type { ChallengeLanguage } from './languages';
import type { Progress } from './progress';
import { renderStatus } from './results';
import type { UiTexts } from './texts';

/** Lo que la página necesita de un reto, sea de SQL o de C#. */
export interface ChallengePage {
  readonly id: string;
  readonly challenge: {
    readonly starter: string;
    readonly cases: readonly { readonly sample?: boolean }[];
  };
  readonly ui: UiTexts;
}

export interface ChallengeDeps<Run> {
  readonly language: ChallengeLanguage<Run>;
  readonly progress: Progress;
  readonly lang: Lang;
  /** Descarga CodeMirror; sin esto (o si falla) queda el <textarea>. */
  readonly loadEditor?: () => Promise<CreateEditor>;
  readonly confirm?: (message: string) => boolean;
  /** Al resolver el reto, además de guardarlo; el modo entrevista lo anota. */
  readonly onSolved?: () => void;
  /** El texto del aviso de resuelto, si no es el de siempre (en una entrevista). */
  readonly solvedText?: () => string | undefined;
}

export interface ChallengeController {
  readonly editor: () => CodeEditor;
  run(mode: 'run' | 'submit'): Promise<void>;
  /** Termina cuando el editor definitivo (CodeMirror o el <textarea>) quedó en su lugar. */
  readonly editorReady: Promise<void>;
}

/** Las pistas, una a la vez: un botón abre la siguiente. */
export function revealHints(container: HTMLElement): void {
  const hints = [...container.querySelectorAll<HTMLDetailsElement>('.ch-hint')];
  const template = container.dataset['next'] ?? '{n}';
  if (hints.length === 0) return;
  for (const hint of hints) hint.hidden = true;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ch-link ch-next-hint';
  let shown = 0;
  const label = () => {
    button.textContent = fill(template, { n: shown + 1, total: hints.length });
  };
  button.addEventListener('click', () => {
    const hint = hints[shown];
    if (!hint) return;
    hint.hidden = false;
    hint.open = true;
    shown++;
    if (shown >= hints.length) {
      button.remove();
      hint.querySelector('summary')?.focus();
    } else label();
  });
  label();
  container.append(button);
}

/** El resumen de la solución dice si la abre o la cierra. */
function solutionToggle(details: HTMLDetailsElement): void {
  const summary = details.querySelector('summary');
  const show = details.dataset['show'] ?? '';
  const hide = details.dataset['hide'] ?? show;
  if (!summary) return;
  const update = () => {
    summary.textContent = details.open ? hide : show;
  };
  details.addEventListener('toggle', update);
  update();
}

export function startChallenge<Run>(
  root: HTMLElement,
  data: ChallengePage,
  deps: ChallengeDeps<Run>,
): ChallengeController {
  const { challenge, ui } = data;
  const { language } = deps;
  const confirm = deps.confirm ?? ((message: string) => window.confirm(message));

  const hints = root.querySelector<HTMLElement>('.ch-hints');
  if (hints) revealHints(hints);
  const solution = root.querySelector<HTMLDetailsElement>('.ch-solution');
  if (solution) solutionToggle(solution);

  const badge = root.querySelector<HTMLElement>('.ch-meta .ch-badge');
  const showSolved = () => {
    if (badge) badge.hidden = deps.progress.get(data.id)?.status !== 'solved';
  };
  showSolved();

  // El editor: primero un <textarea> con el código guardado; luego CodeMirror, si carga.
  const host = required<HTMLElement>('.ch-editor', root);
  const label = host.dataset['label'] ?? ui.challenge.editor_label;
  const save = (code: string) => deps.progress.saveCode(data.id, code);
  const options = {
    doc: deps.progress.get(data.id)?.code ?? challenge.starter,
    label,
    onChange: save,
    onRun: () => void controller.run('run'),
    onSubmit: () => void controller.run('submit'),
    ...language.editor,
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
  const submitButton = required<HTMLButtonElement>('.ch-submit', actions);
  const resetButton = required<HTMLButtonElement>('.ch-reset', actions);
  actions.hidden = false;
  if (help) help.hidden = false;
  panel.hidden = false;

  const samples = challenge.cases.flatMap((item, index) => (item.sample ? [index] : []));
  const all = challenge.cases.map((_, index) => index);
  let running = false;

  const controller: ChallengeController = {
    editor: () => editor,
    editorReady,
    async run(mode) {
      if (running) return;
      running = true;
      for (const button of [runButton, submitButton, resetButton]) button.disabled = true;
      panel.setAttribute('aria-busy', 'true');
      const indexes = mode === 'run' ? samples : all;
      const source = editor.getValue();
      editor.markLine(null);
      deps.progress.markStarted(data.id);
      const { results } = ui;
      const progress = (phase: Phase, position: number) => {
        if (phase === 'loading')
          renderStatus(body, language.texts.loading, language.texts.loading_note);
        else renderStatus(body, fill(results.running, { n: position + 1, total: indexes.length }));
      };
      progress(language.loaded ? 'running' : 'loading', 0);
      try {
        const run = await language.run(indexes, source, progress);
        const verdict = language.render(body, run, indexes.length, mode);
        const line = language.errorLine(run);
        if (line) editor.markLine(line);
        if (mode === 'submit' && verdict.allPassed) {
          deps.progress.markSolved(data.id, source);
          deps.onSolved?.();
          showSolved();
          const text = deps.solvedText?.() ?? ui.challenge.solved_text;
          body.prepend(solvedPanel(ui.challenge.solved_title, text, root));
        }
        announce(fill(results.summary, { passed: verdict.passed, total: verdict.total }));
      } catch (error) {
        const message =
          error instanceof EngineError || error instanceof Error ? error.message : String(error);
        renderStatus(body, fill(language.texts.engine_error, { message }), undefined, 'bad');
        announce(fill(language.texts.engine_error, { message }));
      } finally {
        running = false;
        for (const button of [runButton, submitButton, resetButton]) button.disabled = false;
        panel.removeAttribute('aria-busy');
      }
    },
  };

  runButton.addEventListener('click', () => void controller.run('run'));
  submitButton.addEventListener('click', () => void controller.run('submit'));
  resetButton.addEventListener('click', () => {
    if (!confirm(ui.challenge.reset_confirm)) return;
    editor.setValue(challenge.starter);
    save(challenge.starter);
    editor.focus();
  });

  warmOnIntent(root, language);

  return controller;
}

/** El aviso de reto resuelto, con el enlace al siguiente reto. */
function solvedPanel(title: string, text: string, root: HTMLElement): HTMLElement {
  const next = root.querySelector<HTMLAnchorElement>('.ch-pager .ch-next');
  return h('div', { class: 'ch-solved' }, [
    h('p', { class: 'ch-solved-title' }, [title]),
    h('p', {}, [text]),
    next ? h('a', { href: next.href }, [next.textContent ?? '']) : null,
  ]);
}
