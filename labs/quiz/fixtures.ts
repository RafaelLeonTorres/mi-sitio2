// Datos para las pruebas del simulador: un banco inventado, los textos reales de
// _data/interview/ui.yml, la estructura que deja _includes/interview/quiz.html, un generador de
// números al azar repetible y un almacenamiento en memoria.

import { parse } from 'yaml';
import uiSource from '../../_data/interview/ui.yml?raw';
import type { KeyValueStorage } from '../challenges/progress';
import type { QuizData, QuizTexts, Topic } from './types';

export const UI = parse(uiSource) as Readonly<Record<'es' | 'en', QuizTexts>>;

export function topic(id: string, size: number): Topic {
  return {
    id,
    title: id.toUpperCase(),
    refs: [{ title: `Guía de ${id}`, url: `https://example.com/${id}` }],
    questions: Array.from({ length: size }, (_, i) => ({
      id: `${id}-${i + 1}`,
      q: `¿Pregunta ${i + 1} de \`${id}\`?`,
      options: ['correcta', 'mala 1', 'mala 2', 'mala 3'],
      why: `Porque \`${id}\`.`,
    })),
  };
}

export const BANK: readonly Topic[] = [topic('oop', 40), topic('sql', 20), topic('cqrs', 2)];

export const DATA: QuizData = { ui: UI.es, topics: BANK };

/** La página como la deja Jekyll, con el formulario de preparación y un bloque de código. */
export function pageHtml(topics: readonly Topic[], codeFor = 'oop-1'): string {
  const boxes = topics
    .map(
      (item) =>
        `<label><input type="checkbox" name="topic" value="${item.id}" checked>${item.title}</label>`,
    )
    .join('');
  return `
    <div class="quiz">
      <p class="quiz-nojs">sin JavaScript</p>
      <form class="quiz-setup" hidden>
        <h2 class="quiz-setup-title" tabindex="-1">Prepara</h2>
        <p class="quiz-bank"></p>
        <input type="radio" name="mode" value="exam" checked><span data-help="exam"></span>
        <input type="radio" name="mode" value="practice">
        <button type="button" data-topics="all">Todos</button>
        <button type="button" data-topics="none">Ninguno</button>
        ${boxes}
        <p class="quiz-pool"></p>
        <button type="submit">Empezar</button>
      </form>
      <section class="quiz-run" hidden></section>
      <section class="quiz-results" hidden></section>
      <template id="quiz-code-${codeFor}"><pre><code>var x = 1;</code></pre></template>
    </div>`;
}

/** Un generador repetible (mulberry32). */
export function seeded(seed = 1): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}
