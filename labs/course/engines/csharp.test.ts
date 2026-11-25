// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { CsProgramRequest } from '../../challenges/csharp/protocol';
import { brokenProgram, lessonData, program, semicolonError } from '../fixtures';
import { createCsharpAdapter, type LessonEngine } from './csharp';

// El adaptador de C# por sí solo, sin el núcleo de la lección: sus piezas, lo que le manda al motor
// en Ejecutar y en Enviar, y cómo responde. lesson.test.ts lo prueba además dentro de la lección.

const data = lessonData('es');
const ask = data.steps.find((step) => step.id === 'ask')!;
const print = data.steps.find((step) => step.id === 'print')!;

function setup(answer: () => ReturnType<LessonEngine['runProgram']>) {
  const requests: CsProgramRequest[] = [];
  const engine: LessonEngine = {
    timeoutMs: 5000,
    loaded: true,
    runProgram: (request) => {
      requests.push(request);
      return answer();
    },
    warm: async () => undefined,
  };
  return { adapter: createCsharpAdapter(engine, data, 'es'), requests };
}

describe('adaptador de C#', () => {
  it('trae la entrada y la terminal, y los textos de C#', () => {
    const { adapter } = setup(async () => program([{ stdout: '' }]));
    expect(adapter.id).toBe('csharp');
    expect(adapter.editorLanguage).toBe('csharp');
    expect(adapter.fileLabel).toBe(data.ui.file);
    expect(adapter.panels.input?.classList.contains('cs-stdin')).toBe(true);
    expect(adapter.panels.input?.hidden).toBe(true);
    expect(adapter.panels.output.querySelector('h2')?.textContent).toBe(data.ui.terminal);
    expect(adapter.panels.output.contains(adapter.panels.body)).toBe(true);
  });

  it('al abrir un paso muestra la entrada de ejemplo y deja la terminal en reposo', () => {
    const { adapter } = setup(async () => program([{ stdout: '' }]));
    adapter.panels.open(ask);
    const box = adapter.panels.input!.querySelector('textarea')!;
    expect(adapter.panels.input!.hidden).toBe(false);
    expect(box.value).toBe('Ana\n');
    expect(adapter.panels.body.textContent).toContain(data.ui.idle);
    adapter.panels.open(print);
    expect(adapter.panels.input!.hidden).toBe(true);
    adapter.panels.empty();
    expect(adapter.panels.body.textContent).toContain(data.ui.empty);
  });

  it('Ejecutar manda la entrada escrita y ninguna regla; Enviar, las ejecuciones y reglas del paso', async () => {
    const { adapter, requests } = setup(async () => program([{ stdout: 'Hola, Ana\n' }]));
    adapter.panels.open(ask);
    adapter.panels.input!.querySelector('textarea')!.value = 'Luis\n';
    await adapter.run({ step: ask, code: 'x' });
    expect(requests[0]).toMatchObject({ code: 'x', runs: [{ stdin: 'Luis\n' }], rules: [] });
    await adapter.check({ step: ask, code: 'y' });
    expect(requests[1]?.runs).toEqual([
      expect.objectContaining({ stdin: 'Ana\n', stdout: 'Hola, Ana\n' }),
    ]);
    expect(requests[1]?.rules).toEqual(ask.rules ?? []);
  });

  it('dice el renglón de un error de compilación y que no pasó', async () => {
    const { adapter } = setup(async () => brokenProgram(semicolonError));
    const report = await adapter.check({ step: print, code: 'x' });
    expect(report.passed).toBe(false);
    expect(report.line).toBe(semicolonError.line);
    expect(report.failed).toBeUndefined();
    expect(adapter.panels.body.textContent).not.toBe('');
  });

  it('si el motor falla, lo escribe en la terminal y avisa que no se revisó nada', async () => {
    const { adapter } = setup(async () => {
      throw new Error('no cargó');
    });
    const report = await adapter.run({ step: print, code: 'x' });
    expect(report).toMatchObject({ passed: false, failed: true });
    expect(report.announcement).toContain('no cargó');
    expect(adapter.panels.body.textContent).toContain('no cargó');
  });
});
