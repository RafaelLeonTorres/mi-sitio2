import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// Revisa que _data/labs/rest-api.yml cuadre con la API simulada y con su código: las mismas
// operaciones que labs/rest-api/api.ts, un texto por operación y por parámetro en los dos
// idiomas, ejemplos de cuerpo que la API acepta, un nombre por producto y el C# que Jekyll incluye.

const CODE_DIR = '_includes/labs/code/rest-api';
// Los archivos de la sección "El pipeline" de _includes/labs/rest-api.html.
const PIPELINE = [
  'program',
  'authentication',
  'rate-limiting',
  'exception-handler',
  'correlation-id',
];
// Las mismas que OPERATIONS en labs/rest-api/api.ts ({id} es {id:int} en la API).
const OPERATIONS = [
  { id: 'token', method: 'POST', path: '/api/auth/token', roles: undefined },
  { id: 'list', method: 'GET', path: '/api/products', roles: undefined },
  { id: 'get', method: 'GET', path: '/api/products/{id}', roles: undefined },
  { id: 'create', method: 'POST', path: '/api/products', roles: ['Editor', 'Admin'] },
  { id: 'update', method: 'PUT', path: '/api/products/{id}', roles: ['Editor', 'Admin'] },
  { id: 'delete', method: 'DELETE', path: '/api/products/{id}', roles: ['Admin'] },
];
// Los pasos de STEPS en labs/rest-api/api.ts, en orden.
const STEPS = [
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
];
const STATUSES = [200, 201, 204, 400, 401, 403, 404, 409, 429, 500];
const WITH_BODY = ['token', 'create', 'update'];
// Las columnas que caben en los bloques de código sin desplazarse en una pantalla mediana.
const MAX_COLUMNS = 75;

interface Operation {
  id: string;
  group: string;
  method: string;
  path: string;
  query?: string[];
  route?: string[];
  roles?: string[];
  code: string;
}

interface Texts {
  operations: { id: string; body?: string; codes: { status: number; text: string }[] }[];
  params: { name: string; text: string }[];
  client: {
    categories: { id: number; name: string }[];
    products: { id: number; name: string }[];
    steps: Record<string, { name: string; notes: Record<string, string> }>;
  };
}

interface Data {
  shared: {
    products: { id: number; sku: string; categoryId: number }[];
    operations: Operation[];
    defaults: Record<string, string>;
    model: { id: string; name: string; code: string }[];
  };
  es: Texts;
  en: Texts;
}

const data = parse(readFileSync('_data/labs/rest-api.yml', 'utf8')) as Data;
const { shared } = data;

/** El archivo existe, Jekyll lo puede incluir y sus líneas caben en el bloque de código. */
function checkCode(file: string): void {
  const path = join(CODE_DIR, file);
  expect(existsSync(path)).toBe(true);
  const source = readFileSync(path, 'utf8');
  expect(source).not.toContain('{{');
  expect(source).not.toContain('{%');
  const long = source.split('\n').filter((line) => line.length > MAX_COLUMNS);
  expect(long).toEqual([]);
}

describe('API REST: operaciones', () => {
  it('son las mismas que atiende la API simulada', () => {
    expect(
      shared.operations.map(({ id, method, path, roles }) => ({ id, method, path, roles })),
    ).toEqual(OPERATIONS);
  });

  it('cada parámetro de la ruta aparece en ella y tiene un valor inicial', () => {
    for (const operation of shared.operations) {
      for (const name of operation.route ?? []) expect(operation.path).toContain(`{${name}}`);
      for (const name of [...(operation.route ?? []), ...(operation.query ?? [])]) {
        expect(name in shared.defaults).toBe(true);
      }
    }
  });

  it('el código de cada operación, del pipeline y del modelo existe y cabe', () => {
    for (const operation of shared.operations) checkCode(operation.code);
    for (const file of PIPELINE) checkCode(`pipeline/${file}.cs`);
    for (const item of shared.model) checkCode(item.code);
  });
});

for (const lang of ['es', 'en'] as const) {
  const texts = data[lang];

  describe(`API REST: textos en ${lang}`, () => {
    it('describe cada operación en el mismo orden', () => {
      expect(texts.operations.map((operation) => operation.id)).toEqual(
        shared.operations.map((operation) => operation.id),
      );
    });

    it('cada parámetro tiene su explicación', () => {
      const names = texts.params.map((param) => param.name);
      for (const operation of shared.operations) {
        for (const name of [...(operation.route ?? []), ...(operation.query ?? [])]) {
          expect(names).toContain(name);
        }
      }
    });

    it('solo las operaciones con cuerpo traen un ejemplo, y es JSON', () => {
      for (const operation of texts.operations) {
        expect(operation.body !== undefined).toBe(WITH_BODY.includes(operation.id));
        if (operation.body !== undefined)
          expect(() => JSON.parse(operation.body ?? '')).not.toThrow();
      }
    });

    it('los ejemplos de crear y actualizar pasan la validación tal como están', () => {
      const categories = texts.client.categories.map((category) => category.id);
      const skus = shared.products.map((product) => product.sku);
      const body = (id: string) =>
        JSON.parse(texts.operations.find((operation) => operation.id === id)?.body ?? '{}') as {
          name: string;
          sku: string;
          price: number;
          stock: number;
          categoryId: number;
        };
      for (const id of ['create', 'update']) {
        const product = body(id);
        expect(product.name.length >= 3 && product.name.length <= 100).toBe(true);
        expect(/^[A-Z]{3}-\d{4}$/.test(product.sku)).toBe(true);
        expect(product.price > 0 && Number.isInteger(product.stock) && product.stock >= 0).toBe(
          true,
        );
        expect(categories).toContain(product.categoryId);
      }
      // Crear usa un SKU libre; actualizar, el del producto que edita (el id 1 de inicio).
      expect(skus).not.toContain(body('create').sku);
      expect(body('update').sku).toBe(
        shared.products.find((product) => String(product.id) === shared.defaults['id'])?.sku,
      );
    });

    it('cada respuesta documentada es un código que la API devuelve', () => {
      for (const operation of texts.operations) {
        for (const code of operation.codes) expect(STATUSES).toContain(code.status);
      }
    });

    it('cada producto tiene nombre y su categoría existe', () => {
      expect(texts.client.products.map((product) => product.id)).toEqual(
        shared.products.map((product) => product.id),
      );
      const categories = texts.client.categories.map((category) => category.id);
      for (const product of shared.products) expect(categories).toContain(product.categoryId);
    });

    it('cada paso del pipeline tiene nombre, en el orden de la API', () => {
      expect(Object.keys(texts.client.steps)).toEqual(STEPS);
    });
  });
}

describe('API REST: catálogo', () => {
  it('no repite ids ni SKUs, y cada SKU tiene el formato que valida la API', () => {
    const ids = shared.products.map((product) => product.id);
    const skus = shared.products.map((product) => product.sku);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(skus).size).toBe(skus.length);
    for (const sku of skus) expect(/^[A-Z]{3}-\d{4}$/.test(sku)).toBe(true);
  });
});
