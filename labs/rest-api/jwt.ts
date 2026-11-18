// JWT de verdad, firmados con HMAC-SHA256 (HS256) por medio de Web Crypto. Emitir, decodificar
// y validar como lo haría JwtBearer: la firma, el emisor, la audiencia y el vencimiento. La llave
// vive en el navegador solo porque es una simulación; en un sistema real la tiene el servidor.

import type { Role } from './validation';

export interface Claims {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly role: Role;
  readonly jti: string;
  readonly iat: number;
  readonly exp: number;
}

export type Verified =
  | { readonly ok: true; readonly claims: Claims }
  | {
      readonly ok: false;
      readonly reason: 'malformed' | 'signature' | 'expired' | 'issuer' | 'audience';
      /** El `error_description` que JwtBearer pone en `WWW-Authenticate`, si pone alguno. */
      readonly description?: string;
    };

export interface Expected {
  readonly issuer: string;
  readonly audience: string;
  /** El instante de la validación, en segundos desde 1970. */
  readonly now: number;
}

const HEADER = { alg: 'HS256', typ: 'JWT' };
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Una llave nueva para esta visita, o la que se dé (las pruebas usan una fija). */
export async function createKey(secret?: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const raw = secret ?? crypto.getRandomValues(new Uint8Array(32));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function sign(claims: Claims, key: CryptoKey): Promise<string> {
  const unsigned = `${encodeJson(HEADER)}.${encodeJson(claims)}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(unsigned));
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}

/** El encabezado y el contenido del token, sin revisar la firma; `null` si no se puede leer. */
export function decode(token: string): { header: unknown; payload: unknown } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header = '', payload = ''] = parts;
  try {
    return { header: decodeJson(header), payload: decodeJson(payload) };
  } catch {
    return null;
  }
}

/** El token con otro contenido y la firma original: así se ve qué pasa al alterarlo. */
export function withPayload(token: string, payload: unknown): string {
  return withPayloadText(token, JSON.stringify(payload));
}

/** Lo mismo con el contenido como texto, aunque no sea JSON: así se arma un token mal formado. */
export function withPayloadText(token: string, payload: string): string {
  const [header = '', , signature = ''] = token.split('.');
  return `${header}.${toBase64Url(encoder.encode(payload))}.${signature}`;
}

export async function verify(token: string, key: CryptoKey, expected: Expected): Promise<Verified> {
  const parts = token.split('.');
  const decoded = decode(token);
  const [header = '', payload = '', signature = ''] = parts;
  if (!decoded || !isClaims(decoded.payload)) return { ok: false, reason: 'malformed' };

  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = fromBase64Url(signature);
  } catch {
    return { ok: false, reason: 'signature', description: 'The signature is invalid' };
  }
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    bytes,
    encoder.encode(`${header}.${payload}`),
  );
  if (!valid) return { ok: false, reason: 'signature', description: 'The signature is invalid' };

  // Después de la firma, el mismo orden que JsonWebTokenHandler: vigencia, audiencia y emisor.
  const claims = decoded.payload;
  if (claims.exp <= expected.now) {
    return {
      ok: false,
      reason: 'expired',
      description: `The token expired at '${invariantDate(claims.exp)}'`,
    };
  }
  if (claims.aud !== expected.audience) {
    return {
      ok: false,
      reason: 'audience',
      description: `The audience '${claims.aud}' is invalid`,
    };
  }
  if (claims.iss !== expected.issuer) {
    return { ok: false, reason: 'issuer', description: `The issuer '${claims.iss}' is invalid` };
  }
  return { ok: true, claims };
}

function isClaims(value: unknown): value is Claims {
  if (typeof value !== 'object' || value === null) return false;
  const claims = value as Record<string, unknown>;
  return (
    typeof claims['iss'] === 'string' &&
    typeof claims['aud'] === 'string' &&
    typeof claims['sub'] === 'string' &&
    typeof claims['role'] === 'string' &&
    typeof claims['exp'] === 'number' &&
    typeof claims['iat'] === 'number'
  );
}

/** Como `DateTime.ToString(CultureInfo.InvariantCulture)` en UTC: 11/18/2026 21:35:00. */
function invariantDate(seconds: number): string {
  const date = new Date(seconds * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

function encodeJson(value: unknown): string {
  return toBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodeJson(part: string): unknown {
  return JSON.parse(decoder.decode(fromBase64Url(part)));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('No es base64url.');
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
