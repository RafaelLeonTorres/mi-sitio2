// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BANK, DATA, memoryStorage, pageHtml, seeded, UI } from './fixtures';
import { startQuiz, type QuizDeps } from './page';
import { EXAM_MS, EXAM_SIZE, STORAGE_KEY, type Session } from './session';
import type { KeyValueStorage } from '../challenges/progress';

const texts = UI.es;
let clock = 0;
let ticks: (() => void)[] = [];
let storage: ReturnType<typeof memoryStorage>;

function open(extra: Partial<QuizDeps> = {}, from: KeyValueStorage = storage) {
  document.body.innerHTML = pageHtml(BANK);
  ticks = [];
  return startQuiz(document.querySelector<HTMLElement>('.quiz')!, DATA, {
    storage: from,
    now: () => clock,
    random: seeded(11),
    confirm: () => true,
    every: (tick) => {
      ticks.push(tick);
      return () => {
        ticks = ticks.filter((other) => other !== tick);
      };
    },
    ...extra,
  });
}

const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const all = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const click = (selector: string) => $(selector).click();
const saved = () => JSON.parse(storage.getItem(STORAGE_KEY)!) as Session;
const visible = () => ['.quiz-setup', '.quiz-run', '.quiz-results'].filter((s) => !$(s).hidden);

function start(mode: 'exam' | 'practice') {
  $<HTMLInputElement>(`input[value="${mode}"]`).click();
  $<HTMLFormElement>('.quiz-setup').requestSubmit();
}

/** Elige la opción correcta (la 0 del banco) o una incorrecta en la pregunta que se ve. */
function choose(right: boolean) {
  const input = all('input[name="quiz-option"]').find(
    (radio) => ((radio as HTMLInputElement).value === '0') === right,
  ) as HTMLInputElement;
  input.click();
}

beforeEach(() => {
  clock = 5_000_000;
  storage = memoryStorage();
});

describe('preparar', () => {
  it('muestra el formulario con las cuentas del banco', () => {
    open();
    expect(visible()).toEqual(['.quiz-setup']);
    expect($('.quiz-nojs').hidden).toBe(true);
    expect($('.quiz-bank').textContent).toBe('El banco tiene 62 preguntas de 3 temas.');
    expect($('[data-help="exam"]').textContent).toContain('30 preguntas');
    expect($('.quiz-pool').textContent).toBe('El examen toma 30 de 62 preguntas.');
    expect($('button[type="submit"]').textContent).toBe(texts.start_exam);
  });

  it('cambia el resumen según el modo y los temas, y sin temas no deja empezar', () => {
    open();
    $<HTMLInputElement>('input[value="practice"]').click();
    expect($('.quiz-pool').textContent).toBe('La práctica tiene 62 preguntas.');
    expect($('button[type="submit"]').textContent).toBe(texts.start_practice);
    click('[data-topics="none"]');
    expect($('.quiz-pool').textContent).toBe(texts.pool_none);
    expect($<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
    click('[data-topics="all"]');
    expect($<HTMLButtonElement>('button[type="submit"]').disabled).toBe(false);
  });

  it('solo toma preguntas de los temas elegidos', () => {
    open();
    $<HTMLInputElement>('input[value="oop"]').click();
    start('practice');
    expect(saved().items.every((item) => !item.id.startsWith('oop-'))).toBe(true);
    expect(saved().items).toHaveLength(22);
  });
});

describe('examen', () => {
  it('empieza con 30 preguntas, el reloj y el navegador de preguntas', () => {
    open();
    start('exam');
    expect(visible()).toEqual(['.quiz-run']);
    expect($('.quiz-progress').textContent).toBe(`Pregunta 1 de ${EXAM_SIZE}`);
    expect($('.quiz-time').textContent).toBe('30:00');
    expect(all('.quiz-nav button')).toHaveLength(EXAM_SIZE);
    expect(all('input[name="quiz-option"]')).toHaveLength(4);
    expect($<HTMLButtonElement>('.quiz-prev').disabled).toBe(true);
    expect(document.activeElement).toBe($('.quiz-text'));
  });

  it('guarda la respuesta, la marca en el navegador y deja volver a ella', () => {
    open();
    start('exam');
    choose(false);
    expect($('.quiz-count').textContent).toBe(`1 de ${EXAM_SIZE} respondidas`);
    expect($('[data-index="0"]').classList.contains('is-answered')).toBe(true);
    expect($('[data-index="0"]').getAttribute('aria-label')).toBe('Pregunta 1, respondida');
    click('.quiz-next');
    expect($('.quiz-progress').textContent).toContain('Pregunta 2');
    click('[data-index="0"]');
    expect($<HTMLInputElement>('input[name="quiz-option"]:checked').value).not.toBe('0');
    // No revela nada antes de terminar.
    expect(all('.quiz-mark')).toHaveLength(0);
    expect($('.quiz-feedback').textContent).toBe('');
  });

  it('Enter en una opción pasa a la siguiente, salvo en la última', () => {
    open();
    start('exam');
    const enter = () =>
      $('input[name="quiz-option"]').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    enter();
    expect($('.quiz-progress').textContent).toContain('Pregunta 2');
    click(`[data-index="${EXAM_SIZE - 1}"]`);
    enter();
    expect($('.quiz-progress').textContent).toContain(`Pregunta ${EXAM_SIZE} de`);
  });

  it('pide confirmar si quedan preguntas y califica al terminar', () => {
    const confirm = vi.fn(() => false);
    open({ confirm });
    start('exam');
    choose(true);
    click('.quiz-finish');
    expect(confirm).toHaveBeenCalledWith(
      'Te quedan 29 preguntas sin responder. ¿Terminar de todos modos?',
    );
    expect(visible()).toEqual(['.quiz-run']);

    confirm.mockReturnValue(true);
    click('.quiz-finish');
    expect(visible()).toEqual(['.quiz-results']);
    expect($('.quiz-score').textContent).toBe('1 de 30 correctas (3 %)');
    expect(all('.quiz-review-item')).toHaveLength(EXAM_SIZE);
    expect(all('.quiz-review-item.is-correct')).toHaveLength(1);
    expect($('.quiz-review-item.is-wrong dd').textContent).toBe(texts.unanswered);
    expect(all('.quiz-table tbody tr')).toHaveLength(3);
    expect($('.quiz-study a').getAttribute('href')).toBe('https://example.com/oop');
    expect(ticks).toHaveLength(0);
  });

  it('filtra la revisión para ver solo los fallos', () => {
    open();
    start('exam');
    choose(true);
    click('.quiz-finish');
    click('.quiz-only-mistakes');
    expect(all('.quiz-review-item').filter((item) => !item.hidden)).toHaveLength(EXAM_SIZE - 1);
    click('.quiz-only-mistakes');
    expect(all('.quiz-review-item').filter((item) => !item.hidden)).toHaveLength(EXAM_SIZE);
  });

  it('avisa a los 5 minutos y termina solo cuando se acaba el tiempo', () => {
    open();
    start('exam');
    choose(true);
    clock += EXAM_MS - 4 * 60_000;
    ticks[0]!();
    expect($('.quiz-time').textContent).toBe('04:00');
    expect($('.quiz-clock').classList.contains('is-low')).toBe(true);
    expect($('#lab-live').textContent).toBe(texts.five_left);
    clock += 5 * 60_000;
    ticks[0]!();
    expect(visible()).toEqual(['.quiz-results']);
    expect($('.quiz-timeup').textContent).toBe(texts.results_time_up);
    expect($('.quiz-used').textContent).toBe('Tiempo usado: 30:00');
    expect($('#lab-live').textContent).toBe(texts.time_up);
  });

  it('al recargar la página sigue donde estaba, con las mismas opciones', () => {
    open();
    start('exam');
    choose(true);
    click('.quiz-next');
    const order = all('.quiz-option-text').map((node) => node.textContent);
    open();
    expect(visible()).toEqual(['.quiz-run']);
    expect($('.quiz-progress').textContent).toContain('Pregunta 2');
    expect(all('.quiz-option-text').map((node) => node.textContent)).toEqual(order);
    expect($('.quiz-count').textContent).toBe(`1 de ${EXAM_SIZE} respondidas`);
  });

  it('si se cerró la página y se acabó el tiempo, abre el resultado', () => {
    open();
    start('exam');
    clock += EXAM_MS + 1;
    open();
    expect(visible()).toEqual(['.quiz-results']);
    expect($('.quiz-timeup')).not.toBeNull();
  });

  it('salir pide confirmar y borra el intento', () => {
    const confirm = vi.fn(() => false);
    open({ confirm });
    start('exam');
    click('.quiz-abandon');
    expect(visible()).toEqual(['.quiz-run']);
    confirm.mockReturnValue(true);
    click('.quiz-abandon');
    expect(visible()).toEqual(['.quiz-setup']);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(ticks).toHaveLength(0);
  });

  it('copia el bloque de código de la pregunta que lo tiene', () => {
    const only = { ...DATA, topics: [{ ...BANK[0]!, questions: [BANK[0]!.questions[0]!] }] };
    document.body.innerHTML = pageHtml(only.topics);
    startQuiz($('.quiz'), only, { storage, now: () => clock, every: () => () => {} });
    start('exam');
    expect($('.quiz-code code').textContent).toBe('var x = 1;');
    expect($<HTMLPreElement>('.quiz-code pre').tabIndex).toBe(0);
  });
});

describe('práctica', () => {
  it('no deja comprobar sin elegir', () => {
    open();
    start('practice');
    expect(all('.quiz-clock')).toHaveLength(0);
    expect(all('.quiz-nav')).toHaveLength(0);
    $<HTMLFormElement>('.quiz-answer').requestSubmit();
    expect($('.quiz-feedback').textContent).toBe(texts.choose_first);
  });

  it('explica enseguida, marca la correcta y no deja cambiar la respuesta', () => {
    open();
    start('practice');
    choose(false);
    click('.quiz-check');
    expect($('.quiz-verdict').textContent).toBe(texts.incorrect);
    expect($('.quiz-why').textContent).toContain('Porque');
    expect($('.quiz-option.is-correct .quiz-mark').textContent).toBe(texts.mark_correct);
    expect($('.quiz-option.is-wrong .quiz-mark').textContent).toBe(texts.mark_wrong);
    expect(all('input[name="quiz-option"]:disabled')).toHaveLength(4);
    expect($('.quiz-count').textContent).toBe('Aciertos: 0 de 1');
    expect(document.activeElement).toBe($('.quiz-next'));

    click('.quiz-next');
    choose(true);
    click('.quiz-check');
    expect($('.quiz-verdict').textContent).toBe(texts.correct);
    expect($('.quiz-count').textContent).toBe('Aciertos: 1 de 2');
  });

  it('califica solo lo respondido', () => {
    open();
    start('practice');
    choose(true);
    click('.quiz-check');
    click('.quiz-finish');
    expect($('.quiz-score').textContent).toBe('1 de 1 correctas (100 %)');
    expect($('.quiz-no-mistakes').textContent).toBe(texts.no_mistakes);
    expect(all('.quiz-study')).toHaveLength(0);
    expect(all('.quiz-used')).toHaveLength(0);
  });

  it('sin respuestas lo dice y permite empezar de nuevo', () => {
    open();
    start('practice');
    click('.quiz-finish');
    expect($('.quiz-score').textContent).toBe(texts.results_none);
    expect(all('.quiz-review-item')).toHaveLength(0);
    click('.quiz-restart');
    expect(visible()).toEqual(['.quiz-setup']);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('en la última pregunta lleva al resultado', () => {
    const small = { ...DATA, topics: [BANK[2]!] };
    document.body.innerHTML = pageHtml(small.topics);
    startQuiz($('.quiz'), small, { storage, now: () => clock, every: () => () => {} });
    start('practice');
    for (let i = 0; i < 2; i++) {
      choose(true);
      click('.quiz-check');
      if (i === 0) click('.quiz-next');
    }
    expect($('.quiz-finish').textContent).toBe(texts.see_results);
    click('.quiz-finish');
    expect($('.quiz-score').textContent).toBe('2 de 2 correctas (100 %)');
  });
});
