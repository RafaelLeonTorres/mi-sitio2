import { describe, expect, it } from 'vitest';
import { createApi, route, type Api, type Exchange, type StepId } from './api';
import { MESSAGES, SEED, sequentialHex } from './fixtures';
import { headerValue, type ApiRequest } from './http';
import { createKey, withPayload, decode } from './jwt';
import type { Role } from './validation';

const START = Date.UTC(2026, 10, 18, 21, 0, 0);

interface Harness {
  api: Api;
  /** Avanza el reloj de la API. */
  wait(ms: number): void;
  fail(on: boolean): void;
  token(role: Role): Promise<string>;
  send(
    method: ApiRequest['method'],
    url: string,
    options?: { token?: string; body?: unknown },
  ): Promise<Exchange>;
}

async function harness(): Promise<Harness> {
  let now = START;
  let failing = false;
  const api = createApi({
    seed: SEED,
    messages: MESSAGES,
    key: await createKey(new Uint8Array(32).fill(3)),
    clock: () => now,
    randomHex: sequentialHex(),
    failing: () => failing,
  });
  const send: Harness['send'] = (method, url, options = {}) => {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
    return api.send({
      method,
      url,
      headers,
      ...(options.body === undefined
        ? {}
        : { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) }),
    });
  };
  return {
    api,
    wait: (ms) => (now += ms),
    fail: (on) => (failing = on),
    token: (role) => api.issue(role),
    send,
  };
}

const NEW = { name: 'Webcam HD', sku: 'CAM-4001', price: 999, stock: 5, categoryId: 3 };
const outcome = (exchange: Exchange, id: StepId) => exchange.steps.find((step) => step.id === id);
const header = (exchange: Exchange, name: string) => headerValue(exchange.response.headers, name);

describe('route', () => {
  it('encuentra la operación y el id, y respeta la restricción :int', () => {
    expect(route('GET', '/api/products/7')?.operation.id).toBe('get');
    expect(route('GET', '/api/products/7')?.id).toBe(7);
    expect(route('DELETE', '/api/products/7')?.operation.id).toBe('delete');
    expect(route('GET', '/api/products/abc')).toBeNull();
    expect(route('GET', '/api/products/99999999999')).toBeNull();
  });
});

describe('createApi', () => {
  it('200: lista una página con sus metadatos y sin datos internos', async () => {
    const { send } = await harness();
    const exchange = await send('GET', '/api/products?page=1&pageSize=2');
    expect(exchange.response.status).toBe(200);
    expect(exchange.response.body).toEqual({
      items: [
        {
          id: 1,
          sku: 'KBD-1001',
          name: 'Mechanical keyboard',
          price: 1299,
          stock: 24,
          categoryId: 1,
          categoryName: 'Keyboards',
        },
        {
          id: 2,
          sku: 'KBD-1002',
          name: 'Low-profile keyboard',
          price: 899,
          stock: 0,
          categoryId: 1,
          categoryName: 'Keyboards',
        },
      ],
      page: 1,
      pageSize: 2,
      totalCount: 5,
      totalPages: 3,
    });
    expect(exchange.steps.map((step) => step.outcome)).toEqual([
      'passed',
      'passed',
      'passed',
      'passed',
      'passed',
      'passed',
      'passed',
      'passed',
      'passed',
      'passed',
    ]);
    expect(header(exchange, 'X-Correlation-Id')).toBe(exchange.correlationId);
  });

  it('200: el endpoint del token emite un JWT del rol pedido que vence en 5 minutos', async () => {
    const { send } = await harness();
    const exchange = await send('POST', '/api/auth/token', { body: { role: 'Editor' } });
    expect(exchange.response.status).toBe(200);
    expect(header(exchange, 'Cache-Control')).toBe('no-store');
    const body = exchange.response.body as {
      accessToken: string;
      tokenType: string;
      expiresIn: number;
    };
    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBe(300);
    const payload = decode(body.accessToken)?.payload as { role: string; exp: number; iat: number };
    expect(payload.role).toBe('Editor');
    expect(payload.exp - payload.iat).toBe(300);
    expect(outcome(exchange, 'repository')?.note).toBe('unused');
  });

  it('201: crea con Location y avisa los campos que ignoró el DTO', async () => {
    const h = await harness();
    const exchange = await h.send('POST', '/api/products', {
      token: await h.token('Editor'),
      body: { ...NEW, id: 99, costPrice: 1 },
    });
    expect(exchange.response.status).toBe(201);
    expect(header(exchange, 'Location')).toBe('/api/products/6');
    expect((exchange.response.body as { id: number }).id).toBe(6);
    expect(exchange.ignored).toEqual(['id', 'costPrice']);
    expect(outcome(exchange, 'endpoint')?.note).toBe('ignored');
    expect(h.api.store.find(6)?.createdBy).toBe('demo-editor');
  });

  it('204: actualiza y borra sin cuerpo; después el producto ya no existe', async () => {
    const h = await harness();
    const admin = await h.token('Admin');
    const updated = await h.send('PUT', '/api/products/1', {
      token: admin,
      body: { ...NEW, sku: 'KBD-1001' },
    });
    expect(updated.response.status).toBe(204);
    expect(updated.response.body).toBeNull();
    expect((await h.send('DELETE', '/api/products/1', { token: admin })).response.status).toBe(204);
    expect((await h.send('GET', '/api/products/1')).response.status).toBe(404);
  });

  it('400: validación con errors por campo, en Problem Details', async () => {
    const h = await harness();
    const exchange = await h.send('POST', '/api/products', {
      token: await h.token('Editor'),
      body: { name: 'ab', sku: 'cam', price: 0, stock: 1, categoryId: 1 },
    });
    expect(exchange.response.status).toBe(400);
    expect(header(exchange, 'Content-Type')).toBe('application/problem+json; charset=utf-8');
    const { traceId, ...problem } = exchange.response.body as { traceId: string };
    expect(problem).toEqual({
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
      title: 'One or more validation errors occurred.',
      status: 400,
      instance: 'POST /api/products',
      errors: {
        name: ['Must have between 3 and 100 characters.'],
        sku: ['Must look like ABC-1234.'],
        price: ['Must be greater than 0.'],
      },
    });
    // El traceId W3C lleva el mismo id que el encabezado X-Correlation-Id.
    expect(new RegExp(`^00-${exchange.correlationId}-[0-9a-f]{16}-00$`).test(traceId)).toBe(true);
    expect(outcome(exchange, 'validation')).toEqual({
      id: 'validation',
      outcome: 'stopped',
      note: 'invalid',
      status: 400,
      ms: 0.18,
      value: 'name, sku, price',
    });
    expect(outcome(exchange, 'endpoint')?.outcome).toBe('skipped');
  });

  it('400: un cuerpo que no es JSON y un pageSize mayor que 50', async () => {
    const h = await harness();
    const broken = await h.send('POST', '/api/auth/token', { body: '{"role": ' });
    expect(broken.response.status).toBe(400);
    expect((broken.response.body as { title: string }).title).toBe('Bad Request');
    expect(outcome(broken, 'validation')?.note).toBe('invalidJson');
    const big = await h.send('GET', '/api/products?pageSize=51');
    expect((big.response.body as { errors: unknown }).errors).toEqual({
      pageSize: ['Must be between 1 and 50.'],
    });
  });

  it('401: sin token, con el desafío Bearer', async () => {
    const { send } = await harness();
    const exchange = await send('POST', '/api/products', { body: NEW });
    expect(exchange.response.status).toBe(401);
    expect(header(exchange, 'WWW-Authenticate')).toBe('Bearer');
    expect(outcome(exchange, 'authorization')?.note).toBe('noToken');
    expect(outcome(exchange, 'validation')?.outcome).toBe('skipped');
  });

  it('401: un token vencido o alterado dice por qué en WWW-Authenticate', async () => {
    const h = await harness();
    const editor = await h.token('Editor');
    h.wait(5 * 60 * 1000);
    const expired = await h.send('POST', '/api/products', { token: editor, body: NEW });
    expect(expired.response.status).toBe(401);
    expect(header(expired, 'WWW-Authenticate')).toBe(
      `Bearer error="invalid_token", error_description="The token expired at '11/18/2026 21:05:00'"`,
    );

    const reader = await h.token('Reader');
    const payload = decode(reader)?.payload as Record<string, unknown>;
    const tampered = withPayload(reader, { ...payload, role: 'Admin' });
    const altered = await h.send('DELETE', '/api/products/1', { token: tampered });
    expect(altered.response.status).toBe(401);
    expect(header(altered, 'WWW-Authenticate')).toBe(
      'Bearer error="invalid_token", error_description="The signature is invalid"',
    );
    expect(outcome(altered, 'authentication')).toEqual({
      id: 'authentication',
      outcome: 'passed',
      note: 'invalid',
      ms: 0.31,
      value: 'signature',
    });
  });

  it('inspect valida un token igual que la autenticación', async () => {
    const h = await harness();
    const token = await h.token('Editor');
    const checked = await h.api.inspect(token);
    expect(checked.ok && checked.claims.role).toBe('Editor');
    expect((await h.api.inspect(withPayload(token, { role: 'Admin' }))).ok).toBe(false);
    h.wait(5 * 60 * 1000);
    const expired = await h.api.inspect(token);
    expect(expired.ok ? '' : expired.reason).toBe('expired');
  });

  it('un token inválido en una operación pública solo deja la petición como anónima', async () => {
    const { send } = await harness();
    const exchange = await send('GET', '/api/products/1', { token: 'abc' });
    expect(exchange.response.status).toBe(200);
    expect(outcome(exchange, 'authentication')?.note).toBe('invalid');
    expect(outcome(exchange, 'authorization')?.note).toBe('public');
  });

  it('403: un Lector no puede crear y un Editor no puede borrar', async () => {
    const h = await harness();
    const reader = await h.send('POST', '/api/products', {
      token: await h.token('Reader'),
      body: NEW,
    });
    expect(reader.response.status).toBe(403);
    expect(outcome(reader, 'authorization')?.value).toBe('Editor, Admin');
    const editor = await h.send('DELETE', '/api/products/1', { token: await h.token('Editor') });
    expect(editor.response.status).toBe(403);
    expect(editor.log.some((line) => line.message.includes('(Admin)'))).toBe(true);
  });

  it('404: un id que no existe, y una ruta que no coincide con ningún endpoint', async () => {
    const { send } = await harness();
    const missing = await send('GET', '/api/products/42');
    expect(missing.response.status).toBe(404);
    expect((missing.response.body as { detail: string }).detail).toBe(
      'There is no product with id 42.',
    );
    expect(outcome(missing, 'service')?.outcome).toBe('stopped');
    const noRoute = await send('GET', '/api/products/abc');
    expect(noRoute.response.status).toBe(404);
    expect(noRoute.operation).toBeNull();
    expect(outcome(noRoute, 'routing')?.note).toBe('noRoute');
  });

  it('409: un SKU que ya usa otro producto', async () => {
    const h = await harness();
    const editor = await h.token('Editor');
    const created = await h.send('POST', '/api/products', {
      token: editor,
      body: { ...NEW, sku: 'KBD-1001' },
    });
    expect(created.response.status).toBe(409);
    expect((created.response.body as { title: string }).title).toBe('Conflict');
    const updated = await h.send('PUT', '/api/products/2', {
      token: editor,
      body: { ...NEW, sku: 'KBD-1001' },
    });
    expect(updated.response.status).toBe(409);
  });

  it('429: la petición 11 en 10 segundos espera, con Retry-After', async () => {
    const h = await harness();
    for (let i = 0; i < 10; i++) {
      expect((await h.send('GET', '/api/products')).response.status).toBe(200);
      h.wait(300);
    }
    const limited = await h.send('GET', '/api/products');
    expect(limited.response.status).toBe(429);
    expect(header(limited, 'Retry-After')).toBe('7');
    expect((limited.response.body as { title: string }).title).toBe('Too Many Requests');
    expect(outcome(limited, 'rateLimit')?.value).toBe('7');
    h.wait(8000);
    expect((await h.send('GET', '/api/products')).response.status).toBe(200);
  });

  it('500: la falla simulada sale del servicio y sin detalles internos', async () => {
    const h = await harness();
    h.fail(true);
    const exchange = await h.send('GET', '/api/products/1');
    expect(exchange.response.status).toBe(500);
    expect((exchange.response.body as { title: string }).title).toBe(
      'An error occurred while processing your request.',
    );
    expect(JSON.stringify(exchange.response.body)).not.toContain('Simulated');
    expect(outcome(exchange, 'service')?.outcome).toBe('failed');
    expect(outcome(exchange, 'exceptions')).toEqual({
      id: 'exceptions',
      outcome: 'handled',
      note: 'handled',
      status: 500,
      ms: 0.02,
    });
    expect(exchange.log.some((line) => line.level === 'fail')).toBe(true);
  });

  it('el registro empieza y termina con las líneas de Hosting, con el código y el tiempo', async () => {
    const { send } = await harness();
    const exchange = await send('GET', '/api/products/1');
    expect(exchange.log[0]?.message).toBe(
      'Request starting HTTP/1.1 GET https://tienda.example/api/products/1 - - -',
    );
    expect(exchange.log.at(-1)?.message).toBe(
      `Request finished HTTP/1.1 GET https://tienda.example/api/products/1 - 200 - application/json;+charset=utf-8 ${exchange.ms.toFixed(4)}ms`,
    );
  });

  it('Restablecer vuelve al catálogo inicial', async () => {
    const h = await harness();
    await h.send('DELETE', '/api/products/1', { token: await h.token('Admin') });
    h.api.reset();
    expect((await h.send('GET', '/api/products/1')).response.status).toBe(200);
  });
});
