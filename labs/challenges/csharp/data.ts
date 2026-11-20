// Los retos de C# tal como vienen de _data/labs/challenges/<id>.yml (la parte `shared`): qué método
// se llama, los casos en JSON, el código inicial y la solución. También arma la petición que va al
// motor (dotnet/challenges/Core) y escribe los valores de los casos.

import type { CsCaseInput, CsEntry, CsRule, CsRunRequest } from './protocol';

export type CsCategory = 'fundamentals' | 'linq' | 'algorithms' | 'advanced' | 'oop';

export type CsDifficulty = 'easy' | 'medium' | 'hard';

/** Un caso: los argumentos del método y lo que debe devolver, o la excepción que debe lanzar. */
export interface CsCase {
  readonly sample?: boolean;
  readonly args?: readonly unknown[];
  readonly expected?: unknown;
  readonly throws?: string;
}

/** Una revisión del código, con el nombre del tipo como se escribe en C# para el texto. */
export interface CsCodeRule extends CsRule {
  readonly name: string;
}

export interface CsChallenge {
  readonly language: 'csharp';
  readonly category: CsCategory;
  readonly difficulty: CsDifficulty;
  readonly entry: CsEntry;
  readonly compare?: 'exact' | 'unordered';
  readonly rules?: readonly CsCodeRule[];
  /** Los tipos que da el reto; se compilan junto al código del visitante. */
  readonly prelude?: string;
  /** El código que revisa: llama al del visitante y devuelve algo que comparar. */
  readonly harness?: string;
  readonly starter: string;
  readonly solution: string;
  readonly cases: readonly CsCase[];
}

/** La petición para correr `source` contra los casos `indexes`. */
export function csharpRequest(
  challenge: CsChallenge,
  indexes: readonly number[],
  source: string,
): CsRunRequest {
  const cases = indexes.flatMap((index): CsCaseInput[] => {
    const item = challenge.cases[index];
    if (!item) return [];
    return [
      {
        index,
        args: item.args ?? [],
        ...('expected' in item ? { expected: item.expected ?? null } : {}),
        ...(item.throws ? { throws: item.throws } : {}),
      },
    ];
  });
  return {
    code: source,
    entry: challenge.entry,
    rules: (challenge.rules ?? []).map(({ kind, type }) => ({ kind, type })),
    cases,
    ...(challenge.prelude ? { prelude: challenge.prelude } : {}),
    ...(challenge.harness ? { harness: challenge.harness } : {}),
    ...(challenge.compare ? { compare: challenge.compare } : {}),
  };
}

/**
 * Un valor de un caso como se lee en la página: el JSON compacto que también usa Jekyll
 * (`jsonify`), para que los ejemplos y los resultados se vean igual.
 */
export function showValue(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value);
}

/** La llamada de un caso: `SecondLargest([4,9,7,9])`. */
export function showCall(entry: CsEntry, args: readonly unknown[]): string {
  return `${entry.method}(${args.map(showValue).join(', ')})`;
}
