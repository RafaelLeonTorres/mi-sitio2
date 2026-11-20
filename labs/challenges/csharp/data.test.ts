import { describe, expect, it } from 'vitest';
import { csharpRequest, showCall, showValue, type CsChallenge } from './data';

const challenge: CsChallenge = {
  language: 'csharp',
  category: 'fundamentals',
  difficulty: 'easy',
  entry: { type: 'Solution', method: 'Sum' },
  compare: 'unordered',
  rules: [{ kind: 'uses-type', type: 'System.Lazy`1', name: 'Lazy<T>' }],
  prelude: 'public record Item(int Value);',
  harness: 'public static class Check { }',
  starter: 'public static class Solution { }',
  solution: 'public static class Solution { }',
  cases: [
    { sample: true, args: [[1, 2]], expected: 3 },
    { args: [null], throws: 'ArgumentNullException' },
    { args: [[]], expected: null },
  ],
};

describe('csharpRequest', () => {
  it('lleva solo los casos pedidos, con su índice, y las reglas sin el nombre para la página', () => {
    expect(csharpRequest(challenge, [0, 2], 'code')).toEqual({
      code: 'code',
      entry: { type: 'Solution', method: 'Sum' },
      rules: [{ kind: 'uses-type', type: 'System.Lazy`1' }],
      cases: [
        { index: 0, args: [[1, 2]], expected: 3 },
        { index: 2, args: [[]], expected: null },
      ],
      prelude: 'public record Item(int Value);',
      harness: 'public static class Check { }',
      compare: 'unordered',
    });
  });

  it('un caso que espera una excepción no lleva resultado esperado', () => {
    const request = csharpRequest(challenge, [1], 'code');
    expect(request.cases).toEqual([{ index: 1, args: [null], throws: 'ArgumentNullException' }]);
  });

  it('sin preludio, arnés ni forma de comparar, no los manda; un índice que no existe se ignora', () => {
    const {
      rules: _rules,
      prelude: _prelude,
      harness: _harness,
      compare: _compare,
      ...plain
    } = challenge;
    const request = csharpRequest(plain, [0, 7], 'x');
    expect(request.rules).toEqual([]);
    expect('prelude' in request || 'harness' in request || 'compare' in request).toBe(false);
    expect(request.cases).toHaveLength(1);
  });
});

describe('showValue y showCall', () => {
  it('escriben el JSON compacto, como jsonify en la página', () => {
    expect(showValue({ Name: 'Ana', Tags: ['a', 'b'] })).toBe('{"Name":"Ana","Tags":["a","b"]}');
    expect(showValue(null)).toBe('null');
    expect(showValue(undefined)).toBe('');
    expect(showCall({ type: 'Solution', method: 'TopK' }, [[5, 1], 2])).toBe('TopK([5,1], 2)');
    expect(showCall({ type: 'Check', method: 'Run' }, [])).toBe('Run()');
  });
});
