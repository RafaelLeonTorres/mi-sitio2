// El worker del motor de SQL (assets/js/labs/challenges-worker.js). Carga PGlite una vez, con sus
// archivos de assets/labs/pglite/ (los copia scripts/build-labs.mjs), y corre cada caso en una base
// nueva. Solo ve lo que le manda la
// página: no tiene acceso al DOM, y si se cuelga la página lo termina (engine.ts).

import { PGlite } from '@electric-sql/pglite';
import { pgliteOpener, type CreatePGlite } from './pglite';
import { runPlayground } from './playground';
import type { EngineReply, EngineRequest } from './protocol';
import { runCase, type OpenDatabase } from './runner';

interface WorkerScope {
  postMessage(message: EngineReply): void;
  onmessage: ((event: MessageEvent<EngineRequest>) => void) | null;
  readonly location: { readonly href: string };
}

const scope = self as unknown as WorkerScope;
let engine: { readonly assets: string; readonly open: Promise<OpenDatabase> } | undefined;

/**
 * Descarga un archivo de PGlite. Van comprimidos con gzip (GitHub Pages no comprime .wasm ni .data):
 * si el servidor no los descomprimió, se descomprimen aquí.
 */
async function download(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const bytes = await response.arrayBuffer();
  const view = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (view[0] !== 0x1f || view[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/** PGlite con sus archivos y la plantilla lista: la primera base ya se abrió y se cerró. */
async function load(assets: string): Promise<OpenDatabase> {
  const base = new URL(assets, scope.location.href);
  const file = (name: string) => new URL(name, base).href;
  const [pglite, initdb, data] = await Promise.all(
    ['pglite.wasm.gz', 'initdb.wasm.gz', 'pglite.data.gz'].map((name) => download(file(name))),
  );
  if (!pglite || !initdb || !data) throw new Error('Faltan archivos de PGlite.');
  const [pgliteWasmModule, initdbWasmModule] = await Promise.all([
    WebAssembly.compile(pglite),
    WebAssembly.compile(initdb),
  ]);
  const fsBundle = new Blob([data]);
  const create = ((options) =>
    PGlite.create({ ...options, pgliteWasmModule, initdbWasmModule, fsBundle })) as CreatePGlite;
  const open = pgliteOpener(create);
  await (await open()).close();
  return open;
}

async function handle(request: EngineRequest): Promise<void> {
  const { id } = request;
  const post = (reply: EngineReply) => scope.postMessage(reply);
  try {
    if (engine?.assets !== request.assets) {
      engine = { assets: request.assets, open: load(request.assets) };
    }
    const current = engine;
    const open = await current.open.catch((error: unknown) => {
      if (engine === current) engine = undefined;
      throw error;
    });
    post({ type: 'ready', id });
    if (request.type === 'cases') {
      for (const index of request.indexes) {
        const outcome = await runCase(
          open,
          request.challenge,
          request.dataset,
          index,
          request.source,
          {
            onCode: () => post({ type: 'code', id, index }),
          },
        );
        post({ type: 'case', id, outcome });
      }
    } else if (request.type === 'playground') {
      const outcome = await runPlayground(open, request.dataset, request.source, {
        explain: request.explain,
        generate: request.generate,
        onCode: () => post({ type: 'code', id, index: -1 }),
      });
      post({ type: 'playground', id, outcome });
    }
    post({ type: 'done', id });
  } catch (error) {
    post({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
  }
}

// Las peticiones llegan de una en una: la página espera cada respuesta antes de mandar otra.
let queue = Promise.resolve();
scope.onmessage = (event) => {
  queue = queue.then(() => handle(event.data));
};
