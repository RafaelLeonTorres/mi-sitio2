// El catálogo con JavaScript: filtros por categoría, dificultad y estado, y la marca de los retos
// resueltos o empezados según el progreso guardado en este navegador. Sin JavaScript es una
// lista de enlaces (challenges-catalog.html).

import { required } from '../shared/dom';
import { announce } from '../shared/live';
import { fill } from '../shared/template';
import type { Progress } from './progress';
import type { CatalogTexts } from './texts';

export interface Filters {
  readonly category: string;
  readonly difficulty: string;
  readonly status: 'all' | 'solved' | 'pending';
}

export interface CatalogDeps {
  readonly progress: Progress;
  readonly confirm?: (message: string) => boolean;
}

/** Si un reto entra en los filtros. Sin resolver incluye los empezados. */
export function matches(
  item: { readonly category: string; readonly difficulty: string; readonly solved: boolean },
  filters: Filters,
): boolean {
  if (filters.category && item.category !== filters.category) return false;
  if (filters.difficulty && item.difficulty !== filters.difficulty) return false;
  if (filters.status === 'solved') return item.solved;
  if (filters.status === 'pending') return !item.solved;
  return true;
}

export function startCatalog(root: HTMLElement, texts: CatalogTexts, deps: CatalogDeps): void {
  const confirm = deps.confirm ?? ((message: string) => window.confirm(message));
  const form = required<HTMLFormElement>('.ch-filters', root);
  const summary = required<HTMLElement>('.ch-summary', root);
  const showing = required<HTMLElement>('.ch-showing', summary);
  const progressText = required<HTMLElement>('.ch-progress', summary);
  const clear = required<HTMLButtonElement>('.ch-clear', summary);
  const none = required<HTMLElement>('.ch-none', root);
  const groups = [...root.querySelectorAll<HTMLElement>('.ch-group')];
  const items = groups.flatMap((group) =>
    [...group.querySelectorAll<HTMLElement>('.ch-item')].map((element) => ({
      element,
      group,
      id: element.dataset['id'] ?? '',
      category: group.dataset['category'] ?? '',
      difficulty: element.dataset['difficulty'] ?? '',
    })),
  );
  form.hidden = false;
  summary.hidden = false;

  const read = (): Filters => {
    const values = new FormData(form);
    const status = String(values.get('status') ?? 'all');
    return {
      category: String(values.get('category') ?? ''),
      difficulty: String(values.get('difficulty') ?? ''),
      status: status === 'solved' || status === 'pending' ? status : 'all',
    };
  };

  const update = () => {
    const entries = deps.progress.all();
    const filters = read();
    let shown = 0;
    let solved = 0;
    for (const item of items) {
      const status = entries[item.id]?.status;
      if (status === 'solved') solved++;
      for (const badge of item.element.querySelectorAll<HTMLElement>('.ch-badge')) {
        badge.hidden = badge.dataset['status'] !== status;
      }
      const visible = matches({ ...item, solved: status === 'solved' }, filters);
      item.element.hidden = !visible;
      if (visible) shown++;
    }
    for (const group of groups) {
      group.hidden = !items.some((item) => item.group === group && !item.element.hidden);
    }
    none.hidden = shown > 0;
    showing.textContent = fill(texts.showing, { shown, total: items.length });
    progressText.textContent = fill(texts.progress, { solved, total: items.length });
    clear.hidden = Object.keys(entries).length === 0;
  };

  form.addEventListener('change', () => {
    update();
    announce(showing.textContent ?? '');
  });
  form.addEventListener('submit', (event) => event.preventDefault());
  clear.addEventListener('click', () => {
    if (!confirm(texts.reset_confirm)) return;
    deps.progress.clear();
    update();
    announce(texts.reset_done);
  });
  // Al volver con el botón Atrás, el progreso pudo cambiar en otra página.
  window.addEventListener('pageshow', update);
  update();
}
