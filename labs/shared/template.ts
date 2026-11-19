// Los textos de _data/labs/ llegan con marcas que el TypeScript completa: {n} se cambia por su
// valor y `código` entre comillas invertidas se vuelve un <code>, sin interpretar HTML.

import { h } from './dom';

/** Cambia cada {nombre} de la plantilla por su valor; deja los que no tienen valor. */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

/** El texto con cada `fragmento` entre comillas invertidas como <code>. */
export function inlineCode(text: string): (Node | string)[] {
  return text.split('`').map((part, index) => (index % 2 === 1 ? h('code', {}, [part]) : part));
}
