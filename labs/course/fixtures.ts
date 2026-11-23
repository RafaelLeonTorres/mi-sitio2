// Para las pruebas: los textos reales de _data/course/ui.yml y errors.yml, resultados del motor ya
// armados y una lección mínima con los mismos elementos que _includes/course/lesson.html.
import { parse } from 'yaml';
import errorsSource from '../../_data/course/errors.yml?raw';
import uiSource from '../../_data/course/ui.yml?raw';
import type { CsProgramRun } from '../challenges/csharp/engine';
import type {
  CsCourseRuleOutcome,
  CsDiagnostic,
  CsRunOutcome,
} from '../challenges/csharp/protocol';
import type { CourseUi, ErrorNotes, LessonData } from './types';

export function courseUi(lang: 'es' | 'en' = 'es'): CourseUi {
  return (parse(uiSource) as Record<'es' | 'en', CourseUi>)[lang];
}

export const errorNotes = parse(errorsSource) as ErrorNotes;

export const semicolonError: CsDiagnostic = {
  id: 'CS1002',
  message: '; expected',
  source: 'code',
  line: 1,
  column: 27,
  endLine: 1,
  endColumn: 28,
};

/** Un programa que compiló y cuyas ejecuciones salieron como se indica (una por salida). */
export function program(
  outputs: readonly (Partial<CsRunOutcome> & { stdout: string })[],
  rules: readonly CsCourseRuleOutcome[] = [],
): CsProgramRun {
  return {
    compile: { compiled: true, compileMs: 20, diagnostics: [], rules },
    runs: outputs.map((output, index) => ({
      index,
      outcome: { index, passed: true, failed: [], ms: 1, ...output },
    })),
  };
}

/** Un programa que no compiló. */
export function brokenProgram(...diagnostics: CsDiagnostic[]): CsProgramRun {
  return { compile: { compiled: false, compileMs: 5, diagnostics, rules: [] }, runs: [] };
}

/** El HTML de una lección de cuatro pasos: lectura, dos ejercicios y una pregunta. */
export const lessonHtml = `
<div class="cs-lesson" data-lesson="demo/lesson">
  <header class="cs-top">
    <div class="cs-progress" role="progressbar" aria-valuenow="0" hidden>
      <span class="cs-progress-track"><span class="cs-progress-bar"></span></span>
      <span class="cs-progress-text">0 %</span>
    </div>
  </header>
  <div class="cs-layout">
    <article class="cs-text">
      <section class="cs-step" id="intro" data-step="intro" data-kind="read" data-title="Introducción">
        <h2>1. Introducción</h2><p>Texto.</p>
      </section>
      <section class="cs-step" id="print" data-step="print" data-kind="exercise" data-title="Imprimir">
        <h2>2. Imprimir</h2>
        <div class="cs-fallback"><h4>Código inicial</h4><pre>// escribe</pre></div>
        <ol class="cs-hint-list">
          <li>Usa <code>Console.WriteLine</code>.</li>
          <li>El texto va entre comillas.</li>
          <li>Termina con punto y coma.</li>
        </ol>
        <details class="cs-solution">
          <summary>Solución</summary>
          <div class="highlighter-rouge"><pre>Console.WriteLine("Hola");</pre></div>
          <p>Así se imprime.</p>
        </details>
        <div class="cs-failure">Revisa el texto: debe ser <code>Hola</code>.</div>
      </section>
      <section class="cs-step" id="ask" data-step="ask" data-kind="exercise" data-title="Preguntar">
        <h2>3. Preguntar</h2>
        <ol class="cs-hint-list"><li>Lee con <code>Console.ReadLine</code>.</li></ol>
        <details class="cs-solution"><summary>Solución</summary><p>Se lee y se saluda.</p></details>
      </section>
      <section class="cs-step" id="quiz" data-step="quiz" data-kind="choice" data-title="Repaso">
        <h2>4. Repaso</h2>
        <p class="cs-question">¿Qué imprime?</p>
        <ul class="cs-options"><li>Nada</li><li>Texto</li><li>Un archivo</li></ul>
        <details class="cs-solution"><summary>Respuesta correcta</summary><p>Texto</p></details>
      </section>
    </article>
    <aside class="cs-work ch-work" hidden></aside>
  </div>
  <footer class="cs-bottom" hidden></footer>
</div>`;

export function lessonData(
  lang: 'es' | 'en' = 'es',
  overrides: Partial<LessonData> = {},
): LessonData {
  return {
    id: 'demo/lesson',
    steps: [
      { id: 'intro', kind: 'read' },
      {
        id: 'print',
        kind: 'exercise',
        starter: '// escribe',
        solution: 'Console.WriteLine("Hola");',
        runs: [{ stdout: 'Hola\n' }],
        rules: [{ kind: 'calls-method', name: 'Console.WriteLine' }],
      },
      {
        id: 'ask',
        kind: 'exercise',
        starter: '',
        solution: 'var name = Console.ReadLine();\nConsole.WriteLine($"Hola, {name}");',
        runs: [{ stdin: 'Ana\n', stdout: 'Hola, Ana\n' }],
      },
      { id: 'quiz', kind: 'choice', answer: 1 },
    ],
    starters: {},
    ui: courseUi(lang),
    errors: errorNotes,
    engine: '/csharp/',
    worker: '/w.js',
    syllabus: '/curso/csharp/',
    next: { url: '/curso/csharp/otra/', title: 'Otra' },
    ...overrides,
  };
}
