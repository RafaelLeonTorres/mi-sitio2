// Lo que las pruebas de datos comprueban en la lección de cualquier curso (C#, SQL...), sea cual sea su
// motor: los minutos, los pasos y sus ids, los textos de cada paso en los dos idiomas y que ningún texto
// se lea como Liquid. Lo propio de cada motor (las revisiones de un ejercicio de C#, el nivel y las
// capturas de un paso de SQL) lo comprueba la prueba de ese curso. Las funciones registran sus pruebas
// en el `describe` que las llama, una por lección.

import { expect, it } from 'vitest';
import { lessonData, modules } from './course-pages.mjs';

export const LANGS = ['es', 'en'] as const;

export type Json = Record<string, unknown>;

/** Todas las claves de un objeto, con su ruta, para comparar dos idiomas. */
export function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, inner]) => keys(inner, `${prefix}.${key}`));
}

/** Todos los textos de un objeto. */
export function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(strings);
}

/** Los textos de un paso en un idioma. */
export function stepTexts(data: Json, lang: string, id: string): Json {
  return ((data[lang] as Json)['steps'] as Record<string, Json>)[id]!;
}

/** Las pruebas que valen para el temario de cualquier curso (su clave en catalog.yml). */
export function commonCatalogChecks(root: string, courseId: string): void {
  const catalog = modules(root, courseId);
  const texts = (module: unknown, lang: string) => (module as Record<string, Json>)[lang]!;

  it('cada módulo tiene slug, título, resumen y lecciones por venir en los dos idiomas', () => {
    for (const module of catalog) {
      for (const lang of LANGS) {
        const moduleTexts = texts(module, lang);
        expect(moduleTexts['slug'], `${module.id} ${lang} slug`).toMatch(
          /^[a-z0-9]+(-[a-z0-9]+)*$/,
        );
        expect(moduleTexts['title'], `${module.id} ${lang} title`).toBeTruthy();
        expect(moduleTexts['summary'], `${module.id} ${lang} summary`).toBeTruthy();
        expect(Array.isArray(moduleTexts['planned']), `${module.id} ${lang} planned`).toBe(true);
      }
    }
  });

  it('los módulos y las lecciones tienen ids y slugs únicos', () => {
    expect(new Set(catalog.map((module) => module.id)).size).toBe(catalog.length);
    for (const lang of LANGS) {
      const slugs = catalog.map((module) => texts(module, lang)['slug']);
      expect(new Set(slugs).size).toBe(catalog.length);
    }
  });

  it('las lecciones de un módulo tienen slugs únicos', () => {
    for (const module of catalog) {
      for (const lang of LANGS) {
        const slugs = module.lessons.map(
          (id) => (lessonData(root, courseId, module.id, id)[lang] as Json)['slug'],
        );
        expect(new Set(slugs).size, `${module.id} ${lang}`).toBe(slugs.length);
      }
    }
  });
}

/**
 * Las pruebas que valen para toda lección. `kinds` son los tipos de paso que acepta el motor del
 * curso, y `textKeys` las claves de texto de un paso que deben ser cadenas.
 */
export function commonLessonChecks(
  data: Json,
  options: { kinds: readonly string[]; textKeys?: readonly string[] },
): void {
  const shared = data['shared'] as { steps: Json[]; minutes: number };
  const ids = shared.steps.map((step) => step['id'] as string);
  const textKeys = options.textKeys ?? [
    'title',
    'text',
    'instructions',
    'explanation',
    'failure',
    'question',
    'differences',
  ];

  it('tiene minutos y pasos con ids únicos y tipos válidos', () => {
    expect(typeof shared.minutes).toBe('number');
    expect(shared.steps.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of shared.steps) expect(options.kinds).toContain(step['kind']);
  });

  it('el título, el slug y el resumen existen en los dos idiomas', () => {
    for (const lang of LANGS) {
      const texts = data[lang] as Json;
      expect(texts['slug']).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(texts['title']).toBeTruthy();
      expect(texts['summary']).toBeTruthy();
    }
  });

  it('los dos idiomas tienen los mismos pasos que shared', () => {
    for (const lang of LANGS) {
      expect(Object.keys((data[lang] as Json)['steps'] as Json)).toEqual(ids);
    }
  });

  it('cada paso tiene sus textos en los dos idiomas', () => {
    for (const step of shared.steps) {
      for (const lang of LANGS) {
        const texts = stepTexts(data, lang, step['id'] as string);
        expect(texts['title'], `${step['id']} ${lang} title`).toBeTruthy();
        expect(texts['text'], `${step['id']} ${lang} text`).toBeTruthy();
        if (step['kind'] === 'exercise') {
          expect(texts['instructions'], `${step['id']} ${lang} instructions`).toBeTruthy();
          expect(texts['explanation'], `${step['id']} ${lang} explanation`).toBeTruthy();
          expect(texts['failure'], `${step['id']} ${lang} failure`).toBeTruthy();
          const hints = texts['hints'] as unknown[];
          expect(hints.length, `${step['id']} ${lang} hints`).toBeGreaterThanOrEqual(1);
          expect(hints.length, `${step['id']} ${lang} hints`).toBeLessThanOrEqual(3);
        }
        if (step['kind'] === 'choice') {
          expect(texts['question'], `${step['id']} ${lang} question`).toBeTruthy();
          expect(texts['explanation'], `${step['id']} ${lang} explanation`).toBeTruthy();
          const options = texts['options'] as unknown[];
          expect(options.length).toBeGreaterThanOrEqual(2);
          expect(step['answer'] as number).toBeLessThan(options.length);
        }
      }
    }
  });

  it('los textos de los pasos son cadenas: un `: ` sin comillas en YAML los vuelve objetos', () => {
    const steps = (lang: string) => (data[lang] as Json)['steps'] as Record<string, Json>;
    for (const lang of LANGS) {
      for (const [id, step] of Object.entries(steps(lang))) {
        for (const key of textKeys) {
          if (step[key] !== undefined)
            expect(typeof step[key], `${id} ${lang} ${key}`).toBe('string');
        }
        for (const key of ['hints', 'options']) {
          for (const item of (step[key] as unknown[] | undefined) ?? []) {
            expect(typeof item, `${id} ${lang} ${key}: ${JSON.stringify(item)}`).toBe('string');
          }
        }
      }
    }
  });

  it('las preguntas traen las mismas opciones en los dos idiomas', () => {
    for (const step of shared.steps.filter((item) => item['kind'] === 'choice')) {
      const count = (lang: string) =>
        (stepTexts(data, lang, step['id'] as string)['options'] as unknown[]).length;
      expect(count('es')).toBe(count('en'));
    }
  });

  it('el código inicial propio de un idioma está en los dos o en ninguno', () => {
    for (const step of shared.steps.filter((item) => item['kind'] === 'exercise')) {
      const texts = LANGS.map((lang) => stepTexts(data, lang, step['id'] as string));
      expect(new Set(texts.map((item) => 'starter' in item)).size, `${step['id']} starter`).toBe(1);
      for (const item of texts)
        if ('starter' in item) expect(typeof item['starter']).toBe('string');
    }
  });

  it('ningún texto ni código trae {{ ni {%: Jekyll los leería como Liquid', () => {
    expect(strings(data).filter((text) => /\{\{|\{%/.test(text))).toEqual([]);
  });
}
