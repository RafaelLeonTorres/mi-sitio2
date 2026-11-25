// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { courseUi } from './fixtures';
import { createCourseProgress, type CourseProgress } from './progress';
import { MAX_IMPORT_BYTES, PROGRESS_FILE, startSyllabus } from './syllabus';

const ui = courseUi('es');

/** El temario con los mismos elementos que _includes/course/syllabus.html: dos módulos con una lección cada uno. */
const syllabusHtml = `
<section class="cs-syllabus">
  <header>
    <div class="cs-progress-tools" hidden>
      <p class="cs-syllabus-actions">
        <a class="btn cs-continue" href="#" hidden>Continuar donde lo dejaste</a>
        <button class="cs-link cs-export-progress" type="button" hidden>Exportar mi avance</button>
        <button class="cs-link cs-import-progress" type="button">Importar un avance</button>
        <button class="cs-link cs-reset-progress" type="button" hidden>Borrar mi avance</button>
        <input class="cs-import-file" type="file" accept=".json,application/json" hidden>
      </p>
      <p class="cs-progress-status" role="status"></p>
      <p class="cs-progress-note" hidden>Tu avance se guarda solo en este navegador.</p>
    </div>
  </header>
  <section class="cs-module">
    <ol class="cs-lessons">
      <li data-lesson="one/hello" data-steps="4"><a href="/curso/uno/hola/">Hola</a> <span class="cs-badge">4 pasos</span></li>
    </ol>
  </section>
  <section class="cs-module">
    <ol class="cs-lessons">
      <li data-lesson="two/sums" data-steps="2"><a href="/curso/dos/sumas/">Sumas</a> <span class="cs-badge">2 pasos</span></li>
    </ol>
  </section>
</section>`;

interface Options {
  readonly progress?: CourseProgress;
  readonly confirm?: boolean;
  /** Cómo lee el archivo, si no es con el FileReader de verdad. */
  readonly read?: (file: Blob) => Promise<string>;
}

function setup(options: Options = {}) {
  document.body.innerHTML = syllabusHtml;
  const root = document.querySelector<HTMLElement>('.cs-syllabus')!;
  const progress = options.progress ?? createCourseProgress(null);
  const saved: { name: string; text: string }[] = [];
  const confirms: string[] = [];
  const reload = vi.fn();
  startSyllabus(root, ui, progress, {
    confirm: (message) => {
      confirms.push(message);
      return options.confirm ?? true;
    },
    reload,
    save: (name, text) => saved.push({ name, text }),
    ...(options.read ? { read: options.read } : {}),
  });
  return { root, progress, saved, confirms, reload };
}

const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`falta ${selector}`);
  return found;
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** El avance de otro navegador, ya exportado: la lección `one/hello` con tres pasos resueltos. */
function otherBrowser(): string {
  const other = createCourseProgress(null);
  for (const step of ['intro', 'print', 'ask']) other.mark('one/hello', step, 'done', 'code');
  other.setLast('one/hello', 'quiz');
  return other.exportJson();
}

/** Elige un archivo en el selector, como lo haría el alumno. */
function choose(root: ParentNode, file: File): HTMLInputElement {
  const input = q<HTMLInputElement>(root, '.cs-import-file');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return input;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('el temario sin avance', () => {
  it('ofrece importar y esconde lo que necesita un avance guardado', () => {
    const { root } = setup();
    expect(q(root, '.cs-progress-tools').hidden).toBe(false);
    expect(q(root, '.cs-import-progress').hidden).toBe(false);
    expect(q(root, '.cs-export-progress').hidden).toBe(true);
    expect(q(root, '.cs-reset-progress').hidden).toBe(true);
    expect(q(root, '.cs-continue').hidden).toBe(true);
    // El aviso de que el avance vive solo en este navegador espera a que haya algo que perder.
    expect(q(root, '.cs-progress-note').hidden).toBe(true);
    expect(q(root, '.cs-progress-status').textContent).toBe('');
  });

  it('el botón de importar abre el selector de archivos', () => {
    const { root } = setup();
    const click = vi.spyOn(q<HTMLInputElement>(root, '.cs-import-file'), 'click');
    q(root, '.cs-import-progress').click();
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe('el temario con avance', () => {
  function withProgress() {
    const progress = createCourseProgress(null);
    progress.mark('one/hello', 'intro', 'done');
    progress.mark('one/hello', 'print', 'done');
    progress.mark('two/sums', 'a', 'done');
    progress.mark('two/sums', 'b', 'done');
    progress.setLast('one/hello', 'ask');
    return setup({ progress });
  }

  it('cuenta los pasos resueltos y marca las lecciones terminadas', () => {
    const { root } = withProgress();
    const [hello, sums] = [...root.querySelectorAll<HTMLElement>('li[data-lesson]')];
    expect(hello!.querySelector('.cs-badge')!.textContent).toBe('2/4');
    expect(hello!.classList.contains('cs-done')).toBe(false);
    expect(sums!.querySelector('.cs-badge')!.textContent).toBe('2/2');
    expect(sums!.classList.contains('cs-done')).toBe(true);
  });

  it('muestra continuar, exportar y borrar, y continuar lleva a la última lección', () => {
    const { root } = withProgress();
    expect(q(root, '.cs-continue').hidden).toBe(false);
    expect(q<HTMLAnchorElement>(root, '.cs-continue').pathname).toBe('/curso/uno/hola/');
    expect(q(root, '.cs-export-progress').hidden).toBe(false);
    expect(q(root, '.cs-reset-progress').hidden).toBe(false);
    expect(q(root, '.cs-import-progress').hidden).toBe(false);
    expect(q(root, '.cs-progress-note').hidden).toBe(false);
  });

  it('exportar entrega el avance como archivo y avisa cómo se llama', () => {
    const { root, saved, progress } = withProgress();
    q(root, '.cs-export-progress').click();
    expect(saved).toEqual([{ name: PROGRESS_FILE, text: progress.exportJson() }]);
    expect(q(root, '.cs-progress-status').textContent).toBe(
      `Avance exportado en el archivo ${PROGRESS_FILE}.`,
    );
    // Lo exportado se puede importar en otro navegador.
    expect(JSON.parse(saved[0]!.text).lessons['one/hello'].intro.status).toBe('done');
  });

  it('borrar pregunta primero, y solo si el alumno acepta borra y recarga', () => {
    const declined = withProgress();
    const declinedSetup = setup({ progress: declined.progress, confirm: false });
    q(declinedSetup.root, '.cs-reset-progress').click();
    expect(declinedSetup.confirms).toEqual([ui.reset_progress_confirm]);
    expect(declinedSetup.progress.hasProgress()).toBe(true);
    expect(declinedSetup.reload).not.toHaveBeenCalled();

    const accepted = withProgress();
    q(accepted.root, '.cs-reset-progress').click();
    expect(accepted.progress.hasProgress()).toBe(false);
    expect(accepted.reload).toHaveBeenCalledTimes(1);
  });
});

describe('importar un avance', () => {
  it('mezcla el avance del archivo, lo pinta y lo avisa', async () => {
    const { root, progress } = setup();
    expect(q(root, '.cs-export-progress').hidden).toBe(true);
    choose(root, new File([otherBrowser()], 'avance.json', { type: 'application/json' }));
    // Leer el archivo es asíncrono de verdad: se espera al resultado, no a un número de turnos.
    await vi.waitFor(() => expect(progress.doneCount('one/hello')).toBe(3));
    const badge = q(root, 'li[data-lesson="one/hello"] .cs-badge');
    expect(badge.textContent).toBe('3/4');
    expect(q(root, '.cs-progress-status').textContent).toBe(ui.import_done);
    // Ahora hay avance: aparecen exportar, borrar y continuar, que lleva a donde iba el otro navegador.
    expect(q(root, '.cs-export-progress').hidden).toBe(false);
    expect(q(root, '.cs-reset-progress').hidden).toBe(false);
    expect(q(root, '.cs-progress-note').hidden).toBe(false);
    expect(q(root, '.cs-continue').hidden).toBe(false);
    expect(q<HTMLAnchorElement>(root, '.cs-continue').pathname).toBe('/curso/uno/hola/');
  });

  it('gana el estado más avanzado de cada paso: no baja lo que ya estaba resuelto', async () => {
    const progress = createCourseProgress(null);
    progress.mark('two/sums', 'a', 'done');
    const other = createCourseProgress(null);
    other.mark('two/sums', 'a', 'seen');
    other.mark('two/sums', 'b', 'done');
    const { root } = setup({ progress });
    choose(root, new File([other.exportJson()], 'avance.json'));
    await vi.waitFor(() => expect(progress.status('two/sums', 'b')).toBe('done'));
    expect(progress.status('two/sums', 'a')).toBe('done');
    expect(progress.status('two/sums', 'b')).toBe('done');
    expect(q(root, 'li[data-lesson="two/sums"] .cs-badge').textContent).toBe('2/2');
  });

  it('un archivo que no es un avance no cambia nada y lo avisa', async () => {
    const { root, progress } = setup();
    for (const text of ['esto no es json', '{"otra": 1}', '3']) {
      choose(root, new File([text], 'avance.json'));
      await vi.waitFor(() =>
        expect(q(root, '.cs-progress-status').textContent).toBe(ui.import_failed),
      );
    }
    await flush();
    expect(progress.hasProgress()).toBe(false);
    expect(q(root, '.cs-export-progress').hidden).toBe(true);
  });

  it('un archivo demasiado grande ni se lee', async () => {
    const read = vi.fn(async () => otherBrowser());
    const { root, progress } = setup({ read });
    const big = new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], 'avance.json');
    choose(root, big);
    await flush();
    expect(read).not.toHaveBeenCalled();
    expect(progress.hasProgress()).toBe(false);
    expect(q(root, '.cs-progress-status').textContent).toBe(ui.import_failed);
  });

  it('si el archivo no se puede leer, lo avisa', async () => {
    const read = vi.fn(async () => {
      throw new Error('sin permiso');
    });
    const { root, progress } = setup({ read });
    choose(root, new File(['{}'], 'avance.json'));
    await flush();
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    expect(progress.hasProgress()).toBe(false);
    expect(q(root, '.cs-progress-status').textContent).toBe(ui.import_failed);
  });

  it('sin elegir ningún archivo no hace nada', async () => {
    const { root } = setup();
    const input = q<HTMLInputElement>(root, '.cs-import-file');
    Object.defineProperty(input, 'files', { value: [], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(q(root, '.cs-progress-status').textContent).toBe('');
  });
});

describe('las funciones del navegador', () => {
  it('descarga con un enlace a un Blob y lo libera', () => {
    const urls: Blob[] = [];
    const revoke = vi.fn();
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      urls.push(blob as Blob);
      return 'blob:avance';
    };
    URL.revokeObjectURL = revoke;
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
    document.body.innerHTML = syllabusHtml;
    const root = document.querySelector<HTMLElement>('.cs-syllabus')!;
    const progress = createCourseProgress(null);
    progress.mark('one/hello', 'intro', 'done');
    // Sin `save`: usa la descarga de verdad.
    startSyllabus(root, ui, progress, { reload: () => undefined });
    q(root, '.cs-export-progress').click();
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.download).toBe(PROGRESS_FILE);
    expect(clicked[0]!.getAttribute('href')).toBe('blob:avance');
    expect(urls[0]!.type).toBe('application/json');
    // El enlace no se queda en la página.
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('lee el archivo elegido con un FileReader', async () => {
    document.body.innerHTML = syllabusHtml;
    const root = document.querySelector<HTMLElement>('.cs-syllabus')!;
    const progress = createCourseProgress(null);
    // Sin `read`: lee de verdad el archivo.
    startSyllabus(root, ui, progress, { reload: () => undefined });
    choose(root, new File([otherBrowser()], 'avance.json'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(progress.doneCount('one/hello')).toBe(3);
    expect(q(root, '.cs-progress-status').textContent).toBe(ui.import_done);
  });
});
