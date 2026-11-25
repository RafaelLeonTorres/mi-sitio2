import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  commonCatalogChecks,
  commonLessonChecks,
  keys,
  LANGS,
  strings,
  type Json,
} from './course-lesson-checks';
import { courses, isInteractive, lessonData, modules } from './course-pages.mjs';

// Los datos del curso de C# y lo que comparten todos los cursos: la lista de cursos, el menú y los
// textos de la interfaz. Los de SQL están en course-data-sql.test.ts; lo que vale para la lección de
// cualquier curso, en course-lesson-checks.ts.

const root = '.';
const KINDS = ['read', 'exercise', 'choice'];
const SYNTAX_RULES = ['uses-syntax', 'avoids-syntax'];
const NAME_RULES = [...SYNTAX_RULES, 'declares-variable', 'calls-method'];
const TYPE_RULES = ['uses-type', 'avoids-type'];
const RULES = [...NAME_RULES, ...TYPE_RULES];
const RULE_KEYS = ['kind', 'name', 'type', 'min'];
const RUN_KEYS = ['stdin', 'stdout', 'contains', 'matches', 'throws'];

const COURSE = 'csharp';
const catalog = modules(root, COURSE);
const lessons = catalog.flatMap((module) =>
  module.lessons.map((id) => ({
    module: module.id,
    id,
    data: lessonData(root, COURSE, module.id, id),
  })),
);
const read = (path: string): Json => parse(readFileSync(path, 'utf8')) as Json;
const ui = read('_data/course/ui.yml');
const uiEngine = read('_data/course/ui-csharp.yml');
const uiSql = read('_data/course/ui-sql.yml');

describe('temario del curso', () => {
  commonCatalogChecks(root, COURSE);
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
  // Los comunes (ui.yml) y los de cada motor (ui-<motor>.yml, el de cada curso).
  const engines = { 'ui-csharp.yml': uiEngine, 'ui-sql.yml': uiSql };
  const files = { 'ui.yml': ui, ...engines };

  it.each(Object.entries(files))(
    '%s: el español y el inglés tienen las mismas claves',
    (_, file) => {
      expect(keys(file['en'])).toEqual(keys(file['es']));
    },
  );

  it.each(Object.entries(files))('%s: ningún texto está vacío', (_, file) => {
    for (const lang of LANGS)
      expect(strings(file[lang]).every((text) => text.trim() !== '')).toBe(true);
  });

  it.each(Object.entries(engines))('ninguna clave de %s está también en ui.yml', (_, file) => {
    for (const lang of LANGS) {
      const repeated = Object.keys(ui[lang] as Json).filter((key) => key in (file[lang] as Json));
      expect(repeated, lang).toEqual([]);
    }
  });

  it('cada tipo de paso tiene su nombre en los dos idiomas', () => {
    for (const lang of LANGS) {
      const kinds = Object.keys((ui[lang] as { kind: Json }).kind);
      expect(kinds, lang).toEqual(['read', 'exercise', 'captured', 'choice']);
    }
  });
});

describe('cursos y menú', () => {
  const list = courses(root) as unknown as Json[];
  const site = read('_data/ui.yml');
  const catalogFile = read('_data/course/catalog.yml');
  const ENGINES = ['csharp', 'sql', 'angular'];
  const STATUSES = ['published', 'preview', 'soon'];
  const published = list.filter((course) => course['status'] === 'published');
  // Con temario, lecciones y páginas: los publicados y los que están en vista previa.
  const withPages = list.filter((course) => course['status'] !== 'soon');
  const upcoming = list.filter((course) => course['status'] === 'soon');

  it('cada curso tiene id, carpeta, nombre, estado y motor', () => {
    expect(list.length).toBeGreaterThan(0);
    for (const course of list) {
      expect(course['id'], 'id').toMatch(/^[a-z0-9]+$/);
      expect(course['slug'], `${course['id']} slug`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(String(course['name']).trim(), `${course['id']} name`).not.toBe('');
      expect(STATUSES, `${course['id']} status`).toContain(course['status']);
      expect(ENGINES, `${course['id']} engine`).toContain(course['engine']);
    }
  });

  it('los ids y las carpetas no se repiten, y C# sigue publicado', () => {
    const ids = list.map((course) => course['id'] as string);
    const slugs = list.map((course) => course['slug'] as string);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(published.map((course) => course['id'])).toContain('csharp');
  });

  it('un curso con páginas trae título y resumen, temario, lecciones y las páginas de su temario', () => {
    for (const course of withPages) {
      const id = course['id'] as string;
      const slug = course['slug'] as string;
      for (const lang of LANGS) {
        const texts = course[lang] as Json;
        expect(String(texts?.['title']).trim(), `${id} ${lang} title`).not.toBe('');
        expect(String(texts?.['summary']).trim(), `${id} ${lang} summary`).not.toBe('');
      }
      expect(catalogFile[id], `${id} está en catalog.yml`).toBeDefined();
      expect(existsSync(`_data/course/${id}`), `${id} tiene su carpeta de datos`).toBe(true);
      expect(course['code_lang'], `${id} code_lang`).toBeTruthy();
      expect(course['playground'], `${id} playground`).toBeTruthy();
      const pages = { es: `curso/${slug}/index.html`, en: `en/course/${slug}/index.html` };
      for (const [lang, path] of Object.entries(pages)) {
        expect(existsSync(path), `${path} existe`).toBe(true);
        const front = readFileSync(path, 'utf8').split('---')[1] ?? '';
        expect(front, `${path} lleva course: ${id}`).toMatch(new RegExp(`^course: ${id}$`, 'm'));
        expect(front, `${path} lleva lang: ${lang}`).toMatch(new RegExp(`^lang: ${lang}$`, 'm'));
        // El temario carga el JavaScript del curso (el avance, exportar e importar) si su motor ya
        // tiene adaptador, igual que sus lecciones.
        expect(/^lab: course$/m.test(front), `${path} lab`).toBe(isInteractive(course as never));
      }
    }
  });

  it('un curso en vista previa no se anuncia: sus páginas llevan noindex y quedan fuera del mapa del sitio', () => {
    for (const course of withPages) {
      const slug = course['slug'] as string;
      const preview = course['status'] === 'preview';
      for (const path of [`curso/${slug}/index.html`, `en/course/${slug}/index.html`]) {
        const front = readFileSync(path, 'utf8').split('---')[1] ?? '';
        expect(/^noindex: true$/m.test(front), `${path} noindex`).toBe(preview);
        expect(/^sitemap: false$/m.test(front), `${path} sitemap`).toBe(preview);
      }
    }
  });

  it('un curso que viene no tiene todavía carpeta de páginas ni de datos', () => {
    // Cuando sale de "Próximamente" tiene su carpeta y su estado pasa a `preview` o `published`.
    for (const course of upcoming) {
      expect(existsSync(`curso/${course['slug']}`), `${course['id']} ya tiene carpeta`).toBe(false);
      expect(existsSync(`_data/course/${course['id']}`), `${course['id']} ya tiene datos`).toBe(
        false,
      );
      expect(catalogFile[course['id'] as string], `${course['id']} ya está en catalog.yml`).toBe(
        undefined,
      );
    }
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
  const errors = read('_data/course/csharp/errors.yml');

  it.each(Object.keys(errors))('%s está en los dos idiomas', (code) => {
    // El código de un error del compilador o el nombre corto de una excepción.
    expect(code).toMatch(/^(CS\d{4}|[A-Z][A-Za-z]+Exception)$/);
    const entry = errors[code] as Record<string, string>;
    for (const lang of LANGS) expect(entry[lang]?.trim()).toBeTruthy();
  });
});

describe.each(lessons)('lección $module/$id', ({ data }) => {
  const shared = data['shared'] as { steps: Json[]; minutes: number };
  commonLessonChecks(data, { kinds: KINDS });

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
  // que usa una regla necesita su etiqueta en ui-csharp.yml, en los dos idiomas.
  it('cada regla de sintaxis tiene su etiqueta en la interfaz', () => {
    for (const step of exercises) {
      for (const rule of (step['rules'] as Json[] | undefined) ?? []) {
        if (!SYNTAX_RULES.includes(rule['kind'] as string)) continue;
        for (const lang of LANGS) {
          const labels = (uiEngine[lang] as { syntax: Record<string, string> }).syntax;
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
});
