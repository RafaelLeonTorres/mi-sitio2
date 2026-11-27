// La lógica del simulador de entrevista, sin DOM: qué preguntas entran, en qué orden se muestran
// las opciones, las respuestas, el reloj del examen, la calificación y cómo se guarda el intento.
// El intento solo guarda ids e índices de opciones, así que sigue igual al cambiar de idioma.

import type { KeyValueStorage } from '../challenges/progress';
import type { Topic } from './types';

export const EXAM_SIZE = 30;
export const EXAM_MS = 30 * 60 * 1000;
export const STORAGE_KEY = 'mi-sitio2.entrevista.v1';
/** En el banco, la respuesta correcta es siempre la primera opción. */
export const CORRECT = 0;

export type Mode = 'exam' | 'practice';
export type Random = () => number;

export interface Item {
  readonly id: string;
  /** El orden en que se muestran las opciones: cada número es el índice de la opción en el banco. */
  readonly order: readonly number[];
}

export interface Session {
  readonly mode: Mode;
  readonly items: readonly Item[];
  /** Por pregunta, el índice (en el banco) de la opción elegida. */
  readonly answers: Readonly<Record<string, number>>;
  readonly current: number;
  readonly startedAt: number;
  readonly endedAt?: number;
}

export interface TopicScore {
  readonly id: string;
  readonly correct: number;
  readonly total: number;
}

export interface Score {
  readonly correct: number;
  readonly total: number;
  /** Solo los temas con preguntas que cuentan, en el orden del banco. */
  readonly byTopic: readonly TopicScore[];
}

export function shuffle<T>(list: readonly T[], random: Random): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Cuántas preguntas toma el examen de cada tema: al menos una de cada uno (si caben) y el resto en
 * proporción al tamaño del tema, repartiendo lo que sobra por los restos mayores.
 */
export function examQuotas(sizes: readonly number[], wanted: number, random: Random): number[] {
  const total = Math.min(wanted, sum(sizes));
  const minimum = total >= sizes.filter((size) => size > 0).length ? 1 : 0;
  const quotas = sizes.map((size) => Math.min(size, minimum));
  const room = sizes.map((size, i) => size - (quotas[i] as number));
  const rest = total - sum(quotas);
  const free = sum(room);
  const shares = room.map((places) => (free === 0 ? 0 : (rest * places) / free));
  const result = quotas.map((quota, i) => quota + Math.floor(shares[i] as number));
  const remainder = (i: number) => (shares[i] as number) % 1;
  // Los empates entre restos se deciden al azar: se revuelve antes de ordenar.
  const order = shuffle([...sizes.keys()], random).sort((a, b) => remainder(b) - remainder(a));
  let missing = total - sum(result);
  for (const i of order) {
    if (missing === 0) break;
    if ((result[i] as number) < (sizes[i] as number)) {
      result[i] = (result[i] as number) + 1;
      missing--;
    }
  }
  return result;
}

/**
 * Las preguntas de un intento, ya revueltas. La práctica toma todas las de los temas elegidos; el
 * examen, `EXAM_SIZE` repartidas entre ellos.
 */
export function pickItems(topics: readonly Topic[], mode: Mode, random: Random): Item[] {
  const pools = topics.map((topic) => shuffle(topic.questions, random));
  const quotas =
    mode === 'exam'
      ? examQuotas(
          pools.map((pool) => pool.length),
          EXAM_SIZE,
          random,
        )
      : pools.map((pool) => pool.length);
  const chosen = pools.flatMap((pool, i) => pool.slice(0, quotas[i]));
  return shuffle(chosen, random).map((question) => ({
    id: question.id,
    order: shuffle([...question.options.keys()], random),
  }));
}

export function newSession(
  topics: readonly Topic[],
  mode: Mode,
  now: number,
  random: Random,
): Session {
  return { mode, items: pickItems(topics, mode, random), answers: {}, current: 0, startedAt: now };
}

/** Cuándo se acaba el tiempo; la práctica no tiene límite. */
export const deadline = (session: Session): number =>
  session.mode === 'exam' ? session.startedAt + EXAM_MS : Number.POSITIVE_INFINITY;

export const isRunning = (session: Session, now: number): boolean =>
  session.endedAt === undefined && now < deadline(session);

export const remainingMs = (session: Session, now: number): number =>
  Math.max(0, deadline(session) - (session.endedAt ?? now));

/** Un examen que terminó porque se acabó el tiempo. */
export const timedOut = (session: Session): boolean => session.endedAt === deadline(session);

/** Termina el intento; si el tiempo ya se había acabado, termina cuando se acabó. */
export function finish(session: Session, now: number): Session {
  if (session.endedAt !== undefined) return session;
  return { ...session, endedAt: Math.min(now, deadline(session)) };
}

/** El intento como está ahora: un examen sin tiempo queda terminado. */
export const settle = (session: Session, now: number): Session =>
  now >= deadline(session) ? finish(session, now) : session;

/**
 * Anota una respuesta. En el examen se puede cambiar mientras haya tiempo; en la práctica la primera
 * es la que vale, porque enseguida se muestra la correcta.
 */
export function answer(session: Session, id: string, option: number, now: number): Session {
  if (!isRunning(session, now)) return session;
  if (!session.items.some((item) => item.id === id && item.order.includes(option))) return session;
  if (session.mode === 'practice' && session.answers[id] !== undefined) return session;
  return { ...session, answers: { ...session.answers, [id]: option } };
}

export function goTo(session: Session, index: number): Session {
  const current = Math.min(Math.max(index, 0), session.items.length - 1);
  return current === session.current ? session : { ...session, current };
}

export const answeredCount = (session: Session): number =>
  session.items.filter((item) => session.answers[item.id] !== undefined).length;

/** Las preguntas que cuentan: en el examen todas; en la práctica, las respondidas. */
export const countedItems = (session: Session): readonly Item[] =>
  session.mode === 'exam'
    ? session.items
    : session.items.filter((item) => session.answers[item.id] !== undefined);

export const isRight = (session: Session, id: string): boolean => session.answers[id] === CORRECT;

export const percent = (correct: number, total: number): number =>
  total === 0 ? 0 : Math.round((correct * 100) / total);

export function score(session: Session, topics: readonly Topic[]): Score {
  const counted = countedItems(session);
  const byTopic = topics.flatMap((topic) => {
    const ids = new Set(topic.questions.map((question) => question.id));
    const mine = counted.filter((item) => ids.has(item.id));
    if (mine.length === 0) return [];
    const correct = mine.filter((item) => isRight(session, item.id)).length;
    return [{ id: topic.id, correct, total: mine.length }];
  });
  return {
    correct: counted.filter((item) => isRight(session, item.id)).length,
    total: counted.length,
    byTopic,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIndex = (value: unknown, length: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < length;

/**
 * Un intento guardado, solo si todavía corresponde al banco: cada pregunta existe y sus opciones
 * son las mismas en número. Si el banco cambió, el intento se descarta.
 */
export function parseSession(
  value: unknown,
  optionCounts: ReadonlyMap<string, number>,
): Session | null {
  if (!isRecord(value)) return null;
  const { mode, items, answers, current, startedAt, endedAt } = value;
  if (mode !== 'exam' && mode !== 'practice') return null;
  if (!Array.isArray(items) || items.length === 0) return null;
  const valid = items.every((item: unknown) => {
    if (!isRecord(item) || typeof item['id'] !== 'string') return false;
    const count = optionCounts.get(item['id']);
    const order = item['order'];
    return (
      count !== undefined &&
      Array.isArray(order) &&
      order.length === count &&
      new Set(order).size === count &&
      order.every((option) => isIndex(option, count))
    );
  });
  if (!valid || !isIndex(current, items.length) || typeof startedAt !== 'number') return null;
  if (endedAt !== undefined && typeof endedAt !== 'number') return null;
  if (!isRecord(answers)) return null;
  const known = Object.entries(answers).every(([id, option]) =>
    isIndex(option, optionCounts.get(id) ?? 0),
  );
  return known ? (value as unknown as Session) : null;
}

export interface Store {
  read(): Session | null;
  write(session: Session): void;
  clear(): void;
}

/** El intento en el navegador; sin almacenamiento, vive solo mientras la página esté abierta. */
export function createStore(
  storage: KeyValueStorage | null,
  optionCounts: ReadonlyMap<string, number>,
): Store {
  let memory: Session | null = null;
  return {
    read() {
      if (!storage) return memory;
      try {
        return parseSession(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null'), optionCounts);
      } catch {
        return null;
      }
    },
    write(session) {
      memory = session;
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch {
        // Sin espacio: el intento sigue en memoria.
      }
    },
    clear() {
      memory = null;
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        // Nada que borrar.
      }
    },
  };
}
