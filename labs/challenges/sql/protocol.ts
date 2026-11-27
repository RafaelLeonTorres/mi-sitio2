// Los mensajes entre la página y el worker del motor de SQL. La página manda una petición con un
// número; el worker responde con ese número: cuándo empieza el código del visitante (desde ahí
// corre el tiempo límite), el resultado de cada caso y el final.

import type { Dataset, SqlChallenge, SqlDialect } from './data';
import type { PlaygroundOutcome } from './playground';
import type { CaseOutcome } from './runner';

export type EngineRequest =
  /**
   * Cargar PGlite y preparar la plantilla antes de que el visitante pulse Ejecutar: la del
   * dialecto (`dialect`), o la de T-SQL.
   */
  | {
      readonly type: 'warm';
      readonly id: number;
      readonly assets: string;
      readonly dialect?: SqlDialect;
    }
  | {
      readonly type: 'cases';
      readonly id: number;
      /** La carpeta con los archivos de PGlite (pglite.wasm y pglite.data). */
      readonly assets: string;
      readonly challenge: SqlChallenge;
      readonly dataset: Dataset;
      readonly indexes: readonly number[];
      readonly source: string;
    }
  | {
      readonly type: 'playground';
      readonly id: number;
      readonly assets: string;
      readonly dataset: Dataset;
      readonly source: string;
      readonly explain: boolean;
      readonly generate: boolean;
    };

export type EngineReply =
  /** PGlite ya cargó; la primera vez tarda en descargar sus archivos. */
  | { readonly type: 'ready'; readonly id: number }
  /** Empieza el código del visitante en el caso `index` (-1 en el playground). */
  | { readonly type: 'code'; readonly id: number; readonly index: number }
  | { readonly type: 'case'; readonly id: number; readonly outcome: CaseOutcome }
  | { readonly type: 'playground'; readonly id: number; readonly outcome: PlaygroundOutcome }
  | { readonly type: 'done'; readonly id: number }
  /** El motor no pudo correr (no cargó PGlite, un error propio); no es un error del código. */
  | { readonly type: 'error'; readonly id: number; readonly message: string };
