import { describe, expect, it } from 'vitest';
import { waitForServer } from './sqlserver-wait.mjs';

// La espera a que un SQL Server acepte conexiones (el de un contenedor que acaba de arrancar), sin
// servidor: con un intento falso que falla unas veces y luego responde.

describe('waitForServer', () => {
  it('responde en cuanto el servidor responde, y avisa de cada intento fallido', async () => {
    let calls = 0;
    const lines: string[] = [];
    const result = await waitForServer({
      seconds: 10,
      pause: 0,
      attempt: () => {
        calls++;
        if (calls < 3) throw new Error('Login failed\nmás detalle que no se muestra');
        return '16.0.1000.6';
      },
      log: (line) => lines.push(line),
    });
    expect(result).toEqual({ ok: true, server: '16.0.1000.6' });
    expect(calls).toBe(3);
    expect(lines).toEqual([
      'Intento 1: todavía no responde (Login failed)',
      'Intento 2: todavía no responde (Login failed)',
    ]);
  });

  it('se rinde cuando se acaba el tiempo, con el último error', async () => {
    let calls = 0;
    const result = await waitForServer({
      seconds: 0.05,
      pause: 0.02,
      attempt: () => {
        calls++;
        throw new Error(`rechazó la conexión ${calls}`);
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^rechazó la conexión \d+$/);
    expect(calls).toBeGreaterThanOrEqual(1);
  });

  it('un intento que responde de entrada no espera nada', async () => {
    const started = Date.now();
    const result = await waitForServer({ seconds: 60, pause: 30, attempt: () => '1.2.3.4' });
    expect(result).toEqual({ ok: true, server: '1.2.3.4' });
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
