// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { startChallenge } from './challenge';
import type { CasesRun } from './engine';
import { challengeHtml, pageData } from './fixtures';
import { sqlLanguage, type SqlCasesEngine } from './languages';
import { createProgress } from './progress';
import type { CaseOutcome } from './sql/runner';

const passed = (index: number): CaseOutcome => ({
  index,
  passed: true,
  notes: [],
  expected: { columns: ['Id'], rows: [[2]] },
  actual: { columns: ['id'], rows: [[2]] },
  ms: 3,
});

/** Un motor falso que devuelve lo que la prueba prepare y guarda lo que le piden. */
function fakeEngine(make: (indexes: readonly number[], source: string) => CasesRun) {
  const calls: { indexes: readonly number[]; source: string }[] = [];
  const engine: SqlCasesEngine = {
    timeoutMs: 5000,
    loaded: true,
    runCases: async (_challenge, _dataset, indexes, source) => {
      calls.push({ indexes, source });
      return make(indexes, source);
    },
    warm: async () => undefined,
  };
  return { engine, calls };
}

function setup(
  make: (indexes: readonly number[], source: string) => CasesRun,
  stored?: string,
  hooks: { onSolved?: () => void; solvedText?: () => string | undefined } = {},
) {
  document.body.innerHTML = challengeHtml();
  const root = document.querySelector<HTMLElement>('.ch-page');
  if (!root) throw new Error('falta la página');
  const progress = createProgress(null);
  if (stored) progress.saveCode('demo', stored);
  const { engine, calls } = fakeEngine(make);
  const data = pageData();
  const controller = startChallenge(root, data, {
    language: sqlLanguage(engine, data, 'es'),
    progress,
    lang: 'es',
    confirm: () => true,
    ...hooks,
  });
  return { root, progress, controller, calls };
}

describe('startChallenge', () => {
  it('muestra las acciones y empieza con el código guardado o el inicial', () => {
    const { root, controller } = setup(() => ({ results: [] }), 'SELECT 42;');
    expect(root.querySelector<HTMLElement>('.ch-actions')?.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('.ch-results')?.hidden).toBe(false);
    expect(controller.editor().getValue()).toBe('SELECT 42;');
    expect(root.querySelector('textarea')?.getAttribute('aria-label')).toBe('Código SQL');
    expect(
      setup(() => ({ results: [] }))
        .controller.editor()
        .getValue(),
    ).toBe('SELECT Id FROM Customers;');
  });

  it('abre las pistas una a una', () => {
    const { root } = setup(() => ({ results: [] }));
    const hints = [...root.querySelectorAll<HTMLDetailsElement>('.ch-hint')];
    const button = root.querySelector<HTMLButtonElement>('.ch-next-hint');
    expect(hints.every((hint) => hint.hidden)).toBe(true);
    expect(button?.textContent).toBe('Ver la pista 1 de 2');
    button?.click();
    expect(hints[0]?.hidden).toBe(false);
    expect(hints[0]?.open).toBe(true);
    expect(button?.textContent).toBe('Ver la pista 2 de 2');
    button?.click();
    expect(hints[1]?.hidden).toBe(false);
    expect(root.querySelector('.ch-next-hint')).toBeNull();
  });

  it('el resumen de la solución dice si la abre o la cierra', () => {
    const { root } = setup(() => ({ results: [] }));
    const solution = root.querySelector<HTMLDetailsElement>('.ch-solution');
    if (!solution) throw new Error('falta la solución');
    solution.open = true;
    solution.dispatchEvent(new Event('toggle'));
    expect(solution.querySelector('summary')?.textContent).toBe('Ocultar la solución');
  });

  it('Ejecutar corre los ejemplos y Enviar todos los casos; al pasar todos, queda resuelto', async () => {
    const { root, progress, controller, calls } = setup((indexes) => ({
      results: indexes.map((index) => ({ index, outcome: passed(index) })),
    }));
    controller.editor().setValue('SELECT Id FROM Customers WHERE Id > 1;');
    await controller.run('run');
    expect(calls[0]?.indexes).toEqual([0]);
    expect(root.querySelector('.ch-verdict')?.textContent).toContain('1 de 1');
    expect(progress.get('demo')?.status).toBe('started');
    await controller.run('submit');
    expect(calls[1]).toEqual({ indexes: [0, 1], source: 'SELECT Id FROM Customers WHERE Id > 1;' });
    expect(progress.get('demo')).toEqual({
      status: 'solved',
      code: 'SELECT Id FROM Customers WHERE Id > 1;',
    });
    expect(root.querySelector<HTMLElement>('.ch-meta .ch-badge')?.hidden).toBe(false);
    expect(root.querySelector('.ch-solved a')?.getAttribute('href')).toContain('/siguiente/');
  });

  it('al resolverlo avisa (el modo entrevista lo anota) y usa su texto de resuelto', async () => {
    let solved = 0;
    const { root, controller } = setup(
      (indexes) => ({ results: indexes.map((index) => ({ index, outcome: passed(index) })) }),
      undefined,
      { onSolved: () => solved++, solvedText: () => 'Sigue con la entrevista.' },
    );
    await controller.run('run');
    expect(solved).toBe(0);
    await controller.run('submit');
    expect(solved).toBe(1);
    expect(root.querySelector('.ch-solved')?.textContent).toContain('Sigue con la entrevista.');
  });

  it('un error del motor se dice en el panel y los botones vuelven a funcionar', async () => {
    const { root, controller } = setup(() => {
      throw new Error('sin red');
    });
    await controller.run('run');
    expect(root.querySelector('.ch-status[data-tone="bad"]')?.textContent).toContain('sin red');
    expect(root.querySelector<HTMLButtonElement>('.ch-run')?.disabled).toBe(false);
  });

  it('Volver al código inicial cambia el código y lo guarda', () => {
    const { root, controller, progress } = setup(() => ({ results: [] }), 'SELECT 42;');
    root.querySelector<HTMLButtonElement>('.ch-reset')?.click();
    expect(controller.editor().getValue()).toBe('SELECT Id FROM Customers;');
    expect(progress.get('demo')?.code).toBe('SELECT Id FROM Customers;');
  });
});
