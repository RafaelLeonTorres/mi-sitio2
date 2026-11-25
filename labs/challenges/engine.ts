// El motor de SQL de los retos visto desde la página: manda el código al worker de PGlite
// (sql/worker.ts) y espera sus resultados. Lo común de los motores (el worker, el tiempo límite y la
// carga) está en shared/engine.ts.

import { EngineError, WorkerEngine, type Phase } from '../shared/engine';
import type { Dataset, SqlChallenge } from './sql/data';
import type { PlaygroundOutcome } from './sql/playground';
import type { EngineReply, EngineRequest } from './sql/protocol';
import type { CaseOutcome } from './sql/runner';

/** Lo que pasó con un caso: su resultado, o que se acabó el tiempo. */
export type CaseResult =
  | { readonly index: number; readonly outcome: CaseOutcome }
  | { readonly index: number; readonly timedOut: true };

export interface CasesRun {
  /** Los casos que corrieron, en orden; si uno se pasó del tiempo, es el último. */
  readonly results: readonly CaseResult[];
}

export type PlaygroundRun = { readonly outcome: PlaygroundOutcome } | { readonly timedOut: true };

/** El motor de SQL: PGlite en un worker (sql/worker.ts). */
export class SqlEngine extends WorkerEngine<EngineRequest, EngineReply> {
  /** Corre el código contra los casos indicados, uno tras otro. */
  runCases(
    challenge: SqlChallenge,
    dataset: Dataset,
    indexes: readonly number[],
    source: string,
    onProgress: (phase: Phase, position: number) => void = () => undefined,
  ): Promise<CasesRun> {
    const results: CaseResult[] = [];
    let current = indexes[0] ?? 0;
    const { assets } = this.options;
    return this.request(
      (id) => ({ type: 'cases', id, assets, challenge, dataset, indexes, source }),
      {
        onCode: (index) => {
          current = index;
          onProgress('running', results.length);
        },
        onReply: (reply) => {
          if (reply.type === 'case')
            results.push({ index: reply.outcome.index, outcome: reply.outcome });
        },
        onTimeout: () => results.push({ index: current, timedOut: true }),
        onLoading: () => onProgress('loading', 0),
      },
    ).then(() => ({ results }));
  }

  /** Corre el código del playground. */
  runPlayground(
    dataset: Dataset,
    source: string,
    flags: { readonly explain: boolean; readonly generate: boolean },
    onProgress: (phase: Phase) => void = () => undefined,
  ): Promise<PlaygroundRun> {
    let run: PlaygroundRun | undefined;
    const { assets } = this.options;
    return this.request((id) => ({ type: 'playground', id, assets, dataset, source, ...flags }), {
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
