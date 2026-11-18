import { describe, expect, it } from 'vitest';
import { MESSAGES } from './fixtures';
import { fill, parseObject, readListQuery, readProduct, readTokenRequest } from './validation';

const messages = MESSAGES.validation;
const categories = (id: number) => id >= 1 && id <= 3;
const valid = { name: 'Webcam HD', sku: 'CAM-4001', price: 999, stock: 5, categoryId: 3 };

describe('parseObject', () => {
  it('acepta solo un objeto JSON', () => {
    expect(parseObject('{"a":1}')).toEqual({ a: 1 });
    expect(parseObject('[1]')).toBeNull();
    expect(parseObject('{"a":')).toBeNull();
    expect(parseObject('')).toBeNull();
    expect(parseObject(undefined)).toBeNull();
  });
});

describe('readProduct', () => {
  it('un producto válido no tiene errores', () => {
    const read = readProduct(valid, categories, messages);
    expect(read.errors).toEqual({});
    expect(read.value).toEqual(valid);
  });

  it('revisa cada regla y junta los errores por campo', () => {
    const read = readProduct(
      { name: 'ab', sku: 'cam4001', price: 0, stock: -1, categoryId: 9 },
      categories,
      messages,
    );
    expect(read.errors).toEqual({
      name: ['Must have between 3 and 100 characters.'],
      sku: ['Must look like ABC-1234.'],
      price: ['Must be greater than 0.'],
      stock: ["Can't be negative."],
      categoryId: ['There is no category with id 9.'],
    });
  });

  it('pide los campos que faltan', () => {
    expect(Object.keys(readProduct({}, categories, messages).errors)).toEqual([
      'name',
      'sku',
      'price',
      'stock',
      'categoryId',
    ]);
  });

  it('no distingue mayúsculas, acepta números como texto e ignora lo que el DTO no tiene', () => {
    const read = readProduct(
      {
        Name: 'Webcam HD',
        SKU: 'CAM-4001',
        price: '999.5',
        stock: '5',
        categoryId: 3,
        id: 99,
        costPrice: 1,
      },
      categories,
      messages,
    );
    expect(read.errors).toEqual({});
    expect(read.value.price).toBe(999.5);
    expect(read.ignored).toEqual(['id', 'costPrice']);
  });

  it('un texto que no es número es un error de tipo', () => {
    expect(
      readProduct({ ...valid, price: 'mucho', stock: 2.5 }, categories, messages).errors,
    ).toEqual({
      price: ['Must be a number.'],
      stock: ['Must be a whole number.'],
    });
  });
});

describe('readTokenRequest', () => {
  it('acepta un rol conocido sin distinguir mayúsculas', () => {
    expect(readTokenRequest({ role: 'editor' }, messages).value.role).toBe('Editor');
  });

  it('rechaza un rol desconocido', () => {
    expect(readTokenRequest({ role: 'Owner' }, messages).errors).toEqual({
      role: ['Must be one of: Reader, Editor, Admin.'],
    });
  });
});

describe('readListQuery', () => {
  it('usa la página 1 de 10 si no se piden otras', () => {
    expect(readListQuery(new URLSearchParams(), messages).value).toEqual({
      page: 1,
      pageSize: 10,
      search: '',
    });
  });

  it('rechaza un pageSize mayor que 50 y una página menor que 1', () => {
    expect(readListQuery(new URLSearchParams('page=0&pageSize=51'), messages).errors).toEqual({
      page: ['Must be 1 or more.'],
      pageSize: ['Must be between 1 and 50.'],
    });
  });
});

describe('fill', () => {
  it('sustituye los nombres conocidos y deja los demás', () => {
    expect(fill('{a} y {b}', { a: 1 })).toBe('1 y {b}');
  });
});
