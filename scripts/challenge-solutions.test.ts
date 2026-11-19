import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { Dataset, SqlChallenge } from '../labs/challenges/sql/data';
import { pgliteOpener, type CreatePGlite } from '../labs/challenges/sql/pglite';
import { runCase, type CaseOutcome } from '../labs/challenges/sql/runner';

// Cada reto de SQL contra el mismo motor del sitio, PGlite, en Node: la solución de referencia
// pasa todos sus casos, el código inicial no (si pasara, el reto no pediría nada) y, en los casos
// que revisan el plan, el código inicial reprueba. Tarda cerca de un minuto: cada caso abre su
// propia base y algunos generan 50,000 pedidos.

const open = pgliteOpener(((options) => PGlite.create(options)) as CreatePGlite);
const dataset = (
  parse(readFileSync('_data/labs/challenge-datasets.yml', 'utf8')) as { shared: Dataset }
).shared;
const ids = readdirSync('_data/labs/challenges')
  .filter((name) => name.endsWith('.yml'))
  .map((name) => name.replace(/\.yml$/, ''))
  .sort();

const challengeOf = (id: string) =>
  (parse(readFileSync(`_data/labs/challenges/${id}.yml`, 'utf8')) as { shared: SqlChallenge })
    .shared;

/** Por qué no pasó un caso, para el mensaje de la prueba. */
function why(outcome: CaseOutcome): string {
  return JSON.stringify({
    refusal: outcome.refusal,
    blocked: outcome.blocked,
    error: outcome.error?.message,
    mismatch: outcome.mismatch,
    rules: outcome.plan?.rules,
  });
}

describe('soluciones de los retos de SQL', () => {
  it('hay retos que revisar', () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  for (const id of ids) {
    const challenge = challengeOf(id);

    it(`${id}: la solución pasa todos los casos`, async () => {
      for (let index = 0; index < challenge.cases.length; index++) {
        const outcome = await runCase(open, challenge, dataset, index, challenge.solution);
        expect(outcome.passed, `caso ${index + 1}: ${why(outcome)}`).toBe(true);
      }
    }, 120_000);

    it(`${id}: el código inicial no pasa`, async () => {
      const outcomes: CaseOutcome[] = [];
      for (let index = 0; index < challenge.cases.length; index++) {
        outcomes.push(await runCase(open, challenge, dataset, index, challenge.starter));
      }
      expect(outcomes.every((outcome) => outcome.passed)).toBe(false);
      challenge.cases.forEach((data, index) => {
        if (data.explain) expect(outcomes[index]?.passed, `caso ${index + 1} con plan`).toBe(false);
      });
    }, 120_000);
  }
});
