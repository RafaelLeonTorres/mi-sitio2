// Los motores de los retos se publican comprimidos con gzip: GitHub Pages no comprime .wasm ni
// .data, y sin esto la primera descarga sería del triple. Si el servidor ya los descomprimió (algunos
// servidores locales mandan Content-Encoding: gzip), los bytes llegan sin la firma de gzip y se usan
// tal cual.

/** Si los bytes empiezan con la firma de gzip (1f 8b). */
export function isGzip(bytes: ArrayBuffer): boolean {
  const view = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  return view[0] === 0x1f && view[1] === 0x8b;
}

/** Los bytes descomprimidos, o los mismos si no venían en gzip. */
export async function gunzip(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  if (!isGzip(bytes)) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/** Descarga un archivo de un motor y lo descomprime si hace falta. */
export async function download(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return gunzip(await response.arrayBuffer());
}
