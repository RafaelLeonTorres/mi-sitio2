// @ts-check
// Genera la página de cada lección de los cursos publicados y de los que están en vista previa, en
// español y en inglés, a partir de _data/course/courses.yml, _data/course/catalog.yml y
// _data/course/<curso>/<módulo>/<lección>.yml: curso/<slug>/<módulo>/<lección>/index.html y
// en/course/<slug>/<module>/<lesson>/index.html.
// Son páginas normales y no una colección porque el selector de idioma busca la otra versión en
// site.pages por `ref`. Cada página solo trae su front matter y el include de la lección. Las de un
// curso en vista previa llevan `noindex` y `sitemap: false`: existen, pero el sitio no las anuncia.
//
//   node scripts/course-pages.mjs   escribe las páginas y borra las de lecciones que ya no existen
//
// scripts/course-pages.test.ts revisa que las páginas estén al día con los datos.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/** Dónde va cada idioma: la carpeta de sus cursos, su `locale` y la URL del índice de cursos. */
export const LANGUAGES = {
  es: { dir: 'curso', locale: 'es_MX', url: '/curso/' },
  en: { dir: 'en/course', locale: 'en_US', url: '/en/course/' },
};

const MARKER = '# Generada por scripts/course-pages.mjs';

/**
 * Los motores que ya tienen adaptador en labs/course/engines/: las páginas de sus lecciones cargan el
 * JavaScript de la lección. Las de los demás se leen sin JavaScript hasta que llegue su adaptador
 * (el de `sql` viene con el curso de PostgreSQL).
 */
const INTERACTIVE_ENGINES = new Set(['csharp']);

/**
 * @typedef {{ title: string, summary: string }} CourseTexts
 * @typedef {{
 *   id: string,
 *   slug: string,
 *   name: string,
 *   status: 'published' | 'preview' | 'soon',
 *   engine: string,
 *   code_lang?: string,
 *   product?: string,
 *   playground?: string,
 *   es?: CourseTexts,
 *   en?: CourseTexts,
 * }} Course
 * @typedef {{ slug: string, title: string, summary: string }} Texts
 * @typedef {{ challenges: string[], posts: string[] }} Practice
 * @typedef {{ id: string, lessons: string[], practice: Practice, es: { slug: string }, en: { slug: string } }} Module
 * @typedef {{ path: string, content: string }} Page
 */

/**
 * Todos los cursos de _data/course/courses.yml, en orden.
 * @param {string} [root]
 * @returns {Course[]}
 */
export function courses(root = '.') {
  return parse(readFileSync(join(root, '_data/course/courses.yml'), 'utf8'));
}

/**
 * Los cursos que ya tienen temario y lecciones, y el menú enlaza a ellos.
 * @param {string} [root]
 */
export function publishedCourses(root = '.') {
  return courses(root).filter((course) => course.status === 'published');
}

/**
 * Los cursos con páginas: los publicados y los que están en vista previa.
 * @param {string} [root]
 */
export function coursesWithPages(root = '.') {
  return courses(root).filter(
    (course) => course.status === 'published' || course.status === 'preview',
  );
}

/**
 * Si las páginas de las lecciones de un curso cargan el JavaScript de la lección.
 * @param {Course} course
 */
export function isInteractive(course) {
  return INTERACTIVE_ENGINES.has(course.engine);
}

/**
 * Los módulos del temario de un curso, en orden.
 * @param {string} root
 * @param {string} course el `id` del curso
 * @returns {Module[]}
 */
export function modules(root, course) {
  const catalog = parse(readFileSync(join(root, '_data/course/catalog.yml'), 'utf8'));
  return catalog[course].modules;
}

/**
 * Los datos de una lección.
 * @param {string} root
 * @param {string} course el `id` del curso
 * @param {string} module
 * @param {string} id
 */
export function lessonData(root, course, module, id) {
  return parse(readFileSync(join(root, `_data/course/${course}/${module}/${id}.yml`), 'utf8'));
}

/**
 * Las páginas que deben existir, una por lección y por idioma de cada curso publicado o en vista
 * previa.
 * @param {string} [root]
 * @returns {Page[]}
 */
export function coursePages(root = '.') {
  return coursesWithPages(root).flatMap((course) => {
    const order = modules(root, course.id).flatMap((module) =>
      module.lessons.map((id) => ({ module, id })),
    );
    return order.flatMap(({ module, id }, position) =>
      Object.entries(LANGUAGES).map(([lang, where]) => {
        const key = /** @type {'es' | 'en'} */ (lang);
        const base = `${where.url}${course.slug}/`;
        /** @type {Texts} */
        const texts = lessonData(root, course.id, module.id, id)[key];
        const next = order[position + 1];
        /** @type {string[]} */
        let nextLines = [];
        if (next) {
          /** @type {Texts} */
          const nextTexts = lessonData(root, course.id, next.module.id, next.id)[key];
          nextLines = [
            `next_url: ${base}${next.module[key].slug}/${nextTexts.slug}/`,
            `next_title: ${JSON.stringify(nextTexts.title)}`,
          ];
        }
        const front = [
          '---',
          `${MARKER} desde _data/course/${course.id}/${module.id}/${id}.yml; no la edites a mano.`,
          'layout: course',
          `course: ${course.id}`,
          `lang: ${lang}`,
          `locale: ${where.locale}`,
          `ref: course-${course.id}-${module.id}-${id}`,
          ...(isInteractive(course) ? ['lab: course'] : []),
          `module: ${module.id}`,
          `lesson: ${id}`,
          `title: ${JSON.stringify(texts.title)}`,
          `description: ${JSON.stringify(plain(texts.summary))}`,
          `permalink: ${base}${module[key].slug}/${texts.slug}/`,
          `syllabus: ${base}`,
          ...nextLines,
          ...(course.status === 'preview' ? ['noindex: true', 'sitemap: false'] : []),
          '---',
          '{% include course/lesson.html %}',
          '',
        ];
        return {
          path: `${where.dir}/${course.slug}/${module[key].slug}/${texts.slug}/index.html`,
          content: front.join('\n'),
        };
      }),
    );
  });
}

/**
 * Las páginas de lecciones que hay en las carpetas de los cursos, reconocidas por el comentario del
 * generador.
 * @param {string} [root]
 * @returns {string[]}
 */
export function generatedPages(root = '.') {
  return courses(root).flatMap((course) =>
    Object.values(LANGUAGES).flatMap(({ dir }) => {
      const courseDir = `${dir}/${course.slug}`;
      const base = join(root, courseDir);
      if (!existsSync(base)) return [];
      return readdirSync(base, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((moduleDir) =>
          readdirSync(join(base, moduleDir.name), { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((lessonDir) => `${courseDir}/${moduleDir.name}/${lessonDir.name}/index.html`),
        )
        .filter((path) => {
          const file = join(root, path);
          return existsSync(file) && readFileSync(file, 'utf8').includes(MARKER);
        });
    }),
  );
}

/**
 * El resumen sin las comillas invertidas del Markdown, para la descripción de la página.
 * @param {string} text
 */
function plain(text) {
  return text.replaceAll('`', '').trim();
}

/** Escribe las páginas y borra las que sobran. */
function write(root = '.') {
  const pages = coursePages(root);
  const wanted = new Set(pages.map((page) => page.path));
  for (const page of pages) {
    const file = join(root, page.path);
    mkdirSync(dirname(file), { recursive: true });
    const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (current !== page.content) writeFileSync(file, page.content);
  }
  const stale = generatedPages(root).filter((path) => !wanted.has(path));
  for (const path of stale) rmSync(dirname(join(root, path)), { recursive: true, force: true });
  console.log(
    `${pages.length} páginas de lecciones al día${stale.length ? `; se borraron ${stale.length}` : ''}.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) write();
