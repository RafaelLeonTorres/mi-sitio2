// Cómo guarda SQL Server las filas: páginas de 8 KB y árboles B. De aquí salen las páginas de cada
// índice y su profundidad, que deciden cuántas lecturas lógicas cuesta buscar o recorrer.

/** Bytes de una página que quedan para filas (8,192 menos el encabezado de 96). */
export const PAGE_BYTES = 8096;
/** Cada fila ocupa además 2 bytes en la tabla de posiciones de la página. */
const SLOT_BYTES = 2;
/** Encabezado, mapa de nulos y posiciones de las columnas variables de una fila. */
export const ROW_OVERHEAD = 9;
/** En los niveles de arriba, cada entrada lleva la clave y el número de la página hija. */
const CHILD_POINTER = 6;

export interface IndexShape {
  /** Filas por página en el nivel hoja. */
  readonly rowsPerPage: number;
  /** Páginas del nivel hoja. */
  readonly leafPages: number;
  /** Niveles, contando la hoja: buscar una fila cuesta una lectura por nivel. */
  readonly depth: number;
}

export function rowsPerPage(rowBytes: number): number {
  return Math.max(1, Math.floor(PAGE_BYTES / (rowBytes + SLOT_BYTES)));
}

/**
 * La forma de un índice con `rows` filas de `rowBytes` bytes en la hoja y claves de `keyBytes`
 * bytes en los niveles de arriba.
 */
export function indexShape(rows: number, rowBytes: number, keyBytes: number): IndexShape {
  const perPage = rowsPerPage(rowBytes);
  const leafPages = Math.max(1, Math.ceil(rows / perPage));
  const fanout = rowsPerPage(keyBytes + CHILD_POINTER + ROW_OVERHEAD);
  let depth = 1;
  for (let pages = leafPages; pages > 1; pages = Math.ceil(pages / fanout)) depth += 1;
  return { rowsPerPage: perPage, leafPages, depth };
}

/** Páginas que ocupan `rows` filas contiguas del nivel hoja (al menos una). */
export function pagesFor(rows: number, shape: IndexShape): number {
  return rows <= 0 ? 1 : Math.ceil(rows / shape.rowsPerPage);
}

/** Lecturas de un recorrido completo: bajar hasta la primera hoja y leer todas. */
export function scanReads(shape: IndexShape): number {
  return shape.depth - 1 + shape.leafPages;
}

/** Lecturas de una búsqueda de rango que devuelve `rows` filas contiguas. */
export function seekReads(rows: number, shape: IndexShape): number {
  return shape.depth - 1 + pagesFor(rows, shape);
}

/** Páginas distintas que tocan `lookups` búsquedas repartidas al azar entre `pages` páginas. */
export function distinctPages(lookups: number, pages: number): number {
  if (lookups <= 0) return 0;
  return Math.min(lookups, Math.round(pages * (1 - Math.exp(-lookups / pages))));
}
