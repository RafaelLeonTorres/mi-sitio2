import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { EXAM_SIZE } from '../labs/quiz/session';

// El banco de preguntas de la sección Entrevista (_data/interview/): que cada tema tenga su archivo,
// que cada pregunta diga lo mismo en los dos idiomas con cuatro opciones distintas, que los textos
// de la página existan y que la respuesta correcta (la primera) no se delate por ser la más larga.

const LANGS = ['es', 'en'] as const;
type Lang = (typeof LANGS)[number];

interface Text {
  q: string;
  options: string[];
  why: string;
}

type Question = Record<Lang, Text> & { id: string; lang?: string; code?: string };

interface Topic {
  id: string;
  es: string;
  en: string;
  refs: ({ url: string } & Record<Lang, string>)[];
}

const load = <T>(path: string) => parse(readFileSync(path, 'utf8')) as T;
const topics = load<Topic[]>('_data/interview/topics.yml');
const bank = topics.map((topic) => ({
  topic,
  questions: load<Question[]>(`_data/interview/questions/${topic.id}.yml`),
}));
const questions = bank.flatMap((entry) => entry.questions);
const ui = load<Record<Lang, Record<string, string>>>('_data/interview/ui.yml');

const filled = (value: unknown) => typeof value === 'string' && value.trim() !== '';

describe('temas', () => {
  it('cada tema tiene su archivo de preguntas y no sobra ninguno', () => {
    const files = readdirSync('_data/interview/questions').sort();
    expect(files).toEqual(topics.map((topic) => `${topic.id}.yml`).sort());
  });

  it('cada tema tiene nombre en los dos idiomas y enlaces para repasar', () => {
    expect(new Set(topics.map((topic) => topic.id)).size).toBe(topics.length);
    for (const topic of topics) {
      expect(filled(topic.es) && filled(topic.en), topic.id).toBe(true);
      expect(topic.refs.length, topic.id).toBeGreaterThan(0);
      for (const reference of topic.refs) {
        expect(reference.url, topic.id).toMatch(/^https:\/\//);
        expect(filled(reference.es) && filled(reference.en), reference.url).toBe(true);
      }
    }
  });
});

describe('preguntas', () => {
  it('los temas principales tienen al menos 50 preguntas y los demás al menos 25', () => {
    const main = ['oop', 'dotnet', 'sql', 'rest'];
    const short = bank
      .filter((entry) => entry.questions.length < (main.includes(entry.topic.id) ? 50 : 25))
      .map((entry) => `${entry.topic.id}: ${entry.questions.length}`);
    expect(short).toEqual([]);
    expect(EXAM_SIZE).toBeGreaterThanOrEqual(topics.length);
  });

  it('ningún id se repite', () => {
    const ids = questions.map((question) => question.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  for (const { topic, questions: list } of bank) {
    it(`${topic.id}: cada pregunta está completa en español e inglés`, () => {
      for (const question of list) {
        expect(question.id, topic.id).toMatch(/^[a-z]+(-[a-z0-9]+)+$/);
        if (question.code !== undefined || question.lang !== undefined) {
          expect(filled(question.code), question.id).toBe(true);
          expect(['csharp', 'sql', 'typescript', 'html', 'text'], question.id).toContain(
            question.lang,
          );
        }
        for (const lang of LANGS) {
          const text = question[lang];
          const where = `${question.id}.${lang}`;
          expect(filled(text.q), where).toBe(true);
          expect(filled(text.why), where).toBe(true);
          expect(text.options, where).toHaveLength(4);
          expect(text.options.every(filled), where).toBe(true);
          expect(new Set(text.options).size, where).toBe(4);
          for (const value of [text.q, text.why, ...text.options]) {
            expect(value.split('`').length % 2, `${where}: comilla invertida sin par`).toBe(1);
          }
        }
      }
    });
  }

  it('las preguntas no se repiten', () => {
    for (const lang of LANGS) {
      const seen = questions.map((question) => `${question[lang].q}|${question.code ?? ''}`);
      expect(seen.filter((text, i) => seen.indexOf(text) !== i)).toEqual([]);
    }
  });

  // Con cuatro opciones, la más larga sería la correcta una de cada cuatro veces por azar. Si pasa
  // mucho más, se puede adivinar sin saber: alarga algún distractor.
  it.each(LANGS)('en %s la correcta no suele ser la opción más larga', (lang) => {
    const longest = questions.filter((question) => {
      const [right, ...rest] = question[lang].options.map(
        (text) => text.replaceAll('`', '').length,
      );
      return right! > Math.max(...rest);
    });
    expect(longest.length / questions.length).toBeLessThan(0.4);
  });
});

describe('textos de la sección', () => {
  it('existen en los dos idiomas, con los mismos huecos y sin vacíos', () => {
    expect(Object.keys(ui.en).sort()).toEqual(Object.keys(ui.es).sort());
    const holes = (text: string) => [...text.matchAll(/\{\w+\}/g)].map(String).sort();
    for (const key of Object.keys(ui.es)) {
      expect(filled(ui.es[key]) && filled(ui.en[key]), key).toBe(true);
      expect(holes(ui.en[key]!), key).toEqual(holes(ui.es[key]!));
    }
  });

  it('están las claves que usan el simulador y la página', () => {
    const sources = [
      'labs/quiz/types.ts',
      '_includes/interview/quiz.html',
      '_layouts/interview.html',
    ]
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    const used = [
      ...[...sources.matchAll(/^\s*\| '(\w+)'/gm)].map((match) => match[1]!),
      ...[...sources.matchAll(/\bui\.(?!yml)(\w+)/g)].map((match) => match[1]!),
    ];
    expect(used.length).toBeGreaterThan(40);
    expect(used.filter((key) => ui.es[key] === undefined)).toEqual([]);
  });
});
