// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { matches, startCatalog } from './catalog';
import { uiTexts } from './fixtures';
import { createProgress } from './progress';

function catalogHtml(): string {
  const item = (id: string, difficulty: string) => `
      <li class="ch-item" data-id="${id}" data-difficulty="${difficulty}">
        <a class="ch-item-title" href="#">${id}</a>
        <span class="ch-badge" data-status="solved" hidden>Resuelto</span>
        <span class="ch-badge" data-status="started" hidden>Empezado</span>
      </li>`;
  return `
<div class="ch-catalog">
  <form class="ch-filters" hidden>
    <input type="radio" name="language" value="" checked><input type="radio" name="language" value="sql"><input type="radio" name="language" value="csharp">
    <fieldset class="ch-category-filter">
      <label><input type="radio" name="category" value="" checked></label>
      <label data-language="sql"><input type="radio" name="category" value="queries"></label>
      <label data-language="csharp"><input type="radio" name="category" value="linq"></label>
    </fieldset>
    <input type="radio" name="difficulty" value="" checked><input type="radio" name="difficulty" value="hard">
    <input type="radio" name="status" value="all" checked><input type="radio" name="status" value="solved"><input type="radio" name="status" value="pending">
  </form>
  <div class="ch-summary" hidden><p class="ch-showing"></p><p class="ch-progress"></p><button class="ch-clear" type="button">Borrar</button></div>
  <p class="ch-none" hidden>Nada</p>
  <section class="ch-language" data-language="csharp">
    <section class="ch-group" data-language="csharp" data-category="linq"><ul>${item('d', 'easy')}</ul></section>
  </section>
  <section class="ch-language" data-language="sql">
    <section class="ch-group" data-language="sql" data-category="queries"><ul>${item('a', 'easy')}${item('b', 'hard')}</ul></section>
    <section class="ch-group" data-language="sql" data-category="changes"><ul>${item('c', 'hard')}</ul></section>
  </section>
</div>`;
}

describe('matches', () => {
  it('sin resolver incluye los empezados', () => {
    const item = { language: 'sql', category: 'queries', difficulty: 'hard', solved: false };
    const any = { language: '', category: '', difficulty: '' };
    expect(matches(item, { ...any, status: 'pending' })).toBe(true);
    expect(matches(item, { ...any, category: 'changes', status: 'all' })).toBe(false);
    expect(matches(item, { ...any, language: 'csharp', status: 'all' })).toBe(false);
    expect(
      matches({ ...item, solved: true }, { ...any, difficulty: 'hard', status: 'solved' }),
    ).toBe(true);
  });
});

describe('startCatalog', () => {
  it('marca el progreso, filtra y borra', () => {
    document.body.innerHTML = catalogHtml();
    const root = document.querySelector<HTMLElement>('.ch-catalog');
    if (!root) throw new Error('falta el catálogo');
    const progress = createProgress(null);
    progress.markSolved('a', 'x');
    progress.markStarted('b');
    startCatalog(root, uiTexts('es').catalog, { progress, confirm: () => true });
    const badge = (id: string, status: string) =>
      root.querySelector<HTMLElement>(`[data-id="${id}"] [data-status="${status}"]`)?.hidden;
    expect(badge('a', 'solved')).toBe(false);
    expect(badge('b', 'started')).toBe(false);
    expect(root.querySelector('.ch-progress')?.textContent).toBe('Resueltos 1 de 4.');

    const pick = (name: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
      if (input) input.checked = true;
      root.querySelector('form')?.dispatchEvent(new Event('change'));
    };
    pick('difficulty', 'hard');
    pick('status', 'pending');
    const visible = [...root.querySelectorAll<HTMLElement>('.ch-item')]
      .filter((item) => !item.hidden)
      .map((item) => item.dataset['id']);
    expect(visible).toEqual(['b', 'c']);
    expect(root.querySelector('.ch-showing')?.textContent).toBe('Se muestran 2 de 4 retos.');
    expect(root.querySelector<HTMLElement>('.ch-language[data-language="csharp"]')?.hidden).toBe(
      true,
    );
    // Sin lenguaje no hay filtro de categoría; con uno, solo sus categorías.
    const field = root.querySelector<HTMLElement>('.ch-category-filter');
    const option = (value: string) =>
      root
        .querySelector<HTMLInputElement>(`input[name="category"][value="${value}"]`)
        ?.closest('label');
    expect(field?.hidden).toBe(true);
    pick('language', 'sql');
    expect(field?.hidden).toBe(false);
    expect(option('queries')?.hidden).toBe(false);
    expect(option('linq')?.hidden).toBe(true);
    pick('category', 'queries');
    expect(root.querySelector<HTMLElement>('[data-category="changes"]')?.hidden).toBe(true);
    pick('status', 'solved');
    expect(root.querySelector<HTMLElement>('.ch-none')?.hidden).toBe(false);
    // Cambiar de lenguaje deja la categoría en Cualquiera.
    pick('language', 'csharp');
    expect(root.querySelector<HTMLInputElement>('input[name="category"][value=""]')?.checked).toBe(
      true,
    );

    root.querySelector<HTMLButtonElement>('.ch-clear')?.click();
    expect(progress.all()).toEqual({});
    expect(badge('a', 'solved')).toBe(true);
  });
});
