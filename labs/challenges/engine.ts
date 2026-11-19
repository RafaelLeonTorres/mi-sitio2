// El motor de SQL visto desde la página: manda el código al worker (sql/worker.ts) y espera sus
// resultados. Si el código del visitante pasa del tiempo límite, termina el worker, que se vuelve a
// crear en la siguiente ejecución: un ciclo infinito o una consulta enorme no cuelgan la página.

import type { Dataset, SqlChallenge } from './sql/data';
import type { PlaygroundOutcome } from './sql/playground';
import type { EngineReply, EngineRequest } from './sql/protocol';
import type { CaseOutcome } from './sql/runner';

/** Lo que se usa de un Worker; las pruebas pasan uno falso. */
export interface WorkerLike {
  postMessage(message: EngineRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<EngineReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface EngineOptions {
  readonly worker: string;
  /** La carpeta con los archivos de PGlite. */
  readonly assets: string;
  /** Lo más que puede correr el código del visitante en un caso. */
  readonly timeoutMs?: number;
  /** Lo más que puede tardar el motor en cargar y preparar un caso, sin contar el código. */
  readonly setupMs?: number;
  readonly createWorker?: (url: string) => WorkerLike;
}

/** Lo que pasó con un caso: su resultado, o que se acabó el tiempo. */
export type CaseResult =
  | { readonly index: number; readonly outcome: CaseOutcome }
  | { readonly index: number; readonly timedOut: true };

/** Un problema del motor, no del código: no cargó PGlite o se pasó del tiempo de preparación. */
export class EngineError extends Error {}

export type Phase = 'loading' | 'running';

export interface CasesRun {
  /** Los casos que corrieron, en orden; si uno se pasó del tiempo, es el último. */
  readonly results: readonly CaseResult[];
}

export type PlaygroundRun = { readonly outcome: PlaygroundOutcome } | { readonly timedOut: true };

interface Handlers {
  readonly onCode: (index: number) => void;
  readonly onCase?: (outcome: CaseOutcome) => void;
  readonly onPlayground?: (outcome: PlaygroundOutcome) => void;
  readonly onTimeout: () => void;
  readonly onLoading: () => void;
}

export const TIMEOUT_MS = 5000;
const SETUP_MS = 60_000;

export class SqlEngine {
  readonly timeoutMs: number;
  private worker: WorkerLike | undefined;
  private ready = false;
  private counter = 0;
  /** Las peticiones van de una en una: la siguiente espera a que termine la anterior. */
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly options: EngineOptions) {
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  }

  /** Si el motor ya cargó PGlite en este worker. */
  get loaded(): boolean {
    return this.ready;
  }

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
    return this.request(
      (id) => ({
        type: 'cases',
        id,
        assets: this.options.assets,
        challenge,
        dataset,
        indexes,
        source,
      }),
      {
        onCode: (index) => {
          current = index;
          onProgress('running', results.length);
        },
        onCase: (outcome) => results.push({ index: outcome.index, outcome }),
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
    return this.request(
      (id) => ({ type: 'playground', id, assets: this.options.assets, dataset, source, ...flags }),
      {
        onCode: () => onProgress('running'),
        onPlayground: (outcome) => {
          run = { outcome };
        },
        onTimeout: () => {
          run = { timedOut: true };
        },
        onLoading: () => onProgress('loading'),
      },
    ).then(() => {
      if (!run) throw new EngineError('El motor terminó sin resultado.');
      return run;
    });
  }

  /**
   * Carga PGlite y prepara la plantilla mientras el visitante lee el enunciado, para que su
   * primera ejecución no espere. Si el motor está ocupado o ya cargó, no hace nada.
   */
  warm(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return this.request((id) => ({ type: 'warm', id, assets: this.options.assets }), {
      onCode: () => undefined,
      onTimeout: () => undefined,
      onLoading: () => undefined,
    }).catch(() => undefined);
  }

  /** Termina el worker; el siguiente pedido crea otro. */
  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = false;
  }

  private spawn(): WorkerLike {
    if (this.worker) return this.worker;
    const create =
      this.options.createWorker ??
      ((url: string) => new Worker(url, { type: 'module' }) as unknown as WorkerLike);
    this.worker = create(this.options.worker);
    this.ready = false;
    return this.worker;
  }

  private request(build: (id: number) => EngineRequest, handlers: Handlers): Promise<void> {
    const run = this.tail.then(() => this.send(build, handlers));
    this.tail = run.catch(() => undefined);
    return run;
  }

  private send(build: (id: number) => EngineRequest, handlers: Handlers): Promise<void> {
    const id = ++this.counter;
    const worker = this.spawn();
    if (!this.ready) handlers.onLoading();

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: Error) => {
        clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
        if (error) reject(error);
        else resolve();
      };
      // Un solo reloj: mientras se prepara la base, el de preparación; mientras corre el código,
      // el del visitante.
      const arm = (ms: number, onExpire: () => void) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.dispose();
          onExpire();
        }, ms);
      };
      const setupExpired = () => finish(new EngineError('El motor tardó demasiado en prepararse.'));
      arm(this.options.setupMs ?? SETUP_MS, setupExpired);

      worker.onmessage = (event) => {
        const reply = event.data;
        if (reply.id !== id) return;
        switch (reply.type) {
          case 'ready':
            this.ready = true;
            break;
          case 'code':
            this.ready = true;
            handlers.onCode(reply.index);
            arm(this.timeoutMs, () => {
              handlers.onTimeout();
              finish();
            });
            break;
          case 'case':
            handlers.onCase?.(reply.outcome);
            arm(this.options.setupMs ?? SETUP_MS, setupExpired);
            break;
          case 'playground':
            handlers.onPlayground?.(reply.outcome);
            break;
          case 'done':
            finish();
            break;
          case 'error':
            this.dispose();
            finish(new EngineError(reply.message));
            break;
        }
      };
      worker.onerror = (event) => {
        this.dispose();
        finish(new EngineError(event.message || 'El worker del motor falló.'));
      };
      worker.postMessage(build(id));
    });
  }
}

/**
 * Descarga PGlite cuando el visitante muestra que va a correr código: al entrar al editor o al
 * acercarse a los botones. Así quien solo lee el enunciado no descarga 5 MB, y quien escribe ya
 * tiene el motor listo cuando pulsa Ejecutar.
 */
export function warmOnIntent(root: HTMLElement, engine: { warm(): Promise<void> }): void {
  const work = root.querySelector<HTMLElement>('.ch-work') ?? root;
  const start = () => {
    work.removeEventListener('focusin', start);
    work.removeEventListener('pointerover', start);
    void engine.warm();
  };
  work.addEventListener('focusin', start);
  work.addEventListener('pointerover', start);
}
