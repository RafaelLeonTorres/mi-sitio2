// La API simulada. Cada petición pasa por el pipeline de middleware en el orden que recomienda
// la documentación de ASP.NET Core: manejo de excepciones, registro, enrutamiento, límite de
// peticiones, autenticación y autorización; después la validación (un filtro del endpoint), el
// endpoint, el servicio y el repositorio. La respuesta viene con el recorrido paso a paso, el
// registro que dejaría ILogger y los campos que ignoró el DTO.

import {
  REASON,
  headerValue,
  parseTarget,
  type ApiRequest,
  type ApiResponse,
  type Header,
  type Method,
} from './http';
import { sign, verify, type Claims, type Verified } from './jwt';
import { PROBLEM_JSON, problem, validationProblem, type ProblemContext } from './problem';
import { fixedWindow } from './rate-limit';
import { createStore, type Product, type Seed, type Store } from './store';
import {
  fill,
  parseObject,
  readListQuery,
  readProduct,
  readTokenRequest,
  type Errors,
  type Role,
  type ValidationMessages,
} from './validation';

export const ORIGIN = 'https://tienda.example';
export const ISSUER = 'https://tienda.example';
export const AUDIENCE = 'tienda-api';
export const TOKEN_SECONDS = 5 * 60;
export const RATE_LIMIT = { permits: 10, windowSeconds: 10 } as const;

export type OperationId = 'token' | 'list' | 'get' | 'create' | 'update' | 'delete';

export interface Operation {
  readonly id: OperationId;
  readonly method: Method;
  readonly template: string;
  /** Los roles que pueden usarla, o `null` si no pide token. */
  readonly roles: readonly Role[] | null;
}

export const OPERATIONS: readonly Operation[] = [
  { id: 'token', method: 'POST', template: '/api/auth/token', roles: null },
  { id: 'list', method: 'GET', template: '/api/products', roles: null },
  { id: 'get', method: 'GET', template: '/api/products/{id:int}', roles: null },
  { id: 'create', method: 'POST', template: '/api/products', roles: ['Editor', 'Admin'] },
  { id: 'update', method: 'PUT', template: '/api/products/{id:int}', roles: ['Editor', 'Admin'] },
  { id: 'delete', method: 'DELETE', template: '/api/products/{id:int}', roles: ['Admin'] },
];

export const STEPS = [
  'exceptions',
  'logging',
  'routing',
  'rateLimit',
  'authentication',
  'authorization',
  'validation',
  'endpoint',
  'service',
  'repository',
] as const;
export type StepId = (typeof STEPS)[number];

/** passed: siguió; stopped: respondió desde ahí; failed: lanzó una excepción; handled: la convirtió en 500. */
export type Outcome = 'passed' | 'stopped' | 'failed' | 'handled' | 'skipped';

export interface Step {
  readonly id: StepId;
  readonly outcome: Outcome;
  /** Qué pasó, como clave: la página la cuenta en su idioma (`anonymous`, `forbidden`…). */
  readonly note: string;
  /** El dato de la nota, si tiene: un rol, unos campos, unos segundos. */
  readonly value?: string;
  readonly status?: number;
  /** Tiempo simulado en milisegundos. */
  readonly ms: number;
}

export interface LogLine {
  readonly level: 'info' | 'warn' | 'fail';
  readonly category: string;
  readonly eventId: number;
  readonly message: string;
}

export interface Exchange {
  readonly request: ApiRequest;
  readonly response: ApiResponse;
  readonly steps: readonly Step[];
  readonly log: readonly LogLine[];
  /** El tiempo simulado en el servidor, en milisegundos. */
  readonly ms: number;
  readonly correlationId: string;
  readonly operation: OperationId | null;
  /** Campos del cuerpo que el DTO no tiene y la API ignoró. */
  readonly ignored: readonly string[];
}

/**
 * Lo que la API escribe con sus propias palabras, en el idioma de la página. Lo demás (los títulos
 * de Problem Details, el registro) sale en inglés, como lo escribe ASP.NET Core.
 */
export interface ApiMessages {
  readonly validation: ValidationMessages;
  readonly notFound: string;
  readonly skuTaken: string;
}

export interface ApiOptions {
  readonly seed: Seed;
  readonly messages: ApiMessages;
  readonly key: CryptoKey;
  /** El reloj, en milisegundos; las pruebas lo controlan. */
  readonly clock: () => number;
  /** Texto hexadecimal aleatorio para los ids; las pruebas dan una secuencia fija. */
  readonly randomHex?: (length: number) => string;
  /** Si el servicio debe fallar, para provocar un 500. */
  readonly failing?: () => boolean;
}

export interface Api {
  send(request: ApiRequest): Promise<Exchange>;
  /** Un token firmado para el rol, que vence en `expiresAt` (segundos); el botón Vencer lo usa. */
  issue(role: Role, expiresAt?: number): Promise<string>;
  /** Cómo valida la API un token en este momento; la barra del token lo usa para su estado. */
  inspect(token: string): Promise<Verified>;
  /** Vuelve al catálogo inicial. */
  reset(): void;
  readonly store: Store;
}

/** Lo que devuelve la API por cada producto: sin costo, versión, borrado ni auditoría. */
export interface ProductResponse {
  readonly id: number;
  readonly sku: string;
  readonly name: string;
  readonly price: number;
  readonly stock: number;
  readonly categoryId: number;
  readonly categoryName: string;
}

// Tiempo simulado de cada paso, en milisegundos.
const MS = {
  exceptions: 0.02,
  logging: 0.04,
  routing: 0.05,
  rateLimit: 0.02,
  anonymous: 0.01,
  token: 0.31,
  authorization: 0.03,
  body: 0.18,
  query: 0.06,
  nothing: 0.01,
  endpoint: 0.05,
  service: 0.07,
  sign: 0.42,
  find: 0.62,
  list: 1.1,
  perItem: 0.04,
  skuQuery: 0.48,
  insert: 2.35,
  update: 2.1,
  remove: 1.85,
} as const;

const JSON_TYPE = 'application/json; charset=utf-8';

export function createApi(options: ApiOptions): Api {
  const { messages, key, clock } = options;
  const randomHex = options.randomHex ?? cryptoHex;
  const failing = options.failing ?? (() => false);
  const store = createStore(options.seed, clock);
  const limiter = fixedWindow(RATE_LIMIT.permits, RATE_LIMIT.windowSeconds * 1000);

  const issue = (role: Role, expiresAt?: number) => {
    const iat = Math.floor(clock() / 1000);
    const claims: Claims = {
      iss: ISSUER,
      aud: AUDIENCE,
      sub: `demo-${role.toLowerCase()}`,
      role,
      jti: randomHex(16),
      iat: expiresAt === undefined ? iat : Math.min(iat, expiresAt - TOKEN_SECONDS),
      exp: expiresAt ?? iat + TOKEN_SECONDS,
    };
    return sign(claims, key);
  };

  const inspect = (token: string) =>
    verify(token, key, { issuer: ISSUER, audience: AUDIENCE, now: Math.floor(clock() / 1000) });

  const toResponse = (product: Product): ProductResponse => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    stock: product.stock,
    categoryId: product.categoryId,
    categoryName: store.category(product.categoryId)?.name ?? '',
  });

  async function send(request: ApiRequest): Promise<Exchange> {
    const correlationId = randomHex(32);
    const { path, query } = parseTarget(request.url);
    const context: ProblemContext = {
      instance: `${request.method} ${path}`,
      traceId: `00-${correlationId}-${randomHex(16)}-00`,
    };
    const steps = new Map<StepId, Step>();
    const log: LogLine[] = [];
    let ignored: readonly string[] = [];
    let operation: Operation | undefined;

    const record = (id: StepId, step: Omit<Step, 'id'>) => steps.set(id, { id, ...step });
    const pass = (id: StepId, note: string, ms: number, value?: string) =>
      record(id, { outcome: 'passed', note, ms, ...(value === undefined ? {} : { value }) });
    const stop = (id: StepId, status: number, note: string, ms: number, value?: string) =>
      record(id, {
        outcome: 'stopped',
        note,
        status,
        ms,
        ...(value === undefined ? {} : { value }),
      });
    const write = (level: LogLine['level'], category: string, eventId: number, message: string) =>
      log.push({ level, category, eventId, message });

    const finish = (response: ApiResponse): Exchange => {
      const ordered = STEPS.map(
        (id) => steps.get(id) ?? { id, outcome: 'skipped' as const, note: 'skipped', ms: 0 },
      );
      const ms = round(ordered.reduce((total, step) => total + step.ms, 0));
      if (operation && steps.has('validation')) {
        write('info', ENDPOINTS, 1, `Executed endpoint '${endpointName(operation)}'`);
      }
      const type = headerValue(response.headers, 'Content-Type')?.replaceAll(' ', '+') ?? '-';
      write(
        'info',
        HOSTING,
        2,
        `Request finished HTTP/1.1 ${request.method} ${ORIGIN}${request.url} - ${response.status} - ${type} ${ms.toFixed(4)}ms`,
      );
      return {
        request,
        response: {
          ...response,
          headers: [...response.headers, ['X-Correlation-Id', correlationId]],
        },
        steps: ordered,
        log,
        ms,
        correlationId,
        operation: operation?.id ?? null,
        ignored,
      };
    };
    const fail = (status: number, detail?: string, extra: readonly Header[] = []) =>
      finish(problemResponse(problem(status, context, detail), extra));

    // Manejo de excepciones y registro: siempre pasan; el primero responde 500 si algo falla adentro.
    const contentType = headerValue(request.headers, 'Content-Type');
    const length = request.body === undefined ? '-' : new TextEncoder().encode(request.body).length;
    write(
      'info',
      HOSTING,
      1,
      `Request starting HTTP/1.1 ${request.method} ${ORIGIN}${request.url} - ${contentType ?? '-'} ${length}`,
    );
    pass('exceptions', 'watching', MS.exceptions);
    pass('logging', 'correlation', MS.logging, correlationId);

    // Enrutamiento: sin un endpoint que coincida (por ejemplo, un id que no es número) es 404.
    const match = route(request.method, path);
    if (!match) {
      stop('routing', 404, 'noRoute', MS.routing);
      return fail(404);
    }
    operation = match.operation;
    pass('routing', 'matched', MS.routing, `${operation.method} ${operation.template}`);

    // Límite de peticiones, antes de autenticar: cuenta todas, con o sin token.
    const lease = limiter.acquire(clock());
    if (!lease.acquired) {
      const seconds = String(lease.retryAfterSeconds);
      stop('rateLimit', 429, 'rejected', MS.rateLimit, seconds);
      write(
        'warn',
        'Microsoft.AspNetCore.RateLimiting.RateLimitingMiddleware',
        1,
        'Rate limiter rejected the request.',
      );
      // Sin cuerpo propio: UseStatusCodePages lo vuelve Problem Details.
      return fail(429, undefined, [['Retry-After', seconds]]);
    }
    pass('rateLimit', 'remaining', MS.rateLimit, String(lease.remaining));

    // Autenticación: un token inválido no corta la petición; solo la deja como anónima.
    const authorization = headerValue(request.headers, 'Authorization');
    let user: Claims | null = null;
    let failure: Extract<Verified, { ok: false }> | null = null;
    if (authorization === undefined || authorization.trim() === '') {
      pass('authentication', 'anonymous', MS.anonymous);
    } else {
      const token = /^Bearer\s+(\S+)$/i.exec(authorization.trim())?.[1];
      const verified: Verified = token ? await inspect(token) : { ok: false, reason: 'malformed' };
      if (verified.ok) {
        user = verified.claims;
        pass('authentication', 'authenticated', MS.token, user.role);
      } else {
        failure = verified;
        pass('authentication', 'invalid', MS.token, verified.reason);
        write('info', JWT_HANDLER, 1, 'Failed to validate the token.');
      }
    }

    // Autorización: sin usuario es 401 (con la razón en WWW-Authenticate); sin el rol, 403.
    if (operation.roles === null) {
      pass('authorization', 'public', MS.authorization);
    } else if (!user) {
      stop(
        'authorization',
        401,
        failure ? 'invalidToken' : 'noToken',
        MS.authorization,
        failure?.reason,
      );
      write('info', JWT_HANDLER, 12, 'AuthenticationScheme: Bearer was challenged.');
      return fail(401, undefined, [['WWW-Authenticate', challenge(failure)]]);
    } else if (!operation.roles.includes(user.role)) {
      const roles = operation.roles.join(', ');
      stop('authorization', 403, 'forbidden', MS.authorization, roles);
      write(
        'info',
        'Microsoft.AspNetCore.Authorization.DefaultAuthorizationService',
        2,
        `Authorization failed. These requirements were not met: RolesAuthorizationRequirement:User.IsInRole must be true for one of the following roles: (${operation.roles.join('|')})`,
      );
      write('info', JWT_HANDLER, 13, 'AuthenticationScheme: Bearer was forbidden.');
      return fail(403);
    } else {
      pass('authorization', 'allowed', MS.authorization, user.role);
    }

    // Validación: el filtro corre al ejecutar el endpoint, antes del código del endpoint.
    write('info', ENDPOINTS, 0, `Executing endpoint '${endpointName(operation)}'`);
    const input = validate(operation.id, request.body, query);
    if (input.kind === 'invalidJson') {
      // Como en Minimal APIs: un 400 sin detalle, que UseStatusCodePages vuelve Problem Details.
      stop('validation', 400, 'invalidJson', MS.body);
      return fail(400);
    }
    if (input.kind === 'invalid') {
      ignored = input.ignored;
      stop('validation', 400, 'invalid', input.ms, Object.keys(input.errors).join(', '));
      return finish(problemResponse(validationProblem(input.errors, context)));
    }
    ignored = input.ignored;
    pass('validation', input.kind === 'none' ? 'nothing' : 'valid', input.ms);

    // Endpoint: convierte el DTO en lo que pide el servicio.
    pass('endpoint', ignored.length > 0 ? 'ignored' : 'mapped', MS.endpoint, ignored.join(', '));

    // Servicio: la falla simulada sale de aquí y la convierte en 500 el primer paso.
    if (failing()) {
      record('service', { outcome: 'failed', note: 'exception', ms: MS.service });
      record('exceptions', { outcome: 'handled', note: 'handled', status: 500, ms: MS.exceptions });
      write(
        'fail',
        'Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware',
        1,
        'An unhandled exception has occurred while executing the request.\nSystem.InvalidOperationException: Simulated failure in ProductService.',
      );
      return fail(500);
    }

    const id = match.id;
    const editor = user?.sub ?? 'anonymous';
    switch (operation.id) {
      case 'token': {
        const role = input.kind === 'token' ? input.value.role : 'Reader';
        const accessToken = await issue(role);
        pass('service', 'issued', MS.sign, role);
        record('repository', { outcome: 'skipped', note: 'unused', ms: 0 });
        write(
          'info',
          'Store.Api.Auth.TokenService',
          1,
          `Issued a ${TOKEN_SECONDS}-second token for the ${role} role.`,
        );
        return finish(
          json(200, { accessToken, tokenType: 'Bearer', expiresIn: TOKEN_SECONDS }, [
            ['Cache-Control', 'no-store'],
          ]),
        );
      }
      case 'list': {
        const { page, pageSize, search } =
          input.kind === 'list' ? input.value : { page: 1, pageSize: 10, search: '' };
        const result = store.list(page, pageSize, search);
        pass(
          'repository',
          'listed',
          round(MS.list + MS.perItem * result.items.length),
          String(result.items.length),
        );
        pass('service', 'listed', MS.service, String(result.total));
        return finish(
          json(200, {
            items: result.items.map(toResponse),
            page,
            pageSize,
            totalCount: result.total,
            totalPages: Math.ceil(result.total / pageSize),
          }),
        );
      }
      case 'get': {
        const product = store.find(id);
        pass('repository', product ? 'found' : 'missing', MS.find, String(id));
        if (!product) {
          stop('service', 404, 'notFound', MS.service, String(id));
          return fail(404, fill(messages.notFound, { value: id }));
        }
        pass('service', 'found', MS.service, String(id));
        return finish(json(200, toResponse(product)));
      }
      case 'create': {
        const data = input.kind === 'product' ? input.value : undefined;
        if (!data) break;
        if (store.skuTaken(data.sku)) {
          pass('repository', 'skuQuery', MS.skuQuery, data.sku);
          stop('service', 409, 'skuTaken', MS.service, data.sku);
          return fail(409, fill(messages.skuTaken, { value: data.sku }));
        }
        const product = store.create(data, editor);
        pass('repository', 'inserted', round(MS.skuQuery + MS.insert), String(product.id));
        pass('service', 'created', MS.service, String(product.id));
        write(
          'info',
          SERVICE,
          1,
          `Product ${product.id} created with SKU ${product.sku} by ${editor}.`,
        );
        return finish(
          json(201, toResponse(product), [['Location', `/api/products/${product.id}`]]),
        );
      }
      case 'update': {
        const data = input.kind === 'product' ? input.value : undefined;
        if (!data) break;
        if (!store.find(id)) {
          pass('repository', 'missing', MS.find, String(id));
          stop('service', 404, 'notFound', MS.service, String(id));
          return fail(404, fill(messages.notFound, { value: id }));
        }
        if (store.skuTaken(data.sku, id)) {
          pass('repository', 'skuQuery', round(MS.find + MS.skuQuery), data.sku);
          stop('service', 409, 'skuTaken', MS.service, data.sku);
          return fail(409, fill(messages.skuTaken, { value: data.sku }));
        }
        store.update(id, data, editor);
        pass('repository', 'updated', round(MS.find + MS.skuQuery + MS.update), String(id));
        pass('service', 'updated', MS.service, String(id));
        write('info', SERVICE, 2, `Product ${id} updated by ${editor}.`);
        return finish(empty(204));
      }
      case 'delete': {
        if (!store.remove(id, editor)) {
          pass('repository', 'missing', MS.find, String(id));
          stop('service', 404, 'notFound', MS.service, String(id));
          return fail(404, fill(messages.notFound, { value: id }));
        }
        pass('repository', 'deleted', round(MS.find + MS.remove), String(id));
        pass('service', 'deleted', MS.service, String(id));
        write('info', SERVICE, 3, `Product ${id} deleted (soft delete) by ${editor}.`);
        return finish(empty(204));
      }
    }
    throw new Error(`Operación sin manejar: ${operation.id}`);
  }

  type Input =
    | { kind: 'none'; ignored: readonly string[]; ms: number }
    | { kind: 'invalidJson' }
    | { kind: 'invalid'; errors: Errors; ignored: readonly string[]; ms: number }
    | { kind: 'token'; value: { role: Role }; ignored: readonly string[]; ms: number }
    | {
        kind: 'list';
        value: { page: number; pageSize: number; search: string };
        ignored: readonly string[];
        ms: number;
      }
    | {
        kind: 'product';
        value: Parameters<Store['create']>[0];
        ignored: readonly string[];
        ms: number;
      };

  function validate(id: OperationId, body: string | undefined, query: URLSearchParams): Input {
    if (id === 'get' || id === 'delete') return { kind: 'none', ignored: [], ms: MS.nothing };
    if (id === 'list') {
      const read = readListQuery(query, messages.validation);
      return hasErrors(read.errors)
        ? { kind: 'invalid', errors: read.errors, ignored: [], ms: MS.query }
        : { kind: 'list', value: read.value, ignored: [], ms: MS.query };
    }
    const object = parseObject(body);
    if (!object) return { kind: 'invalidJson' };
    if (id === 'token') {
      const read = readTokenRequest(object, messages.validation);
      return hasErrors(read.errors)
        ? { kind: 'invalid', errors: read.errors, ignored: read.ignored, ms: MS.body }
        : { kind: 'token', value: read.value, ignored: read.ignored, ms: MS.body };
    }
    const read = readProduct(
      object,
      (category) => store.category(category) !== undefined,
      messages.validation,
    );
    return hasErrors(read.errors)
      ? { kind: 'invalid', errors: read.errors, ignored: read.ignored, ms: MS.body }
      : { kind: 'product', value: read.value, ignored: read.ignored, ms: MS.body };
  }

  return { send, issue, inspect, reset: () => store.reset(), store };
}

const HOSTING = 'Microsoft.AspNetCore.Hosting.Diagnostics';
const ENDPOINTS = 'Microsoft.AspNetCore.Routing.EndpointMiddleware';
const JWT_HANDLER = 'Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerHandler';
const SERVICE = 'Store.Api.Products.ProductService';

/** La operación y el id de la ruta, o `null` si ningún endpoint coincide. */
export function route(method: Method, path: string): { operation: Operation; id: number } | null {
  const segments = path.split('/').filter(Boolean);
  for (const operation of OPERATIONS) {
    if (operation.method !== method) continue;
    const pattern = operation.template.split('/').filter(Boolean);
    if (pattern.length !== segments.length) continue;
    let id = 0;
    const matches = pattern.every((part, index) => {
      const segment = segments[index] ?? '';
      if (part !== '{id:int}') return part.toLowerCase() === segment.toLowerCase();
      // La restricción :int de ASP.NET Core: un entero de 32 bits.
      if (!/^-?\d+$/.test(segment)) return false;
      id = Number(segment);
      return id >= -2147483648 && id <= 2147483647;
    });
    if (matches) return { operation, id };
  }
  return null;
}

function endpointName(operation: Operation): string {
  return `HTTP: ${operation.method} ${operation.template}`;
}

/** `WWW-Authenticate` como lo escribe JwtBearer: con la razón si el token no sirvió. */
function challenge(failure: Extract<Verified, { ok: false }> | null): string {
  if (!failure) return 'Bearer';
  return failure.description
    ? `Bearer error="invalid_token", error_description="${failure.description}"`
    : 'Bearer error="invalid_token"';
}

function problemResponse(
  body: ReturnType<typeof problem>,
  extra: readonly Header[] = [],
): ApiResponse {
  return {
    status: body.status,
    headers: [['Content-Type', `${PROBLEM_JSON}; charset=utf-8`], ...extra],
    body,
  };
}

function json(status: number, body: unknown, extra: readonly Header[] = []): ApiResponse {
  return { status, headers: [['Content-Type', JSON_TYPE], ...extra], body };
}

function empty(status: number): ApiResponse {
  return { status, headers: [], body: null };
}

function hasErrors(errors: Errors): boolean {
  return Object.keys(errors).length > 0;
}

function round(ms: number): number {
  return Math.round(ms * 100) / 100;
}

function cryptoHex(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/** La línea de estado: `201 Created`. */
export function statusLine(status: number): string {
  return `${status} ${REASON[status] ?? ''}`.trim();
}
