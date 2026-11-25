// Lo común de los motores vistos desde la página (retos y cursos): mandan el código a un worker y
// esperan sus resultados. Si el código del visitante pasa del tiempo límite, la página termina el
// worker, que se vuelve a crear en la siguiente ejecución: un ciclo infinito o una consulta enorme
// no cuelgan la página. Cada motor (SQL en challenges/engine.ts, C# en challenges/csharp/engine.ts)
// extiende `WorkerEngine` con sus mensajes.

/** Lo que tienen todos los mensajes: su tipo y el número de la petición. */
export interface EngineMessage {
  readonly type: string;
  readonly id: number;
}

/** Lo que se usa de un Worker; las pruebas pasan uno falso. */
export interface WorkerLike<Request = EngineMessage, Reply = EngineMessage> {
  postMessage(message: Request): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<Reply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface EngineOptions<Request = EngineMessage, Reply = EngineMessage> {
  readonly worker: string;
  /** La carpeta con los archivos del motor (PGlite o .NET). */
  readonly assets: string;
  /** Lo más que puede correr el código del visitante en un caso. */
  readonly timeoutMs?: number;
  /** Lo más que puede tardar el motor en cargar y preparar un caso, sin contar el código. */
  readonly setupMs?: number;
  readonly createWorker?: (url: string) => WorkerLike<Request, Reply>;
}

/** Un problema del motor, no del código: no cargó o se pasó del tiempo de preparación. */
export class EngineError extends Error {}

export type Phase = 'loading' | 'running';

/** Qué hacer con lo que responde el worker a una petición. */
export interface Handlers<Reply> {
  /** Empieza el código del visitante en el caso `index` (-1 en el playground). */
  readonly onCode: (index: number) => void;
  /** Lo propio de cada motor: un caso, la compilación o el playground. */
  readonly onReply?: (reply: Reply) => void;
  readonly onTimeout: () => void;
  readonly onLoading: () => void;
}

export const TIMEOUT_MS = 5000;
const SETUP_MS = 60_000;

/**
 * Lo común de los motores: un worker a la vez, las peticiones en fila y un solo reloj. Mientras el
 * motor carga, compila o prepara un caso corre el de preparación; desde el aviso `code` hasta el
 * siguiente `case`, el del visitante.
 */
export class WorkerEngine<Request extends EngineMessage, Reply extends EngineMessage> {
  readonly timeoutMs: number;
  private worker: WorkerLike<Request, Reply> | undefined;
  private ready = false;
  private counter = 0;
  /** Las peticiones van de una en una: la siguiente espera a que termine la anterior. */
  private tail: Promise<void> = Promise.resolve();

  constructor(protected readonly options: EngineOptions<Request, Reply>) {
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  }

  /** Si el motor ya cargó en este worker. */
  get loaded(): boolean {
    return this.ready;
  }

  /**
   * Carga el motor mientras el visitante lee el enunciado, para que su primera ejecución no espere.
   * Si el motor está ocupado o ya cargó, no hace nada.
   */
  warm(): Promise<void> {
    if (this.ready) return Promise.resolve();
    const build = (id: number) =>
      ({ type: 'warm', id, assets: this.options.assets }) as unknown as Request;
    return this.request(build, {
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

  protected request(build: (id: number) => Request, handlers: Handlers<Reply>): Promise<void> {
    const run = this.tail.then(() => this.send(build, handlers));
    this.tail = run.catch(() => undefined);
    return run;
  }

  private spawn(): WorkerLike<Request, Reply> {
    if (this.worker) return this.worker;
    const create =
      this.options.createWorker ??
      ((url: string) =>
        new Worker(url, { type: 'module' }) as unknown as WorkerLike<Request, Reply>);
    this.worker = create(this.options.worker);
    this.ready = false;
    return this.worker;
  }

  private send(build: (id: number) => Request, handlers: Handlers<Reply>): Promise<void> {
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
        const fields = reply as Reply & { readonly index?: number; readonly message?: string };
        switch (reply.type) {
          case 'ready':
            this.ready = true;
            break;
          case 'code':
            this.ready = true;
            handlers.onCode(fields.index ?? -1);
            arm(this.timeoutMs, () => {
              handlers.onTimeout();
              finish();
            });
            break;
          case 'case':
          case 'run':
            handlers.onReply?.(reply);
            arm(this.options.setupMs ?? SETUP_MS, setupExpired);
            break;
          case 'done':
            finish();
            break;
          case 'error':
            this.dispose();
            finish(new EngineError(fields.message ?? 'El motor falló.'));
            break;
          default:
            handlers.onReply?.(reply);
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
 * Descarga el motor cuando el visitante muestra que va a correr código: al entrar al editor o al
 * acercarse a los botones. Así quien solo lee el enunciado no descarga varios MB, y quien escribe
 * ya tiene el motor listo cuando pulsa Ejecutar.
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
