// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { CourseEngine } from './engine';
import { lessonData, sqlCourseUi } from './fixtures';
import { startLesson } from './lesson';
import { createCourseProgress, type CourseProgress } from './progress';
import type { StepData } from './types';

// El paso capturado (kind: captured) en el núcleo de la lección: no lleva editor; su predicción se
// contesta como una pregunta de opción, y Ver salida muestra lo que grabó un servidor real sin
// contestarla. Su HTML es el de _includes/course/lesson.html y captured.html.

const LESSON = 'demo/sql';

const html = `
<div class="cs-lesson" data-lesson="demo/sql">
  <header class="cs-top">
    <div class="cs-progress" role="progressbar" aria-valuenow="0" hidden>
      <span class="cs-progress-track"><span class="cs-progress-bar"></span></span>
      <span class="cs-progress-text">0 %</span>
    </div>
  </header>
  <div class="cs-layout">
    <article class="cs-text">
      <section class="cs-step" id="what" data-step="what" data-kind="read" data-title="Introducción">
        <h2>1. Introducción</h2><p>Texto.</p>
      </section>
      <section class="cs-step" id="divide" data-step="divide" data-kind="captured" data-title="Dividir">
        <h2>2. Dividir</h2>
        <h3>Código</h3>
        <div class="cs-script"><pre>SELECT 1 / 0;</pre></div>
        <div class="cs-predict">
          <h4>Antes de ver la salida</h4>
          <p class="cs-question">¿Qué pasa?</p>
          <ul class="cs-options"><li>Un error</li><li>Un cero</li></ul>
        </div>
        <details class="cs-solution cs-captured">
          <summary>Ver salida</summary>
          <p>Salida grabada de la división.</p>
        </details>
      </section>
      <section class="cs-step" id="plain" data-step="plain" data-kind="captured" data-title="Sin pregunta">
        <h2>3. Sin pregunta</h2>
        <div class="cs-script"><pre>PRINT 1;</pre></div>
        <details class="cs-solution cs-captured">
          <summary>Ver salida</summary>
          <p>Salida grabada del PRINT.</p>
        </details>
      </section>
    </article>
    <aside class="cs-work ch-work" hidden></aside>
  </div>
  <footer class="cs-bottom" hidden></footer>
</div>`;

const steps: StepData[] = [
  { id: 'what', kind: 'read' },
  { id: 'divide', kind: 'captured', predict: { answer: 0 } },
  { id: 'plain', kind: 'captured' },
];

function setup(solved: readonly string[] = ['what']) {
  document.body.innerHTML = html;
  const root = document.querySelector<HTMLElement>('.cs-lesson')!;
  const progress = createCourseProgress(null);
  for (const id of solved) progress.mark(LESSON, id, 'done');
  return start(root, progress);
}

function start(root: HTMLElement, progress: CourseProgress) {
  const engine: CourseEngine = {
    id: 'sql',
    editorLanguage: 'sql',
    fileLabel: 'consulta.sql',
    panels: {
      input: null,
      output: document.createElement('section'),
      body: document.createElement('div'),
      empty: () => undefined,
      open: () => undefined,
    },
    warm: async () => undefined,
    run: async () => ({ passed: false, announcement: '' }),
    check: async () => ({ passed: false, announcement: '' }),
  };
  const data = lessonData('es', { id: LESSON, steps, ui: sqlCourseUi('es') });
  const controller = startLesson(root, data, {
    engine,
    progress,
    lang: 'es',
    navigate: () => undefined,
  });
  return { root, controller, progress };
}

const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`falta ${selector}`);
  return found;
};
const button = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('button')].find((item) => item.textContent === label);
const choose = (root: ParentNode, value: number) => {
  const radio = q<HTMLInputElement>(root, `input[value="${value}"]`);
  radio.checked = true;
};
const output = (root: ParentNode, id: string) =>
  q<HTMLDetailsElement>(root, `#${id} details.cs-solution`);

describe('un paso capturado con predicción', () => {
  it('se abre sin editor, con su pregunta como formulario y la salida sin mostrar', () => {
    const { root, controller } = setup();
    expect(controller.index()).toBe(1);
    expect(root.dataset['kind']).toBe('captured');
    expect(q(root, '.cs-work').hidden).toBe(true);
    const form = q(root, '#divide .cs-predict .cs-form');
    expect(form.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(button(form, 'Enviar')).toBeDefined();
    expect(button(form, 'Ver salida')).toBeDefined();
    expect(q(root, '#divide').classList.contains('cs-answered')).toBe(false);
    expect(output(root, 'divide').open).toBe(false);
    expect(q(root, '.cs-counter').textContent).toBe('Salida capturada 2 de 3');
    expect(button(root, 'Siguiente')?.disabled).toBe(true);
  });

  it('una predicción equivocada no muestra la salida ni resuelve el paso', () => {
    const { root, progress } = setup();
    choose(root, 1);
    button(root, 'Enviar')?.click();
    expect(q(root, '.cs-feedback').textContent).toBe('Esa no es. Inténtalo de nuevo.');
    expect(progress.status(LESSON, 'divide')).toBe('pending');
    expect(output(root, 'divide').open).toBe(false);
    expect(button(root, 'Siguiente')?.disabled).toBe(true);
  });

  it('sin elegir nada pide elegir', () => {
    const { root } = setup();
    button(root, 'Enviar')?.click();
    expect(q(root, '.cs-feedback').textContent).toBe('Elige una opción.');
  });

  it('acertar la predicción resuelve el paso y muestra la salida', () => {
    const { root, progress } = setup();
    choose(root, 0);
    button(root, 'Enviar')?.click();
    expect(q(root, '.cs-feedback').textContent).toBe('¡Correcto!');
    expect(progress.status(LESSON, 'divide')).toBe('done');
    expect(q(root, '#divide').classList.contains('cs-answered')).toBe(true);
    expect(output(root, 'divide').open).toBe(true);
    expect(button(root, 'Siguiente')?.disabled).toBe(false);
  });

  it('Ver salida sin contestar muestra la salida y deja el paso en "visto"', () => {
    const { root, progress } = setup();
    button(root, 'Ver salida')?.click();
    expect(progress.status(LESSON, 'divide')).toBe('seen');
    expect(output(root, 'divide').open).toBe(true);
    expect(q(root, '.cs-chip').textContent).toBe('Visto');
    expect(button(root, 'Siguiente')?.disabled).toBe(false);
  });

  it('si ya acertó antes, la salida está a la vista; si se equivocó y la vio, también', () => {
    const done = setup(['what']);
    done.progress.mark(LESSON, 'divide', 'done');
    done.controller.open(1);
    expect(output(done.root, 'divide').open).toBe(true);
    const seen = setup(['what']);
    seen.progress.mark(LESSON, 'divide', 'seen');
    seen.controller.open(1);
    expect(output(seen.root, 'divide').open).toBe(true);
  });
});

describe('un paso capturado sin predicción', () => {
  it('solo trae Ver salida, y verla lo resuelve', () => {
    const { root, progress } = setup(['what', 'divide']);
    const section = q(root, '#plain');
    expect(section.querySelectorAll('input')).toHaveLength(0);
    expect(button(section, 'Enviar')).toBeUndefined();
    button(section, 'Ver salida')?.click();
    expect(progress.status(LESSON, 'plain')).toBe('done');
    expect(output(root, 'plain').open).toBe(true);
    expect(button(root, 'Siguiente lección')?.disabled).toBe(false);
  });
});
