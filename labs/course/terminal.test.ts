// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { CsProgramRun } from '../challenges/csharp/engine';
import { brokenProgram, courseUi, errorNotes, program, semicolonError } from './fixtures';
import { judge, renderRun, renderStatus, type TerminalContext } from './terminal';

const ui = courseUi('es');
const ctx: TerminalContext = { ui, errors: errorNotes, lang: 'es', timeoutSeconds: 5 };

function body(): HTMLElement {
  document.body.innerHTML = '<div id="t"></div>';
  return document.getElementById('t')!;
}

const texts = (root: HTMLElement, selector: string) =>
  [...root.querySelectorAll(selector)].map((node) => node.textContent);

describe('judge', () => {
  it('pasa si compiló, cumplió las reglas y cada ejecución pasó', () => {
    expect(judge(program([{ stdout: 'a' }]), 1)).toBe(true);
    expect(judge(program([{ stdout: 'a' }, { stdout: 'b' }]), 2)).toBe(true);
    expect(judge(program([{ stdout: 'a' }], [{ kind: 'x', passed: true }]), 1)).toBe(true);
  });

  it('no pasa si no compiló o si el motor no llegó a compilar', () => {
    expect(judge(brokenProgram(semicolonError), 1)).toBe(false);
    expect(judge({ runs: [] }, 1)).toBe(false);
  });

  it('no pasa si una regla falló', () => {
    expect(judge(program([{ stdout: 'a' }], [{ kind: 'x', passed: false }]), 1)).toBe(false);
  });

  it('no pasa si una ejecución falló, se pasó del tiempo o faltó alguna', () => {
    expect(judge(program([{ stdout: 'a', passed: false, failed: ['stdout'] }]), 1)).toBe(false);
    const timedOut: CsProgramRun = { ...program([]), runs: [{ index: 0, timedOut: true }] };
    expect(judge(timedOut, 1)).toBe(false);
    expect(judge(program([{ stdout: 'a' }]), 2)).toBe(false);
  });
});

describe('renderStatus', () => {
  it('escribe el aviso y su nota', () => {
    const root = body();
    renderStatus(root, 'Cargando', 'Unos 9 MB');
    expect(texts(root, 'p')).toEqual(['Cargando', 'Unos 9 MB']);
    expect(root.querySelector('.cs-bad')).toBeNull();
  });

  it('un error se marca como malo y reemplaza lo anterior', () => {
    const root = body();
    renderStatus(root, 'Antes');
    renderStatus(root, 'Falló', undefined, 'bad');
    expect(texts(root, 'p')).toEqual(['Falló']);
    expect(root.querySelector('.cs-bad')?.textContent).toBe('Falló');
  });
});

describe('renderRun: sin compilar', () => {
  it('si el motor no llegó a compilar, dice cuánto tardó', () => {
    const root = body();
    renderRun(root, { runs: [] }, ctx, 'run', false, 1);
    expect(root.textContent).toBe(
      'El programa tardó más de 5 s y se detuvo. ¿Hay un ciclo que no termina?',
    );
  });

  it('un error de compilación muestra la línea, el mensaje y la explicación', () => {
    const root = body();
    renderRun(root, brokenProgram(semicolonError), ctx, 'run', false, 1);
    expect(root.querySelector('.cs-bad')?.textContent).toBe('El código no compila.');
    expect(texts(root, '.cs-diag p')).toEqual([
      'línea 1: CS1002',
      'Mensaje del compilador: ; expected',
      errorNotes['CS1002']!['es']!.replaceAll('`', ''),
    ]);
    // Lo que va entre comillas invertidas se vuelve <code>.
    expect(root.querySelector('.cs-diag code')?.textContent).toBe(';');
  });

  it('un error que no está explicado muestra solo la línea y el mensaje', () => {
    const root = body();
    renderRun(
      root,
      brokenProgram({ ...semicolonError, id: 'CS9999', message: 'raro' }),
      ctx,
      'run',
      false,
      1,
    );
    expect(texts(root, '.cs-diag p')).toEqual(['línea 1: CS9999', 'Mensaje del compilador: raro']);
  });

  it('la explicación sale en el idioma de la página', () => {
    const root = body();
    renderRun(
      root,
      brokenProgram(semicolonError),
      { ...ctx, ui: courseUi('en'), lang: 'en' },
      'run',
      false,
      1,
    );
    expect(texts(root, '.cs-diag p')[0]).toBe('line 1: CS1002');
    expect(texts(root, '.cs-diag p')[2]).toContain('A semicolon');
  });

  it('muestra como mucho tres errores', () => {
    const root = body();
    const many = [1, 2, 3, 4, 5].map((line) => ({ ...semicolonError, line }));
    renderRun(root, brokenProgram(...many), ctx, 'run', false, 1);
    expect(root.querySelectorAll('.cs-diag')).toHaveLength(3);
  });
});

describe('renderRun: Ejecutar', () => {
  it('muestra solo lo que escribió el programa, sin veredicto', () => {
    const root = body();
    renderRun(
      root,
      program([{ stdout: 'Hola\n', passed: false, failed: ['stdout'] }]),
      ctx,
      'run',
      false,
      1,
    );
    expect(texts(root, 'pre.cs-out')).toEqual(['Hola\n']);
    expect(root.querySelector('.cs-ok, .cs-bad')).toBeNull();
    expect(root.textContent).not.toContain('Se esperaba');
  });

  it('avisa si el programa no escribió nada', () => {
    const root = body();
    renderRun(root, program([{ stdout: '' }]), ctx, 'run', false, 1);
    expect(root.querySelector('pre')).toBeNull();
    expect(root.textContent).toBe('(el programa no escribió nada)');
  });

  it('una excepción se muestra con su tipo y su mensaje, una sola vez', () => {
    const root = body();
    const error = { type: 'System.InvalidOperationException', message: 'boom' };
    renderRun(
      root,
      program([{ stdout: 'x', passed: false, failed: ['error'], error }]),
      ctx,
      'submit',
      false,
      1,
    );
    expect(texts(root, '.cs-bad')).toEqual([
      'Todavía no.',
      'El programa lanzó System.InvalidOperationException: boom',
    ]);
  });

  it('una excepción conocida trae su explicación, y una desconocida solo el mensaje', () => {
    const root = body();
    const known = { type: 'DivideByZeroException', message: 'Attempted to divide by zero.' };
    renderRun(
      root,
      program([{ stdout: '', passed: false, failed: ['error'], error: known }]),
      ctx,
      'run',
      false,
      1,
    );
    expect(texts(root, 'p')).toEqual([
      '(el programa no escribió nada)',
      'El programa lanzó DivideByZeroException: Attempted to divide by zero.',
      errorNotes['DivideByZeroException']!['es']!,
    ]);

    const unknown = { type: 'RareException', message: 'raro' };
    renderRun(
      root,
      program([{ stdout: '', passed: false, failed: ['error'], error: unknown }]),
      ctx,
      'run',
      false,
      1,
    );
    expect(texts(root, 'p')).toEqual([
      '(el programa no escribió nada)',
      'El programa lanzó RareException: raro',
    ]);
  });

  it('un programa que se pasó del tiempo lo dice', () => {
    const root = body();
    const timedOut: CsProgramRun = { ...program([]), runs: [{ index: 0, timedOut: true }] };
    renderRun(root, timedOut, ctx, 'run', false, 1);
    expect(root.textContent).toContain('tardó más de 5 s');
  });

  it('con varias ejecuciones, cada una lleva su título', () => {
    const root = body();
    renderRun(root, program([{ stdout: 'a' }, { stdout: 'b' }]), ctx, 'run', false, 2);
    expect(texts(root, 'h3')).toEqual(['Ejecución 1', 'Ejecución 2']);
    expect(texts(root, 'pre.cs-out')).toEqual(['a', 'b']);
  });

  it('con una sola ejecución no hay título', () => {
    const root = body();
    renderRun(root, program([{ stdout: 'a' }]), ctx, 'run', false, 1);
    expect(root.querySelector('h3')).toBeNull();
  });
});

describe('renderRun: Enviar', () => {
  it('si pasó, dice Correcto', () => {
    const root = body();
    renderRun(root, program([{ stdout: 'Hola\n' }]), ctx, 'submit', true, 1);
    expect(root.querySelector('.cs-ok')?.textContent).toBe('¡Correcto!');
    expect(root.querySelector('.cs-bad')).toBeNull();
  });

  it('si la salida no es la esperada, muestra lo que salió junto a lo esperado', () => {
    const root = body();
    const run = program([
      { stdout: 'hola\n', passed: false, failed: ['stdout'], expected: 'Hola\n' },
    ]);
    renderRun(
      root,
      run,
      { ...ctx, failure: 'Revisa el texto: debe ser `Hola`.' },
      'submit',
      false,
      1,
    );
    expect(texts(root, '.cs-bad')).toEqual(['Todavía no.', 'La salida no es la esperada.']);
    expect(texts(root, 'p.cs-muted')).toEqual(['Salió:', 'Se esperaba:']);
    expect(texts(root, 'pre.cs-out')).toEqual(['hola\n', 'Hola\n']);
    expect(root.querySelector('.cs-tip')?.textContent).toBe('Revisa el texto: debe ser Hola.');
    expect(root.querySelector('.cs-tip code')?.textContent).toBe('Hola');
  });

  it('una regla que falló dice qué le falta al código', () => {
    const root = body();
    const run = program(
      [{ stdout: 'Hola\n' }],
      [
        { kind: 'calls-method', name: 'Console.WriteLine', passed: false },
        { kind: 'uses-type', type: 'List<T>', passed: true },
      ],
    );
    renderRun(root, run, ctx, 'submit', false, 1);
    expect(texts(root, '.cs-bad')).toEqual([
      'Todavía no.',
      'Tu código debe llamar a Console.WriteLine.',
    ]);
  });

  it('si se pedían varias veces, el mensaje dice cuántas', () => {
    const root = body();
    const run = program(
      [{ stdout: '1\n2\n' }],
      [
        { kind: 'calls-method', name: 'Console.WriteLine', passed: false, min: 3 },
        // Con un mínimo de 1 no hace falta decirlo.
        { kind: 'uses-syntax', name: 'LockStatement', passed: false, min: 1 },
        // Una revisión que no cuenta usa el mensaje de siempre, aunque traiga un mínimo.
        { kind: 'declares-variable', name: 'edad', passed: false, min: 2 },
      ],
    );
    renderRun(root, run, ctx, 'submit', false, 1);
    expect(texts(root, '.cs-bad')).toEqual([
      'Todavía no.',
      'Tu código debe llamar a Console.WriteLine al menos 3 veces.',
      'Tu código debe usar LockStatement.',
      'Tu código debe declarar la variable edad.',
    ]);
  });

  it('las reglas de sintaxis se nombran como una persona, y las demás con su nombre', () => {
    const root = body();
    const run = program(
      [{ stdout: 'x' }],
      [
        { kind: 'uses-syntax', name: 'ConstKeyword', passed: false },
        { kind: 'avoids-syntax', name: 'SingleLineCommentTrivia', passed: false },
        { kind: 'uses-syntax', name: 'SingleLineCommentTrivia', passed: false, min: 2 },
        // Sin etiqueta, se dice el nombre de Roslyn tal cual.
        { kind: 'uses-syntax', name: 'LockStatement', passed: false },
        // `name` de otra regla no se traduce.
        { kind: 'calls-method', name: 'ConstKeyword', passed: false },
      ],
    );
    renderRun(root, run, ctx, 'submit', false, 1);
    expect(texts(root, '.cs-bad').slice(1)).toEqual([
      'Tu código debe usar la palabra const.',
      'Tu código no debe usar un comentario con //.',
      'Tu código debe usar un comentario con // al menos 2 veces.',
      'Tu código debe usar LockStatement.',
      'Tu código debe llamar a ConstKeyword.',
    ]);
  });

  it('sin frase del paso no hay consejo', () => {
    const root = body();
    renderRun(
      root,
      program([{ stdout: 'x', passed: false, failed: ['contains'] }]),
      ctx,
      'submit',
      false,
      1,
    );
    expect(root.querySelector('.cs-tip')).toBeNull();
    expect(texts(root, '.cs-bad')).toContain('A la salida le falta un texto esperado.');
  });

  it('con Ejecutar no se revisan las reglas ni se muestra el consejo', () => {
    const root = body();
    const run = program(
      [{ stdout: 'x' }],
      [{ kind: 'calls-method', name: 'Console.Write', passed: false }],
    );
    renderRun(root, run, { ...ctx, failure: 'Consejo' }, 'run', false, 1);
    expect(root.querySelector('.cs-bad, .cs-tip')).toBeNull();
  });
});
