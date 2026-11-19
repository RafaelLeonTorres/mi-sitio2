// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { challenge, uiTexts } from './fixtures';
import { renderCases, renderPlayground, resultTable, type Context } from './results';
import type { CaseOutcome } from './sql/runner';

const context: Context = { texts: uiTexts('es'), lang: 'es', timeoutSeconds: 5, generated: [] };
const container = () => document.createElement('div');

describe('resultTable', () => {
  it('escribe NULL como NULL y avisa cuántas filas no muestra', () => {
    const table = resultTable(
      {
        columns: ['a', 'b'],
        rows: [
          [1, null],
          [2, 'x'],
          [3, 'y'],
        ],
      },
      context,
      'T',
      2,
    );
    expect(table.querySelector('caption')?.textContent).toBe('T');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(table.querySelector('.ch-null')?.textContent).toBe('NULL');
    expect(table.querySelector('.ch-more-rows')?.textContent).toBe('Y 1 filas más.');
    expect(resultTable({ columns: ['a'], rows: [] }, context).textContent).toContain('Sin filas');
  });
});

describe('renderCases', () => {
  const failing: CaseOutcome = {
    index: 1,
    passed: false,
    notes: ['brackets'],
    mismatch: { kind: 'row-count', expected: 1, actual: 2 },
    expected: { columns: ['Id'], rows: [[3]] },
    actual: { columns: ['id'], rows: [[3], [4]] },
    error: { message: 'syntax error', line: 2 },
    ms: 4,
  };

  it('resume, explica cada caso y deja abiertos los que no pasan', () => {
    const element = container();
    const verdict = renderCases(
      element,
      {
        results: [
          { index: 0, outcome: { index: 0, passed: true, notes: ['brackets'] } },
          { index: 1, outcome: failing },
        ],
      },
      2,
      'submit',
      challenge,
      context,
    );
    expect(verdict).toEqual({ passed: 1, total: 2, allPassed: false });
    expect(element.querySelector('.ch-verdict-title')?.textContent).toBe('1 de 2 casos aprobados.');
    const cases = [...element.querySelectorAll<HTMLDetailsElement>('.ch-case')];
    expect(cases.map((item) => item.open)).toEqual([false, true]);
    expect(cases[1]?.querySelector('.ch-why')?.textContent).toBe(
      'Se esperaban 1 filas y llegaron 2.',
    );
    expect(cases[1]?.querySelector('.ch-error')?.textContent).toContain('Error en la línea 2');
    // Al enviar se ven los datos de los casos que no son ejemplos.
    expect(cases[1]?.querySelector('.ch-input caption')?.textContent).toBe('Customers');
    expect(element.querySelectorAll('.ch-notes li')).toHaveLength(1);
  });

  it('si el código no corrió, lo dice una sola vez', () => {
    const element = container();
    const refusal = (index: number): CaseOutcome => ({
      index,
      passed: false,
      notes: [],
      refusal: 'blocked',
      blocked: [{ key: 'top', line: 3 }],
    });
    renderCases(
      element,
      {
        results: [
          { index: 0, outcome: refusal(0) },
          { index: 1, outcome: refusal(1) },
        ],
      },
      2,
      'submit',
      challenge,
      context,
    );
    expect(element.querySelectorAll('.ch-case')).toHaveLength(0);
    expect(element.textContent).toContain('Línea 3');
    expect(element.querySelector('code')?.textContent).toBe('TOP');
  });

  it('un caso que se pasó del tiempo lo dice con el límite', () => {
    const element = container();
    renderCases(element, { results: [{ index: 0, timedOut: true }] }, 1, 'run', challenge, context);
    expect(element.textContent).toContain('5 segundos');
  });
});

describe('renderPlayground', () => {
  it('muestra cada sentencia: filas, filas afectadas o error, y el plan', () => {
    const element = container();
    renderPlayground(
      element,
      {
        outcome: {
          notes: [],
          ms: 2,
          plan: 'Seq Scan on customers',
          statements: [
            { line: 1, result: { columns: [], rows: [], affected: 3 } },
            { line: 2, error: { message: 'boom', line: 2 } },
            { line: 3, result: { columns: ['n'], rows: [[1]] } },
          ],
        },
      },
      context,
    );
    const items = [...element.querySelectorAll('.ch-statement-result')];
    expect(items.map((item) => item.querySelector('h4')?.textContent)).toEqual([
      'Sentencia 1, línea 1',
      'Sentencia 2, línea 2',
      'Sentencia 3, línea 3',
    ]);
    expect(items[0]?.textContent).toContain('3 filas afectadas.');
    expect(items[1]?.hasAttribute('data-error')).toBe(true);
    expect(element.querySelector('.ch-plan-text')?.textContent).toBe('Seq Scan on customers');
    expect(element.querySelector('.ch-verdict-title')?.textContent).toBe('3 sentencias en 2 ms.');
  });
});
