// Datos que Jekyll deja en la página como JSON (<script type="application/json">). Así el
// TypeScript no tiene textos fijos: todo sale de _data/labs/ en el idioma de la página.

/** Textos de las piezas compartidas (`_data/labs/ui.yml`, clave `kit`). */
export interface KitStrings {
  copy_label: string;
  copied: string;
  copy_failed: string;
}

/** Lee el JSON de `<script type="application/json" id="…">`. */
export function readJson<T>(id: string, doc: Document = document): T {
  const script = doc.getElementById(id);
  if (!script?.textContent) throw new Error(`Falta el JSON #${id} en la página.`);
  return JSON.parse(script.textContent) as T;
}

/** Los textos del kit, que el layout `lab` deja en `#lab-ui`. */
export function kitStrings(doc: Document = document): KitStrings {
  return readJson<KitStrings>('lab-ui', doc);
}
