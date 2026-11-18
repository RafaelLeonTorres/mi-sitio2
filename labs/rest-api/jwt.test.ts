import { describe, expect, it } from 'vitest';
import { createKey, decode, sign, verify, withPayload, withPayloadText, type Claims } from './jwt';

const SECRET = new Uint8Array(32).fill(7);
const NOW = 1_795_030_800;
const CLAIMS: Claims = {
  iss: 'https://tienda.example',
  aud: 'tienda-api',
  sub: 'demo-editor',
  role: 'Editor',
  jti: 'abc',
  iat: NOW,
  exp: NOW + 300,
};
const expected = { issuer: CLAIMS.iss, audience: CLAIMS.aud, now: NOW + 10 };

describe('jwt', () => {
  it('firma un token de tres partes que se valida con la misma llave', async () => {
    const key = await createKey(SECRET);
    const token = await sign(CLAIMS, key);
    expect(token.split('.')).toHaveLength(3);
    expect(decode(token)?.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(await verify(token, key, expected)).toEqual({ ok: true, claims: CLAIMS });
  });

  it('con otra llave la firma no coincide', async () => {
    const token = await sign(CLAIMS, await createKey(SECRET));
    const other = await createKey(new Uint8Array(32).fill(8));
    expect(await verify(token, other, expected)).toEqual({
      ok: false,
      reason: 'signature',
      description: 'The signature is invalid',
    });
  });

  it('si se cambia el rol a mano, la firma deja de coincidir', async () => {
    const key = await createKey(SECRET);
    const token = await sign(CLAIMS, key);
    const tampered = withPayload(token, { ...CLAIMS, role: 'Admin' });
    expect(decode(tampered)?.payload).toEqual({ ...CLAIMS, role: 'Admin' });
    expect((await verify(tampered, key, expected)).ok).toBe(false);
  });

  it('un token vencido dice cuándo venció, como JwtBearer', async () => {
    const key = await createKey(SECRET);
    const token = await sign(CLAIMS, key);
    expect(await verify(token, key, { ...expected, now: NOW + 300 })).toEqual({
      ok: false,
      reason: 'expired',
      description: "The token expired at '11/18/2026 19:45:00'",
    });
  });

  it('lo que no es un JWT es un token mal formado', async () => {
    const key = await createKey(SECRET);
    expect(await verify('abc', key, expected)).toEqual({ ok: false, reason: 'malformed' });
    expect(decode('a.b.c')).toBeNull();
  });

  it('un contenido que no es JSON deja el token mal formado, con su encabezado y su firma', async () => {
    const key = await createKey(SECRET);
    const token = await sign(CLAIMS, key);
    const broken = withPayloadText(token, '{"role": "Admin"');
    expect(broken.split('.')[0]).toBe(token.split('.')[0]);
    expect(broken.split('.')[2]).toBe(token.split('.')[2]);
    expect(decode(broken)).toBeNull();
    expect(await verify(broken, key, expected)).toEqual({ ok: false, reason: 'malformed' });
  });
});
