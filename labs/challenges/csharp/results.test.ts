// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { uiTexts } from '../fixtures';
import type { CsChallenge } from './data';
import type { CsRun } from './engine';
import type { CsCompileOutcome, CsDiagnostic } from './protocol';
import { csErrorLine, renderCsCases, renderCsPlayground, type CsContext } from './results';

const ui = uiTexts('es');
const context: CsContext = {
  results: ui.results,
  csharp: ui.csharp,
  lang: 'es',
  timeoutSeconds: 5,
};
const container = () => document.createElement('div');

const challenge: CsChallenge = {
  language: 'csharp',
  category: 'oop',
  difficulty: 'medium',
  entry: { type: 'Solution', method: 'Find' },
  rules: [{ kind: 'uses-type', type: 'System.Lazy`1', name: 'Lazy<T>' }],
  starter: '',
  solution: '',
  cases: [
    { sample: true, args: [[1, 2]], expected: 2 },
    { args: [[]], throws: 'InvalidOperationException' },
  ],
};

const diagnostic = (source: string, line: number): CsDiagnostic => ({
  id: 'CS1002',
  message: '; expected',
  source,
  line,
  column: 5,
  endLine: line,
  endColumn: 6,
});

const compiled = (extra: Partial<CsCompileOutcome> = {}): CsCompileOutcome => ({
  compiled: true,
  compileMs: 120,
  diagnostics: [],
  rules: [],
  ...extra,
});

describe('renderCsCases', () => {
  it('si no compila, muestra los errores con su línea y el mensaje en inglés', () => {
    const body = container();
    const run: CsRun = {
      compile: compiled({
        compiled: false,
        diagnostics: [diagnostic('code', 3), diagnostic('prelude', 1)],
      }),
      results: [],
    };
    const verdict = renderCsCases(body, run, 2, 'run', challenge, context);
    expect(verdict).toEqual({ passed: 0, total: 2, allPassed: false });
    expect(body.querySelector('.ch-verdict-title')?.textContent).toBe('Tu código no compila.');
    const items = [...body.querySelectorAll('.ch-diagnostics li')];
    expect(items[0]?.querySelector('.ch-diagnostic-where')?.textContent).toBe('Línea 3, columna 5');
    expect(items[0]?.querySelector('.ch-diagnostic-message')?.getAttribute('lang')).toBe('en');
    expect(items[1]?.textContent).toContain('En el código que da el reto');
    expect(csErrorLine(run)).toBe(3);
  });

  it('si compila pero falta el método, lo explica con sus datos', () => {
    const body = container();
    const run: CsRun = {
      compile: compiled({
        entry: { key: 'wrong-arity', values: { type: 'Solution', method: 'Find', count: '1' } },
      }),
      results: [],
    };
    renderCsCases(body, run, 2, 'submit', challenge, context);
    const text = body.querySelector('.ch-error')?.textContent ?? '';
    expect(text).toContain('Find');
    expect(text).toContain('(1)');
    expect(body.querySelectorAll('.ch-error code').length).toBeGreaterThan(0);
  });

  it('con los casos bien pero una regla sin cumplir, no cuenta como resuelto', () => {
    const body = container();
    const run: CsRun = {
      compile: compiled({ rules: [{ kind: 'uses-type', type: 'System.Lazy`1', passed: false }] }),
      results: [
        { index: 0, outcome: { index: 0, passed: true, actual: 2, console: '', ms: 1 } },
        {
          index: 1,
          outcome: {
            index: 1,
            passed: true,
            error: { type: 'InvalidOperationException', message: 'Empty', member: 'Solution.Find' },
            console: '',
            ms: 1,
          },
        },
      ],
    };
    const verdict = renderCsCases(body, run, 2, 'submit', challenge, context);
    expect(verdict.allPassed).toBe(false);
    expect(verdict.passed).toBe(2);
    expect(body.querySelector('.ch-verdict')?.textContent).toContain(
      ui.csharp.results.rules_failed,
    );
    const rule = body.querySelector('.ch-rule-list li');
    expect(rule?.hasAttribute('data-ok')).toBe(false);
    expect(rule?.querySelector('code')?.textContent).toBe('Lazy<T>');
    expect(body.querySelector('.ch-status-note')?.textContent).toContain('Compiló en');
  });

  it('cada caso muestra la llamada, lo esperado y lo obtenido, y abre los que fallan', () => {
    const body = container();
    const run: CsRun = {
      compile: compiled(),
      results: [
        { index: 0, outcome: { index: 0, passed: false, actual: 1, console: 'hola\n', ms: 2 } },
        {
          index: 1,
          outcome: {
            index: 1,
            passed: false,
            error: {
              type: 'NullReferenceException',
              message: 'Object reference not set',
              member: 'Solution.Find',
            },
            console: '',
            ms: 1,
          },
        },
      ],
    };
    renderCsCases(body, run, 2, 'submit', challenge, context);
    const [first, second] = [...body.querySelectorAll<HTMLDetailsElement>('.ch-case')];
    expect(first?.open).toBe(true);
    expect(first?.querySelector('.ch-case-name')?.textContent).toBe('Caso 1 (ejemplo)');
    const values = [...(first?.querySelectorAll('pre.ch-value') ?? [])].map(
      (pre) => pre.textContent,
    );
    expect(values).toEqual(['Find([1,2])', '2', '1', 'hola']);
    expect(second?.querySelector('.ch-value-note')?.textContent).toBe(
      'Que lance InvalidOperationException',
    );
    const error = second?.querySelector('.ch-error');
    expect(error?.textContent).toContain('Lanzó NullReferenceException en Solution.Find');
    expect(error?.querySelector('[lang="en"]')?.textContent).toBe('Object reference not set');
  });

  it('un caso que se pasa del tiempo lo dice con los segundos', () => {
    const body = container();
    const run: CsRun = { compile: compiled(), results: [{ index: 0, timedOut: true }] };
    const verdict = renderCsCases(body, run, 1, 'run', challenge, context);
    expect(verdict.allPassed).toBe(false);
    expect(body.querySelector('.ch-case .ch-error')?.textContent).toContain('5 segundos');
  });
});

describe('renderCsPlayground', () => {
  it('muestra la consola y el tiempo', () => {
    const body = container();
    renderCsPlayground(
      body,
      { outcome: { compiled: true, compileMs: 40, diagnostics: [], console: 'a\nb\n', ms: 3 } },
      context,
    );
    expect(body.querySelector('.ch-verdict-title')?.textContent).toContain('Terminó en');
    expect(body.querySelector('pre.ch-value')?.textContent).toBe('a\nb');
  });

  it('sin salida lo dice, y una excepción se muestra después de la consola', () => {
    const body = container();
    renderCsPlayground(
      body,
      {
        outcome: {
          compiled: true,
          compileMs: 40,
          diagnostics: [],
          console: '',
          error: { type: 'FormatException', message: 'Bad', member: 'Program.Main' },
          ms: 1,
        },
      },
      context,
    );
    expect(body.querySelector('.ch-verdict-title')?.textContent).toContain(
      'Se detuvo por una excepción',
    );
    expect(body.querySelector('.ch-value-note')?.textContent).toBe(ui.csharp.playground.no_output);
    expect(body.querySelector('.ch-error')?.textContent).toContain(
      'FormatException en Program.Main',
    );
  });

  it('si no compila o se pasa del tiempo, lo dice', () => {
    const body = container();
    renderCsPlayground(
      body,
      {
        outcome: {
          compiled: false,
          compileMs: 5,
          diagnostics: [diagnostic('code', 2)],
          console: '',
          ms: 0,
        },
      },
      context,
    );
    expect(body.querySelector('.ch-diagnostic-where')?.textContent).toBe('Línea 2, columna 5');
    renderCsPlayground(body, { timedOut: true }, context);
    expect(body.querySelector('[role="alert"]')?.textContent).toContain('5 segundos');
  });
});
