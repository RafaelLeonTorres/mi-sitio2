import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// Revisa que cada arquitectura de _data/labs/architecture/ cuadre: que las conexiones y el
// recorrido nombren piezas que existen, que el diagrama no encime piezas, que cada pieza y cada
// paso tengan texto en los dos idiomas y que el código de cada pieza exista sin llaves de Liquid.

const DATA_DIR = '_data/labs/architecture';
const CODE_DIR = '_includes/labs/code/architecture';
const KINDS = ['uses', 'implements', 'event'];
// El mismo orden que _includes/labs/architecture.html.
const ORDER = ['monolith', 'layered', 'clean', 'microservices', 'cqrs'];

interface Architecture {
  shared: {
    columns: number;
    nodes: { id: string; col: number; row: number; code?: string }[];
    edges: [from: string, to: string, kind: string][];
    flow: { node: string; from?: string }[];
  };
  es: Texts;
  en: Texts;
}

interface Texts {
  nodes: { id: string }[];
  flow: { steps: string[] };
}

const files = readdirSync(DATA_DIR).filter((name) => name.endsWith('.yml'));

describe('arquitecturas', () => {
  it('hay arquitecturas que revisar', () => {
    expect(files.length).toBeGreaterThan(0);
  });
});

for (const file of files) {
  const id = file.replace(/\.yml$/, '');
  const data = parse(readFileSync(join(DATA_DIR, file), 'utf8')) as Architecture;
  const { shared } = data;
  const ids = shared.nodes.map((node) => node.id);
  const connected = (a: string, b: string) =>
    shared.edges.some(([from, to]) => (from === a && to === b) || (from === b && to === a));

  describe(`arquitectura ${id}`, () => {
    it('está en la lista de la página', () => {
      expect(ORDER).toContain(id);
    });

    it('no repite piezas ni las encima en la cuadrícula', () => {
      expect(new Set(ids).size).toBe(ids.length);
      const cells = shared.nodes.map((node) => `${node.col},${node.row}`);
      expect(new Set(cells).size).toBe(cells.length);
      for (const node of shared.nodes) {
        expect(node.col >= 1 && node.col <= shared.columns && node.row >= 1).toBe(true);
      }
    });

    it('sus conexiones unen piezas que existen', () => {
      for (const [from, to, kind] of shared.edges) {
        expect(ids).toContain(from);
        expect(ids).toContain(to);
        expect(KINDS).toContain(kind);
      }
    });

    it('el recorrido pasa por piezas que existen y por conexiones del diagrama', () => {
      for (const step of shared.flow) {
        expect(ids).toContain(step.node);
        if (step.from) expect(connected(step.from, step.node)).toBe(true);
      }
    });

    it('cada pieza y cada paso tienen texto en los dos idiomas', () => {
      for (const texts of [data.es, data.en]) {
        expect(texts.nodes.map((node) => node.id)).toEqual(ids);
        expect(texts.flow.steps).toHaveLength(shared.flow.length);
      }
    });

    it('el código de cada pieza existe y Jekyll lo puede incluir', () => {
      for (const node of shared.nodes) {
        if (!node.code) continue;
        const path = join(CODE_DIR, node.code);
        expect(existsSync(path)).toBe(true);
        const source = readFileSync(path, 'utf8');
        expect(source).not.toContain('{{');
        expect(source).not.toContain('{%');
      }
    });
  });
}
