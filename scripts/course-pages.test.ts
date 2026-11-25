import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { coursePages, generatedPages, modules } from './course-pages.mjs';

// Las páginas de las lecciones salen de _data/course/ con `npm run pages:course` (o
// `node scripts/course-pages.mjs`); estas pruebas avisan si algo quedó desactualizado.
describe('páginas de las lecciones', () => {
  const pages = coursePages('.');

  it('hay una página por lección y por idioma', () => {
    const lessons = modules('.', 'csharp').flatMap((module) => module.lessons);
    expect(pages).toHaveLength(lessons.length * 2);
  });

  it.each(pages)('$path existe y está al día', (page) => {
    expect(existsSync(page.path)).toBe(true);
    expect(readFileSync(page.path, 'utf8')).toBe(page.content);
  });

  it('no sobran páginas generadas de lecciones que ya no existen', () => {
    const wanted = new Set(pages.map((page) => page.path));
    expect(generatedPages('.').filter((path) => !wanted.has(path))).toEqual([]);
  });

  it('cada lección enlaza a la siguiente, menos la última', () => {
    const withNext = pages.filter((page) => page.content.includes('next_url:'));
    const ordered = modules('.', 'csharp').flatMap((module) => module.lessons);
    expect(withNext).toHaveLength((ordered.length - 1) * 2);
  });
});
