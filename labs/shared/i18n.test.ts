// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { kitStrings, readJson } from './i18n';

describe('readJson', () => {
  it('lee el JSON que dejó Jekyll en la página', () => {
    document.body.innerHTML =
      '<script type="application/json" id="datos">{"a": 1, "b": ["x"]}</script>';
    expect(readJson<{ a: number; b: string[] }>('datos')).toEqual({ a: 1, b: ['x'] });
  });

  it('acepta el escape de "</" que hace el layout', () => {
    document.body.innerHTML =
      '<script type="application/json" id="x">{"t": "<\\/script>"}</script>';
    expect(readJson<{ t: string }>('x').t).toBe('</script>');
  });

  it('dice qué JSON falta', () => {
    document.body.innerHTML = '';
    expect(() => readJson('nada')).toThrow('Falta el JSON #nada en la página.');
  });
});

describe('kitStrings', () => {
  it('lee los textos del kit de #lab-ui', () => {
    document.body.innerHTML =
      '<script type="application/json" id="lab-ui">{"copy_label": "Copiar", "copied": "Copiado", "copy_failed": "No se pudo copiar"}</script>';
    expect(kitStrings().copied).toBe('Copiado');
  });
});
