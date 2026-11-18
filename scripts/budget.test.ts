import { describe, expect, it } from 'vitest';
import { BUDGET_BYTES, demoSizes, overBudget } from './budget.mjs';

// Una salida como la de esbuild: dos demos que comparten un chunk (que a su vez importa otro) y
// una de ellas carga un chunk más con import(). esbuild marca ese chunk como entrada también.
const entries = ['labs/sql/main.ts', 'labs/rest-api/main.ts'];
const outputs = {
  'assets/js/labs/sql.js': {
    entryPoint: 'labs/sql/main.ts',
    imports: [
      { path: 'assets/js/labs/chunks/shared-AB12.js', kind: 'import-statement' },
      { path: 'assets/js/labs/chunks/plan-view-CD34.js', kind: 'dynamic-import' },
    ],
  },
  'assets/js/labs/rest-api.js': {
    entryPoint: 'labs/rest-api/main.ts',
    imports: [{ path: 'assets/js/labs/chunks/shared-AB12.js', kind: 'import-statement' }],
  },
  'assets/js/labs/chunks/shared-AB12.js': {
    imports: [{ path: 'assets/js/labs/chunks/format-EF56.js', kind: 'import-statement' }],
  },
  'assets/js/labs/chunks/format-EF56.js': { imports: [] },
  'assets/js/labs/chunks/plan-view-CD34.js': { entryPoint: 'labs/sql/plan-view.ts', imports: [] },
  'assets/js/labs/sql.js.map': { imports: [] },
};

const gzipBytes: Record<string, number> = {
  'assets/js/labs/sql.js': 12_000,
  'assets/js/labs/rest-api.js': 9_000,
  'assets/js/labs/chunks/shared-AB12.js': 4_000,
  'assets/js/labs/chunks/format-EF56.js': 1_000,
  'assets/js/labs/chunks/plan-view-CD34.js': 20_000,
};
const sizeOf = (file: string) => gzipBytes[file] ?? 0;

describe('demoSizes', () => {
  it('suma la demo y los chunks que importa al cargar, también los indirectos', () => {
    expect(demoSizes(outputs, entries, sizeOf)).toEqual([
      {
        name: 'rest-api',
        files: [
          'assets/js/labs/rest-api.js',
          'assets/js/labs/chunks/shared-AB12.js',
          'assets/js/labs/chunks/format-EF56.js',
        ],
        bytes: 14_000,
      },
      {
        name: 'sql',
        files: [
          'assets/js/labs/sql.js',
          'assets/js/labs/chunks/shared-AB12.js',
          'assets/js/labs/chunks/format-EF56.js',
        ],
        bytes: 17_000,
      },
    ]);
  });

  it('no cuenta lo que se carga con import() ni los mapas de código', () => {
    const sizes = demoSizes(outputs, entries, sizeOf);
    expect(sizes.map((demo) => demo.name)).toEqual(['rest-api', 'sql']);
    const sql = sizes.find((demo) => demo.name === 'sql');
    expect(sql?.files).not.toContain('assets/js/labs/chunks/plan-view-CD34.js');
    expect(sql?.files).not.toContain('assets/js/labs/sql.js.map');
  });

  it('ignora las importaciones externas', () => {
    const external = {
      'assets/js/labs/demo.js': {
        entryPoint: 'labs/demo/main.ts',
        imports: [{ path: 'https://example.com/lib.js', kind: 'import-statement', external: true }],
      },
    };
    expect(demoSizes(external, ['labs/demo/main.ts'], () => 100)).toEqual([
      { name: 'demo', files: ['assets/js/labs/demo.js'], bytes: 100 },
    ]);
  });
});

describe('overBudget', () => {
  it('devuelve solo las demos que pasan del límite', () => {
    const sizes = [
      { name: 'justa', files: [], bytes: BUDGET_BYTES },
      { name: 'pesada', files: [], bytes: BUDGET_BYTES + 1 },
    ];
    expect(overBudget(sizes).map((demo) => demo.name)).toEqual(['pesada']);
  });

  it('acepta otro límite', () => {
    expect(overBudget([{ name: 'demo', files: [], bytes: 2_000 }], 1_000)).toHaveLength(1);
  });
});
