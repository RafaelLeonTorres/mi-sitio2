import { describe, expect, it } from 'vitest';
import { EngineError, type WorkerLike } from '../../shared/engine';
import type { CsChallenge } from './data';
import { CsharpEngine } from './engine';
import type { CsCaseOutcome, CsCompileOutcome, CsEngineReply, CsEngineRequest } from './protocol';

/** Un worker falso: responde lo que la prueba le diga a cada petición. */
class FakeWorker implements WorkerLike<CsEngineRequest, CsEngineReply> {
  onmessage: ((event: MessageEvent<CsEngineReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  readonly requests: CsEngineRequest[] = [];
  constructor(
    private readonly respond: (
      request: CsEngineRequest,
      reply: (message: CsEngineReply) => void,
    ) => void,
  ) {}
  postMessage(message: CsEngineRequest): void {
    this.requests.push(message);
    const reply = (data: CsEngineReply) =>
      setTimeout(() => this.onmessage?.({ data } as MessageEvent<CsEngineReply>), 0);
    this.respond(message, reply);
  }
  terminate(): void {
    this.terminated = true;
  }
}

const challenge = {
  entry: { type: 'Solution', method: 'Run' },
  cases: [
    { args: [1], expected: 1 },
    { args: [2], expected: 2 },
    { args: [3], expected: 3 },
  ],
} as unknown as CsChallenge;

const compiled: CsCompileOutcome = { compiled: true, compileMs: 12, diagnostics: [], rules: [] };
const outcome = (index: number): CsCaseOutcome => ({
  index,
  passed: true,
  actual: index + 1,
  console: '',
  ms: 1,
});

/** Compila y responde cada caso, salvo `hang`, que se queda corriendo. */
function answering(hang?: number) {
  return (request: CsEngineRequest, reply: (message: CsEngineReply) => void) => {
    if (request.type === 'warm') {
      reply({ type: 'ready', id: request.id, warmMs: 5 });
      return;
    }
    if (request.type === 'playground') {
      reply({ type: 'ready', id: request.id });
      reply({ type: 'code', id: request.id, index: -1 });
      if (hang === -1) return;
      reply({
        type: 'playground',
        id: request.id,
        outcome: { compiled: true, compileMs: 3, diagnostics: [], console: 'Hola\n', ms: 2 },
      });
      reply({ type: 'done', id: request.id });
      return;
    }
    reply({ type: 'ready', id: request.id });
    reply({ type: 'compiled', id: request.id, outcome: compiled });
    if (request.type !== 'cases') return;
    for (const item of request.request.cases) {
      reply({ type: 'code', id: request.id, index: item.index });
      if (item.index === hang) return;
      reply({ type: 'case', id: request.id, outcome: outcome(item.index) });
    }
    reply({ type: 'done', id: request.id });
  };
}

function engineWith(respond: ReturnType<typeof answering>, timeoutMs?: number) {
  const workers: FakeWorker[] = [];
  const engine = new CsharpEngine({
    worker: 'w.js',
    assets: '/csharp/',
    ...(timeoutMs ? { timeoutMs } : {}),
    createWorker: () => {
      const worker = new FakeWorker(respond);
      workers.push(worker);
      return worker;
    },
  });
  return { engine, workers };
}

describe('CsharpEngine', () => {
  it('compila una vez, corre los casos pedidos en orden y avisa el avance', async () => {
    const { engine, workers } = engineWith(answering());
    const phases: string[] = [];
    const run = await engine.runCases(challenge, [0, 2], 'code', (phase, position) =>
      phases.push(`${phase}:${position}`),
    );
    expect(run.compile).toEqual(compiled);
    expect(run.results.map((result) => result.index)).toEqual([0, 2]);
    expect(phases).toEqual(['loading:0', 'running:0', 'running:1']);
    const request = workers[0]?.requests[0];
    expect(request?.type).toBe('cases');
    if (request?.type === 'cases') {
      expect(request.assets).toBe('/csharp/');
      expect(request.request.cases.map((item) => item.index)).toEqual([0, 2]);
    }
  });

  it('si un caso pasa del tiempo límite, lo marca, termina el worker y el siguiente pedido crea otro', async () => {
    const { engine, workers } = engineWith(answering(1), 30);
    const run = await engine.runCases(challenge, [0, 1, 2], 'while (true) { }');
    expect(run.results).toEqual([
      { index: 0, outcome: outcome(0) },
      { index: 1, timedOut: true },
    ]);
    expect(workers[0]?.terminated).toBe(true);
    const again = await engine.runCases(challenge, [2], 'code');
    expect(again.results).toEqual([{ index: 2, outcome: outcome(2) }]);
    expect(workers).toHaveLength(2);
  });

  it('el playground devuelve lo que escribió el programa', async () => {
    const { engine } = engineWith(answering());
    const run = await engine.runPlayground('Console.WriteLine("Hola");');
    expect('outcome' in run && run.outcome.console).toBe('Hola\n');
  });

  it('un programa que no termina en el playground da timedOut', async () => {
    const { engine, workers } = engineWith(answering(-1), 30);
    const run = await engine.runPlayground('while (true) { }');
    expect(run).toEqual({ timedOut: true });
    expect(workers[0]?.terminated).toBe(true);
  });

  it('un error del motor rechaza la ejecución con EngineError', async () => {
    const { engine } = engineWith((request, reply) => {
      reply({ type: 'error', id: request.id, message: 'no cargó .NET' });
    });
    let error: unknown;
    try {
      await engine.runCases(challenge, [0], 'code');
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof EngineError).toBe(true);
    expect(error instanceof Error ? error.message : '').toContain('no cargó .NET');
  });
});
