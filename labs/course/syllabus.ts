// El temario con JavaScript: el avance de cada lección, el botón para continuar donde se quedó el
// alumno y los de exportar, importar y borrar el avance. Sin JavaScript se ve la lista de lecciones
// sin avance.

import { fill } from '../shared/template';
import type { CourseProgress } from './progress';
import type { SyllabusData } from './types';

/** El nombre del archivo del avance exportado. */
export const PROGRESS_FILE = 'mi-sitio2-curso-csharp.json';

/** Un avance de verdad pesa unos kilobytes: un archivo mucho mayor no es uno y ni se lee. */
export const MAX_IMPORT_BYTES = 10_000_000;

/** Lo que el temario hace fuera de la página; las pruebas pasan lo suyo. */
export interface SyllabusDeps {
  readonly confirm?: (message: string) => boolean;
  readonly reload?: () => void;
  /** Le entrega un archivo al alumno: una descarga. */
  readonly save?: (name: string, text: string) => void;
  /** El texto de un archivo que eligió el alumno. */
  readonly read?: (file: Blob) => Promise<string>;
}

/** Descarga un texto como archivo, sin servidor: un enlace a un Blob que se pulsa solo. */
function downloadFile(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function readFile(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function startSyllabus(
  root: HTMLElement,
  ui: SyllabusData['ui'],
  progress: CourseProgress,
  deps: SyllabusDeps = {},
): void {
  const confirm = deps.confirm ?? ((message: string) => window.confirm(message));
  const reload = deps.reload ?? (() => window.location.reload());
  const save = deps.save ?? downloadFile;
  const read = deps.read ?? readFile;

  const items = [...root.querySelectorAll<HTMLElement>('li[data-lesson]')];
  const tools = root.querySelector<HTMLElement>('.cs-progress-tools');
  const link = root.querySelector<HTMLAnchorElement>('.cs-continue');
  const exportButton = root.querySelector<HTMLButtonElement>('.cs-export-progress');
  const importButton = root.querySelector<HTMLButtonElement>('.cs-import-progress');
  const importFile = root.querySelector<HTMLInputElement>('.cs-import-file');
  const reset = root.querySelector<HTMLButtonElement>('.cs-reset-progress');
  const status = root.querySelector<HTMLElement>('.cs-progress-status');
  const note = root.querySelector<HTMLElement>('.cs-progress-note');
  const say = (message: string) => {
    if (status) status.textContent = message;
  };

  /** Pinta el avance guardado: el de cada lección y los botones que necesitan que haya algo guardado. */
  const render = () => {
    for (const item of items) {
      const total = Number(item.dataset['steps'] ?? 0);
      const done = progress.doneCount(item.dataset['lesson'] ?? '');
      const badge = item.querySelector('.cs-badge');
      if (done > 0 && badge) badge.textContent = fill(ui.done_of, { done, total });
      item.classList.toggle('cs-done', total > 0 && done >= total);
    }
    const saved = progress.hasProgress();
    const last = progress.last();
    const target = items
      .find((item) => item.dataset['lesson'] === last?.lesson)
      ?.querySelector('a');
    if (link) {
      link.hidden = !(saved && target);
      if (target) link.href = target.href;
    }
    if (exportButton) exportButton.hidden = !saved;
    if (reset) reset.hidden = !saved;
    // El aviso de que el avance vive solo en este navegador importa cuando hay algo que perder.
    if (note) note.hidden = !saved;
  };

  render();
  // Importar sirve aunque este navegador todavía no tenga nada: es para traer el avance de otro.
  if (tools) tools.hidden = false;

  exportButton?.addEventListener('click', () => {
    save(PROGRESS_FILE, progress.exportJson());
    say(fill(ui.export_done, { name: PROGRESS_FILE }));
  });

  importButton?.addEventListener('click', () => importFile?.click());
  importFile?.addEventListener('change', () => {
    const file = importFile.files?.[0];
    // Se vacía para que elegir el mismo archivo otra vez vuelva a importarlo.
    importFile.value = '';
    if (!file) return;
    void (async () => {
      let imported = false;
      if (file.size <= MAX_IMPORT_BYTES) {
        try {
          imported = progress.importJson(await read(file));
        } catch {
          imported = false;
        }
      }
      if (imported) render();
      say(imported ? ui.import_done : ui.import_failed);
    })();
  });

  reset?.addEventListener('click', () => {
    if (!confirm(ui.reset_progress_confirm)) return;
    progress.clear();
    reload();
  });
}
