// El temario con JavaScript: el avance de cada lección, el botón para continuar donde se quedó el
// alumno y el de borrar el avance. Sin JavaScript se ve la lista de lecciones sin avance.

import { fill } from '../shared/template';
import type { CourseProgress } from './progress';
import type { SyllabusData } from './types';

export function startSyllabus(
  root: HTMLElement,
  ui: SyllabusData['ui'],
  progress: CourseProgress,
  confirm: (message: string) => boolean = (message) => window.confirm(message),
  reload: () => void = () => window.location.reload(),
): void {
  const items = [...root.querySelectorAll<HTMLElement>('li[data-lesson]')];
  for (const item of items) {
    const total = Number(item.dataset['steps'] ?? 0);
    const done = progress.doneCount(item.dataset['lesson'] ?? '');
    const badge = item.querySelector('.cs-badge');
    if (done > 0 && badge) badge.textContent = fill(ui.done_of, { done, total });
    item.classList.toggle('cs-done', total > 0 && done >= total);
  }

  const actions = root.querySelector<HTMLElement>('.cs-syllabus-actions');
  const link = root.querySelector<HTMLAnchorElement>('.cs-continue');
  const reset = root.querySelector<HTMLButtonElement>('.cs-reset-progress');
  if (!actions) return;
  actions.hidden = !progress.hasProgress();
  const last = progress.last();
  const target = items.find((item) => item.dataset['lesson'] === last?.lesson)?.querySelector('a');
  if (link && target) {
    link.href = target.href;
    link.hidden = false;
  }
  reset?.addEventListener('click', () => {
    if (!confirm(ui.reset_progress_confirm)) return;
    progress.clear();
    reload();
  });
}
