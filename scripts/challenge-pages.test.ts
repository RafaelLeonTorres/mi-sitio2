import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { challengeIds, challengePages, generatedPages } from './challenge-pages.mjs';

// La página de cada reto la escribe scripts/challenge-pages.mjs a partir de sus datos. Si un reto
// cambia de título, de slug o es nuevo, esta prueba avisa que hay que correr el script.

const pages = challengePages();

describe('páginas de los retos', () => {
  it('hay una por reto y por idioma', () => {
    expect(challengeIds().length).toBeGreaterThan(0);
    expect(pages).toHaveLength(challengeIds().length * 2);
  });

  it('cada una tiene su propia URL', () => {
    const paths = pages.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  for (const page of pages) {
    it(`${page.path} está al día (node scripts/challenge-pages.mjs)`, () => {
      expect(existsSync(page.path)).toBe(true);
      expect(readFileSync(page.path, 'utf8')).toBe(page.content);
    });
  }

  it('no quedan páginas de retos que ya no existen', () => {
    const wanted = new Set(pages.map((page) => page.path));
    expect(generatedPages().filter((path) => !wanted.has(path))).toEqual([]);
  });
});
