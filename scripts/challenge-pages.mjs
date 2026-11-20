// @ts-check
// Genera la página de cada reto en español y en inglés a partir de _data/labs/challenges/<id>.yml:
// laboratorio/retos/<slug>/index.html y en/lab/challenges/<slug>/index.html. Son páginas normales
// y no una colección porque el selector de idioma busca la otra versión en site.pages por `ref`.
// Cada página solo trae su front matter y el include de su lenguaje (labs/challenge.html para SQL,
// labs/challenge-csharp.html para C#); el contenido sale de los datos.
//
//   node scripts/challenge-pages.mjs   escribe las páginas y borra las de retos que ya no existen
//
// scripts/challenge-pages.test.ts revisa que las páginas estén al día con los datos.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/** Dónde va cada idioma: la carpeta de sus páginas, su `locale` y la URL de la carpeta. */
export const LANGUAGES = {
  es: { dir: 'laboratorio/retos', locale: 'es_MX', url: '/laboratorio/retos/' },
  en: { dir: 'en/lab/challenges', locale: 'en_US', url: '/en/lab/challenges/' },
};

const MARKER = '# Generada por scripts/challenge-pages.mjs';

/**
 * @typedef {{ path: string, content: string }} Page
 * @typedef {{ slug: string, title: string, summary: string }} Texts
 */

/** Los ids de los retos: los archivos de _data/labs/challenges/, sin la extensión. */
export function challengeIds(root = '.') {
  return readdirSync(join(root, '_data/labs/challenges'))
    .filter((name) => name.endsWith('.yml'))
    .map((name) => name.replace(/\.yml$/, ''))
    .sort();
}

/**
 * Las páginas que deben existir, una por reto y por idioma.
 * @param {string} [root]
 * @returns {Page[]}
 */
export function challengePages(root = '.') {
  return challengeIds(root).flatMap((id) => {
    const data = parse(readFileSync(join(root, `_data/labs/challenges/${id}.yml`), 'utf8'));
    return Object.entries(LANGUAGES).map(([lang, where]) => {
      /** @type {Texts} */
      const texts = data[lang];
      const include = data.shared.language === 'csharp' ? 'challenge-csharp' : 'challenge';
      const front = [
        '---',
        `${MARKER} desde _data/labs/challenges/${id}.yml; no la edites a mano.`,
        'layout: lab',
        `lang: ${lang}`,
        `locale: ${where.locale}`,
        `ref: challenge-${id}`,
        'lab: challenges',
        'parent: challenges',
        `challenge: ${id}`,
        `title: ${JSON.stringify(texts.title)}`,
        `description: ${JSON.stringify(plain(texts.summary))}`,
        `permalink: ${where.url}${texts.slug}/`,
        '---',
        `{% include labs/${include}.html %}`,
        '',
      ];
      return { path: `${where.dir}/${texts.slug}/index.html`, content: front.join('\n') };
    });
  });
}

/**
 * Las páginas de retos que hay en las carpetas, reconocidas por el comentario del generador.
 * @param {string} [root]
 * @returns {string[]}
 */
export function generatedPages(root = '.') {
  return Object.values(LANGUAGES).flatMap(({ dir }) => {
    const base = join(root, dir);
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${dir}/${entry.name}/index.html`)
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
  const pages = challengePages(root);
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
    `${pages.length} páginas de retos al día${stale.length ? `; se borraron ${stale.length}` : ''}.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) write();
