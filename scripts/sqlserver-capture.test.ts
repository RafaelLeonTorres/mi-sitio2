import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  capture,
  captureYaml,
  capturedSteps,
  comparable,
  replaceCaptured,
  sameOutput,
  toCaptured,
  toMessages,
  type Captured,
} from './sqlserver-capture.mjs';
import { connectionString, splitBatches } from './sqlserver-client.mjs';

// El script de capturas y su cliente, sin servidor: partir un script en lotes, guardar lo que devolvió
// SQL Server en el YAML de la lección y compararlo. Con MSSQL_CONNECTION, la última prueba corre los
// pasos capturados de verdad (lo mismo que `node scripts/sqlserver-capture.mjs --check`).

describe('splitBatches', () => {
  it('parte por las líneas que solo dicen GO, sin importar las mayúsculas ni los espacios', () => {
    expect(splitBatches('SELECT 1;\nGO\n  go  \nSELECT 2;\nGO\n')).toEqual([
      'SELECT 1;',
      'SELECT 2;',
    ]);
  });

  it('cada lote empieza en la línea que sigue al GO, como SSMS: sus números de línea cuentan desde ahí', () => {
    expect(splitBatches('A\nGO\n\nB')).toEqual(['A', '\nB']);
  });

  it('un script sin GO es un solo lote, y GOTO o un comentario no lo parten', () => {
    expect(splitBatches('SELECT 1;\nGOTO fin;\n-- GO\nfin:')).toEqual([
      'SELECT 1;\nGOTO fin;\n-- GO\nfin:',
    ]);
  });

  it('descarta los lotes vacíos y entiende los saltos de línea de Windows', () => {
    expect(splitBatches('GO\r\nSELECT 1;\r\nGO\r\n\r\nGO\r\n')).toEqual(['SELECT 1;']);
    expect(splitBatches('')).toEqual([]);
  });
});

const message = (level: number, text: string, number = 0) => ({
  number,
  level,
  state: 1,
  line: 3,
  text,
});

describe('toMessages', () => {
  it('un PRINT y lo de gravedad 10 o menos son texto plano, y un error lleva su encabezado', () => {
    expect(
      toMessages([
        message(0, 'Hola'),
        message(16, 'Divide by zero error encountered.', 8134),
        message(0, 'The statement has been terminated.', 3621),
        message(10, 'Warning: Null value is eliminated.', 8153),
      ]),
    ).toEqual([
      { text: 'Hola' },
      { number: 8134, level: 16, state: 1, line: 3, text: 'Divide by zero error encountered.' },
      { text: 'The statement has been terminated.' },
      { text: 'Warning: Null value is eliminated.' },
    ]);
  });
});

const sample: Captured = {
  server: '16.0.1000.6',
  date: '2026-11-25',
  batches: [
    {
      results: [
        {
          columns: ['Name', 'Price', ''],
          rows: [
            ['Café: "uno"', '189.00', null],
            ['Té', '95.00', 7],
          ],
        },
        { columns: ['On'], rows: [] },
      ],
      messages: [
        { text: 'Hola' },
        { number: 8134, level: 16, state: 1, line: 2, text: 'Divide by zero error encountered.' },
      ],
    },
    { results: [], messages: [] },
  ],
};

const lesson = `shared:
  minutes: 5
  steps:
    - id: a
      kind: read
    - id: b
      kind: captured
      script: |
        SELECT 1;
      captured:
        server: "1.0"
        date: "2020-01-01"
        batches:
          - results: []
            messages: []
      predict:
        answer: 0
    - id: c
      kind: captured
      script: |
        SELECT 2;
es:
  slug: x
`;

describe('captureYaml y replaceCaptured', () => {
  /** La lección con el bloque de un paso, leída de vuelta. */
  const captured = (text: string, id: string) =>
    (parse(text) as { shared: { steps: { id: string; captured?: unknown }[] } }).shared.steps.find(
      (step) => step.id === id,
    )?.captured;

  it('escribe un YAML que se lee de vuelta igual: texto entre comillas, números, NULL y nombres raros', () => {
    const text = `${lesson.split('      captured:')[0]}${captureYaml(sample).join('\n')}\nes:\n  slug: x\n`;
    expect(captured(text, 'b')).toEqual(sample);
  });

  it('reemplaza el bloque de un paso y deja todo lo demás tal cual', () => {
    const next = replaceCaptured(lesson, 'b', captureYaml(sample));
    expect(captured(next, 'b')).toEqual(sample);
    expect(next).toContain('      predict:\n        answer: 0\n    - id: c');
    expect(
      next.startsWith('shared:\n  minutes: 5\n  steps:\n    - id: a\n      kind: read\n'),
    ).toBe(true);
    expect(next.endsWith('es:\n  slug: x\n')).toBe(true);
    expect(captured(next, 'c')).toBeUndefined();
  });

  it('agrega el bloque al final del paso que todavía no lo tiene, antes de la siguiente clave', () => {
    const next = replaceCaptured(lesson, 'c', captureYaml(sample));
    expect(captured(next, 'c')).toEqual(sample);
    expect(next).toContain('        SELECT 2;\n      captured:\n');
    expect(next.endsWith('es:\n  slug: x\n')).toBe(true);
    expect(captured(next, 'b')).toEqual({
      server: '1.0',
      date: '2020-01-01',
      batches: [{ results: [], messages: [] }],
    });
  });

  it('es idempotente: escribir lo mismo otra vez no cambia el archivo', () => {
    const once = replaceCaptured(lesson, 'b', captureYaml(sample));
    expect(replaceCaptured(once, 'b', captureYaml(sample))).toBe(once);
    const twice = replaceCaptured(once, 'c', captureYaml(sample));
    expect(replaceCaptured(twice, 'c', captureYaml(sample))).toBe(twice);
  });

  it('avisa si el paso no existe', () => {
    expect(() => replaceCaptured(lesson, 'z', captureYaml(sample))).toThrow(/paso z/);
  });
});

describe('comparar capturas', () => {
  it('la versión del servidor y la fecha no cuentan, y los resultados y los mensajes sí', () => {
    expect(sameOutput(sample, { ...sample, server: '16.0.4210.1', date: '2027-01-01' })).toBe(true);
    const other = structuredClone(sample);
    other.batches[0]!.messages[0] = { text: 'Adiós' };
    expect(sameOutput(sample, other)).toBe(false);
    const rows = structuredClone(sample);
    rows.batches[0]!.results[0]!.rows[0]![1] = '190.00';
    expect(sameOutput(sample, rows)).toBe(false);
    expect(sameOutput(undefined, sample)).toBe(false);
    expect(comparable(sample)).toEqual(sample.batches);
  });

  it('toCaptured guarda lo que devolvió el servidor, con los errores y los avisos en su forma', () => {
    const run = {
      id: 'x',
      batches: [
        {
          results: [{ columns: ['a'], rows: [[1]] }],
          messages: [message(16, 'Boom', 50001), message(0, 'Listo')],
        },
      ],
    };
    expect(toCaptured('1.2.3.4', run, '2026-01-02')).toEqual({
      server: '1.2.3.4',
      date: '2026-01-02',
      batches: [
        {
          results: [{ columns: ['a'], rows: [[1]] }],
          messages: [
            { number: 50001, level: 16, state: 1, line: 3, text: 'Boom' },
            { text: 'Listo' },
          ],
        },
      ],
    });
  });
});

describe('los pasos capturados del curso', () => {
  const steps = capturedSteps('.');

  it('se encuentran con su script y su captura', () => {
    // En el orden del temario: los del módulo 3 van antes que los de T-SQL programable.
    const keys = steps.map((step) => step.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'types-functions/collation/conflict',
        'programmable-tsql/try-catch/divide',
        'programmable-tsql/try-catch/keeps-going',
        'programmable-tsql/try-catch/rethrow',
      ]),
    );
    expect(keys.indexOf('types-functions/collation/conflict')).toBeLessThan(
      keys.indexOf('programmable-tsql/try-catch/divide'),
    );
    for (const step of steps) {
      expect(step.script.trim(), step.key).not.toBe('');
      expect(step.captured, step.key).toBeDefined();
    }
  });

  it('están escritos como los escribe el script: volver a escribirlos no cambia nada', () => {
    // Si alguien edita a mano un `captured`, esta prueba lo avisa: lo que vale es lo que graba el script.
    for (const step of steps) {
      const text = readFileSync(step.file, 'utf8');
      expect(replaceCaptured(text, step.id, captureYaml(step.captured as Captured)), step.key).toBe(
        text,
      );
    }
  });
});

describe.skipIf(!connectionString())('los pasos capturados contra un SQL Server de verdad', () => {
  it('dan lo mismo que lo grabado (node scripts/sqlserver-capture.mjs --check)', () => {
    const { ok, lines } = capture({ check: true });
    expect(lines.join('\n')).toContain('SQL Server');
    expect(ok, lines.join('\n')).toBe(true);
  }, 300_000);
});
