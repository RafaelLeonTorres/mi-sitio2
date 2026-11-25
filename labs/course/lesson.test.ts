// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { CsProgramRun } from '../challenges/csharp/engine';
import type { CsProgramRequest } from '../challenges/csharp/protocol';
import { textareaEditor, type CreateEditor } from '../shared/editor-api';
import type { Phase } from '../shared/engine';
import { brokenProgram, lessonData, lessonHtml, program, semicolonError } from './fixtures';
import { createCsharpAdapter, type LessonEngine } from './engines/csharp';
import { startLesson } from './lesson';
import { createCourseProgress, type CourseProgress } from './progress';
import type { LessonData } from './types';

const LESSON = 'demo/lesson';
const STEPS = ['intro', 'print', 'ask', 'quiz'];

interface Options {
  /** Cómo responde el motor falso. */
  readonly answer?: (request: CsProgramRequest) => CsProgramRun | Promise<CsProgramRun>;
  /** Los pasos que el alumno ya resolvió antes de abrir la lección. */
  readonly solved?: readonly string[];
  readonly progress?: CourseProgress;
  readonly confirm?: boolean;
  readonly loaded?: boolean;
  /** Los avisos de fase que manda el motor falso antes de responder. */
  readonly phases?: readonly Phase[];
  readonly loadEditor?: () => Promise<CreateEditor>;
  readonly data?: Partial<LessonData>;
  /** La página, si no es la de siempre. */
  readonly html?: string;
}

function setup(options: Options = {}) {
  document.body.innerHTML = options.html ?? lessonHtml;
  const root = document.querySelector<HTMLElement>('.cs-lesson')!;
  const progress = options.progress ?? createCourseProgress(null);
  for (const id of options.solved ?? []) progress.mark(LESSON, id, 'done');
  const requests: CsProgramRequest[] = [];
  const confirms: string[] = [];
  const navigated: string[] = [];
  const warm = vi.fn(async () => undefined);
  const engine: LessonEngine = {
    timeoutMs: 5000,
    loaded: options.loaded ?? true,
    runProgram: async (request, onProgress) => {
      requests.push(request);
      for (const phase of options.phases ?? ['running']) onProgress?.(phase, 0);
      return (options.answer ?? (() => program([{ stdout: '' }])))(request);
    },
    warm,
  };
  const data = lessonData('es', options.data);
  const controller = startLesson(root, data, {
    engine: createCsharpAdapter(engine, data, 'es'),
    progress,
    lang: 'es',
    confirm: (message) => {
      confirms.push(message);
      return options.confirm ?? true;
    },
    navigate: (url) => navigated.push(url),
    ...(options.loadEditor ? { loadEditor: options.loadEditor } : {}),
  });
  return { root, controller, progress, requests, confirms, navigated, warm };
}

const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`falta ${selector}`);
  return found;
};
const texts = (root: ParentNode, selector: string) =>
  [...root.querySelectorAll(selector)].map((node) => node.textContent);
const button = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('button')].find((item) => item.textContent === label);
const editor = (root: ParentNode) => q<HTMLTextAreaElement>(root, '.cs-editor textarea');
const terminal = (root: ParentNode) => q(root, '.cs-terminal-body');
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Escribe en el editor como lo haría el alumno. */
function type(root: ParentNode, code: string): void {
  const area = editor(root);
  area.value = code;
  area.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Una respuesta del motor que se resuelve cuando el prueba lo decide. */
function deferred() {
  let release!: (run: CsProgramRun) => void;
  const promise = new Promise<CsProgramRun>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('al abrir la lección', () => {
  it('muestra el primer paso, oculta el resto y enciende el pie y el avance', () => {
    const { root, controller } = setup();
    expect(controller.index()).toBe(0);
    expect(
      [...root.querySelectorAll<HTMLElement>('.cs-step')].map((section) => section.hidden),
    ).toEqual([false, true, true, true]);
    expect(root.dataset['kind']).toBe('read');
    expect(root.classList.contains('cs-js')).toBe(true);
    expect(q(root, '.cs-progress').hidden).toBe(false);
    expect(q(root, '.cs-bottom').hidden).toBe(false);
    expect(q(root, '.cs-work').hidden).toBe(true);
    expect(q(root, '.cs-counter').textContent).toBe('Lectura 1 de 4');
    expect(q(root, '.cs-chip').textContent).toBe('Pendiente');
    expect(button(root, 'Atrás')?.disabled).toBe(true);
    expect(button(root, 'Entendido, siguiente')?.disabled).toBe(false);
  });

  it('abre en el primer paso pendiente, no en el primero', () => {
    const { controller, root } = setup({ solved: ['intro', 'print'] });
    expect(controller.index()).toBe(2);
    expect(root.dataset['kind']).toBe('exercise');
    expect(q(root, '.cs-progress-text').textContent).toBe('50 %');
  });

  it('con la lección terminada abre en el último paso', () => {
    const { controller, root } = setup({ solved: STEPS });
    expect(controller.index()).toBe(3);
    expect(q(root, '.cs-progress-text').textContent).toBe('100 %');
    expect(q(root, '.cs-progress').getAttribute('aria-valuenow')).toBe('100');
  });

  it('Entendido marca la lectura y abre el ejercicio con su código inicial', () => {
    const { root, controller, progress } = setup();
    button(root, 'Entendido, siguiente')?.click();
    expect(progress.status(LESSON, 'intro')).toBe('done');
    expect(controller.index()).toBe(1);
    expect(q(root, '.cs-work').hidden).toBe(false);
    expect(editor(root).value).toBe('// escribe');
    expect(terminal(root).textContent).toBe('Pulsa Ejecutar para ver el resultado.');
    expect(q(root, '.cs-progress-text').textContent).toBe('25 %');
    expect(button(root, 'Siguiente')?.disabled).toBe(true);
  });

  it('recuerda el código y el paso donde se quedó el alumno', () => {
    const progress = createCourseProgress(null);
    const first = setup({ progress, solved: ['intro'] });
    type(first.root, 'var x = 1;');
    expect(progress.code(LESSON, 'print')).toBe('var x = 1;');
    const second = setup({ progress });
    expect(second.controller.index()).toBe(1);
    expect(editor(second.root).value).toBe('var x = 1;');
  });

  it('cargar el código de un paso no lo cuenta como algo que escribió el alumno', () => {
    const { progress } = setup({ solved: ['intro'] });
    expect(progress.code(LESSON, 'print')).toBeUndefined();
  });

  it('el código inicial del idioma de la página reemplaza al compartido', () => {
    const { root, progress } = setup({
      solved: ['intro'],
      data: { starters: { print: '// Escribe tu código aquí' } },
    });
    expect(editor(root).value).toBe('// Escribe tu código aquí');
    type(root, 'x');
    button(root, 'Restablecer')?.click();
    expect(editor(root).value).toBe('// Escribe tu código aquí');
    expect(progress.code(LESSON, 'print')).toBe('// Escribe tu código aquí');
  });
});

describe('Ejecutar y Enviar', () => {
  it('Ejecutar corre el código tal cual, sin revisiones, y muestra la salida', async () => {
    const { root, controller, requests, progress } = setup({
      solved: ['intro'],
      answer: () => program([{ stdout: 'Hola\n' }]),
    });
    await controller.run();
    expect(requests).toEqual([{ code: '// escribe', runs: [{ stdin: '' }], rules: [] }]);
    expect(texts(terminal(root), 'pre.cs-out')).toEqual(['Hola\n']);
    expect(progress.status(LESSON, 'print')).toBe('pending');
  });

  it('Enviar manda las ejecuciones y las reglas del paso, y si pasa lo marca resuelto', async () => {
    const { root, controller, requests, progress } = setup({
      solved: ['intro'],
      answer: () =>
        program(
          [{ stdout: 'Hola\n' }],
          [{ kind: 'calls-method', name: 'Console.WriteLine', passed: true }],
        ),
    });
    type(root, 'Console.WriteLine("Hola");');
    await controller.submit();
    expect(requests).toEqual([
      {
        code: 'Console.WriteLine("Hola");',
        runs: [{ stdin: '', stdout: 'Hola\n' }],
        rules: [{ kind: 'calls-method', name: 'Console.WriteLine' }],
      },
    ]);
    expect(q(terminal(root), '.cs-ok').textContent).toBe('¡Correcto!');
    expect(progress.status(LESSON, 'print')).toBe('done');
    expect(progress.code(LESSON, 'print')).toBe('Console.WriteLine("Hola");');
    expect(q(root, '.cs-chip').textContent).toBe('Resuelto');
    expect(q(root, '.cs-progress-text').textContent).toBe('50 %');
    expect(button(root, 'Siguiente')?.disabled).toBe(false);
    expect(document.getElementById('lab-live')?.textContent).toBe('¡Correcto!');
  });

  it('Enviar con una salida distinta no marca el paso y explica qué falló', async () => {
    const { root, controller, progress } = setup({
      solved: ['intro'],
      answer: () =>
        program([{ stdout: 'hola\n', passed: false, failed: ['stdout'], expected: 'Hola\n' }]),
    });
    type(root, 'Console.WriteLine("hola");');
    await controller.submit();
    expect(progress.status(LESSON, 'print')).toBe('pending');
    expect(q(terminal(root), '.cs-bad').textContent).toBe('Todavía no.');
    expect(texts(terminal(root), 'pre.cs-out')).toEqual(['hola\n', 'Hola\n']);
    expect(q(terminal(root), '.cs-tip').textContent).toBe('Revisa el texto: debe ser Hola.');
    expect(button(root, 'Siguiente')?.disabled).toBe(true);
  });

  it('un error de compilación se explica y no marca el paso', async () => {
    const { root, controller, progress } = setup({
      solved: ['intro'],
      answer: () => brokenProgram(semicolonError),
    });
    type(root, 'Console.WriteLine("Hola")');
    await controller.submit();
    expect(texts(terminal(root), '.cs-diag p')[0]).toBe('línea 1: CS1002');
    expect(progress.status(LESSON, 'print')).toBe('pending');
  });

  it('sin código no llama al motor', async () => {
    const { root, controller, requests } = setup({ solved: ['intro'] });
    type(root, '   ');
    await controller.run();
    await controller.submit();
    expect(requests).toEqual([]);
    expect(terminal(root).textContent).toBe('Escribe algo de código primero.');
    // Repetir el mismo aviso le agrega un espacio para que el lector de pantalla lo diga otra vez.
    expect(document.getElementById('lab-live')?.textContent?.trim()).toBe(
      'Escribe algo de código primero.',
    );
  });

  it('si el motor falla, lo dice y deja volver a intentar', async () => {
    const { root, controller } = setup({
      solved: ['intro'],
      answer: () => {
        throw new Error('sin red');
      },
    });
    await controller.run();
    expect(q(terminal(root), '.cs-bad').textContent).toBe('El motor falló: sin red');
    expect(q<HTMLButtonElement>(root, '.cs-run').disabled).toBe(false);
    expect(q<HTMLButtonElement>(root, '.cs-submit').disabled).toBe(false);
  });

  it('no corre dos veces a la vez y bloquea los botones mientras corre', async () => {
    const reply = deferred();
    const { root, controller, requests } = setup({
      solved: ['intro'],
      answer: () => reply.promise,
    });
    const first = controller.run();
    const second = controller.submit();
    expect(requests).toHaveLength(1);
    expect(q<HTMLButtonElement>(root, '.cs-run').disabled).toBe(true);
    expect(q<HTMLButtonElement>(root, '.cs-hint-btn').disabled).toBe(true);
    expect(q(root, '.cs-terminal').hasAttribute('aria-busy')).toBe(true);
    reply.release(program([{ stdout: 'a' }]));
    await Promise.all([first, second]);
    expect(q<HTMLButtonElement>(root, '.cs-run').disabled).toBe(false);
    expect(q(root, '.cs-terminal').hasAttribute('aria-busy')).toBe(false);
  });

  it('mientras el motor carga, la terminal lo avisa', async () => {
    const reply = deferred();
    const { root, controller } = setup({
      solved: ['intro'],
      loaded: false,
      phases: ['loading'],
      answer: () => reply.promise,
    });
    const running = controller.run();
    expect(terminal(root).textContent).toContain('Cargando el motor de C#');
    expect(terminal(root).textContent).toContain('unos 9 MB');
    reply.release(program([{ stdout: 'a' }]));
    await running;
    expect(terminal(root).textContent).not.toContain('Cargando');
  });

  it('Ctrl+Enter ejecuta y Ctrl+Mayús+Enter envía', async () => {
    const { root, requests } = setup({ solved: ['intro'] });
    const press = (shiftKey: boolean) =>
      editor(root).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, shiftKey, bubbles: true }),
      );
    press(false);
    await flush();
    press(true);
    await flush();
    expect(requests.map((request) => request.rules.length)).toEqual([0, 1]);
  });

  it('un paso con entrada simulada la muestra en su caja y la manda al ejecutar', async () => {
    const { root, controller, requests } = setup({ solved: ['intro', 'print'] });
    expect(q(root, '.cs-stdin').hidden).toBe(false);
    expect(q<HTMLTextAreaElement>(root, '.cs-stdin textarea').value).toBe('Ana\n');
    q<HTMLTextAreaElement>(root, '.cs-stdin textarea').value = 'Luis\n';
    type(root, 'var name = Console.ReadLine();');
    await controller.run();
    await controller.submit();
    expect(requests.map((request) => request.runs)).toEqual([
      [{ stdin: 'Luis\n' }],
      [{ stdin: 'Ana\n', stdout: 'Hola, Ana\n' }],
    ]);
  });

  it('un paso sin entrada esconde su caja', () => {
    const { root } = setup({ solved: ['intro'] });
    expect(q(root, '.cs-stdin').hidden).toBe(true);
  });
});

describe('pistas y solución', () => {
  it('cada botón muestra su pista y las anteriores', () => {
    const { root } = setup({ solved: ['intro'] });
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.cs-hint-btn')];
    expect(buttons.map((item) => item.disabled)).toEqual([false, false, false]);
    buttons[1]?.click();
    expect(texts(root, '.cs-hintbox .cs-hint')).toEqual([
      'Pista 1: Usa Console.WriteLine.',
      'Pista 2: El texto va entre comillas.',
    ]);
    expect(buttons.map((item) => item.getAttribute('aria-pressed'))).toEqual([
      'true',
      'true',
      'false',
    ]);
    expect(button(root, 'Ver solución')).toBeUndefined();
    buttons[2]?.click();
    expect(button(root, 'Ver solución')).toBeDefined();
  });

  it('un paso con una sola pista deja los otros botones apagados', () => {
    const { root } = setup({ solved: ['intro', 'print'] });
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.cs-hint-btn')];
    expect(buttons.map((item) => item.disabled)).toEqual([false, true, true]);
  });

  it('Ver solución la muestra con su explicación y marca el paso como visto', () => {
    const { root, progress } = setup({ solved: ['intro'] });
    root.querySelectorAll<HTMLButtonElement>('.cs-hint-btn')[2]?.click();
    button(root, 'Ver solución')?.click();
    const shown = terminal(root);
    expect(q(shown, 'h3').textContent).toBe('Solución');
    expect(texts(shown, 'pre')).toEqual(['Console.WriteLine("Hola");']);
    expect(shown.textContent).toContain('Así se imprime.');
    expect(progress.status(LESSON, 'print')).toBe('seen');
    expect(q(root, '.cs-chip').textContent).toBe('Visto');
    // Verla deja avanzar, pero no cuenta como resuelto.
    expect(button(root, 'Siguiente')?.disabled).toBe(false);
    expect(q(root, '.cs-progress-text').textContent).toBe('25 %');
  });

  it('Cargar en el editor pone la solución y la guarda', () => {
    const { root, progress } = setup({ solved: ['intro'] });
    root.querySelectorAll<HTMLButtonElement>('.cs-hint-btn')[2]?.click();
    button(root, 'Ver solución')?.click();
    button(root, 'Cargar en el editor')?.click();
    expect(editor(root).value).toBe('Console.WriteLine("Hola");');
    expect(progress.code(LESSON, 'print')).toBe('Console.WriteLine("Hola");');
  });

  it('ver la solución de un paso resuelto lo deja resuelto', () => {
    const { root, progress } = setup({ solved: ['intro', 'print'] });
    root.querySelectorAll<HTMLButtonElement>('.cs-hint-btn')[0]?.click();
    button(root, 'Ver solución')?.click();
    expect(progress.status(LESSON, 'ask')).toBe('seen');
    expect(progress.status(LESSON, 'print')).toBe('done');
  });

  it('las pistas empiezan de nuevo al abrir otro paso', () => {
    const { root, controller } = setup({ solved: ['intro', 'print'] });
    root.querySelectorAll<HTMLButtonElement>('.cs-hint-btn')[0]?.click();
    expect(root.querySelectorAll('.cs-hint')).toHaveLength(1);
    controller.open(1);
    expect(root.querySelectorAll('.cs-hint')).toHaveLength(0);
    expect(
      [...root.querySelectorAll('.cs-hint-btn')].map((item) => item.getAttribute('aria-pressed')),
    ).toEqual(['false', 'false', 'false']);
  });
});

describe('Restablecer', () => {
  it('vuelve al código inicial solo si el alumno confirma', () => {
    const declined = setup({ solved: ['intro'], confirm: false });
    type(declined.root, 'x');
    button(declined.root, 'Restablecer')?.click();
    expect(editor(declined.root).value).toBe('x');

    const accepted = setup({ solved: ['intro'], confirm: true });
    type(accepted.root, 'x');
    button(accepted.root, 'Restablecer')?.click();
    expect(editor(accepted.root).value).toBe('// escribe');
    expect(accepted.progress.code(LESSON, 'print')).toBe('// escribe');
    expect(accepted.confirms).toEqual([
      '¿Restablecer el código de este paso? Se pierde lo que escribiste.',
    ]);
  });
});

describe('preguntas de opción', () => {
  it('muestran sus opciones y no usan el editor', () => {
    const { root } = setup({ solved: ['intro', 'print', 'ask'] });
    expect(root.dataset['kind']).toBe('choice');
    expect(q(root, '.cs-work').hidden).toBe(true);
    expect(root.querySelectorAll('input[type="radio"]')).toHaveLength(3);
    expect(texts(root, '.cs-option')).toEqual(['Nada', 'Texto', 'Un archivo']);
  });

  it('sin elegir pide elegir, una incorrecta lo dice y la correcta marca el paso', () => {
    const { root, progress } = setup({ solved: ['intro', 'print', 'ask'] });
    const form = q<HTMLFormElement>(root, '.cs-form');
    const feedback = () => q(root, '.cs-feedback').textContent;
    const submit = () => form.dispatchEvent(new Event('submit', { cancelable: true }));
    const radios = [...root.querySelectorAll<HTMLInputElement>('input[type="radio"]')];

    submit();
    expect(feedback()).toBe('Elige una opción.');

    radios[0]!.checked = true;
    submit();
    expect(feedback()).toBe('Esa no es. Inténtalo de nuevo.');
    expect(progress.status(LESSON, 'quiz')).toBe('pending');

    radios[1]!.checked = true;
    submit();
    expect(feedback()).toBe('¡Correcto!');
    expect(progress.status(LESSON, 'quiz')).toBe('done');
    expect(q(root, '.cs-step[data-step="quiz"]').classList.contains('cs-answered')).toBe(true);
    expect(q(root, '.cs-chip').textContent).toBe('Resuelto');
    expect(q(root, '.cs-progress-text').textContent).toBe('100 %');
  });

  it('una opción con código lo conserva dentro de un solo <span>', () => {
    const { root } = setup({
      solved: ['intro', 'print', 'ask'],
      html: lessonHtml.replace('<li>Texto</li>', '<li>Escribe <code>Hola</code> en pantalla</li>'),
    });
    const second = root.querySelectorAll('.cs-option')[1]!;
    expect(second.textContent).toBe('Escribe Hola en pantalla');
    expect(second.querySelectorAll(':scope > span > code')).toHaveLength(1);
    expect(second.children).toHaveLength(2);
  });

  it('una pregunta ya resuelta se abre marcada como respondida', () => {
    const { root } = setup({ solved: STEPS });
    expect(q(root, '.cs-step[data-step="quiz"]').classList.contains('cs-answered')).toBe(true);
    expect(q<HTMLDetailsElement>(root, '.cs-step[data-step="quiz"] details').open).toBe(true);
  });

  it('la respuesta sigue cerrada hasta que el alumno acierta', () => {
    const { root } = setup({ solved: ['intro', 'print', 'ask'] });
    const answer = q<HTMLDetailsElement>(root, '.cs-step[data-step="quiz"] details');
    expect(answer.open).toBe(false);
    const radios = root.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    radios[0]!.checked = true;
    q<HTMLFormElement>(root, '.cs-form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(answer.open).toBe(false);
    radios[1]!.checked = true;
    q<HTMLFormElement>(root, '.cs-form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(answer.open).toBe(true);
  });

  it('volver a abrir la pregunta no duplica el formulario', () => {
    const { root, controller } = setup({ solved: STEPS });
    controller.open(0);
    controller.open(3);
    expect(root.querySelectorAll('.cs-form')).toHaveLength(1);
  });
});

describe('menú y navegación', () => {
  it('el menú solo deja abrir los pasos que ya se alcanzaron', () => {
    const { root, controller } = setup({ solved: ['intro'] });
    const items = () => [...root.querySelectorAll<HTMLButtonElement>('.cs-menu-item')];
    expect(items().map((item) => item.disabled)).toEqual([false, false, true, true]);
    expect(items().map((item) => item.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      null,
      null,
    ]);
    expect(items()[0]?.textContent).toContain('1. Introducción');
    expect(items()[0]?.textContent).toContain('Resuelto');
    items()[0]?.click();
    expect(controller.index()).toBe(0);
    controller.open(3);
    expect(controller.index()).toBe(0);
    controller.open(-1);
    expect(controller.index()).toBe(0);
  });

  it('Atrás y Siguiente cambian de paso', () => {
    const { root, controller } = setup({ solved: ['intro', 'print'] });
    button(root, 'Atrás')?.click();
    expect(controller.index()).toBe(1);
    button(root, 'Siguiente')?.click();
    expect(controller.index()).toBe(2);
  });

  it('en el último paso, Siguiente lleva a la lección que sigue', () => {
    const { root, navigated } = setup({ solved: STEPS });
    button(root, 'Siguiente lección')?.click();
    expect(navigated).toEqual(['/curso/csharp/otra/']);
    expect(document.getElementById('lab-live')?.textContent).toBe('Terminaste la lección.');
  });

  it('en el último paso de la última lección, vuelve al temario', () => {
    const { root, navigated } = setup({ solved: STEPS, data: { next: null } });
    button(root, 'Volver al temario')?.click();
    expect(navigated).toEqual(['/curso/csharp/']);
  });
});

describe('el motor y el editor', () => {
  it('el motor se descarga al acercarse al editor, una sola vez', () => {
    const { root, warm } = setup({ solved: ['intro'] });
    expect(warm).not.toHaveBeenCalled();
    const work = q(root, '.cs-work');
    work.dispatchEvent(new Event('pointerover', { bubbles: true }));
    work.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(warm).toHaveBeenCalledTimes(1);
  });

  it('el editor se cambia por CodeMirror al cargar, sin perder el código', async () => {
    const docs: string[] = [];
    const create: CreateEditor = (host, options) => {
      docs.push(options.doc);
      return textareaEditor(host, options);
    };
    const { root, controller } = setup({ solved: ['intro'], loadEditor: async () => create });
    type(root, 'var a = 1;');
    await controller.editorReady;
    expect(docs).toEqual(['var a = 1;']);
    expect(editor(root).value).toBe('var a = 1;');
  });

  it('si el editor no carga, se queda el <textarea>', async () => {
    const { root, controller } = setup({
      solved: ['intro'],
      loadEditor: () => Promise.reject(new Error('sin red')),
    });
    await controller.editorReady;
    type(root, 'var b = 2;');
    expect(editor(root).value).toBe('var b = 2;');
  });
});
