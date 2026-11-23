// @ts-check
// Genera la página de cada lección del curso, en español y en inglés, a partir de
// _data/course/catalog.yml y _data/course/csharp/<módulo>/<lección>.yml:
// curso/csharp/<módulo>/<lección>/index.html y en/course/csharp/<module>/<lesson>/index.html.
// Son páginas normales y no una colección porque el selector de idioma busca la otra versión en
// site.pages por `ref`. Cada página solo trae su front matter y el include de la lección.
//
//   node scripts/course-pages.mjs   escribe las páginas y borra las de lecciones que ya no existen
//
// scripts/course-pages.test.ts revisa que las páginas estén al día con los datos.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/** Dónde va cada idioma: la carpeta de sus lecciones, su `locale` y la URL del temario. */
export const LANGUAGES = {
  es: { dir: 'curso/csharp', locale: 'es_MX', url: '/curso/csharp/' },
  en: { dir: 'en/course/csharp', locale: 'en_US', url: '/en/course/csharp/' },
};

const MARKER = '# Generada por scripts/course-pages.mjs';

/**
 * @typedef {{ slug: string, title: string, summary: string }} Texts
 * @typedef {{ id: string, lessons: string[], es: { slug: string }, en: { slug: string } }} Module
 * @typedef {{ path: string, content: string }} Page
 */

/**
 * Los módulos del temario, en orden.
 * @param {string} [root]
 * @returns {Module[]}
 */
export function modules(root = '.') {
  const catalog = parse(readFileSync(join(root, '_data/course/catalog.yml'), 'utf8'));
  return catalog.csharp.modules;
}

/**
 * Los datos de una lección.
 * @param {string} root
 * @param {string} module
 * @param {string} id
 */
export function lessonData(root, module, id) {
  return parse(readFileSync(join(root, `_data/course/csharp/${module}/${id}.yml`), 'utf8'));
}

/**
 * Las páginas que deben existir, una por lección y por idioma.
 * @param {string} [root]
 * @returns {Page[]}
 */
export function coursePages(root = '.') {
  const order = modules(root).flatMap((module) => module.lessons.map((id) => ({ module, id })));
  return order.flatMap(({ module, id }, position) =>
    Object.entries(LANGUAGES).map(([lang, where]) => {
      const key = /** @type {'es' | 'en'} */ (lang);
      /** @type {Texts} */
      const texts = lessonData(root, module.id, id)[key];
      const next = order[position + 1];
      /** @type {string[]} */
      let nextLines = [];
      if (next) {
        /** @type {Texts} */
        const nextTexts = lessonData(root, next.module.id, next.id)[key];
        nextLines = [
          `next_url: ${where.url}${next.module[key].slug}/${nextTexts.slug}/`,
          `next_title: ${JSON.stringify(nextTexts.title)}`,
        ];
      }
      const front = [
        '---',
        `${MARKER} desde _data/course/csharp/${module.id}/${id}.yml; no la edites a mano.`,
        'layout: course',
        `lang: ${lang}`,
        `locale: ${where.locale}`,
        `ref: course-csharp-${module.id}-${id}`,
        'lab: course',
        `module: ${module.id}`,
        `lesson: ${id}`,
        `title: ${JSON.stringify(texts.title)}`,
        `description: ${JSON.stringify(plain(texts.summary))}`,
        `permalink: ${where.url}${module[key].slug}/${texts.slug}/`,
        `syllabus: ${where.url}`,
        ...nextLines,
        '---',
        '{% include course/lesson.html %}',
        '',
      ];
      return {
        path: `${where.dir}/${module[key].slug}/${texts.slug}/index.html`,
        content: front.join('\n'),
      };
    }),
  );
}

/**
 * Las páginas de lecciones que hay en las carpetas, reconocidas por el comentario del generador.
 * @param {string} [root]
 * @returns {string[]}
 */
export function generatedPages(root = '.') {
  return Object.values(LANGUAGES).flatMap(({ dir }) => {
    const base = join(root, dir);
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((moduleDir) =>
        readdirSync(join(base, moduleDir.name), { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((lessonDir) => `${dir}/${moduleDir.name}/${lessonDir.name}/index.html`),
      )
      .filter((path) => {
        const file = join(root, path);
        return existsSync(file) && readFileSync(file, 'utf8').includes(MARKER);
      });
  });
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
