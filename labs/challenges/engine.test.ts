import { describe, expect, it } from 'vitest';
import { EngineError, type WorkerLike } from '../shared/engine';
import { SqlEngine } from './engine';
import type { SqlChallenge } from './sql/data';
import type { EngineReply, EngineRequest } from './sql/protocol';
import type { CaseOutcome } from './sql/runner';

/** Un worker falso: responde lo que la prueba le diga a cada petición. */
class FakeWorker implements WorkerLike<EngineRequest, EngineReply> {
  onmessage: ((event: MessageEvent<EngineReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  readonly requests: EngineRequest[] = [];
  constructor(
    private readonly respond: (
      request: EngineRequest,
      reply: (message: EngineReply) => void,
    ) => void,
  ) {}
  postMessage(message: EngineRequest): void {
    this.requests.push(message);
    const reply = (data: EngineReply) =>
      setTimeout(() => this.onmessage?.({ data } as MessageEvent<EngineReply>), 0);
    this.respond(message, reply);
  }
  terminate(): void {
    this.terminated = true;
  }
}

const challenge = { cases: [{}, {}, {}] } as unknown as SqlChallenge;
const dataset = { tables: [], generators: [] };
const outcome = (index: number): CaseOutcome => ({ index, passed: true, notes: [] });

/** Responde cada caso con un resultado, salvo `hang`, que se queda corriendo. */
function answering(hang?: number) {
  return (request: EngineRequest, reply: (message: EngineReply) => void) => {
    if (request.type !== 'cases') return;
    reply({ type: 'ready', id: request.id });
    for (const index of request.indexes) {
      reply({ type: 'code', id: request.id, index });
      if (index === hang) return;
      reply({ type: 'case', id: request.id, outcome: outcome(index) });
    }
    reply({ type: 'done', id: request.id });
  };
}

describe('SqlEngine', () => {
  it('corre los casos en orden y avisa el avance', async () => {
    const workers: FakeWorker[] = [];
    const engine = new SqlEngine({
      worker: 'w.js',
      assets: '/pglite/',
      createWorker: () => {
        const worker = new FakeWorker(answering());
        workers.push(worker);
        return worker;
      },
    });
    const phases: string[] = [];
    const run = await engine.runCases(challenge, dataset, [0, 2], 'SELECT 1;', (phase, position) =>
      phases.push(`${phase}:${position}`),
    );
    expect(run.results.map((result) => result.index)).toEqual([0, 2]);
    expect(phases).toEqual(['loading:0', 'running:0', 'running:1']);
    expect(engine.loaded).toBe(true);
    expect(workers).toHaveLength(1);
    expect(workers[0]?.requests[0]).toEqual({
      type: 'cases',
      id: 1,
      assets: '/pglite/',
      challenge,
      dataset,
      indexes: [0, 2],
      source: 'SELECT 1;',
    });
  });

  it('si el código pasa del tiempo límite, termina el worker y el siguiente pedido crea otro', async () => {
    const workers: FakeWorker[] = [];
    const engine = new SqlEngine({
      worker: 'w.js',
      assets: '/pglite/',
      timeoutMs: 30,
      createWorker: () => {
        const worker = new FakeWorker(answering(workers.length === 0 ? 1 : undefined));
        workers.push(worker);
        return worker;
      },
    });
    const first = await engine.runCases(challenge, dataset, [0, 1, 2], 'x');
    expect(first.results).toEqual([
      { index: 0, outcome: outcome(0) },
      { index: 1, timedOut: true },
    ]);
    expect(workers[0]?.terminated).toBe(true);
    const second = await engine.runCases(challenge, dataset, [1], 'x');
    expect(second.results).toEqual([{ index: 1, outcome: outcome(1) }]);
    expect(workers).toHaveLength(2);
  });

  it('un error del motor rechaza la ejecución y deja el worker listo para recrearse', async () => {
    let created = 0;
    const engine = new SqlEngine({
      worker: 'w.js',
      assets: '/pglite/',
      createWorker: () => {
        created++;
        return new FakeWorker((request, reply) =>
          reply({ type: 'error', id: request.id, message: 'sin red' }),
        );
      },
    });
    let caught: unknown;
    await engine.runCases(challenge, dataset, [0], 'x').catch((error: unknown) => {
      caught = error;
    });
    expect(caught instanceof EngineError).toBe(true);
    expect((caught as Error).message).toBe('sin red');
    await engine.warm();
    expect(created).toBe(2);
  });

  it('las peticiones esperan su turno', async () => {
    const engine = new SqlEngine({
      worker: 'w.js',
      assets: '/',
      createWorker: () => new FakeWorker(answering()),
    });
    const [a, b] = await Promise.all([
      engine.runCases(challenge, dataset, [0], 'a'),
      engine.runCases(challenge, dataset, [1], 'b'),
    ]);
    expect(a.results[0]?.index).toBe(0);
    expect(b.results[0]?.index).toBe(1);
  });
});
