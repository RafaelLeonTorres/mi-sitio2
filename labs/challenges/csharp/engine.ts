// El motor de C# visto desde la página: .NET y Roslyn en un worker (csharp/worker.ts). Compila el
// código una vez por ejecución y corre los casos uno tras otro; el tiempo límite cuenta desde que
// empieza el código del visitante en cada caso, sin la compilación.

import { EngineError, WorkerEngine, type Phase } from '../../shared/engine';
import { csharpRequest, type CsChallenge } from './data';
import type {
  CsCaseOutcome,
  CsCompileOutcome,
  CsEngineReply,
  CsEngineRequest,
  CsPlaygroundOutcome,
  CsProgramCompile,
  CsProgramRequest,
  CsRunOutcome,
} from './protocol';

export type CsCaseResult =
  | { readonly index: number; readonly outcome: CsCaseOutcome }
  | { readonly index: number; readonly timedOut: true };

export interface CsRun {
  /** Falta si el motor no llegó a compilar (se pasó del tiempo antes). */
  readonly compile?: CsCompileOutcome;
  /** Los casos que corrieron, en orden; si uno se pasó del tiempo, es el último. */
  readonly results: readonly CsCaseResult[];
}

export type CsPlaygroundRun =
  { readonly outcome: CsPlaygroundOutcome } | { readonly timedOut: true };

export type CsRunResult =
  | { readonly index: number; readonly outcome: CsRunOutcome }
  | { readonly index: number; readonly timedOut: true };

/** Lo que pasó con el programa de un paso del curso: cómo compiló y cada ejecución. */
export interface CsProgramRun {
  /** Falta si el motor no llegó a compilar (se pasó del tiempo antes). */
  readonly compile?: CsProgramCompile;
  /** Las ejecuciones, en orden; si una se pasó del tiempo, es la última. */
  readonly runs: readonly CsRunResult[];
}

export class CsharpEngine extends WorkerEngine<CsEngineRequest, CsEngineReply> {
  /** Compila el código y lo corre contra los casos indicados. */
  runCases(
    challenge: CsChallenge,
    indexes: readonly number[],
    source: string,
    onProgress: (phase: Phase, position: number) => void = () => undefined,
  ): Promise<CsRun> {
    const results: CsCaseResult[] = [];
    let compile: CsCompileOutcome | undefined;
    let current = indexes[0] ?? 0;
    const { assets } = this.options;
    const request = csharpRequest(challenge, indexes, source);
    return this.request((id) => ({ type: 'cases', id, assets, request }), {
      onCode: (index) => {
        current = index;
        onProgress('running', results.length);
      },
      onReply: (reply) => {
        if (reply.type === 'compiled') compile = reply.outcome;
        else if (reply.type === 'case')
          results.push({ index: reply.outcome.index, outcome: reply.outcome });
      },
      onTimeout: () => results.push({ index: current, timedOut: true }),
      onLoading: () => onProgress('loading', 0),
    }).then(() => (compile ? { compile, results } : { results }));
  }

  /** Compila y corre el programa del playground. */
  runPlayground(
    source: string,
    onProgress: (phase: Phase) => void = () => undefined,
  ): Promise<CsPlaygroundRun> {
    let run: CsPlaygroundRun | undefined;
    const { assets } = this.options;
    return this.request((id) => ({ type: 'playground', id, assets, source }), {
      onCode: () => onProgress('running'),
      onReply: (reply) => {
        if (reply.type === 'playground') run = { outcome: reply.outcome };
      },
      onTimeout: () => {
        run = { timedOut: true };
      },
      onLoading: () => onProgress('loading'),
    }).then(() => {
      if (!run) throw new EngineError('El motor terminó sin resultado.');
      return run;
    });
  }

  /** Compila el programa de un paso del curso y lo corre con cada entrada simulada. */
  runProgram(
    request: CsProgramRequest,
    onProgress: (phase: Phase, position: number) => void = () => undefined,
  ): Promise<CsProgramRun> {
    const runs: CsRunResult[] = [];
    let compile: CsProgramCompile | undefined;
    let current = 0;
    const { assets } = this.options;
    return this.request((id) => ({ type: 'program', id, assets, request }), {
      onCode: (index) => {
        current = index;
        onProgress('running', runs.length);
      },
      onReply: (reply) => {
        if (reply.type === 'program') compile = reply.outcome;
        else if (reply.type === 'run')
          runs.push({ index: reply.outcome.index, outcome: reply.outcome });
      },
      onTimeout: () => runs.push({ index: current, timedOut: true }),
      onLoading: () => onProgress('loading', 0),
    }).then(() => (compile ? { compile, runs } : { runs }));
  }
}
