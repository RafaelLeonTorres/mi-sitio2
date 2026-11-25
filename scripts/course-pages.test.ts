import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  coursePages,
  coursesWithPages,
  generatedPages,
  isInteractive,
  modules,
} from './course-pages.mjs';

// Las páginas de las lecciones salen de _data/course/ con `npm run pages:course` (o
// `node scripts/course-pages.mjs`); estas pruebas avisan si algo quedó desactualizado.
describe('páginas de las lecciones', () => {
  const pages = coursePages('.');
  const courses = coursesWithPages('.');
  const lessonsOf = (id: string) => modules('.', id).flatMap((module) => module.lessons);
  /** Las páginas de un curso, por la carpeta de su temario en cada idioma. */
  const pagesOf = (slug: string) =>
    pages.filter(
      (page) =>
        page.path.startsWith(`curso/${slug}/`) || page.path.startsWith(`en/course/${slug}/`),
    );

  it('hay una página por lección y por idioma en cada curso con páginas', () => {
    for (const course of courses)
      expect(pagesOf(course.slug), course.id).toHaveLength(lessonsOf(course.id).length * 2);
    expect(pages).toHaveLength(
      courses.reduce((total, course) => total + lessonsOf(course.id).length * 2, 0),
    );
  });

  it.each(pages)('$path existe y está al día', (page) => {
    expect(existsSync(page.path)).toBe(true);
    expect(readFileSync(page.path, 'utf8')).toBe(page.content);
  });

  it('no sobran páginas generadas de lecciones que ya no existen', () => {
    const wanted = new Set(pages.map((page) => page.path));
    expect(generatedPages('.').filter((path) => !wanted.has(path))).toEqual([]);
  });

  it('cada lección enlaza a la siguiente de su curso, menos la última', () => {
    for (const course of courses) {
      const withNext = pagesOf(course.slug).filter((page) => page.content.includes('next_url:'));
      expect(withNext, course.id).toHaveLength((lessonsOf(course.id).length - 1) * 2);
    }
  });

  it('las páginas de un curso en vista previa llevan noindex y sitemap: false, y las de uno publicado no', () => {
    for (const course of courses) {
      const preview = course.status === 'preview';
      for (const page of pagesOf(course.slug)) {
        expect(page.content.includes('\nnoindex: true\n'), `${page.path} noindex`).toBe(preview);
        expect(page.content.includes('\nsitemap: false\n'), `${page.path} sitemap`).toBe(preview);
      }
    }
  });

  it('solo cargan el JavaScript de la lección las páginas de los cursos que ya tienen adaptador', () => {
    for (const course of courses)
      for (const page of pagesOf(course.slug))
        expect(page.content.includes('\nlab: course\n'), `${page.path} lab`).toBe(
          isInteractive(course),
        );
  });
});
