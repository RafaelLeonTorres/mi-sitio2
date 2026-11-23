// La página de una lección con JavaScript: un paso a la vez, con el editor, la entrada simulada, las
// pistas y la terminal a la derecha, y el pie con el menú, el contador y Atrás y Siguiente. Sin
// JavaScript la página se lee completa (includes/course/lesson.html); aquí se deja un paso visible.
// El código del alumno corre en el motor de C# de los retos, en un worker con tiempo límite.

import type { CsProgramRun } from '../challenges/csharp/engine';
import type { CsCourseRun, CsProgramRequest } from '../challenges/csharp/protocol';
import { textareaEditor, type CodeEditor, type CreateEditor } from '../challenges/editor-api';
import { warmOnIntent, type Phase } from '../challenges/engine';
import { h, required } from '../shared/dom';
import type { Lang } from '../shared/format';
import { announce } from '../shared/live';
import { fill } from '../shared/template';
import type { CourseProgress } from './progress';
import { percent, reachable, startIndex, type StepStatus } from './steps';
import { judge, renderRun, renderStatus } from './terminal';
import type { LessonData, RunData, StepData } from './types';

/** Lo que la lección usa del motor de C#; las pruebas pasan uno falso. */
export interface LessonEngine {
  readonly timeoutMs: number;
  readonly loaded: boolean;
  runProgram(
    request: CsProgramRequest,
    onProgress?: (phase: Phase, position: number) => void,
  ): Promise<CsProgramRun>;
  warm(): Promise<void>;
}

export interface LessonDeps {
  readonly engine: LessonEngine;
  readonly progress: CourseProgress;
  readonly lang: Lang;
  readonly loadEditor?: () => Promise<CreateEditor>;
  readonly confirm?: (message: string) => boolean;
  /** Ir a otra página: la siguiente lección o el temario. */
  readonly navigate?: (url: string) => void;
}

export interface LessonController {
  /** El paso que se está viendo (desde 0). */
  index(): number;
  open(index: number): void;
  run(): Promise<void>;
  submit(): Promise<void>;
  readonly editorReady: Promise<void>;
}

/** Una ejecución como la escribe el YAML, lista para mandarla al motor. */
function toRun(run: RunData): CsCourseRun {
  return {
    stdin: run.stdin ?? '',
    ...(run.stdout === undefined ? {} : { stdout: run.stdout }),
    ...(run.contains === undefined ? {} : { contains: run.contains }),
    ...(run.matches === undefined ? {} : { matches: run.matches }),
    ...(run.throws === undefined ? {} : { throws: run.throws }),
  };
}

export function startLesson(
  root: HTMLElement,
  data: LessonData,
  deps: LessonDeps,
): LessonController {
  const { ui, steps } = data;
  const lessonId = data.id;
  const sections = [...root.querySelectorAll<HTMLElement>('.cs-step')];
  const confirm = deps.confirm ?? ((message: string) => window.confirm(message));
  const navigate = deps.navigate ?? ((url: string) => window.location.assign(url));
  root.classList.add('cs-js');

  const progressBox = required<HTMLElement>('.cs-progress', root);
  const progressBar = required<HTMLElement>('.cs-progress-bar', root);
  const progressText = required<HTMLElement>('.cs-progress-text', root);
  const work = required<HTMLElement>('.cs-work', root);
  const bottom = required<HTMLElement>('.cs-bottom', root);
  progressBox.hidden = false;
  bottom.hidden = false;

  let index = 0;
  let running = false;
  let hintsShown = 0;
  let suppress = false;
  const step = (): StepData => steps[index]!;
  /** El código con el que empieza un paso: el de su idioma, si lo tiene, o el compartido. */
  const starterOf = (item: StepData): string => data.starters[item.id] ?? item.starter ?? '';
  const states = (): StepStatus[] => steps.map((item) => deps.progress.status(lessonId, item.id));

  // --- Panel del editor ---
  const editorHost = h('div', { class: 'cs-editor' });
  const stdinBox = h('textarea', {
    rows: 3,
    spellcheck: 'false',
    autocomplete: 'off',
    'aria-label': ui.stdin,
  });
  const stdinWrap = h('div', { class: 'cs-stdin', hidden: true }, [
    h('label', {}, [ui.stdin, stdinBox]),
    h('p', { class: 'cs-help' }, [ui.stdin_help]),
  ]);
  const hintButtons = [1, 2, 3].map((n) =>
    h('button', { class: 'cs-hint-btn', type: 'button', 'aria-label': fill(ui.hint, { n }) }, [
      '?',
    ]),
  );
  const resetButton = h('button', { class: 'cs-link cs-reset', type: 'button' }, [ui.reset]);
  const runButton = h('button', { class: 'btn btn-secondary cs-run', type: 'button' }, [ui.run]);
  const submitButton = h('button', { class: 'btn btn-primary cs-submit', type: 'button' }, [
    ui.submit,
  ]);
  const hintBox = h('div', { class: 'cs-hintbox', 'aria-live': 'polite' });
  const terminalBody = h('div', { class: 'cs-terminal-body' });
  work.replaceChildren(
    h('div', { class: 'cs-file' }, [ui.file]),
    editorHost,
    stdinWrap,
    h('div', { class: 'cs-actions' }, [
      h('div', { class: 'cs-hints-row' }, hintButtons),
      h('div', { class: 'cs-actions-right' }, [resetButton, runButton, submitButton]),
    ]),
    hintBox,
    h('section', { class: 'cs-terminal', 'aria-labelledby': 'cs-terminal-title' }, [
      h('h2', { id: 'cs-terminal-title' }, [ui.terminal]),
      terminalBody,
    ]),
  );
  work.hidden = false;

  const editorOptions = (doc: string) => ({
    doc,
    label: ui.editor_label,
    language: 'csharp' as const,
    onChange: (code: string) => {
      if (!suppress && step().kind === 'exercise')
        deps.progress.saveCode(lessonId, step().id, code);
    },
    onRun: () => void controller.run(),
    onSubmit: () => void controller.submit(),
  });
  let editor: CodeEditor = textareaEditor(editorHost, editorOptions(''));
  const editorReady = (deps.loadEditor?.() ?? Promise.reject(new Error('sin CodeMirror')))
    .then((create) => {
      const code = editor.getValue();
      const focused = editorHost.contains(document.activeElement);
      editor.destroy();
      editorHost.replaceChildren();
      editor = create(editorHost, editorOptions(code));
      if (focused) editor.focus();
    })
    .catch(() => undefined);
  const load = (code: string) => {
    suppress = true;
    editor.setValue(code);
    suppress = false;
  };

  // --- Pie ---
  const menuList = h('ol', { class: 'cs-menu-list' });
  const counter = h('span', { class: 'cs-counter' });
  const chip = h('span', { class: 'cs-chip' });
  const backButton = h('button', { class: 'btn btn-secondary', type: 'button' }, [ui.back]);
  const nextButton = h('button', { class: 'btn btn-primary', type: 'button' }, [ui.next]);
  bottom.replaceChildren(
    h('details', { class: 'cs-menu' }, [h('summary', {}, [ui.menu]), menuList]),
    counter,
    chip,
    h('span', { class: 'cs-nav' }, [backButton, nextButton]),
  );

  function refresh(): void {
    const all = states();
    const limit = reachable(all);
    const pct = percent(all);
    progressBar.style.width = `${pct}%`;
    progressText.textContent = `${pct} %`;
    progressBox.setAttribute('aria-valuenow', String(pct));
    const current = step();
    const state = all[index] ?? 'pending';
    counter.textContent = fill(ui.step_of, {
      kind: ui.kind[current.kind] ?? '',
      n: index + 1,
      total: steps.length,
    });
    chip.textContent = ui.status[state] ?? '';
    chip.dataset['status'] = state;
    menuList.replaceChildren(
      ...steps.map((item, i) =>
        h('li', {}, [
          h(
            'button',
            {
              type: 'button',
              class: 'cs-menu-item',
              'data-i': i,
              'aria-current': i === index ? 'step' : null,
              disabled: i > limit,
            },
            [
              `${i + 1}. ${sections[i]?.dataset['title'] ?? item.id}`,
              h('span', { class: 'cs-menu-status', 'data-status': all[i] }, [
                ui.status[all[i] ?? 'pending'] ?? '',
              ]),
            ],
          ),
        ]),
      ),
    );
    const last = index === steps.length - 1;
    const reading = current.kind === 'read' && state === 'pending';
    backButton.disabled = index === 0;
    nextButton.disabled = state === 'pending' && current.kind !== 'read';
    nextButton.textContent = reading
      ? ui.understood
      : last
        ? data.next
          ? ui.next_lesson
          : ui.to_syllabus
        : ui.next;
  }

  function setBusy(on: boolean): void {
    for (const button of [runButton, submitButton, resetButton, ...hintButtons])
      button.disabled = on;
    terminalBody.parentElement?.toggleAttribute('aria-busy', on);
    if (!on) updateHints();
  }

  // --- Pistas y solución ---
  const hintItems = (): HTMLElement[] => [
    ...sections[index]!.querySelectorAll<HTMLElement>('.cs-hint-list > li'),
  ];

  function updateHints(): void {
    const total = hintItems().length;
    hintButtons.forEach((button, i) => {
      button.disabled = i >= total;
      button.setAttribute('aria-pressed', String(i < hintsShown));
    });
  }

  function showHint(n: number): void {
    const items = hintItems();
    hintsShown = Math.max(hintsShown, n + 1);
    const shown = items
      .slice(0, hintsShown)
      .map((item, i) =>
        h('p', { class: 'cs-hint' }, [
          h('strong', {}, [`${fill(ui.hint, { n: i + 1 })}: `]),
          ...[...item.cloneNode(true).childNodes],
        ]),
      );
    const more =
      hintsShown >= items.length
        ? h('button', { class: 'cs-link', type: 'button' }, [ui.show_solution])
        : null;
    more?.addEventListener('click', showSolution);
    hintBox.replaceChildren(...h('div', {}, [...shown, more]).childNodes);
    updateHints();
    announce(shown.at(-1)?.textContent ?? '');
  }

  function showSolution(): void {
    const current = step();
    const clone = sections[index]!.querySelector('.cs-solution')?.cloneNode(true) as
      HTMLElement | undefined;
    // Del bloque de la página queda la explicación: el título y el código de la solución (el primer
    // bloque resaltado) ya salen en la terminal.
    clone?.querySelector('summary')?.remove();
    clone?.querySelector('div.highlighter-rouge')?.remove();
    const loadButton = h('button', { class: 'btn btn-secondary', type: 'button' }, [
      ui.load_solution,
    ]);
    loadButton.addEventListener('click', () => {
      load(current.solution ?? '');
      deps.progress.saveCode(lessonId, current.id, current.solution ?? '');
      editor.focus();
    });
    terminalBody.replaceChildren(
      ...h('div', {}, [
        h('h3', { class: 'cs-run-title' }, [ui.solution_title]),
        h('pre', { class: 'cs-out' }, [current.solution ?? '']),
        ...(clone ? [...clone.childNodes] : []),
        loadButton,
      ]).childNodes,
    );
    if (deps.progress.status(lessonId, current.id) === 'pending') {
      deps.progress.mark(lessonId, current.id, 'seen');
      refresh();
    }
  }

  // --- Preguntas de opción ---
  function setupChoice(section: HTMLElement, current: StepData): void {
    section.querySelector('.cs-form')?.remove();
    const options = [...section.querySelectorAll<HTMLElement>('.cs-options > li')];
    const name = `cs-choice-${current.id}`;
    const feedback = h('p', { class: 'cs-feedback', role: 'status' });
    // Sin JavaScript la respuesta está cerrada en un <details>; aquí se abre al acertar.
    const answer = section.querySelector<HTMLDetailsElement>('details.cs-solution');
    const form = h('form', { class: 'cs-form' }, [
      h('fieldset', {}, [
        h('legend', {}, [ui.choose]),
        // El texto de la opción puede traer `código`: se copian sus nodos, dentro de un solo <span>.
        ...options.map((item, i) =>
          h('label', { class: 'cs-option' }, [
            h('input', { type: 'radio', name, value: i }),
            h('span', {}, [...item.cloneNode(true).childNodes]),
          ]),
        ),
      ]),
      h('button', { class: 'btn btn-primary', type: 'submit' }, [ui.submit]),
      feedback,
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const chosen = form.querySelector<HTMLInputElement>('input:checked');
      if (!chosen) {
        feedback.textContent = ui.choose;
      } else if (Number(chosen.value) === current.answer) {
        deps.progress.mark(lessonId, current.id, 'done');
        feedback.textContent = ui.verdict_ok;
        section.classList.add('cs-answered');
        if (answer) answer.open = true;
        announce(ui.verdict_ok);
        refresh();
      } else {
        feedback.textContent = ui.wrong;
        announce(ui.wrong);
      }
    });
    section.querySelector('.cs-options')?.after(form);
    const solved = deps.progress.status(lessonId, current.id) === 'done';
    section.classList.toggle('cs-answered', solved);
    if (answer) answer.open = solved;
  }

  // --- Ejecutar y enviar ---
  async function execute(mode: 'run' | 'submit'): Promise<void> {
    const current = step();
    if (current.kind !== 'exercise' || running) return;
    const code = editor.getValue();
    if (code.trim() === '') {
      renderStatus(terminalBody, ui.empty);
      announce(ui.empty);
      return;
    }
    const runs: CsCourseRun[] =
      mode === 'run'
        ? [{ stdin: stdinBox.value }]
        : current.runs?.length
          ? current.runs.map(toRun)
          : [{ stdin: '' }];
    const request: CsProgramRequest = {
      code,
      runs,
      rules: mode === 'run' ? [] : (current.rules ?? []),
    };
    running = true;
    setBusy(true);
    editor.markLine(null);
    const status = (phase: Phase) =>
      phase === 'loading'
        ? renderStatus(terminalBody, ui.loading, ui.loading_note)
        : renderStatus(terminalBody, ui.running);
    status(deps.engine.loaded ? 'running' : 'loading');
    try {
      const result = await deps.engine.runProgram(request, status);
      const passed = mode === 'submit' && judge(result, runs.length);
      const failure = sections[index]!.querySelector('.cs-failure')?.textContent?.trim();
      renderRun(
        terminalBody,
        result,
        {
          ui,
          errors: data.errors,
          lang: deps.lang,
          timeoutSeconds: deps.engine.timeoutMs / 1000,
          ...(failure ? { failure } : {}),
        },
        mode,
        passed,
        runs.length,
      );
      const line = result.compile?.diagnostics[0]?.line;
      if (line) editor.markLine(line);
      if (passed) deps.progress.mark(lessonId, current.id, 'done', code);
      announce(
        terminalBody.querySelector('.cs-ok, .cs-bad')?.textContent ??
          terminalBody.textContent?.slice(0, 120) ??
          '',
      );
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      renderStatus(terminalBody, fill(ui.engine_error, { message }), undefined, 'bad');
      announce(fill(ui.engine_error, { message }));
    } finally {
      running = false;
      setBusy(false);
    }
  }

  // --- Abrir un paso ---
  function open(target: number): void {
    if (target < 0 || target >= steps.length || target > reachable(states())) return;
    index = target;
    hintsShown = 0;
    const current = step();
    sections.forEach((section, i) => {
      section.hidden = i !== index;
    });
    root.dataset['kind'] = current.kind;
    deps.progress.setLast(lessonId, current.id);
    const exercise = current.kind === 'exercise';
    work.hidden = !exercise;
    hintBox.replaceChildren();
    if (exercise) {
      load(deps.progress.code(lessonId, current.id) ?? starterOf(current));
      const stdin = current.runs?.find((run) => run.stdin)?.stdin ?? '';
      stdinBox.value = stdin;
      stdinWrap.hidden = stdin === '';
      renderStatus(terminalBody, ui.idle);
      updateHints();
    }
    if (current.kind === 'choice') setupChoice(sections[index]!, current);
    refresh();
  }

  // --- Eventos ---
  hintButtons.forEach((button, i) => button.addEventListener('click', () => showHint(i)));
  runButton.addEventListener('click', () => void controller.run());
  submitButton.addEventListener('click', () => void controller.submit());
  resetButton.addEventListener('click', () => {
    if (!confirm(ui.reset_confirm)) return;
    load(starterOf(step()));
    deps.progress.saveCode(lessonId, step().id, starterOf(step()));
    editor.markLine(null);
    editor.focus();
  });
  backButton.addEventListener('click', () => open(index - 1));
  nextButton.addEventListener('click', () => {
    const current = step();
    if (current.kind === 'read' && deps.progress.status(lessonId, current.id) === 'pending') {
      deps.progress.mark(lessonId, current.id, 'done');
    }
    if (index < steps.length - 1) open(index + 1);
    else {
      announce(ui.lesson_done);
      navigate(data.next?.url ?? data.syllabus);
    }
  });
  menuList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-i]');
    if (button) open(Number(button.dataset['i']));
  });
  warmOnIntent(root, deps.engine);

  const controller: LessonController = {
    index: () => index,
    open,
    run: () => execute('run'),
    submit: () => execute('submit'),
    editorReady,
  };

  const last = deps.progress.last();
  const lastIndex =
    last?.lesson === lessonId ? steps.findIndex((item) => item.id === last.step) : undefined;
  open(startIndex(states(), lastIndex));
  return controller;
}
