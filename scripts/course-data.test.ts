import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { lessonData, modules } from './course-pages.mjs';

const root = '.';
const LANGS = ['es', 'en'] as const;
const KINDS = ['read', 'exercise', 'choice'];
const SYNTAX_RULES = ['uses-syntax', 'avoids-syntax'];
const NAME_RULES = [...SYNTAX_RULES, 'declares-variable', 'calls-method'];
const TYPE_RULES = ['uses-type', 'avoids-type'];
const RULES = [...NAME_RULES, ...TYPE_RULES];
const RULE_KEYS = ['kind', 'name', 'type', 'min'];
const RUN_KEYS = ['stdin', 'stdout', 'contains', 'matches', 'throws'];

type Json = Record<string, unknown>;

/** Todas las claves de un objeto, con su ruta, para comparar dos idiomas. */
function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, inner]) => keys(inner, `${prefix}.${key}`));
}

/** Todos los textos de un objeto. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(strings);
}

const catalog = modules(root);
const lessons = catalog.flatMap((module) =>
  module.lessons.map((id) => ({ module: module.id, id, data: lessonData(root, module.id, id) })),
);
const read = (path: string): Json => parse(readFileSync(path, 'utf8')) as Json;
const ui = read('_data/course/ui.yml');

describe('temario del curso', () => {
  it('cada módulo tiene slug, título, resumen y lecciones por venir en los dos idiomas', () => {
    for (const module of catalog) {
      for (const lang of LANGS) {
        const texts = (module as unknown as Record<string, Json>)[lang]!;
        expect(texts['slug'], `${module.id} ${lang} slug`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(texts['title'], `${module.id} ${lang} title`).toBeTruthy();
        expect(texts['summary'], `${module.id} ${lang} summary`).toBeTruthy();
        expect(Array.isArray(texts['planned']), `${module.id} ${lang} planned`).toBe(true);
      }
    }
  });

  it('los módulos y las lecciones tienen ids y slugs únicos', () => {
    expect(new Set(catalog.map((module) => module.id)).size).toBe(catalog.length);
    for (const lang of LANGS) {
      const slugs = catalog.map(
        (module) => (module as unknown as Record<string, Json>)[lang]!['slug'],
      );
      expect(new Set(slugs).size).toBe(catalog.length);
    }
  });

  it('las lecciones de un módulo tienen slugs únicos', () => {
    for (const module of catalog) {
      for (const lang of LANGS) {
        const slugs = module.lessons.map(
          (id) => (lessonData(root, module.id, id)[lang] as Json)['slug'],
        );
        expect(new Set(slugs).size, `${module.id} ${lang}`).toBe(slugs.length);
      }
    }
  });
});

describe('cierre de los módulos', () => {
  type Practice = { challenges: string[]; posts: string[] };
  const LEVELS = ['easy', 'medium', 'hard'];
  const practiceOf = (module: unknown) => (module as { practice?: Practice }).practice;
  const challengeOf = (id: string): Json => read(`_data/labs/challenges/${id}.yml`);

  /** Los `ref` de las publicaciones de un idioma, leídos de su front matter. */
  const postRefs = (lang: string): string[] =>
    readdirSync(`_posts/${lang}`)
      .filter((name) => name.endsWith('.md'))
      .map((name) => {
        const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(
          readFileSync(`_posts/${lang}/${name}`, 'utf8'),
        );
        return (parse(front?.[1] ?? '') as Json)['ref'] as string;
      });

  it('cada módulo trae sus retos y sus lecturas como listas de ids', () => {
    for (const module of catalog) {
      const practice = practiceOf(module);
      for (const key of ['challenges', 'posts'] as const) {
        const ids = practice?.[key];
        expect(Array.isArray(ids), `${module.id} practice.${key}`).toBe(true);
        expect(
          ids!.every((id) => typeof id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)),
          `${module.id} practice.${key} son ids`,
        ).toBe(true);
      }
    }
  });

  it('los retos existen, son de C# y cada uno cierra un solo módulo', () => {
    const all = catalog.flatMap((module) => practiceOf(module)!.challenges);
    expect(new Set(all).size, 'un reto en dos módulos').toBe(all.length);
    for (const id of all) {
      expect(existsSync(`_data/labs/challenges/${id}.yml`), `${id} existe`).toBe(true);
      const challenge = challengeOf(id);
      expect((challenge['shared'] as Json)['language'], `${id} es de C#`).toBe('csharp');
      for (const lang of LANGS)
        expect((challenge[lang] as Json)['slug'], `${id} ${lang} slug`).toBeTruthy();
    }
  });

  it('dentro de cada módulo los retos van de lo fácil a lo difícil', () => {
    for (const module of catalog) {
      const levels = practiceOf(module)!.challenges.map((id) =>
        LEVELS.indexOf((challengeOf(id)['shared'] as Json)['difficulty'] as string),
      );
      expect(
        levels.every((level) => level >= 0),
        `${module.id} dificultad`,
      ).toBe(true);
      expect(levels, module.id).toEqual([...levels].sort((a, b) => a - b));
    }
  });

  it('cada publicación existe en español y en inglés', () => {
    const refs = { es: postRefs('es'), en: postRefs('en') };
    for (const module of catalog)
      for (const ref of practiceOf(module)!.posts)
        for (const lang of LANGS)
          expect(refs[lang], `${module.id}: ${ref} en ${lang}`).toContain(ref);
  });

  it('los primeros módulos pueden no traer retos, pero desde el primero que los trae, todos los traen', () => {
    // Los retos piden escribir un método con ciclos: antes de eso, el cierre remite al playground.
    const counts = catalog.map((module) => practiceOf(module)!.challenges.length);
    const first = counts.findIndex((count) => count > 0);
    expect(first, 'ningún módulo trae retos').toBeGreaterThanOrEqual(0);
    expect(
      counts.slice(first).every((count) => count > 0),
      'un módulo sin retos después de otro que los trae',
    ).toBe(true);
  });
});

describe('textos de la interfaz', () => {
  it('el español y el inglés tienen las mismas claves', () => {
    expect(keys(ui['en'])).toEqual(keys(ui['es']));
  });

  it('ningún texto está vacío', () => {
    for (const lang of LANGS)
      expect(strings(ui[lang]).every((text) => text.trim() !== '')).toBe(true);
  });
});

describe('cursos y menú', () => {
  const soon = parse(readFileSync('_data/course/soon.yml', 'utf8')) as Json[];
  const site = read('_data/ui.yml');

  it('cada curso por venir tiene un id y un título', () => {
    expect(soon.length).toBeGreaterThan(0);
    for (const course of soon) {
      expect(course['id'], 'id').toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(String(course['title']).trim(), `${course['id']} title`).not.toBe('');
    }
  });

  it('los ids no se repiten y ninguno es de un curso que ya existe', () => {
    const ids = soon.map((course) => course['id'] as string);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('csharp');
    // Cuando un curso se publica tiene su carpeta; entonces ya no debe salir como "Próximamente".
    for (const id of ids) expect(existsSync(`curso/${id}`), `${id} ya tiene carpeta`).toBe(false);
  });

  it('el menú de los dos idiomas lleva al índice de cursos y abre su submenú', () => {
    for (const lang of LANGS) {
      const nav = (site[lang] as { nav: Json[] }).nav;
      const entry = nav.find((item) => item['menu'] === 'courses');
      expect(entry, lang).toBeDefined();
      expect(entry!['page'], lang).toBe((ui[lang] as Json)['course_url']);
    }
  });
});

describe('explicaciones de errores', () => {
  const errors = read('_data/course/errors.yml');

  it.each(Object.keys(errors))('%s está en los dos idiomas', (code) => {
    // El código de un error del compilador o el nombre corto de una excepción.
    expect(code).toMatch(/^(CS\d{4}|[A-Z][A-Za-z]+Exception)$/);
    const entry = errors[code] as Record<string, string>;
    for (const lang of LANGS) expect(entry[lang]?.trim()).toBeTruthy();
  });
});

describe.each(lessons)('lección $module/$id', ({ data }) => {
  const shared = data['shared'] as { steps: Json[]; minutes: number };
  const ids = shared.steps.map((step) => step['id'] as string);

  it('tiene minutos y pasos con ids únicos y tipos válidos', () => {
    expect(typeof shared.minutes).toBe('number');
    expect(shared.steps.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of shared.steps) expect(KINDS).toContain(step['kind']);
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
        const texts = ((data[lang] as Json)['steps'] as Record<string, Json>)[
          step['id'] as string
        ]!;
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
        for (const key of ['title', 'text', 'instructions', 'explanation', 'failure', 'question']) {
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
        (
          ((data[lang] as Json)['steps'] as Record<string, Json>)[step['id'] as string]![
            'options'
          ] as unknown[]
        ).length;
      expect(count('es')).toBe(count('en'));
    }
  });

  const exercises = shared.steps.filter((item) => item['kind'] === 'exercise');

  it('los ejercicios traen código inicial, solución y alguna revisión', () => {
    for (const step of exercises) {
      expect(typeof step['starter'], `${step['id']} starter`).toBe('string');
      expect(typeof step['solution'], `${step['id']} solution`).toBe('string');
      const runs = (step['runs'] as Json[] | undefined) ?? [];
      const rules = (step['rules'] as Json[] | undefined) ?? [];
      expect(runs.length + rules.length, `${step['id']} revisiones`).toBeGreaterThan(0);
    }
  });

  it('las reglas están completas y no traen claves de más', () => {
    for (const step of exercises) {
      for (const rule of (step['rules'] as Json[] | undefined) ?? []) {
        const where = `${step['id']} regla ${String(rule['kind'])}`;
        expect(RULES, where).toContain(rule['kind']);
        expect(
          Object.keys(rule).filter((key) => !RULE_KEYS.includes(key)),
          where,
        ).toEqual([]);
        if (NAME_RULES.includes(rule['kind'] as string))
          expect(typeof rule['name'], `${where}: name`).toBe('string');
        if (TYPE_RULES.includes(rule['kind'] as string)) {
          expect(typeof rule['type'], `${where}: type`).toBe('string');
          // `type` es el nombre de metadatos (`System.Func`2`); `name` es como lo dice el mensaje.
          expect(typeof rule['name'], `${where}: name`).toBe('string');
        }
        if ('min' in rule) expect(Number.isInteger(rule['min']), `${where}: min`).toBe(true);
      }
    }
  });

  // Los mensajes dicen "un comentario con //", no `SingleLineCommentTrivia`: cada nombre de sintaxis
  // que usa una regla necesita su etiqueta en ui.yml, en los dos idiomas.
  it('cada regla de sintaxis tiene su etiqueta en la interfaz', () => {
    for (const step of exercises) {
      for (const rule of (step['rules'] as Json[] | undefined) ?? []) {
        if (!SYNTAX_RULES.includes(rule['kind'] as string)) continue;
        for (const lang of LANGS) {
          const labels = (ui[lang] as { syntax: Record<string, string> }).syntax;
          expect(labels[rule['name'] as string], `${step['id']}: etiqueta ${lang}`).toBeTruthy();
        }
      }
    }
  });

  // YAML lee `stdout: 5` como número, y el motor espera texto: las salidas van entre comillas.
  it('las ejecuciones esperan texto y no traen claves de más', () => {
    for (const step of exercises) {
      for (const run of (step['runs'] as Json[] | undefined) ?? []) {
        const where = `${step['id']} ejecución`;
        expect(
          Object.keys(run).filter((key) => !RUN_KEYS.includes(key)),
          where,
        ).toEqual([]);
        for (const key of ['stdin', 'stdout', 'matches', 'throws'])
          if (key in run) expect(typeof run[key], `${where}: ${key}`).toBe('string');
        if ('contains' in run) {
          const parts = run['contains'] as unknown[];
          expect(
            parts.every((part) => typeof part === 'string'),
            `${where}: contains`,
          ).toBe(true);
        }
      }
    }
  });

  it('el código inicial propio de un idioma está en los dos o en ninguno', () => {
    for (const step of exercises) {
      const texts = LANGS.map(
        (lang) => ((data[lang] as Json)['steps'] as Record<string, Json>)[step['id'] as string]!,
      );
      expect(new Set(texts.map((item) => 'starter' in item)).size, `${step['id']} starter`).toBe(1);
      for (const item of texts)
        if ('starter' in item) expect(typeof item['starter']).toBe('string');
    }
  });

  it('ningún texto ni código trae {{ ni {%: Jekyll los leería como Liquid', () => {
    expect(strings(data).filter((text) => /\{\{|\{%/.test(text))).toEqual([]);
  });
});
