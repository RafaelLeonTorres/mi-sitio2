// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { highlightInto, tokenizeJson, tokenizeSql, type Token } from './highlight';

const joined = (tokens: Token[]) => tokens.map((token) => token.text).join('');
const marked = (tokens: Token[]) =>
  tokens.filter((token) => token.kind !== 'text').map((token) => `${token.kind}:${token.text}`);

describe('tokenizeJson', () => {
  const body =
    '{\n  "id": 12,\n  "name": "Teclado \\"pro\\"",\n  "price": -1.5e2,\n  "active": true,\n  "tags": null\n}';

  it('reproduce el texto original', () => {
    expect(joined(tokenizeJson(body))).toBe(body);
  });

  it('distingue nombres de campo, textos, números y literales', () => {
    expect(marked(tokenizeJson(body))).toEqual([
      't:"id"',
      'n:12',
      't:"name"',
      's:"Teclado \\"pro\\""',
      't:"price"',
      'n:-1.5e2',
      't:"active"',
      'k:true',
      't:"tags"',
      'k:null',
    ]);
  });

  it('no falla con un JSON a medio escribir', () => {
    const broken = '{ "name": "sin cerrar';
    expect(joined(tokenizeJson(broken))).toBe(broken);
    expect(marked(tokenizeJson(broken))).toEqual(['t:"name"', 's:"sin cerrar']);
  });
});

describe('tokenizeSql', () => {
  const query =
    "SELECT Id, Total FROM Orders -- pedidos\nWHERE YEAR(OrderDate) = 2026 AND Notes = N'it''s' AND CustomerId = @id;";

  it('reproduce el texto original', () => {
    expect(joined(tokenizeSql(query))).toBe(query);
  });

  it('reconoce palabras clave, funciones, textos, números, comentarios y parámetros', () => {
    expect(marked(tokenizeSql(query))).toEqual([
      'k:SELECT',
      'k:FROM',
      'c:-- pedidos',
      'k:WHERE',
      'f:YEAR',
      'n:2026',
      'k:AND',
      "s:N'it''s'",
      'k:AND',
      't:@id',
    ]);
  });

  it('acepta palabras clave en minúsculas y comentarios de bloque', () => {
    expect(marked(tokenizeSql('/* nota */ select * from Orders order by Id desc'))).toEqual([
      'c:/* nota */',
      'k:select',
      'k:from',
      'k:order',
      'k:by',
      'k:desc',
    ]);
  });

  it('solo marca como función lo que lleva paréntesis', () => {
    expect(marked(tokenizeSql('SELECT Year FROM T WHERE YEAR (OrderDate) > 0'))).toEqual([
      'k:SELECT',
      'k:FROM',
      'k:WHERE',
      'f:YEAR',
      'n:0',
    ]);
  });

  it('deja sin color los nombres entre corchetes y marca los tipos', () => {
    expect(marked(tokenizeSql('SELECT [Order] FROM T WHERE CAST(OrderDate AS date) = @d'))).toEqual(
      ['k:SELECT', 'k:FROM', 'k:WHERE', 'f:CAST', 'k:AS', 't:date', 't:@d'],
    );
  });
});

describe('highlightInto', () => {
  it('pone cada token con clase en un span y deja el resto como texto', () => {
    const code = document.createElement('code');
    highlightInto(code, 'json', '{"ok": true}');
    expect(code.innerHTML).toBe(
      '{<span class="tok-t">"ok"</span>: <span class="tok-k">true</span>}',
    );
  });

  it('nunca interpreta el texto como HTML', () => {
    const code = document.createElement('code');
    highlightInto(code, 'sql', "SELECT '<b>x</b>'");
    expect(code.querySelector('b')).toBeNull();
    expect(code.textContent).toBe("SELECT '<b>x</b>'");
  });
});
