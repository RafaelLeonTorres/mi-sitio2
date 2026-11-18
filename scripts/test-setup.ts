import { webcrypto } from 'node:crypto';

// jsdom no trae `crypto.subtle`, y la consola de la API firma sus tokens con Web Crypto. En las
// pruebas con DOM se usa el de Node, que es la misma API.
if (globalThis.crypto?.subtle === undefined) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
