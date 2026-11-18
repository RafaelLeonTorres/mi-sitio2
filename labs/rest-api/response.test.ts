import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import source from '../../_data/labs/rest-api.yml?raw';
import { createApi, type Exchange } from './api';
import { MESSAGES, SEED, sequentialHex } from './fixtures';
import { createKey } from './jwt';
import type { Client } from './page';
import { answeringStep, deepestStep, headersText, logText, stepNote } from './response';

const client = (parse(source) as { es: { client: Client } }).es.client;
const roleName = (role: string) => (role === 'Reader' ? 'Lector' : role);

async function exchanges(): Promise<Record<string, Exchange>> {
  let failing = false;
  const api = createApi({
    seed: SEED,
    messages: MESSAGES,
    key: await createKey(new Uint8Array(32).fill(9)),
    clock: () => Date.UTC(2026, 10, 18, 21, 0, 0),
    randomHex: sequentialHex(),
    failing: () => failing,
  });
  const reader = await api.issue('Reader');
  const editor = await api.issue('Editor');
  const json = { Accept: 'application/json', 'Content-Type': 'application/json' };
  const product = { name: 'Webcam HD', sku: 'KBD-1001', price: 999, stock: 5, categoryId: 1 };
  const result = {
    noToken: await api.send({ method: 'POST', url: '/api/products', headers: json, body: '{}' }),
    reader: await api.send({
      method: 'DELETE',
      url: '/api/products/1',
      headers: { Authorization: `Bearer ${reader}` },
    }),
    taken: await api.send({
      method: 'POST',
      url: '/api/products',
      headers: { ...json, Authorization: `Bearer ${editor}` },
      body: JSON.stringify(product),
    }),
    tampered: await api.send({
      method: 'GET',
      url: '/api/products',
      headers: { Authorization: `Bearer ${editor.slice(0, -2)}xx` },
    }),
    list: await api.send({ method: 'GET', url: '/api/products', headers: {} }),
  };
  failing = true;
  return {
    ...result,
    failed: await api.send({ method: 'GET', url: '/api/products', headers: {} }),
  };
}

describe('respuesta', () => {
  it('ubica el paso que respondió y hasta dónde llegó la petición', async () => {
    const all = await exchanges();
    const at = (exchange: Exchange | undefined, index: number) => exchange?.steps[index]?.id;
    expect(at(all['noToken'], answeringStep(all['noToken']?.steps ?? []))).toBe('authorization');
    expect(deepestStep(all['noToken']?.steps ?? [])).toBe(5);
    // Un 409: el servicio respondió después de preguntar al repositorio por el SKU.
    expect(at(all['taken'], answeringStep(all['taken']?.steps ?? []))).toBe('service');
    expect(at(all['taken'], deepestStep(all['taken']?.steps ?? []))).toBe('repository');
    // Un 200: respondió el endpoint, y la petición llegó hasta el repositorio.
    expect(at(all['list'], answeringStep(all['list']?.steps ?? []))).toBe('endpoint');
    // Un 500: lo responde el manejo de excepciones; el repositorio no se usó.
    expect(at(all['failed'], answeringStep(all['failed']?.steps ?? []))).toBe('exceptions');
    expect(at(all['failed'], deepestStep(all['failed']?.steps ?? []))).toBe('service');
  });

  it('cuenta cada paso en el idioma de la página, con roles y razones traducidos', async () => {
    const all = await exchanges();
    const note = (exchange: Exchange | undefined, id: string) => {
      const step = exchange?.steps.find((item) => item.id === id);
      return step ? stepNote(step, client, roleName) : '';
    };
    expect(note(all['reader'], 'authentication')).toBe('Token válido de Lector.');
    expect(note(all['reader'], 'authorization')).toBe(
      'Pide Admin, y el rol del token no está entre ellos.',
    );
    expect(note(all['tampered'], 'authentication')).toBe(
      'Token inválido (la firma no coincide); la petición sigue como anónima.',
    );
    expect(note(all['noToken'], 'validation')).toBe(client.skipped);
  });

  it('escribe los encabezados y el registro como los verían una herramienta HTTP y la consola', async () => {
    const { noToken } = await exchanges();
    if (!noToken) throw new Error('falta el intercambio');
    const headers = headersText(noToken).split('\n');
    expect(headers[0]).toBe('HTTP/1.1 401 Unauthorized');
    expect(headers).toContain('WWW-Authenticate: Bearer');
    const log = logText(noToken.log).split('\n');
    expect(log[0]).toBe('info: Microsoft.AspNetCore.Hosting.Diagnostics[1]');
    expect(log[1]?.startsWith('      Request starting HTTP/1.1 POST')).toBe(true);
  });
});
