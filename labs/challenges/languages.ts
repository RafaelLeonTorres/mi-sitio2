// Lo que cambia entre los retos de SQL y los de C#: el motor que corre los casos, el lenguaje del
// editor y cómo se escriben los resultados. La página del reto (challenge.ts) es la misma.

import type { Lang } from '../shared/format';
import type { CsChallenge } from './csharp/data';
import type { CsRun } from './csharp/engine';
import { csErrorLine, renderCsCases, type CsContext } from './csharp/results';
import type { EditorOptions } from '../shared/editor-api';
import type { Phase } from '../shared/engine';
import type { CasesRun } from './engine';
import { renderCases, type Context, type Verdict } from './results';
import { editorSchema, type Dataset, type SqlChallenge } from './sql/data';
import type { ChallengePageData, CsChallengePageData } from './texts';

export interface ChallengeLanguage<Run = unknown> {
  readonly loaded: boolean;
  /** Lo que se le pasa al editor: el lenguaje y, en SQL, las tablas para autocompletar. */
  readonly editor: Pick<EditorOptions, 'language' | 'schema'>;
  /** El aviso mientras carga el motor y el de un error suyo. */
  readonly texts: {
    readonly loading: string;
    readonly loading_note: string;
    readonly engine_error: string;
  };
  run(
    indexes: readonly number[],
    source: string,
    onProgress: (phase: Phase, position: number) => void,
  ): Promise<Run>;
  /** Escribe los resultados en el panel y dice cuántos casos pasaron. */
  render(body: HTMLElement, run: Run, total: number, mode: 'run' | 'submit'): Verdict;
  /** El renglón del primer error del código del visitante, para marcarlo en el editor. */
  errorLine(run: Run): number | undefined;
  warm(): Promise<void>;
}

/** Lo que el lenguaje SQL usa de su motor; las pruebas pasan uno falso. */
export interface SqlCasesEngine {
  readonly timeoutMs: number;
  readonly loaded: boolean;
  runCases(
    challenge: SqlChallenge,
    dataset: Dataset,
    indexes: readonly number[],
    source: string,
    onProgress?: (phase: Phase, position: number) => void,
  ): Promise<CasesRun>;
  warm(): Promise<void>;
}

export function sqlLanguage(
  engine: SqlCasesEngine,
  data: ChallengePageData,
  lang: Lang,
): ChallengeLanguage<CasesRun> {
  const context: Context = {
    texts: data.ui,
    lang,
    timeoutSeconds: engine.timeoutMs / 1000,
    generated: data.generated,
  };
  return {
    get loaded() {
      return engine.loaded;
    },
    editor: { language: 'sql', schema: editorSchema(data.dataset.tables) },
    texts: data.ui.results,
    run: (indexes, source, onProgress) =>
      engine.runCases(data.challenge, data.dataset, indexes, source, onProgress),
    render: (body, run, total, mode) =>
      renderCases(body, run, total, mode, data.challenge, context),
    errorLine: (run) => {
      for (const item of run.results) {
        if ('outcome' in item && item.outcome.error?.line) return item.outcome.error.line;
      }
      return undefined;
    },
    warm: () => engine.warm(),
  };
}

/** Lo que el lenguaje C# usa de su motor; las pruebas pasan uno falso. */
export interface CsCasesEngine {
  readonly timeoutMs: number;
  readonly loaded: boolean;
  runCases(
    challenge: CsChallenge,
    indexes: readonly number[],
    source: string,
    onProgress?: (phase: Phase, position: number) => void,
  ): Promise<CsRun>;
  warm(): Promise<void>;
}

export function csharpLanguage(
  engine: CsCasesEngine,
  data: CsChallengePageData,
  lang: Lang,
): ChallengeLanguage<CsRun> {
  const context: CsContext = {
    results: data.ui.results,
    csharp: data.ui.csharp,
    lang,
    timeoutSeconds: engine.timeoutMs / 1000,
  };
  return {
    get loaded() {
      return engine.loaded;
    },
    editor: { language: 'csharp' },
    texts: data.ui.csharp.results,
    run: (indexes, source, onProgress) =>
      engine.runCases(data.challenge, indexes, source, onProgress),
    render: (body, run, total, mode) =>
      renderCsCases(body, run, total, mode, data.challenge, context),
    errorLine: csErrorLine,
    warm: () => engine.warm(),
  };
}
