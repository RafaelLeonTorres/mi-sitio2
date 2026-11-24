import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// El menú principal y la sección Entrevista (por ahora solo un aviso de "Próximamente"): que el
// enlace del menú lleve a su página, que las dos páginas se emparejen para el botón de idioma y que
// los textos existan en español e inglés.

const LANGS = ['es', 'en'] as const;
const PAGES = { es: 'entrevista/index.html', en: 'en/interview/index.html' } as const;

type Json = Record<string, unknown>;
type NavItem = { label: string; page?: string; section?: string; menu?: string };

const ui = parse(readFileSync('_data/ui.yml', 'utf8')) as Record<string, Json>;

/** El front matter de una página de Jekyll, entre las dos primeras líneas `---`. */
function frontMatter(path: string): Record<string, string> {
  return parse(readFileSync(path, 'utf8').split('---')[1] ?? '') as Record<string, string>;
}

describe('menú principal', () => {
  it('Entrevista va justo después de Cursos y lleva a su página, en los dos idiomas', () => {
    for (const lang of LANGS) {
      const nav = ui[lang]!['nav'] as NavItem[];
      const courses = nav.findIndex((item) => item.menu === 'courses');
      expect(courses, `${lang}: falta Cursos`).toBeGreaterThan(-1);
      expect(nav[courses + 1]?.page, lang).toBe(frontMatter(PAGES[lang])['permalink']);
    }
  });

  it('ningún enlace del menú se repite', () => {
    for (const lang of LANGS) {
      const nav = ui[lang]!['nav'] as NavItem[];
      const targets = nav.map((item) => item.page ?? item.section);
      expect(new Set(targets).size, lang).toBe(nav.length);
    }
  });
});

describe('sección Entrevista', () => {
  it('las dos páginas se emparejan por `ref` y usan el mismo diseño', () => {
    const es = frontMatter(PAGES.es);
    const en = frontMatter(PAGES.en);
    expect(es['ref']).toBe('interview');
    expect(en['ref']).toBe(es['ref']);
    expect([es['layout'], en['layout']]).toEqual(['interview', 'interview']);
    expect([es['lang'], en['lang']]).toEqual(['es', 'en']);
    for (const page of [es, en]) {
      expect(page['title']?.trim(), 'title').toBeTruthy();
      expect(page['description']?.trim(), 'description').toBeTruthy();
    }
  });

  it('los textos existen en los dos idiomas y ninguno está vacío', () => {
    const texts = (lang: (typeof LANGS)[number]) =>
      ui[lang]!['interview'] as Record<string, string>;
    expect(Object.keys(texts('en')).sort()).toEqual(Object.keys(texts('es')).sort());
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(texts(lang))) {
        expect(String(value).trim(), `${lang}.interview.${key}`).not.toBe('');
      }
    }
  });
});
