// El modo entrevista: cinco retos al azar de un lenguaje y una categoría, con 30 minutos para
// todos. La sesión vive en el navegador (localStorage), así que sigue al pasar de un reto a otro
// y entre pestañas. En la página de la entrevista se prepara, se sigue y se ve el resumen; en la
// página de cada reto de la sesión aparece una barra con el reloj, las pistas y la solución se
// ocultan mientras corre el tiempo, y Enviar con todos los casos lo anota como resuelto. El tiempo
// de cada reto es el que su página estuvo abierta y a la vista.

import { h, required } from '../shared/dom';
import type { Lang } from '../shared/format';
import { announce } from '../shared/live';
import { fill } from '../shared/template';
import type { KeyValueStorage } from './progress';

export const INTERVIEW_KEY = 'mi-sitio2.retos.entrevista.v1';
export const INTERVIEW_SIZE = 5;
export const INTERVIEW_MS = 30 * 60 * 1000;
/** Cuando quedan estos minutos, se avisa una vez. */
const WARNING_MS = 5 * 60 * 1000;
/** Lo más que suma un tic al tiempo de un reto, por si el navegador durmió la pestaña. */
const MAX_TICK_MS = 5000;

export interface InterviewTexts {
  readonly intro: string;
  readonly nojs: string;
  readonly setup: string;
  readonly language: string;
  readonly category: string;
  readonly any: string;
  readonly pool: string;
  readonly pool_small: string;
  readonly start: string;
  readonly active: string;
  readonly clock: string;
  readonly progress: string;
  readonly challenges: string;
  readonly open: string;
  readonly finish: string;
  readonly finish_confirm: string;
  readonly banner: string;
  readonly step: string;
  readonly next: string;
  readonly back: string;
  readonly aids_hidden: string;
  readonly five_left: string;
  readonly time_up: string;
  readonly summary: string;
  readonly summary_solved: string;
  readonly summary_all: string;
  readonly summary_ended: string;
  readonly column_challenge: string;
  readonly column_difficulty: string;
  readonly column_result: string;
  readonly column_time: string;
  readonly solved_at: string;
  readonly not_solved: string;
  readonly review: string;
  readonly again: string;
}

/** Un reto que puede entrar en una entrevista, con su título y su página en los dos idiomas. */
export interface InterviewChallenge {
  readonly id: string;
  readonly language: string;
  readonly category: string;
  readonly difficulty: string;
  readonly titles: Readonly<Record<Lang, string>>;
  readonly urls: Readonly<Record<Lang, string>>;
}

export interface Session {
  readonly language: string;
  readonly category: string;
  readonly challenges: readonly InterviewChallenge[];
  readonly startedAt: number;
  readonly limitMs: number;
  /** Cuándo terminó antes del límite: el visitante la terminó o resolvió todos. */
  readonly endedAt?: number;
  /** Por reto, cuánto había pasado desde el inicio cuando se resolvió. */
  readonly solved: Readonly<Record<string, number>>;
  /** Por reto, cuánto tiempo estuvo su página abierta y a la vista. */
  readonly spent: Readonly<Record<string, number>>;
  /** Ya se vio el resumen: los retos dejan de mostrar la barra de la entrevista. */
  readonly reviewed?: boolean;
}

export interface InterviewStore {
  read(): Session | null;
  write(session: Session): void;
  clear(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTimes = (value: unknown): boolean =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'number');

const isChallenge = (value: unknown): value is InterviewChallenge =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  typeof value['difficulty'] === 'string' &&
  isRecord(value['titles']) &&
  isRecord(value['urls']);

function isSession(value: unknown): value is Session {
  return (
    isRecord(value) &&
    typeof value['language'] === 'string' &&
    typeof value['category'] === 'string' &&
    Array.isArray(value['challenges']) &&
    value['challenges'].every(isChallenge) &&
    typeof value['startedAt'] === 'number' &&
    typeof value['limitMs'] === 'number' &&
    (value['endedAt'] === undefined || typeof value['endedAt'] === 'number') &&
    isTimes(value['solved']) &&
    isTimes(value['spent'])
  );
}

/** La sesión en el navegador; sin almacenamiento, vive solo mientras la página esté abierta. */
export function createInterviewStore(
  storage: KeyValueStorage | null,
  key = INTERVIEW_KEY,
): InterviewStore {
  let memory: Session | null = null;
  return {
    read() {
      if (!storage) return memory;
      try {
        const value: unknown = JSON.parse(storage.getItem(key) ?? 'null');
        return isSession(value) ? value : null;
      } catch {
        return null;
      }
    },
    write(session) {
      memory = session;
      try {
        storage?.setItem(key, JSON.stringify(session));
      } catch {
        // Sin espacio: la sesión sigue en memoria.
      }
    },
    clear() {
      memory = null;
      try {
        storage?.removeItem(key);
      } catch {
        // Nada que borrar.
      }
    },
  };
}

/** El momento en que termina: el límite de tiempo, o antes si terminó. */
export function endOf(session: Session): number {
  const limit = session.startedAt + session.limitMs;
  return session.endedAt === undefined ? limit : Math.min(limit, session.endedAt);
}

export const isActive = (session: Session, now: number): boolean => now < endOf(session);

/** Un tiempo como minutos y segundos: 07:05. */
export function clock(ms: number, round: 'up' | 'down' = 'down'): string {
  const seconds = Math.max(0, round === 'up' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Los retos de un lenguaje y, si se eligió, de una categoría. */
export function poolFor(
  challenges: readonly InterviewChallenge[],
  language: string,
  category: string,
): InterviewChallenge[] {
  return challenges.filter(
    (item) => item.language === language && (category === '' || item.category === category),
  );
}

const RANK: Readonly<Record<string, number>> = { easy: 0, medium: 1, hard: 2 };

/** `count` retos al azar, de menor a mayor dificultad y, entre iguales, como en el catálogo. */
export function pickChallenges(
  pool: readonly InterviewChallenge[],
  count: number,
  random: () => number,
): InterviewChallenge[] {
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j] as InterviewChallenge, order[i] as InterviewChallenge];
  }
  const chosen = new Set(order.slice(0, count).map((item) => item.id));
  return pool
    .filter((item) => chosen.has(item.id))
    .sort((a, b) => (RANK[a.difficulty] ?? 3) - (RANK[b.difficulty] ?? 3));
}

export function newSession(
  pool: readonly InterviewChallenge[],
  language: string,
  category: string,
  now: number,
  random: () => number,
): Session {
  return {
    language,
    category,
    challenges: pickChallenges(pool, INTERVIEW_SIZE, random),
    startedAt: now,
    limitMs: INTERVIEW_MS,
    solved: {},
    spent: {},
  };
}

/** Anota un reto resuelto si la entrevista sigue; con el último, la entrevista termina. */
export function recordSolved(session: Session, id: string, now: number): Session {
  if (!isActive(session, now) || session.solved[id] !== undefined) return session;
  if (!session.challenges.some((item) => item.id === id)) return session;
  const solved = { ...session.solved, [id]: now - session.startedAt };
  const all = session.challenges.every((item) => solved[item.id] !== undefined);
  return { ...session, solved, ...(all ? { endedAt: now } : {}) };
}

export function addSpent(session: Session, id: string, ms: number): Session {
  if (ms <= 0) return session;
  return { ...session, spent: { ...session.spent, [id]: (session.spent[id] ?? 0) + ms } };
}

export function finishSession(session: Session, now: number): Session {
  return isActive(session, now) ? { ...session, endedAt: now } : session;
}

const solvedCount = (session: Session) =>
  session.challenges.filter((item) => session.solved[item.id] !== undefined).length;

/** Si se acabó el tiempo, y no terminó antes. */
const timedOut = (session: Session) =>
  session.endedAt === undefined || session.endedAt >= session.startedAt + session.limitMs;

/** Cómo terminó una entrevista: se acabó el tiempo, se resolvieron todos o el visitante la terminó. */
function ending(session: Session, texts: InterviewTexts): string {
  const total = session.challenges.length;
  const solved = solvedCount(session);
  const used = clock(endOf(session) - session.startedAt);
  if (timedOut(session)) return texts.time_up;
  if (solved === total) return fill(texts.summary_all, { total, time: used });
  return fill(texts.summary_ended, { time: used });
}

/** Llama a `tick` cada `ms` milisegundos y devuelve cómo pararlo. */
export type Every = (tick: () => void, ms: number) => () => void;

const everySecond: Every = (tick, ms) => {
  const timer = setInterval(tick, ms);
  return () => clearInterval(timer);
};

/** Los textos de la entrevista y lo que comparte con los retos. */
export interface InterviewUi {
  readonly interview: InterviewTexts;
  readonly difficulties: Readonly<Record<string, string>>;
}

export interface InterviewPageData {
  readonly interview: true;
  readonly ui: InterviewUi;
  readonly challenges: readonly InterviewChallenge[];
}

export interface InterviewDeps {
  readonly store: InterviewStore;
  readonly lang: Lang;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly confirm?: (message: string) => boolean;
  readonly every?: Every;
}

export interface InterviewPage {
  /** Vuelve a leer la sesión y muestra lo que toca: preparar, en curso o el resumen. */
  update(): void;
  stop(): void;
}

/** La página de la entrevista: el formulario, la entrevista en curso y el resumen. */
export function startInterviewPage(
  root: HTMLElement,
  data: InterviewPageData,
  deps: InterviewDeps,
): InterviewPage {
  const texts = data.ui.interview;
  const now = deps.now ?? (() => Date.now());
  const random = deps.random ?? Math.random;
  const confirm = deps.confirm ?? ((message: string) => window.confirm(message));
  const form = required<HTMLFormElement>('.ch-interview-setup', root);
  const run = required<HTMLElement>('.ch-interview-run', root);
  const summary = required<HTMLElement>('.ch-interview-summary', root);
  const pool = required<HTMLElement>('.ch-interview-pool', form);
  const options = [...form.querySelectorAll<HTMLElement>('label[data-language]')];
  for (const element of root.querySelectorAll<HTMLElement>('.ch-nojs')) element.hidden = true;

  let view: 'setup' | 'run' | 'summary' | null = null;
  let signature = '';
  let warned = false;
  let clockText: HTMLElement | null = null;

  const choice = () => {
    const values = new FormData(form);
    return {
      language: String(values.get('language') ?? ''),
      category: String(values.get('category') ?? ''),
    };
  };

  /** Solo las categorías del lenguaje elegido, y cuántos retos hay para elegir. */
  const showChoice = () => {
    const { language } = choice();
    for (const option of options) {
      const visible = option.dataset['language'] === language;
      option.hidden = !visible;
      const input = option.querySelector('input');
      if (!visible && input?.checked) {
        const any = form.querySelector<HTMLInputElement>('input[name="category"][value=""]');
        if (any) any.checked = true;
      }
    }
    const { category } = choice();
    const n = poolFor(data.challenges, language, category).length;
    pool.textContent = fill(n > INTERVIEW_SIZE ? texts.pool : texts.pool_small, { n });
  };

  const show = (next: 'setup' | 'run' | 'summary') => {
    form.hidden = next !== 'setup';
    run.hidden = next !== 'run';
    summary.hidden = next !== 'summary';
    view = next;
  };

  const renderRun = (session: Session) => {
    clockText = h('strong', { class: 'ch-interview-time', role: 'timer' }, [
      clock(endOf(session) - now(), 'up'),
    ]);
    const finish = h('button', { class: 'btn ch-interview-finish', type: 'button' }, [
      texts.finish,
    ]);
    finish.addEventListener('click', () => {
      if (!confirm(texts.finish_confirm)) return;
      const current = deps.store.read();
      if (current) deps.store.write(finishSession(current, now()));
      update();
      focusHeading(summary);
    });
    run.replaceChildren(
      h('h2', { id: 'ch-interview-run-title', tabindex: -1 }, [texts.active]),
      h('p', { class: 'ch-interview-clock' }, [h('span', {}, [texts.clock]), ' ', clockText]),
      h('p', { class: 'ch-interview-progress' }, [
        fill(texts.progress, { solved: solvedCount(session), total: session.challenges.length }),
      ]),
      h('h3', {}, [texts.challenges]),
      challengeList(session, data.ui, deps.lang),
      h('p', { class: 'ch-actions' }, [finish]),
    );
  };

  const renderSummary = (session: Session) => {
    const solved = solvedCount(session);
    const total = session.challenges.length;
    const all = solved === total && !timedOut(session);
    const again = h('button', { class: 'btn btn-primary ch-interview-again', type: 'button' }, [
      texts.again,
    ]);
    again.addEventListener('click', () => {
      deps.store.clear();
      for (const [name, value] of [
        ['language', session.language],
        ['category', session.category],
      ] as const) {
        const inputs = [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
        const input = inputs.find((item) => item.value === value);
        if (input) input.checked = true;
      }
      update();
      form.querySelector<HTMLInputElement>('input:checked')?.focus();
    });
    summary.replaceChildren(
      h('h2', { id: 'ch-interview-summary-title', tabindex: -1 }, [texts.summary]),
      h('div', { class: 'ch-verdict', 'data-tone': solved === total ? 'good' : 'bad' }, [
        h('p', { class: 'ch-verdict-title' }, [
          all ? ending(session, texts) : fill(texts.summary_solved, { solved, total }),
        ]),
        all ? null : h('p', {}, [ending(session, texts)]),
      ]),
      summaryTable(session, data.ui, deps.lang),
      h('p', {}, [texts.review]),
      h('p', { class: 'ch-actions' }, [again]),
    );
    if (!session.reviewed) deps.store.write({ ...session, reviewed: true });
  };

  function update() {
    const session = deps.store.read();
    if (!session) {
      if (view !== 'setup') {
        show('setup');
        showChoice();
      }
      return;
    }
    const left = endOf(session) - now();
    if (left <= 0) {
      const key = `summary:${JSON.stringify(session.solved)}:${session.endedAt ?? ''}`;
      if (view !== 'summary' || signature !== key) {
        const wasRunning = view === 'run';
        signature = key;
        renderSummary(session);
        show('summary');
        if (wasRunning) announce(session.endedAt === undefined ? texts.time_up : texts.summary);
      }
      return;
    }
    const key = `run:${session.startedAt}:${JSON.stringify(session.solved)}`;
    if (view !== 'run' || signature !== key) {
      signature = key;
      renderRun(session);
      show('run');
      warned = left <= WARNING_MS;
    }
    if (clockText) clockText.textContent = clock(left, 'up');
    if (!warned && left <= WARNING_MS) {
      warned = true;
      announce(texts.five_left);
    }
  }

  form.addEventListener('change', showChoice);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { language, category } = choice();
    const candidates = poolFor(data.challenges, language, category);
    if (candidates.length === 0) return;
    deps.store.write(newSession(candidates, language, category, now(), random));
    update();
    focusHeading(run);
  });

  const stopTimer = (deps.every ?? everySecond)(update, 1000);
  // Al volver con el botón Atrás desde un reto, la sesión pudo cambiar.
  window.addEventListener('pageshow', update);
  update();
  return {
    update,
    stop: () => {
      stopTimer();
      window.removeEventListener('pageshow', update);
    },
  };
}

function focusHeading(section: HTMLElement): void {
  section.querySelector<HTMLElement>('h2')?.focus();
}

/** Los retos de la entrevista, en orden, con su dificultad y si ya se resolvieron. */
function challengeList(session: Session, ui: InterviewUi, lang: Lang): HTMLElement {
  const texts = ui.interview;
  return h(
    'ol',
    { class: 'ch-interview-list' },
    session.challenges.map((item) => {
      const solved = session.solved[item.id] !== undefined;
      return h('li', { 'data-solved': solved }, [
        h('a', { href: item.urls[lang] }, [item.titles[lang]]),
        ' ',
        h('span', { class: 'ch-chip ch-level', 'data-level': item.difficulty }, [
          ui.difficulties[item.difficulty] ?? item.difficulty,
        ]),
        ' ',
        h('span', { class: 'ch-interview-state' }, [
          solved
            ? fill(texts.solved_at, { time: clock(session.solved[item.id] ?? 0) })
            : texts.not_solved,
        ]),
      ]);
    }),
  );
}

/** El resumen: cada reto con su dificultad, si se resolvió y cuánto tiempo se le dedicó. */
function summaryTable(session: Session, ui: InterviewUi, lang: Lang): HTMLElement {
  const texts = ui.interview;
  const head = [
    texts.column_challenge,
    texts.column_difficulty,
    texts.column_result,
    texts.column_time,
  ];
  return h('div', { class: 'ch-table-wrap' }, [
    h('table', { class: 'ch-interview-table' }, [
      h('thead', {}, [
        h(
          'tr',
          {},
          head.map((text) => h('th', { scope: 'col' }, [text])),
        ),
      ]),
      h(
        'tbody',
        {},
        session.challenges.map((item) => {
          const at = session.solved[item.id];
          return h('tr', { 'data-solved': at !== undefined }, [
            h('th', { scope: 'row' }, [h('a', { href: item.urls[lang] }, [item.titles[lang]])]),
            h('td', {}, [ui.difficulties[item.difficulty] ?? item.difficulty]),
            h('td', {}, [
              at === undefined ? texts.not_solved : fill(texts.solved_at, { time: clock(at) }),
            ]),
            h('td', {}, [clock(session.spent[item.id] ?? 0)]),
          ]);
        }),
      ),
    ]),
  ]);
}

export interface ChallengeInterview {
  /** Enviar pasó todos los casos: se anota si la entrevista sigue. */
  onSolved(): void;
  /** El texto del aviso de resuelto durante la entrevista, o undefined fuera de ella. */
  solvedText(): string | undefined;
  stop(): void;
}

export interface ChallengeInterviewDeps {
  readonly store: InterviewStore;
  readonly lang: Lang;
  readonly now?: () => number;
  readonly every?: Every;
  /** Si la página está a la vista; solo entonces cuenta el tiempo del reto. */
  readonly visible?: () => boolean;
}

/**
 * La entrevista en la página de un reto, si el reto es parte de una: la barra con el reloj y el
 * siguiente reto, las pistas y la solución ocultas mientras corre el tiempo, y el tiempo que se le
 * dedica. Devuelve undefined si no hay entrevista con este reto.
 */
export function interviewForChallenge(
  root: HTMLElement,
  id: string,
  ui: InterviewUi & { readonly challenge: { readonly solved_interview: string } },
  deps: ChallengeInterviewDeps,
): ChallengeInterview | undefined {
  const texts = ui.interview;
  const now = deps.now ?? (() => Date.now());
  const visible = deps.visible ?? (() => document.visibilityState === 'visible');
  const first = deps.store.read();
  if (!first || first.reviewed || !first.challenges.some((item) => item.id === id))
    return undefined;

  const home = root.dataset['interview'] ?? '';
  const aids = root.querySelector<HTMLElement>('.ch-aids');
  const note = h('p', { class: 'ch-aids-note' }, [texts.aids_hidden]);
  aids?.before(note);
  const pagerNext = root.querySelector<HTMLAnchorElement>('.ch-pager .ch-next');
  const original = pagerNext ? { href: pagerNext.href, text: pagerNext.textContent ?? '' } : null;
  const banner = h('aside', { class: 'ch-interview-banner', 'aria-label': texts.banner });
  const meta = root.querySelector('.ch-meta');
  if (meta) meta.after(banner);
  else root.prepend(banner);

  let last = now();
  let signature = '';
  let active = isActive(first, last);

  /** El siguiente reto sin resolver después de este, dando la vuelta. */
  const nextOf = (session: Session): InterviewChallenge | undefined => {
    const list = session.challenges;
    const at = list.findIndex((item) => item.id === id);
    for (let step = 1; step < list.length; step++) {
      const item = list[(at + step) % list.length];
      if (item && session.solved[item.id] === undefined) return item;
    }
    return undefined;
  };

  const render = (session: Session) => {
    const at = now();
    active = isActive(session, at);
    const next = active ? nextOf(session) : undefined;
    const key = `${active}:${JSON.stringify(session.solved)}:${next?.id ?? ''}`;
    if (key !== signature) {
      signature = key;
      const position = session.challenges.findIndex((item) => item.id === id) + 1;
      banner.replaceChildren(
        h('p', { class: 'ch-interview-step' }, [
          h('strong', {}, [texts.banner]),
          ' ',
          fill(texts.step, { n: position, total: session.challenges.length }),
        ]),
        active
          ? h('p', { class: 'ch-interview-clock' }, [
              h('span', { class: 'visually-hidden' }, [`${texts.clock}: `]),
              h('strong', { class: 'ch-interview-time', role: 'timer' }, ['']),
            ])
          : h('p', { class: 'ch-interview-clock' }, [
              timedOut(session) || solvedCount(session) === session.challenges.length
                ? ending(session, texts)
                : fill(texts.summary_solved, {
                    solved: solvedCount(session),
                    total: session.challenges.length,
                  }),
            ]),
        next
          ? h('a', { class: 'ch-interview-next', href: next.urls[deps.lang] }, [
              fill(texts.next, { title: next.titles[deps.lang] }),
            ])
          : '',
        h('a', { class: 'ch-interview-back', href: home }, [texts.back]),
      );
      if (aids) aids.hidden = active;
      note.hidden = !active;
      if (pagerNext && original) {
        if (active && next) {
          pagerNext.href = next.urls[deps.lang];
          pagerNext.textContent = fill(texts.next, { title: next.titles[deps.lang] });
        } else if (active || !home) {
          pagerNext.href = original.href;
          pagerNext.textContent = original.text;
        } else {
          pagerNext.href = home;
          pagerNext.textContent = texts.back;
        }
      }
    }
    const time = banner.querySelector('.ch-interview-time');
    if (time) time.textContent = clock(endOf(session) - at, 'up');
  };

  const tick = () => {
    const session = deps.store.read();
    if (!session || !session.challenges.some((item) => item.id === id)) {
      stop();
      return;
    }
    const at = now();
    const wasActive = active;
    const counted = wasActive && visible() ? Math.min(at - last, MAX_TICK_MS) : 0;
    last = at;
    const updated = counted > 0 ? addSpent(session, id, counted) : session;
    if (updated !== session) deps.store.write(updated);
    render(updated);
    if (wasActive && !active && updated.endedAt === undefined) announce(texts.time_up);
  };

  const stopTimer = (deps.every ?? everySecond)(tick, 1000);
  const stop = () => {
    stopTimer();
  };
  render(first);

  return {
    onSolved() {
      const session = deps.store.read();
      if (!session) return;
      tick();
      const current = deps.store.read() ?? session;
      const updated = recordSolved(current, id, now());
      if (updated !== current) deps.store.write(updated);
      render(updated);
    },
    solvedText() {
      const session = deps.store.read();
      if (!session || session.solved[id] === undefined) return undefined;
      if (isActive(session, now())) return ui.challenge.solved_interview;
      // Con este reto se resolvieron todos: la entrevista acaba de terminar.
      return solvedCount(session) === session.challenges.length && !timedOut(session)
        ? ending(session, texts)
        : undefined;
    },
    stop,
  };
}
