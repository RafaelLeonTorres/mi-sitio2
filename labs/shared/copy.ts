// Botón "Copiar" para los bloques de código de las demos, con el mismo aspecto que el de las
// publicaciones del sitio (.copy-btn en main.css).

import type { KitStrings } from './i18n';

/** Lo único que se usa del portapapeles; las pruebas pasan uno falso. */
export interface TextClipboard {
  writeText(text: string): Promise<void>;
}

const RESET_MS = 1800;

/**
 * Agrega el botón al contenedor del `<pre>`, que debe tener `position: relative`.
 * Sin portapapeles (por ejemplo, fuera de HTTPS, o `null`) no agrega nada.
 */
export function addCopyButton(
  pre: HTMLElement,
  strings: KitStrings,
  clipboard: TextClipboard | null = navigator.clipboard ?? null,
): HTMLButtonElement | null {
  const holder = pre.parentElement;
  if (!clipboard || !holder) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-btn';
  button.textContent = strings.copy_label;
  button.setAttribute('aria-live', 'polite');

  let timer: ReturnType<typeof setTimeout> | undefined;
  const show = (label: string) => {
    button.textContent = label;
    button.classList.add('is-done');
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.textContent = strings.copy_label;
      button.classList.remove('is-done');
    }, RESET_MS);
  };

  button.addEventListener('click', () => {
    const text = (pre.querySelector('code') ?? pre).textContent ?? '';
    clipboard.writeText(text.replace(/\n$/, '')).then(
      () => show(strings.copied),
      () => show(strings.copy_failed),
    );
  });

  holder.append(button);
  return button;
}
