// El adaptador de C# del curso: el motor de C# de los retos (Roslyn en un worker con tiempo límite),
// la entrada simulada (stdin) y la terminal donde salen el resultado, los errores y las revisiones.

import type { CsProgramRun } from '../../challenges/csharp/engine';
import type { CsCourseRun, CsProgramRequest } from '../../challenges/csharp/protocol';
import { h } from '../../shared/dom';
import type { Phase } from '../../shared/engine';
import type { Lang } from '../../shared/format';
import { fill } from '../../shared/template';
import type { CourseEngine, ExecuteReport, ExecuteRequest } from '../engine';
import { judge, renderRun, renderStatus } from '../terminal';
import type { LessonData, RunData } from '../types';

/** Lo que el curso usa del motor de C#; las pruebas pasan uno falso. */
export interface LessonEngine {
  readonly timeoutMs: number;
  readonly loaded: boolean;
  runProgram(
    request: CsProgramRequest,
    onProgress?: (phase: Phase, position: number) => void,
  ): Promise<CsProgramRun>;
  warm(): Promise<void>;
}

/** Una ejecución como la escribe el YAML, lista para mandarla al motor. */
function toRun(run: RunData): CsCourseRun {
  return {
    stdin: run.stdin ?? '',
    ...(run.stdout === undefined ? {} : { stdout: run.stdout }),
    ...(run.contains === undefined ? {} : { contains: run.contains }),
    ...(run.matches === undefined ? {} : { matches: run.matches }),
    ...(run.throws === undefined ? {} : { throws: run.throws }),
  };
}

export function createCsharpAdapter(
  engine: LessonEngine,
  data: LessonData,
  lang: Lang,
): CourseEngine {
  const { ui } = data;
  const stdinBox = h('textarea', {
    rows: 3,
    spellcheck: 'false',
    autocomplete: 'off',
    'aria-label': ui.stdin,
  });
  const input = h('div', { class: 'cs-stdin', hidden: true }, [
    h('label', {}, [ui.stdin, stdinBox]),
    h('p', { class: 'cs-help' }, [ui.stdin_help]),
  ]);
  const body = h('div', { class: 'cs-terminal-body' });
  const output = h('section', { class: 'cs-terminal', 'aria-labelledby': 'cs-terminal-title' }, [
    h('h2', { id: 'cs-terminal-title' }, [ui.terminal]),
    body,
  ]);

  async function execute(
    mode: 'run' | 'submit',
    { step, code, failure }: ExecuteRequest,
  ): Promise<ExecuteReport> {
    const runs: CsCourseRun[] =
      mode === 'run'
        ? [{ stdin: stdinBox.value }]
        : step.runs?.length
          ? step.runs.map(toRun)
          : [{ stdin: '' }];
    const request: CsProgramRequest = {
      code,
      runs,
      rules: mode === 'run' ? [] : (step.rules ?? []),
    };
    const status = (phase: Phase) =>
      phase === 'loading'
        ? renderStatus(body, ui.loading, ui.loading_note)
        : renderStatus(body, ui.running);
    status(engine.loaded ? 'running' : 'loading');
    try {
      const result = await engine.runProgram(request, status);
      const passed = mode === 'submit' && judge(result, runs.length);
      renderRun(
        body,
        result,
        {
          ui,
          errors: data.errors,
          lang,
          timeoutSeconds: engine.timeoutMs / 1000,
          ...(failure ? { failure } : {}),
        },
        mode,
        passed,
        runs.length,
      );
      const line = result.compile?.diagnostics[0]?.line;
      return {
        passed,
        ...(line ? { line } : {}),
        announcement:
          body.querySelector('.cs-ok, .cs-bad')?.textContent ??
          body.textContent?.slice(0, 120) ??
          '',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const text = fill(ui.engine_error, { message });
      renderStatus(body, text, undefined, 'bad');
      return { passed: false, announcement: text, failed: true };
    }
  }

  return {
    id: 'csharp',
    editorLanguage: 'csharp',
    fileLabel: ui.file,
    panels: {
      input,
      output,
      body,
      empty: () => renderStatus(body, ui.empty),
      open: (step) => {
        const stdin = step.runs?.find((run) => run.stdin)?.stdin ?? '';
        stdinBox.value = stdin;
        input.hidden = stdin === '';
        renderStatus(body, ui.idle);
      },
    },
    warm: () => engine.warm(),
    run: (request) => execute('run', request),
    check: (request) => execute('submit', request),
  };
}
