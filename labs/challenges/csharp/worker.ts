// El worker del motor de C# (assets/js/labs/challenges-csharp-worker.js). Carga .NET y Roslyn una
// vez desde assets/labs/csharp/ (lo publica `npm run csharp`) y compila y corre ahí el código del
// visitante. Solo ve lo que le manda la página: no tiene acceso al DOM, y si el código se cuelga, la
// página lo termina (engine.ts).

import { gunzip } from '../gzip';
import type {
  CsCaseOutcome,
  CsCompileOutcome,
  CsEngineReply,
  CsEngineRequest,
  CsPlaygroundOutcome,
  CsProgramCompile,
  CsRunOutcome,
} from './protocol';

interface WorkerScope {
  postMessage(message: CsEngineReply): void;
  onmessage: ((event: MessageEvent<CsEngineRequest>) => void) | null;
  readonly location: { readonly href: string };
}

/** Lo que se usa de dotnet.js. */
type ResourceLoader = (
  type: string,
  name: string,
  defaultUri: string,
  integrity: string,
  behavior: string,
) => string | Promise<Response> | null | undefined;

interface DotnetBuilder {
  withResourceLoader(loader: ResourceLoader): DotnetBuilder;
  create(): Promise<DotnetRuntime>;
}

interface DotnetRuntime {
  setModuleImports(name: string, imports: Record<string, unknown>): void;
  getAssemblyExports(name: string): Promise<unknown>;
  getConfig(): { readonly mainAssemblyName?: string };
}

/** Los métodos de Exports.cs. */
interface EngineExports {
  Warm(): number;
  RunCases(request: string): Promise<void>;
  RunPlayground(code: string): Promise<string>;
  RunProgram(request: string): Promise<void>;
}

const scope = self as unknown as WorkerScope;
let engine: { readonly assets: string; readonly exports: Promise<EngineExports> } | undefined;
let warmMs: number | undefined;
/** La petición que se está atendiendo, para marcar lo que reporta el motor. */
let active = 0;
let queue: Promise<void> = Promise.resolve();

/**
 * Los archivos de .NET van comprimidos con gzip (ver scripts/csharp-engine.mjs). Los módulos de
 * JavaScript se dejan a dotnet.js, que los importa; lo demás (los ensamblados y el runtime en
 * WebAssembly) se descarga aquí y se descomprime.
 */
const loader: ResourceLoader = (type, _name, defaultUri) => {
  if (type === 'dotnetjs' || type.startsWith('js-module')) return undefined;
  return compressed(
    defaultUri,
    type === 'dotnetwasm' ? 'application/wasm' : 'application/octet-stream',
  );
};

async function compressed(uri: string, contentType: string): Promise<Response> {
  const url = new URL(uri, scope.location.href);
  const gz = new URL(url);
  gz.pathname += '.gz';
  let response = await fetch(gz);
  if (!response.ok) response = await fetch(url);
  if (!response.ok) return response;
  const bytes = await gunzip(await response.arrayBuffer());
  return new Response(bytes, { headers: { 'Content-Type': contentType } });
}

/** Lo que reporta Exports.cs mientras corre: se pasa a la página con el número de la petición. */
function report(kind: string, index: number, payload: string): void {
  const id = active;
  if (kind === 'compiled') {
    scope.postMessage({ type: 'compiled', id, outcome: JSON.parse(payload) as CsCompileOutcome });
  } else if (kind === 'code') {
    scope.postMessage({ type: 'code', id, index });
  } else if (kind === 'case') {
    scope.postMessage({ type: 'case', id, outcome: JSON.parse(payload) as CsCaseOutcome });
  } else if (kind === 'program') {
    scope.postMessage({ type: 'program', id, outcome: JSON.parse(payload) as CsProgramCompile });
  } else if (kind === 'run') {
    scope.postMessage({ type: 'run', id, outcome: JSON.parse(payload) as CsRunOutcome });
  }
}

async function load(assets: string): Promise<EngineExports> {
  const base = new URL(assets, scope.location.href);
  const url = new URL('dotnet.js', base).href;
  const { dotnet } = (await import(/* @vite-ignore */ url)) as { dotnet: DotnetBuilder };
  const runtime = await dotnet.withResourceLoader(loader).create();
  runtime.setModuleImports('challenges', { report });
  const name = runtime.getConfig().mainAssemblyName ?? 'Challenges.Engine.dll';
  const exports = (await runtime.getAssemblyExports(name)) as {
    readonly Challenges: { readonly Engine: { readonly Exports: EngineExports } };
  };
  const engineExports = exports.Challenges.Engine.Exports;
  try {
    warmMs = engineExports.Warm();
  } catch {
    // Calentar es opcional: si falla, solo tarda un poco más la primera ejecución.
  }
  return engineExports;
}

async function handle(request: CsEngineRequest): Promise<void> {
  const { id } = request;
  active = id;
  const post = (reply: CsEngineReply) => scope.postMessage(reply);
  try {
    if (engine?.assets !== request.assets) {
      engine = { assets: request.assets, exports: load(request.assets) };
    }
    const current = engine;
    const exports = await current.exports.catch((error: unknown) => {
      if (engine === current) engine = undefined;
      throw error;
    });
    post({ type: 'ready', id, ...(warmMs === undefined ? {} : { warmMs }) });
    if (request.type === 'cases') {
      await exports.RunCases(JSON.stringify(request.request));
    } else if (request.type === 'program') {
      await exports.RunProgram(JSON.stringify(request.request));
    } else if (request.type === 'playground') {
      const outcome = JSON.parse(
        await exports.RunPlayground(request.source),
      ) as CsPlaygroundOutcome;
      post({ type: 'playground', id, outcome });
    }
    post({ type: 'done', id });
  } catch (error) {
    post({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
  }
}

scope.onmessage = (event) => {
  const request = event.data;
  queue = queue.then(() => handle(request));
};
