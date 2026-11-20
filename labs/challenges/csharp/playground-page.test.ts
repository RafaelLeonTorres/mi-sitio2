// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { uiTexts } from '../fixtures';
import { createProgress } from '../progress';
import type { CsPlaygroundPageData } from '../texts';
import type { CsPlaygroundRun } from './engine';
import { CS_PLAYGROUND_ID, startCsPlayground, type CsPlaygroundEngine } from './playground-page';

/** El HTML de _includes/labs/csharp-playground.html, reducido a lo que usa el TypeScript. */
const html = `
<div class="ch-playground" data-language="csharp">
  <div class="ch-editor" data-label="Código C#"><p class="ch-nojs">Sin JS</p><pre>Console.WriteLine();</pre></div>
  <div class="ch-actions" hidden>
    <button class="ch-run" type="button">Ejecutar</button>
    <button class="ch-reset" type="button">Volver al ejemplo</button>
  </div>
  <p class="ch-help" hidden>Ayuda</p>
  <section class="ch-results" hidden><div class="ch-results-body"><p>Vacío</p></div></section>
</div>`;

function setup(
  make: (source: string) => CsPlaygroundRun | Promise<CsPlaygroundRun>,
  stored?: string,
) {
  document.body.innerHTML = html;
  const root = document.querySelector<HTMLElement>('.ch-playground');
  if (!root) throw new Error('falta el playground');
  const progress = createProgress(null);
  if (stored) progress.saveCode(CS_PLAYGROUND_ID, stored);
  const sources: string[] = [];
  const engine: CsPlaygroundEngine = {
    timeoutMs: 5000,
    loaded: true,
    runPlayground: async (source) => {
      sources.push(source);
      return make(source);
    },
    warm: async () => undefined,
  };
  const data: CsPlaygroundPageData = {
    playground: 'csharp',
    starter: 'Console.WriteLine("Hola");',
    ui: uiTexts('es'),
    engine: '/csharp/',
    worker: '/w.js',
  };
  const controller = startCsPlayground(root, data, {
    engine,
    progress,
    lang: 'es',
    confirm: () => true,
  });
  return { root, controller, progress, sources };
}

describe('startCsPlayground', () => {
  it('empieza con el código guardado o el ejemplo, y muestra las acciones', () => {
    const { root, controller } = setup(() => ({ timedOut: true }), 'var x = 1;');
    expect(controller.editor().getValue()).toBe('var x = 1;');
    expect(root.querySelector<HTMLElement>('.ch-actions')?.hidden).toBe(false);
    expect(root.querySelector('textarea')?.getAttribute('aria-label')).toBe('Código C#');
    expect(
      setup(() => ({ timedOut: true }))
        .controller.editor()
        .getValue(),
    ).toBe('Console.WriteLine("Hola");');
  });

  it('corre el programa y muestra la consola', async () => {
    const { root, controller, sources } = setup(() => ({
      outcome: { compiled: true, compileMs: 30, diagnostics: [], console: 'Hola\n', ms: 2 },
    }));
    await controller.run();
    expect(sources).toEqual(['Console.WriteLine("Hola");']);
    expect(root.querySelector('pre.ch-value')?.textContent).toBe('Hola');
    expect(document.getElementById('lab-live')?.textContent).toContain('Terminó en');
    expect(root.querySelector<HTMLButtonElement>('.ch-run')?.disabled).toBe(false);
  });

  it('un error de compilación se muestra con su línea', async () => {
    const { root, controller } = setup(() => ({
      outcome: {
        compiled: false,
        compileMs: 10,
        diagnostics: [
          {
            id: 'CS1002',
            message: '; expected',
            source: 'code',
            line: 1,
            column: 27,
            endLine: 1,
            endColumn: 28,
          },
        ],
        console: '',
        ms: 0,
      },
    }));
    await controller.run();
    expect(root.querySelector('.ch-diagnostic-where')?.textContent).toBe('Línea 1, columna 27');
    expect(document.getElementById('lab-live')?.textContent).toBe('Tu código no compila.');
  });

  it('sin código no llama al motor, y un error del motor se dice en el panel', async () => {
    const empty = setup(() => ({ timedOut: true }), '   ');
    await empty.controller.run();
    expect(empty.sources).toEqual([]);
    expect(empty.root.querySelector('.ch-status')?.textContent).toContain('Escribe un programa');
    const failing = setup(() => {
      throw new Error('sin red');
    });
    await failing.controller.run();
    expect(failing.root.querySelector('.ch-status[data-tone="bad"]')?.textContent).toContain(
      'sin red',
    );
  });

  it('Volver al ejemplo cambia el código y lo guarda', () => {
    const { root, controller, progress } = setup(() => ({ timedOut: true }), 'var x = 1;');
    root.querySelector<HTMLButtonElement>('.ch-reset')?.click();
    expect(controller.editor().getValue()).toBe('Console.WriteLine("Hola");');
    expect(progress.get(CS_PLAYGROUND_ID)?.code).toBe('Console.WriteLine("Hola");');
  });
});
