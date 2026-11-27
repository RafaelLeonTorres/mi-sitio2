// La página de la sección Entrevista: preparar la simulación, contestar (examen o práctica) y ver
// el resultado. Las preguntas y los textos llegan en #quiz-data y el código de cada pregunta ya
// viene resaltado en un <template id="quiz-code-…">. El intento se guarda en el navegador, así que
// sigue al recargar la página o al cambiar de idioma.

import { clock } from '../challenges/interview';
import type { KeyValueStorage } from '../challenges/progress';
import { h, required, type Child } from '../shared/dom';
import { announce } from '../shared/live';
import { fill, inlineCode } from '../shared/template';
import {
  CORRECT,
  EXAM_MS,
  EXAM_SIZE,
  answer,
  answeredCount,
  countedItems,
  createStore,
  deadline,
  finish,
  goTo,
  isRight,
  isRunning,
  newSession,
  percent,
  remainingMs,
  score,
  settle,
  timedOut,
  type Item,
  type Mode,
  type Score,
  type Session,
} from './session';
import type { Question, QuizData, Topic } from './types';

/** Cuando quedan estos minutos de examen, se avisa una vez. */
export const WARNING_MS = 5 * 60 * 1000;

export interface QuizDeps {
  readonly storage: KeyValueStorage | null;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly confirm?: (message: string) => boolean;
  /** Llama a `tick` cada `ms` milisegundos y devuelve cómo pararlo. */
  readonly every?: (tick: () => void, ms: number) => () => void;
}

export interface Quiz {
  stop(): void;
}

interface Entry {
  readonly question: Question;
  readonly topic: Topic;
}

export function startQuiz(root: HTMLElement, data: QuizData, deps: QuizDeps): Quiz {
  const texts = data.ui;
  const now = deps.now ?? (() => Date.now());
  const random = deps.random ?? Math.random;
  const confirm = deps.confirm ?? ((message: string) => window.confirm(message));
  const every =
    deps.every ??
    ((tick: () => void, ms: number) => {
      const timer = setInterval(tick, ms);
      return () => clearInterval(timer);
    });

  const entries = new Map<string, Entry>(
    data.topics.flatMap((topic) =>
      topic.questions.map((question) => [question.id, { question, topic }] as const),
    ),
  );
  const store = createStore(
    deps.storage,
    new Map([...entries].map(([id, entry]) => [id, entry.question.options.length])),
  );

  const setup = required<HTMLFormElement>('.quiz-setup', root);
  const run = required<HTMLElement>('.quiz-run', root);
  const results = required<HTMLElement>('.quiz-results', root);
  const topicInputs = [...setup.querySelectorAll<HTMLInputElement>('input[name="topic"]')];
  const start = required<HTMLButtonElement>('button[type="submit"]', setup);
  const pool = required<HTMLElement>('.quiz-pool', setup);
  for (const element of root.querySelectorAll<HTMLElement>('.quiz-nojs')) element.hidden = true;

  let session: Session | null = null;
  let stopClock: (() => void) | null = null;
  let warned = false;

  const entry = (id: string): Entry => entries.get(id) as Entry;

  function halt(): void {
    stopClock?.();
    stopClock = null;
  }

  function show(view: HTMLElement): void {
    for (const element of [setup, run, results]) element.hidden = element !== view;
    if (view !== run) halt();
  }

  // --- Preparar ------------------------------------------------------------

  const selectedMode = (): Mode =>
    setup.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value === 'practice'
      ? 'practice'
      : 'exam';

  const selectedTopics = (): Topic[] =>
    data.topics.filter((topic) =>
      topicInputs.some((input) => input.checked && input.value === topic.id),
    );

  function updateSetup(): void {
    const total = selectedTopics().reduce((count, topic) => count + topic.questions.length, 0);
    const exam = selectedMode() === 'exam';
    start.disabled = total === 0;
    start.textContent = exam ? texts.start_exam : texts.start_practice;
    if (total === 0) pool.textContent = texts.pool_none;
    else if (exam)
      pool.textContent = fill(texts.pool_exam, { size: Math.min(EXAM_SIZE, total), total });
    else pool.textContent = fill(texts.pool_practice, { total });
  }

  function openSetup(focus: boolean): void {
    show(setup);
    updateSetup();
    if (focus) required<HTMLElement>('.quiz-setup-title', setup).focus();
  }

  // --- Piezas comunes ------------------------------------------------------

  const button = (name: string, label: string, kind: string, disabled = false) =>
    h('button', { type: 'button', class: `${kind} ${name}`, disabled }, [label]);

  function codeBlock(id: string): HTMLElement | null {
    const template = root.ownerDocument.getElementById(`quiz-code-${id}`);
    if (!(template instanceof HTMLTemplateElement)) return null;
    const block = h('div', { class: 'quiz-code', role: 'group', 'aria-label': texts.code_label }, [
      template.content.cloneNode(true),
    ]);
    // El bloque se desplaza de lado en pantallas angostas: también con el teclado.
    for (const pre of block.querySelectorAll('pre')) pre.tabIndex = 0;
    return block;
  }

  const explanation = (question: Question) =>
    h('p', { class: 'quiz-why' }, [
      h('strong', {}, [`${texts.why}: `]),
      ...inlineCode(question.why),
    ]);

  const topicTag = (topic: Topic) => h('span', { class: 'tag' }, [topic.title]);

  // --- Contestar -----------------------------------------------------------

  const currentItem = (active: Session): Item => active.items[active.current] as Item;

  const countText = (active: Session): string =>
    active.mode === 'exam'
      ? fill(texts.answered, { answered: answeredCount(active), total: active.items.length })
      : fill(texts.score, {
          correct: score(active, data.topics).correct,
          answered: answeredCount(active),
        });

  function statusBar(active: Session): HTMLElement {
    const left = remainingMs(active, now());
    return h('div', { class: 'quiz-bar' }, [
      h('p', { class: 'quiz-progress' }, [
        fill(texts.question, { n: active.current + 1, total: active.items.length }),
      ]),
      h('p', { class: 'quiz-count' }, [countText(active)]),
      active.mode === 'exam'
        ? h('p', { class: left <= WARNING_MS ? 'quiz-clock is-low' : 'quiz-clock' }, [
            h('span', {}, [`${texts.clock} `]),
            h('strong', { class: 'quiz-time' }, [clock(left, 'up')]),
          ])
        : null,
    ]);
  }

  /** Una opción; en la práctica ya contestada se marcan la correcta y la elegida. */
  function option(question: Question, index: number, chosen: number | undefined, shown: boolean) {
    const right = index === CORRECT;
    const picked = index === chosen;
    let state = '';
    if (shown && right) state = ' is-correct';
    else if (shown && picked) state = ' is-wrong';
    return h('label', { class: `quiz-option${state}` }, [
      h('input', {
        type: 'radio',
        name: 'quiz-option',
        value: index,
        checked: picked,
        disabled: shown,
      }),
      h('span', { class: 'quiz-option-text' }, inlineCode(question.options[index] as string)),
      state
        ? h('span', { class: 'quiz-mark' }, [right ? texts.mark_correct : texts.mark_wrong])
        : null,
    ]);
  }

  function actions(active: Session): Child[] {
    const last = active.current === active.items.length - 1;
    const leave = button('quiz-abandon', texts.abandon, 'quiz-link');
    if (active.mode === 'exam') {
      return [
        button('quiz-prev', texts.previous, 'btn btn-secondary', active.current === 0),
        button('quiz-next', texts.next, 'btn btn-secondary', last),
        button('quiz-finish', texts.finish_exam, 'btn btn-primary'),
        leave,
      ];
    }
    const answered = active.answers[currentItem(active).id] !== undefined;
    if (answered && last) {
      return [button('quiz-finish', texts.see_results, 'btn btn-primary'), leave];
    }
    return [
      answered
        ? button('quiz-next', texts.next, 'btn btn-primary')
        : h('button', { type: 'submit', class: 'btn btn-primary quiz-check' }, [texts.check]),
      button('quiz-finish', texts.finish_practice, 'btn btn-secondary'),
      leave,
    ];
  }

  function navigator(active: Session): HTMLElement {
    return h('nav', { class: 'quiz-nav', 'aria-label': texts.navigator }, [
      h(
        'ol',
        {},
        active.items.map((item, index) => {
          const answered = active.answers[item.id] !== undefined;
          return h('li', {}, [
            h(
              'button',
              {
                type: 'button',
                class: answered ? 'is-answered' : null,
                'data-index': index,
                'aria-current': index === active.current ? 'step' : null,
                'aria-label': fill(answered ? texts.nav_answered : texts.nav_pending, {
                  n: index + 1,
                }),
              },
              [index + 1],
            ),
          ]);
        }),
      ),
    ]);
  }

  function renderRun(focus: boolean): void {
    if (!session) return;
    const item = currentItem(session);
    const { question, topic } = entry(item.id);
    const chosen = session.answers[item.id];
    const shown = session.mode === 'practice' && chosen !== undefined;
    const title = h(
      'h2',
      { class: 'quiz-text', id: 'quiz-question', tabindex: -1 },
      inlineCode(question.q),
    );
    const feedback = h('div', { class: 'quiz-feedback' }, [
      shown
        ? h(
            'p',
            { class: chosen === CORRECT ? 'quiz-verdict is-correct' : 'quiz-verdict is-wrong' },
            [chosen === CORRECT ? texts.correct : texts.incorrect],
          )
        : null,
      shown ? explanation(question) : null,
    ]);
    const card = h('article', { class: 'quiz-card' }, [
      h('p', { class: 'quiz-meta' }, [topicTag(topic)]),
      title,
      codeBlock(item.id),
      h('form', { class: 'quiz-answer', novalidate: true }, [
        h('fieldset', { class: 'quiz-options', 'aria-describedby': 'quiz-question' }, [
          h('legend', { class: 'visually-hidden' }, [texts.options]),
          ...item.order.map((index) => option(question, index, chosen, shown)),
        ]),
        feedback,
        h('div', { class: 'quiz-actions' }, actions(session)),
      ]),
    ]);
    run.replaceChildren(statusBar(session), card);
    if (session.mode === 'exam') run.append(navigator(session));
    if (focus) title.focus();
  }

  /** Si se acabó el tiempo del examen, lo termina y muestra el resultado. */
  function expired(): boolean {
    if (!session || session.endedAt !== undefined || now() < deadline(session)) return false;
    session = finish(session, now());
    store.write(session);
    openResults(true);
    announce(texts.time_up);
    return true;
  }

  function tick(): void {
    if (!session || session.mode !== 'exam' || expired()) return;
    const left = remainingMs(session, now());
    const time = run.querySelector('.quiz-time');
    if (time) time.textContent = clock(left, 'up');
    if (left <= WARNING_MS) {
      run.querySelector('.quiz-clock')?.classList.add('is-low');
      if (!warned) announce(texts.five_left);
      warned = true;
    }
  }

  function openRun(focus: boolean): void {
    show(run);
    renderRun(focus);
    halt();
    if (session?.mode !== 'exam') return;
    stopClock = every(tick, 1000);
    tick();
  }

  function save(next: Session): void {
    session = next;
    store.write(next);
  }

  function move(index: number): void {
    if (!session || expired()) return;
    save(goTo(session, index));
    renderRun(true);
  }

  function requestFinish(): void {
    if (!session || expired()) return;
    if (session.mode === 'exam') {
      const pending = session.items.length - answeredCount(session);
      if (pending > 0 && !confirm(fill(texts.confirm_finish, { n: pending }))) return;
    }
    save(finish(session, now()));
    openResults(true);
  }

  function abandon(): void {
    if (!confirm(texts.confirm_abandon)) return;
    store.clear();
    session = null;
    openSetup(true);
  }

  /** La práctica: comprobar la opción elegida. */
  function check(): void {
    if (!session) return;
    const item = currentItem(session);
    const chosen = run.querySelector<HTMLInputElement>('input[name="quiz-option"]:checked');
    if (!chosen) {
      required<HTMLElement>('.quiz-feedback', run).textContent = texts.choose_first;
      announce(texts.choose_first);
      return;
    }
    save(answer(session, item.id, Number(chosen.value), now()));
    renderRun(false);
    const right = (entry(item.id).question.options[CORRECT] as string).replaceAll('`', '');
    announce(
      isRight(session, item.id)
        ? texts.correct
        : `${texts.incorrect} ${texts.mark_correct}: ${right}`,
    );
    run.querySelector<HTMLButtonElement>('.quiz-actions .btn-primary')?.focus();
  }

  // --- Resultado -----------------------------------------------------------

  function topicTable(result: Score): HTMLElement {
    const title = (id: string) => data.topics.find((topic) => topic.id === id)?.title ?? id;
    return h('div', { class: 'quiz-table-wrap' }, [
      h('table', { class: 'quiz-table' }, [
        h('caption', {}, [texts.by_topic]),
        h('thead', {}, [
          h(
            'tr',
            {},
            [texts.col_topic, texts.col_correct, texts.col_percent].map((label) =>
              h('th', { scope: 'col' }, [label]),
            ),
          ),
        ]),
        h(
          'tbody',
          {},
          result.byTopic.map((row) =>
            h('tr', {}, [
              h('th', { scope: 'row' }, [title(row.id)]),
              h('td', {}, [fill(texts.fraction, { correct: row.correct, total: row.total })]),
              h('td', {}, [fill(texts.percent, { percent: percent(row.correct, row.total) })]),
            ]),
          ),
        ),
      ]),
    ]);
  }

  function reviewItem(finished: Session, item: Item): HTMLElement {
    const { question, topic } = entry(item.id);
    const chosen = finished.answers[item.id];
    const right = chosen === CORRECT;
    let verdict = right ? texts.correct : texts.incorrect;
    if (chosen === undefined) verdict = texts.unanswered;
    return h(
      'li',
      {
        class: right ? 'quiz-review-item is-correct' : 'quiz-review-item is-wrong',
        value: finished.items.indexOf(item) + 1,
      },
      [
        h('p', { class: 'quiz-meta' }, [
          topicTag(topic),
          h('span', { class: 'quiz-mark' }, [verdict]),
        ]),
        h('p', { class: 'quiz-review-text' }, inlineCode(question.q)),
        codeBlock(item.id),
        h('dl', { class: 'quiz-answers' }, [
          h('dt', {}, [texts.your_answer]),
          h(
            'dd',
            {},
            chosen === undefined
              ? [texts.unanswered]
              : inlineCode(question.options[chosen] as string),
          ),
          right ? null : h('dt', {}, [texts.right_answer]),
          right ? null : h('dd', {}, inlineCode(question.options[CORRECT] as string)),
        ]),
        explanation(question),
      ],
    );
  }

  function review(finished: Session): HTMLElement {
    const items = countedItems(finished);
    const mistakes = items.some((item) => !isRight(finished, item.id));
    return h('section', { class: 'quiz-review-section' }, [
      h('h3', {}, [texts.review_title]),
      mistakes
        ? h('label', { class: 'quiz-filter' }, [
            h('input', { type: 'checkbox', class: 'quiz-only-mistakes' }),
            h('span', {}, [texts.only_mistakes]),
          ])
        : h('p', { class: 'quiz-no-mistakes' }, [texts.no_mistakes]),
      h(
        'ol',
        { class: 'quiz-review' },
        items.map((item) => reviewItem(finished, item)),
      ),
    ]);
  }

  /** Los enlaces para repasar de los temas en los que hubo algún fallo. */
  function study(result: Score): HTMLElement | null {
    const missed = data.topics.filter((topic) =>
      result.byTopic.some((row) => row.id === topic.id && row.correct < row.total),
    );
    if (missed.length === 0) return null;
    return h('section', { class: 'quiz-study' }, [
      h('h3', {}, [texts.study_title]),
      h(
        'ul',
        {},
        missed.map((topic) =>
          h('li', {}, [
            h('strong', {}, [topic.title]),
            h(
              'ul',
              {},
              topic.refs.map((reference) =>
                h('li', {}, [h('a', { href: reference.url }, [reference.title])]),
              ),
            ),
          ]),
        ),
      ),
    ]);
  }

  function openResults(focus: boolean): void {
    if (!session) return;
    show(results);
    const result = score(session, data.topics);
    const title = h('h2', { class: 'quiz-results-title', tabindex: -1 }, [texts.results_title]);
    const parts: (HTMLElement | null)[] = [
      title,
      h('p', { class: 'quiz-score' }, [
        result.total === 0
          ? texts.results_none
          : fill(texts.results_score, {
              correct: result.correct,
              total: result.total,
              percent: percent(result.correct, result.total),
            }),
      ]),
    ];
    if (session.mode === 'exam') {
      const used = (session.endedAt ?? now()) - session.startedAt;
      parts.push(
        timedOut(session) ? h('p', { class: 'quiz-timeup' }, [texts.results_time_up]) : null,
        h('p', { class: 'quiz-used' }, [fill(texts.results_time, { time: clock(used) })]),
      );
    }
    if (result.total > 0) parts.push(topicTable(result), study(result), review(session));
    parts.push(
      h('p', { class: 'quiz-actions' }, [button('quiz-restart', texts.restart, 'btn btn-primary')]),
    );
    results.replaceChildren(...parts.filter((part) => part !== null));
    if (focus) title.focus();
  }

  // --- Eventos -------------------------------------------------------------

  const target = (event: Event) => event.target as Element;

  setup.addEventListener('change', updateSetup);
  setup.addEventListener('click', (event) => {
    const toggle = target(event).closest<HTMLElement>('[data-topics]');
    if (!toggle) return;
    for (const input of topicInputs) input.checked = toggle.dataset['topics'] === 'all';
    updateSetup();
  });
  setup.addEventListener('submit', (event) => {
    event.preventDefault();
    const topics = selectedTopics();
    if (topics.length === 0) return;
    warned = false;
    save(newSession(topics, selectedMode(), now(), random));
    openRun(true);
  });

  run.addEventListener('click', (event) => {
    const pressed = target(event).closest('button');
    if (!pressed || !session) return;
    if (pressed.matches('.quiz-prev')) move(session.current - 1);
    else if (pressed.matches('.quiz-next')) move(session.current + 1);
    else if (pressed.matches('[data-index]')) move(Number(pressed.dataset['index']));
    else if (pressed.matches('.quiz-finish')) requestFinish();
    else if (pressed.matches('.quiz-abandon')) abandon();
  });
  // Solo la práctica tiene botón de envío (Comprobar), así que Enter en una opción la comprueba.
  run.addEventListener('submit', (event) => {
    event.preventDefault();
    check();
  });
  // En el examen no hay envío: Enter en una opción pasa a la siguiente.
  run.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || session?.mode !== 'exam') return;
    if (!target(event).matches('input[name="quiz-option"]')) return;
    event.preventDefault();
    if (session.current < session.items.length - 1) move(session.current + 1);
  });
  run.addEventListener('change', (event) => {
    const input = target(event) as HTMLInputElement;
    if (!session || session.mode !== 'exam' || input.name !== 'quiz-option' || expired()) return;
    save(answer(session, currentItem(session).id, Number(input.value), now()));
    required<HTMLElement>('.quiz-count', run).textContent = countText(session);
    const step = required<HTMLElement>(`[data-index="${session.current}"]`, run);
    step.classList.add('is-answered');
    step.setAttribute('aria-label', fill(texts.nav_answered, { n: session.current + 1 }));
  });

  results.addEventListener('click', (event) => {
    if (!target(event).closest('.quiz-restart')) return;
    store.clear();
    session = null;
    openSetup(true);
  });
  results.addEventListener('change', (event) => {
    const filter = target(event) as HTMLInputElement;
    if (!filter.matches('.quiz-only-mistakes')) return;
    for (const item of results.querySelectorAll<HTMLElement>('.quiz-review-item.is-correct')) {
      item.hidden = filter.checked;
    }
  });

  // --- Al abrir la página --------------------------------------------------

  const total = entries.size;
  required<HTMLElement>('.quiz-bank', setup).textContent = fill(texts.bank, {
    total,
    topics: data.topics.length,
  });
  required<HTMLElement>('[data-help="exam"]', setup).textContent = fill(texts.mode_exam_help, {
    size: EXAM_SIZE,
    minutes: EXAM_MS / 60_000,
  });

  const stored = store.read();
  if (!stored) {
    openSetup(false);
  } else {
    save(settle(stored, now()));
    if (session && isRunning(session, now())) openRun(false);
    else openResults(false);
  }

  return { stop: halt };
}
