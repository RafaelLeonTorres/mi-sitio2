// El motor de C# visto desde la página: .NET y Roslyn en un worker (csharp/worker.ts). Compila el
// código una vez por ejecución y corre los casos uno tras otro; el tiempo límite cuenta desde que
// empieza el código del visitante en cada caso, sin la compilación.

import { EngineError, WorkerEngine, type Phase } from '../engine';
import { csharpRequest, type CsChallenge } from './data';
import type {
  CsCaseOutcome,
  CsCompileOutcome,
  CsEngineReply,
  CsEngineRequest,
  CsPlaygroundOutcome,
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
}
