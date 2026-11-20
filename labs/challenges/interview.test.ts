// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { challengeHtml, uiTexts } from './fixtures';
import {
  INTERVIEW_MS,
  clock,
  createInterviewStore,
  interviewForChallenge,
  newSession,
  pickChallenges,
  recordSolved,
  startInterviewPage,
  type Every,
  type InterviewChallenge,
  type InterviewPageData,
  type Session,
} from './interview';
import type { KeyValueStorage } from './progress';

const ui = uiTexts('es');
const texts = ui.interview;

const item = (
  id: string,
  language: string,
  category: string,
  difficulty: string,
): InterviewChallenge => ({
  id,
  language,
  category,
  difficulty,
  titles: { es: `Reto ${id}`, en: `Challenge ${id}` },
  urls: { es: `/retos/${id}/`, en: `/en/challenges/${id}/` },
});

const challenges: InterviewChallenge[] = [
  item('a', 'csharp', 'fundamentals', 'hard'),
  item('b', 'csharp', 'fundamentals', 'easy'),
  item('c', 'csharp', 'fundamentals', 'medium'),
  item('d', 'csharp', 'linq', 'easy'),
  item('e', 'csharp', 'linq', 'medium'),
  item('f', 'csharp', 'linq', 'easy'),
  item('g', 'csharp', 'oop', 'medium'),
  item('h', 'sql', 'queries', 'easy'),
  item('i', 'sql', 'queries', 'hard'),
];

/** Un almacenamiento en memoria, como localStorage. */
function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Un reloj a mano: `tick()` llama a lo que se programó cada segundo. */
function manualClock(start = 1_000_000) {
  let now = start;
  const ticks: (() => void)[] = [];
  const every: Every = (tick) => {
    ticks.push(tick);
    return () => ticks.splice(ticks.indexOf(tick), 1);
  };
  return {
    now: () => now,
    every,
    advance(ms: number) {
      now += ms;
      for (const tick of [...ticks]) tick();
    },
  };
}

/** Siempre el primero que queda: con esto, el sorteo es predecible. */
const first = () => 0;

describe('clock y pickChallenges', () => {
  it('escribe minutos y segundos', () => {
    expect(clock(0)).toBe('00:00');
    expect(clock(65_400)).toBe('01:05');
    expect(clock(65_400, 'up')).toBe('01:06');
    expect(clock(INTERVIEW_MS, 'up')).toBe('30:00');
    expect(clock(-5)).toBe('00:00');
  });

  it('elige sin repetir y ordena de menor a mayor dificultad, como en el catálogo', () => {
    const picked = pickChallenges(challenges.slice(0, 7), 5, first);
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((entry) => entry.id)).size).toBe(5);
    const rank = { easy: 0, medium: 1, hard: 2 } as Record<string, number>;
    const ranks = picked.map((entry) => rank[entry.difficulty] ?? 9);
    expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
    expect(pickChallenges(challenges.slice(0, 2), 5, Math.random).map((entry) => entry.id)).toEqual(
      ['b', 'a'],
    );
  });
});

describe('la sesión', () => {
  it('se guarda en el almacenamiento y descarta lo que no reconoce', () => {
    const storage = memoryStorage();
    const store = createInterviewStore(storage, 'k');
    expect(store.read()).toBeNull();
    const session = newSession(challenges.slice(0, 3), 'csharp', 'fundamentals', 10, first);
    store.write(session);
    expect(store.read()).toEqual(session);
    storage.data.set('k', '{"language": 3}');
    expect(store.read()).toBeNull();
    storage.data.set('k', 'no es JSON');
    expect(store.read()).toBeNull();
    const memory = createInterviewStore(null);
    memory.write(session);
    expect(memory.read()).toEqual(session);
    memory.clear();
    expect(memory.read()).toBeNull();
  });

  it('anota cada reto resuelto una vez, solo mientras corre el tiempo, y termina con el último', () => {
    const start = 1000;
    let session: Session = newSession(challenges.slice(0, 2), 'csharp', '', start, first);
    session = recordSolved(session, 'a', start + 60_000);
    session = recordSolved(session, 'a', start + 90_000);
    expect(session.solved).toEqual({ a: 60_000 });
    expect(recordSolved(session, 'zzz', start + 1)).toBe(session);
    expect(recordSolved(session, 'b', start + INTERVIEW_MS + 1)).toBe(session);
    session = recordSolved(session, 'b', start + 120_000);
    expect(session.endedAt).toBe(start + 120_000);
  });
});

/** El HTML de _includes/labs/challenges-interview.html, reducido a lo que usa el TypeScript. */
function interviewHtml(): string {
  return `
<div class="ch-interview">
  <div class="ch-panel ch-nojs"><p>Sin JS</p></div>
  <form class="ch-interview-setup" hidden>
    <input type="radio" name="language" value="csharp" checked><input type="radio" name="language" value="sql">
    <label><input type="radio" name="category" value="" checked></label>
    <label data-language="csharp"><input type="radio" name="category" value="fundamentals"></label>
    <label data-language="csharp"><input type="radio" name="category" value="linq"></label>
    <label data-language="sql"><input type="radio" name="category" value="queries"></label>
    <p class="ch-interview-pool"></p>
    <button type="submit">Empezar</button>
  </form>
  <section class="ch-interview-run" hidden></section>
  <section class="ch-interview-summary" hidden></section>
</div>`;
}

function interviewPage(confirm = () => true) {
  document.body.innerHTML = interviewHtml();
  const root = document.querySelector<HTMLElement>('.ch-interview');
  if (!root) throw new Error('falta la entrevista');
  const storage = memoryStorage();
  const store = createInterviewStore(storage);
  const time = manualClock();
  const data: InterviewPageData = {
    interview: true,
    ui: { interview: texts, difficulties: ui.difficulties },
    challenges,
  };
  const page = startInterviewPage(root, data, {
    store,
    lang: 'es',
    now: time.now,
    every: time.every,
    random: first,
    confirm,
  });
  const form = root.querySelector<HTMLFormElement>('.ch-interview-setup');
  const pick = (name: string, value: string) => {
    const input = [...root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].find(
      (candidate) => candidate.value === value,
    );
    if (!input) throw new Error(`falta ${name}=${value}`);
    input.checked = true;
    form?.dispatchEvent(new Event('change', { bubbles: true }));
  };
  return { root, store, time, page, form, pick };
}

describe('la página de la entrevista', () => {
  it('sin sesión muestra el formulario, con las categorías del lenguaje y cuántos retos hay', () => {
    const { root, pick } = interviewPage();
    const form = root.querySelector<HTMLElement>('.ch-interview-setup');
    expect(form?.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('.ch-nojs')?.hidden).toBe(true);
    const pool = () => root.querySelector('.ch-interview-pool')?.textContent;
    expect(pool()).toBe('Hay 7 retos en esta selección; la entrevista toma 5 al azar.');
    const option = (value: string) =>
      root.querySelector(`input[name="category"][value="${value}"]`)?.closest('label');
    expect(option('queries')?.hidden).toBe(true);
    pick('category', 'linq');
    expect(pool()).toBe('Esta selección tiene 3 retos; la entrevista los usa todos.');
    pick('language', 'sql');
    expect(option('linq')?.hidden).toBe(true);
    expect(root.querySelector<HTMLInputElement>('input[name="category"][value=""]')?.checked).toBe(
      true,
    );
    expect(pool()).toBe('Esta selección tiene 2 retos; la entrevista los usa todos.');
  });

  it('empieza la entrevista, lleva el reloj y avisa a 5 minutos del final', () => {
    const { root, store, time, form } = interviewPage();
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    const session = store.read();
    expect(session?.challenges).toHaveLength(5);
    const run = root.querySelector<HTMLElement>('.ch-interview-run');
    expect(run?.hidden).toBe(false);
    expect(root.querySelector('.ch-interview-time')?.textContent).toBe('30:00');
    expect(document.activeElement?.id).toBe('ch-interview-run-title');
    const links = [...root.querySelectorAll<HTMLAnchorElement>('.ch-interview-list a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      session?.challenges.map((entry) => entry.urls.es),
    );
    time.advance(25 * 60 * 1000 + 500);
    expect(root.querySelector('.ch-interview-time')?.textContent).toBe('05:00');
    expect(document.getElementById('lab-live')?.textContent).toBe(texts.five_left);
  });

  it('al acabarse el tiempo muestra el resumen con cada reto, y Otra entrevista vuelve a empezar', () => {
    const { root, store, time, form } = interviewPage();
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    const session = store.read();
    if (!session) throw new Error('sin sesión');
    const firstId = session.challenges[0]?.id ?? '';
    store.write({
      ...recordSolved(session, firstId, session.startedAt + 61_000),
      spent: { [firstId]: 75_000 },
    });
    time.advance(INTERVIEW_MS);
    const summary = root.querySelector<HTMLElement>('.ch-interview-summary');
    expect(summary?.hidden).toBe(false);
    expect(summary?.querySelector('.ch-verdict-title')?.textContent).toBe(
      'Resolviste 1 de 5 retos.',
    );
    expect(summary?.textContent).toContain(texts.time_up);
    const rows = [...(summary?.querySelectorAll('tbody tr') ?? [])];
    expect(rows).toHaveLength(5);
    expect(rows[0]?.textContent).toContain('Resuelto a los 01:01');
    expect(rows[0]?.textContent).toContain('01:15');
    expect(rows[1]?.textContent).toContain(texts.not_solved);
    expect(store.read()?.reviewed).toBe(true);
    summary?.querySelector<HTMLButtonElement>('.ch-interview-again')?.click();
    expect(store.read()).toBeNull();
    expect(root.querySelector<HTMLElement>('.ch-interview-setup')?.hidden).toBe(false);
  });

  it('Terminar la entrevista pide confirmación y deja el resumen con el tiempo usado', () => {
    let answer = false;
    const { root, store, time, form } = interviewPage(() => answer);
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    time.advance(90_000);
    const finish = root.querySelector<HTMLButtonElement>('.ch-interview-finish');
    finish?.click();
    expect(root.querySelector<HTMLElement>('.ch-interview-run')?.hidden).toBe(false);
    answer = true;
    finish?.click();
    expect(store.read()?.endedAt).toBe(time.now());
    const summary = root.querySelector<HTMLElement>('.ch-interview-summary');
    expect(summary?.hidden).toBe(false);
    expect(summary?.textContent).toContain('Terminaste la entrevista a los 01:30.');
  });
});

describe('la entrevista en la página de un reto', () => {
  function challengePage(session: Session | null, id = 'b', visible = true) {
    document.body.innerHTML = challengeHtml();
    const root = document.querySelector<HTMLElement>('.ch-page');
    if (!root) throw new Error('falta la página');
    const store = createInterviewStore(memoryStorage());
    if (session) store.write(session);
    const time = manualClock(session ? session.startedAt : 0);
    const interview = interviewForChallenge(root, id, ui, {
      store,
      lang: 'es',
      now: time.now,
      every: time.every,
      visible: () => visible,
    });
    return { root, store, time, interview };
  }

  const started = (ids: readonly string[] = ['b', 'd', 'c']): Session => ({
    language: 'csharp',
    category: '',
    challenges: ids.map((id) => challenges.find((entry) => entry.id === id) as InterviewChallenge),
    startedAt: 5_000_000,
    limitMs: INTERVIEW_MS,
    solved: {},
    spent: {},
  });

  it('sin una entrevista con este reto no hace nada', () => {
    expect(challengePage(null).interview).toBeUndefined();
    expect(challengePage(started(), 'zzz').interview).toBeUndefined();
    expect(challengePage({ ...started(), reviewed: true }).interview).toBeUndefined();
    expect(document.querySelector('.ch-interview-banner')).toBeNull();
  });

  it('muestra la barra con el reloj y el siguiente reto, y oculta las pistas y la solución', () => {
    const { root } = challengePage(started(['b', 'd', 'c']), 'd');
    const banner = root.querySelector('.ch-interview-banner');
    expect(banner?.previousElementSibling?.classList.contains('ch-meta')).toBe(true);
    expect(banner?.querySelector('.ch-interview-step')?.textContent).toContain('Reto 2 de 3');
    expect(banner?.querySelector('.ch-interview-time')?.textContent).toBe('30:00');
    expect(banner?.querySelector('.ch-interview-next')?.getAttribute('href')).toBe('/retos/c/');
    expect(banner?.querySelector('.ch-interview-back')?.getAttribute('href')).toBe('/entrevista/');
    expect(root.querySelector<HTMLElement>('.ch-aids')?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('.ch-aids-note')?.hidden).toBe(false);
    expect(root.querySelector('.ch-pager .ch-next')?.textContent).toBe('Siguiente: Reto c');
  });

  it('cuenta el tiempo del reto solo con la página a la vista, a lo más 5 segundos por tic', () => {
    const shown = challengePage(started());
    shown.time.advance(1000);
    shown.time.advance(60_000);
    expect(shown.store.read()?.spent).toEqual({ b: 6000 });
    const hidden = challengePage(started(), 'b', false);
    hidden.time.advance(1000);
    expect(hidden.store.read()?.spent).toEqual({});
  });

  it('al resolver, lo anota; con el último, la entrevista termina y vuelven las pistas', () => {
    const { root, store, time, interview } = challengePage(started(['b', 'd']), 'b');
    time.advance(30_000);
    interview?.onSolved();
    expect(store.read()?.solved).toEqual({ b: 30_000 });
    expect(interview?.solvedText()).toBe(ui.challenge.solved_interview);
    const other = recordSolved(store.read() as Session, 'd', time.now() + 10_000);
    store.write(other);
    time.advance(10_000);
    expect(root.querySelector<HTMLElement>('.ch-aids')?.hidden).toBe(false);
    expect(interview?.solvedText()).toBe('Resolviste los 2 retos en 00:40.');
    expect(root.querySelector('.ch-pager .ch-next')?.getAttribute('href')).toBe('/entrevista/');
  });

  it('cuando se acaba el tiempo, lo dice y deja ver las pistas', () => {
    const { root, time, interview } = challengePage(started());
    time.advance(INTERVIEW_MS);
    expect(root.querySelector('.ch-interview-banner')?.textContent).toContain(texts.time_up);
    expect(root.querySelector<HTMLElement>('.ch-aids')?.hidden).toBe(false);
    interview?.onSolved();
    expect(interview?.solvedText()).toBeUndefined();
  });
});
