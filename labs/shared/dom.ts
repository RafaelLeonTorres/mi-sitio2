// Construcción de elementos sin plantillas de texto: los valores entran como atributos o nodos
// de texto, así que nunca se interpretan como HTML.

export type Child = Node | string | number | null | undefined | false;
export type Attributes = Record<string, string | number | boolean | null | undefined>;

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Crea un elemento con sus atributos e hijos. Un atributo `true` queda vacío (`hidden=""`);
 * `false`, `null` y `undefined` no se agregan, igual que los hijos `null`, `undefined` y `false`.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  return fill(document.createElement(tag), attributes, children);
}

/** Lo mismo que `h`, para elementos SVG. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: readonly Child[] = [],
): SVGElementTagNameMap[K] {
  return fill(document.createElementNS(SVG_NS, tag), attributes, children);
}

/** Busca un elemento que la página debe tener; si falta, el error dice cuál. */
export function required<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`No se encontró ${selector} en la página.`);
  return element;
}

function fill<E extends Element>(
  element: E,
  attributes: Attributes,
  children: readonly Child[],
): E {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'number' ? String(child) : child);
  }
  return element;
}
