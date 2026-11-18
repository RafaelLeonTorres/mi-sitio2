// Una petición y una respuesta HTTP simuladas: sus tipos, la ruta con su consulta, los
// encabezados sin distinguir mayúsculas y el curl equivalente a lo que se envió.

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ApiRequest {
  readonly method: Method;
  /** La ruta con su consulta, como la escribiría un cliente: `/api/products?page=2`. */
  readonly url: string;
  /** Los encabezados como se escribieron; se buscan sin distinguir mayúsculas. */
  readonly headers: Readonly<Record<string, string>>;
  /** El cuerpo tal como se escribió, sin interpretar. */
  readonly body?: string;
}

export type Header = readonly [name: string, value: string];

export interface ApiResponse {
  readonly status: number;
  readonly headers: readonly Header[];
  /** El JSON de la respuesta, o `null` si no tiene cuerpo (como un 204). */
  readonly body: unknown;
}

/** La frase de cada código, como la escribe ASP.NET Core en la línea de estado. */
export const REASON: Readonly<Record<number, string>> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/** El valor de un encabezado, sin importar cómo se escribió su nombre. */
export function headerValue(
  headers: Readonly<Record<string, string>> | readonly Header[],
  name: string,
): string | undefined {
  const wanted = name.toLowerCase();
  const entries = Array.isArray(headers) ? headers : Object.entries(headers);
  for (const [key, value] of entries) if (key.toLowerCase() === wanted) return value;
  return undefined;
}

export interface Target {
  readonly path: string;
  readonly query: URLSearchParams;
}

/** Separa la ruta de su consulta: `/api/products?page=2` → `/api/products` y `page=2`. */
export function parseTarget(url: string): Target {
  const mark = url.indexOf('?');
  if (mark === -1) return { path: url, query: new URLSearchParams() };
  return { path: url.slice(0, mark), query: new URLSearchParams(url.slice(mark + 1)) };
}

/** El comando curl que hace la misma petición contra `origin`, listo para una terminal. */
export function toCurl(request: ApiRequest, origin: string): string {
  const target = quote(origin + request.url);
  const lines = [
    request.method === 'GET' ? `curl ${target}` : `curl -X ${request.method} ${target}`,
  ];
  for (const [name, value] of Object.entries(request.headers)) {
    lines.push(`  -H ${quote(`${name}: ${value}`)}`);
  }
  if (request.body !== undefined && request.body.trim() !== '') {
    lines.push(`  --data-raw ${quote(compact(request.body))}`);
  }
  return lines.join(' \\\n');
}

/** Comillas simples de shell: una comilla dentro del texto se escribe como '\''. */
function quote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

/** El JSON en una línea; si no es JSON válido, se envía tal como se escribió. */
function compact(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body));
  } catch {
    return body;
  }
}
