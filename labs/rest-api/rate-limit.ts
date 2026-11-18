// Límite de peticiones de ventana fija, como `AddFixedWindowLimiter` de ASP.NET Core: cierto
// número de permisos por ventana; los rechazos no gastan permisos y dicen cuánto esperar.

export type Lease =
  | { readonly acquired: true; readonly remaining: number }
  | { readonly acquired: false; readonly retryAfterSeconds: number };

export interface FixedWindow {
  /** Pide un permiso en el instante `now` (milisegundos). */
  acquire(now: number): Lease;
}

export function fixedWindow(permits: number, windowMs: number): FixedWindow {
  let start = Number.NEGATIVE_INFINITY;
  let used = 0;
  return {
    acquire(now) {
      if (now - start >= windowMs) {
        start = now;
        used = 0;
      }
      if (used < permits) {
        used += 1;
        return { acquired: true, remaining: permits - used };
      }
      return {
        acquired: false,
        retryAfterSeconds: Math.max(1, Math.ceil((start + windowMs - now) / 1000)),
      };
    },
  };
}
