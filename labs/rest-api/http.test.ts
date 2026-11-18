import { describe, expect, it } from 'vitest';
import { headerValue, parseTarget, toCurl } from './http';

describe('parseTarget', () => {
  it('separa la ruta de la consulta', () => {
    const target = parseTarget('/api/products?page=2&search=rat%C3%B3n');
    expect(target.path).toBe('/api/products');
    expect(target.query.get('page')).toBe('2');
    expect(target.query.get('search')).toBe('ratón');
  });

  it('una ruta sin consulta queda igual', () => {
    expect(parseTarget('/api/products/7').path).toBe('/api/products/7');
  });
});

describe('headerValue', () => {
  it('encuentra el encabezado sin importar las mayúsculas', () => {
    expect(headerValue({ authorization: 'Bearer abc' }, 'Authorization')).toBe('Bearer abc');
    expect(headerValue([['Content-Type', 'application/json']], 'content-type')).toBe(
      'application/json',
    );
    expect(headerValue({}, 'Authorization')).toBe(undefined);
  });
});

describe('toCurl', () => {
  it('arma un GET sin -X', () => {
    expect(
      toCurl({ method: 'GET', url: '/api/products?page=2', headers: {} }, 'https://tienda.example'),
    ).toBe("curl 'https://tienda.example/api/products?page=2'");
  });

  it('lleva el método, los encabezados y el cuerpo en una línea', () => {
    const curl = toCurl(
      {
        method: 'POST',
        url: '/api/products',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer abc' },
        body: '{\n  "name": "Teclado"\n}',
      },
      'https://tienda.example',
    );
    expect(curl).toBe(
      [
        "curl -X POST 'https://tienda.example/api/products' \\",
        "  -H 'Content-Type: application/json' \\",
        "  -H 'Authorization: Bearer abc' \\",
        `  --data-raw '{"name":"Teclado"}'`,
      ].join('\n'),
    );
  });

  it('escapa las comillas simples del cuerpo', () => {
    const curl = toCurl(
      { method: 'POST', url: '/x', headers: {}, body: `{"name":"O'Brien"}` },
      'https://tienda.example',
    );
    expect(curl).toContain(`--data-raw '{"name":"O'\\''Brien"}'`);
  });
});
