import { describe, expect, it } from 'vitest';
import { controlText, fill, fillNodes, type ClientTexts, type ScenarioTexts } from './page';

describe('textos de la página', () => {
  it('llena las plantillas y deja las llaves que no conoce', () => {
    expect(fill('{side} es {value} veces más rápida.', { side: 'B', value: '9.6' })).toBe(
      'B es 9.6 veces más rápida.',
    );
    expect(fill('{value} de {total}', { value: 3 })).toBe('3 de {total}');
  });

  it('pone nodos en lugar de las llaves', () => {
    expect(fillNodes('Índices: {value} y las claves primarias.', { value: 'IX' })).toEqual([
      'Índices: ',
      'IX',
      ' y las claves primarias.',
    ]);
    expect(fillNodes('{value}', { value: 'solo' })).toEqual(['solo']);
  });

  it('busca el texto de un control en el escenario y luego en los compartidos', () => {
    const client = { controls: { cache: { label: 'Caché' } } } as unknown as ClientTexts;
    const scenario: ScenarioTexts = {
      id: 'indexes',
      labels: {},
      controls: { index: { label: 'Índice de B' } },
    };
    expect(controlText(client, scenario, 'index').label).toBe('Índice de B');
    expect(controlText(client, scenario, 'cache').label).toBe('Caché');
    expect(() => controlText(client, { ...scenario, controls: null }, 'columns')).toThrow(
      'columns',
    );
  });
});
