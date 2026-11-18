// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { addCopyButton } from './copy';
import type { KitStrings } from './i18n';

const strings: KitStrings = {
  copy_label: 'Copiar',
  copied: 'Copiado',
  copy_failed: 'No se pudo copiar',
};

/** Un bloque de código dentro de su contenedor, como en las páginas. */
function codeBlock(text: string): HTMLPreElement {
  document.body.innerHTML = '<div class="lab-code"><pre><code></code></pre></div>';
  const pre = document.querySelector('pre');
  if (!pre) throw new Error('falta el pre');
  pre.querySelector('code')?.append(text);
  return pre;
}

/** Deja correr las promesas pendientes. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('addCopyButton', () => {
  it('agrega el botón al contenedor del bloque', () => {
    const pre = codeBlock('SELECT 1;');
    const button = addCopyButton(pre, strings, { writeText: async () => {} });
    expect(button?.textContent).toBe('Copiar');
    expect(pre.parentElement?.lastElementChild).toBe(button);
  });

  it('copia el código sin el salto de línea final y avisa', async () => {
    const copied: string[] = [];
    const pre = codeBlock('SELECT 1;\n');
    const button = addCopyButton(pre, strings, {
      writeText: async (text) => {
        copied.push(text);
      },
    });
    button?.click();
    await settle();
    expect(copied).toEqual(['SELECT 1;']);
    expect(button?.textContent).toBe('Copiado');
  });

  it('avisa si no se pudo copiar', async () => {
    const pre = codeBlock('x');
    const button = addCopyButton(pre, strings, {
      writeText: () => Promise.reject(new Error('denegado')),
    });
    button?.click();
    await settle();
    expect(button?.textContent).toBe('No se pudo copiar');
  });

  it('sin portapapeles no agrega nada', () => {
    const pre = codeBlock('x');
    expect(addCopyButton(pre, strings, null)).toBeNull();
    expect(document.querySelector('button')).toBeNull();
  });
});
