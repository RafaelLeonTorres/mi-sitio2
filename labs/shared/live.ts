// Una región aria-live para que el lector de pantalla anuncie los resultados ("201 Created",
// "Consulta B: 9 ms") sin mover el foco.

const REGION_ID = 'lab-live';

/** Anuncia un mensaje. Si es igual al anterior, le agrega un espacio para que se lea otra vez. */
export function announce(message: string, doc: Document = document): void {
  let region = doc.getElementById(REGION_ID);
  if (!region) {
    region = doc.createElement('div');
    region.id = REGION_ID;
    region.className = 'visually-hidden';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-atomic', 'true');
    doc.body.append(region);
  }
  region.textContent = region.textContent === message ? `${message} ` : message;
}
