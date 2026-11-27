// Un paso de ejercicio de un curso de SQL como el reto que corre el motor. Va aparte del adaptador
// y solo depende de los datos (nada del DOM, tampoco por sus tipos): las pruebas de lecciones arman
// con esto el mismo reto que el navegador.

import type { SqlChallenge, SqlDialect } from '../../challenges/sql/data';

/** Lo que se usa de un paso de ejercicio (`StepData`, en types.ts). */
export type SqlStep = Partial<
  Pick<
    SqlChallenge,
    | 'tables'
    | 'check'
    | 'starter'
    | 'solution'
    | 'cases'
    | 'ordered'
    | 'names'
    | 'verify'
    | 'setup'
    | 'query'
    | 'plan'
  >
> & { readonly mode?: string };

export function challengeOf(
  step: SqlStep,
  collation: 'ci' | null,
  dialect?: SqlDialect | null,
): SqlChallenge {
  return {
    language: 'sql',
    category:
      step.mode === 'change' ? 'changes' : step.mode === 'plan' ? 'optimization' : 'queries',
    difficulty: 'easy',
    tables: step.tables ?? [],
    check: step.check ?? 'rows',
    starter: step.starter ?? '',
    solution: step.solution ?? '',
    cases: step.cases ?? [{ sample: true }],
    ...(step.ordered ? { ordered: true } : {}),
    ...(step.names ? { names: step.names } : {}),
    ...(step.verify ? { verify: step.verify } : {}),
    ...(step.setup ? { setup: step.setup } : {}),
    ...(step.query ? { query: step.query } : {}),
    ...(step.plan ? { plan: step.plan } : {}),
    ...(collation ? { collation } : {}),
    ...(dialect ? { dialect } : {}),
  };
}
