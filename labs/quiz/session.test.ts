import { describe, expect, it } from 'vitest';
import { BANK, memoryStorage, seeded, topic } from './fixtures';
import {
  EXAM_MS,
  EXAM_SIZE,
  STORAGE_KEY,
  answer,
  createStore,
  examQuotas,
  finish,
  goTo,
  newSession,
  parseSession,
  pickItems,
  remainingMs,
  score,
  settle,
  shuffle,
  timedOut,
  type Session,
} from './session';

const START = 1_000_000;
const exam = () => newSession(BANK, 'exam', START, seeded(7));
const practice = () => newSession(BANK, 'practice', START, seeded(7));
const first = (session: Session) => session.items[0]!.id;
const counts = new Map(BANK.flatMap((item) => item.questions.map((q) => [q.id, 4] as const)));
const total = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

describe('shuffle', () => {
  it('devuelve los mismos elementos sin tocar la lista original', () => {
    const list = [1, 2, 3, 4, 5];
    const mixed = shuffle(list, seeded(3));
    expect([...mixed].sort()).toEqual(list);
    expect(list).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('examQuotas', () => {
  it('reparte el examen en proporción y toma al menos una de cada tema', () => {
    const quotas = examQuotas([40, 20, 2], 30, seeded(1));
    expect(total(quotas)).toBe(30);
    expect(quotas[0]).toBeGreaterThan(quotas[1]!);
    expect(quotas[2]).toBeGreaterThanOrEqual(1);
  });

  it('nunca pide a un tema más preguntas de las que tiene', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const sizes = [1, 2, 60, 3];
      const quotas = examQuotas(sizes, 30, seeded(seed));
      expect(total(quotas)).toBe(30);
      quotas.forEach((quota, i) => expect(quota).toBeLessThanOrEqual(sizes[i]!));
    }
  });

  it('toma todo cuando los temas no llegan al tamaño del examen', () => {
    expect(examQuotas([3, 4], 30, seeded(1))).toEqual([3, 4]);
  });

  it('con más temas que preguntas sigue sumando lo pedido', () => {
    const quotas = examQuotas(Array<number>(8).fill(5), 5, seeded(2));
    expect(total(quotas)).toBe(5);
  });
});

describe('pickItems', () => {
  it('el examen toma 30 preguntas distintas con las opciones revueltas', () => {
    const items = pickItems(BANK, 'exam', seeded(5));
    expect(items).toHaveLength(EXAM_SIZE);
    expect(new Set(items.map((item) => item.id)).size).toBe(EXAM_SIZE);
    for (const item of items) expect([...item.order].sort()).toEqual([0, 1, 2, 3]);
    expect(items.some((item) => item.order[0] !== 0)).toBe(true);
  });

  it('la práctica toma todas las preguntas de los temas elegidos', () => {
    expect(pickItems(BANK, 'practice', seeded(5))).toHaveLength(62);
    expect(pickItems([topic('tdd', 3)], 'practice', seeded(5))).toHaveLength(3);
  });
});

describe('answer', () => {
  it('en el examen se puede cambiar la respuesta', () => {
    let session = exam();
    session = answer(session, first(session), 2, START + 1);
    session = answer(session, first(session), 0, START + 2);
    expect(session.answers[first(session)]).toBe(0);
  });

  it('en la práctica vale la primera respuesta', () => {
    let session = practice();
    session = answer(session, first(session), 2, START + 1);
    session = answer(session, first(session), 0, START + 2);
    expect(session.answers[first(session)]).toBe(2);
  });

  it('ignora preguntas y opciones que no son del intento', () => {
    const session = exam();
    expect(answer(session, 'otra-1', 0, START)).toBe(session);
    expect(answer(session, first(session), 9, START)).toBe(session);
  });

  it('ignora las respuestas cuando se acabó el tiempo o ya terminó', () => {
    const session = exam();
    expect(answer(session, first(session), 0, START + EXAM_MS)).toBe(session);
    const ended = finish(session, START + 5);
    expect(answer(ended, first(ended), 0, START + 6)).toBe(ended);
  });
});

describe('tiempo', () => {
  it('el examen dura 30 minutos y la práctica no tiene límite', () => {
    expect(remainingMs(exam(), START + 60_000)).toBe(EXAM_MS - 60_000);
    expect(remainingMs(practice(), START + EXAM_MS * 10)).toBe(Number.POSITIVE_INFINITY);
  });

  it('un examen sin tiempo queda terminado cuando se acabó', () => {
    const late = settle(exam(), START + EXAM_MS + 90_000);
    expect(late.endedAt).toBe(START + EXAM_MS);
    expect(timedOut(late)).toBe(true);
    expect(timedOut(finish(exam(), START + 10))).toBe(false);
    expect(settle(practice(), START + EXAM_MS * 10).endedAt).toBeUndefined();
  });

  it('terminar dos veces no cambia nada', () => {
    const ended = finish(exam(), START + 10);
    expect(finish(ended, START + 20)).toBe(ended);
  });
});

describe('goTo', () => {
  it('no sale de las preguntas', () => {
    const session = exam();
    expect(goTo(session, -3).current).toBe(0);
    expect(goTo(session, 999).current).toBe(session.items.length - 1);
  });
});

describe('score', () => {
  it('en el examen las preguntas sin responder cuentan como falladas', () => {
    let session = exam();
    session = answer(session, session.items[0]!.id, 0, START);
    session = answer(session, session.items[1]!.id, 1, START);
    const result = score(session, BANK);
    expect(result).toMatchObject({ correct: 1, total: EXAM_SIZE });
    expect(total(result.byTopic.map((row) => row.total))).toBe(EXAM_SIZE);
    expect(total(result.byTopic.map((row) => row.correct))).toBe(1);
  });

  it('en la práctica solo cuentan las respondidas', () => {
    let session = practice();
    session = answer(session, session.items[0]!.id, 0, START);
    session = answer(session, session.items[1]!.id, 3, START);
    expect(score(session, BANK)).toMatchObject({ correct: 1, total: 2 });
  });
});

describe('intento guardado', () => {
  const saved = () => {
    const session = exam();
    return JSON.parse(JSON.stringify(answer(session, first(session), 1, START))) as Record<
      string,
      unknown
    >;
  };

  it('se recupera igual', () => {
    expect(parseSession(saved(), counts)).toEqual(saved());
  });

  it.each([
    ['sin forma de intento', 'texto'],
    ['otro modo', { ...saved(), mode: 'libre' }],
    ['sin preguntas', { ...saved(), items: [] }],
    ['una pregunta que ya no existe', { ...saved(), items: [{ id: 'x', order: [0, 1, 2, 3] }] }],
    ['un orden incompleto', { ...saved(), items: [{ id: 'oop-1', order: [0, 1] }] }],
    ['un orden repetido', { ...saved(), items: [{ id: 'oop-1', order: [0, 0, 1, 2] }] }],
    ['una posición imposible', { ...saved(), current: 99 }],
    ['sin inicio', { ...saved(), startedAt: 'ayer' }],
    ['una respuesta imposible', { ...saved(), answers: { 'oop-1': 7 } }],
    ['un final que no es un número', { ...saved(), endedAt: 'hoy' }],
  ])('se descarta con %s', (_name, value) => {
    expect(parseSession(value, counts)).toBeNull();
  });

  it('vive en localStorage, y sin él solo mientras la página siga abierta', () => {
    const storage = memoryStorage();
    createStore(storage, counts).write(exam());
    expect(createStore(storage, counts).read()?.items).toHaveLength(EXAM_SIZE);
    createStore(storage, counts).clear();
    expect(storage.data.has(STORAGE_KEY)).toBe(false);

    const memory = createStore(null, counts);
    memory.write(exam());
    expect(memory.read()?.items).toHaveLength(EXAM_SIZE);
    memory.clear();
    expect(memory.read()).toBeNull();
  });

  it('un JSON roto o un almacenamiento lleno no rompen la página', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{');
    expect(createStore(storage, counts).read()).toBeNull();
    const full = {
      ...storage,
      setItem: () => {
        throw new Error('lleno');
      },
    };
    expect(() => createStore(full, counts).write(exam())).not.toThrow();
  });
});
