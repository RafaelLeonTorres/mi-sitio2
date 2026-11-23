// Los mensajes entre la página y el worker del motor de C#, y lo que intercambia el worker con el
// motor de .NET (dotnet/challenges/Core/Models.cs, en JSON con los nombres en camelCase). La página
// manda una petición con un número; el worker responde con ese número cuándo compiló, cuándo empieza
// el código del visitante en cada caso (desde ahí corre el tiempo límite), cada resultado y el final.

/** El método que se llama en cada caso: del visitante o del código que revisa el reto. */
export interface CsEntry {
  readonly type: string;
  readonly method: string;
}

/** Una revisión del código; `type` es el nombre de metadatos (System.Lazy`1) o un tipo del visitante. */
export interface CsRule {
  readonly kind: 'uses-type' | 'avoids-type' | 'private-constructor';
  readonly type: string;
}

export interface CsCaseInput {
  readonly index: number;
  readonly args: readonly unknown[];
  /** Falta si el caso espera una excepción. */
  readonly expected?: unknown;
  readonly throws?: string;
}

export interface CsRunRequest {
  readonly code: string;
  readonly prelude?: string;
  readonly harness?: string;
  readonly entry: CsEntry;
  readonly compare?: 'exact' | 'unordered';
  readonly rules: readonly CsRule[];
  readonly cases: readonly CsCaseInput[];
}

/** Un error del compilador; `source` es code (el editor), prelude, harness o vacío. */
export interface CsDiagnostic {
  readonly id: string;
  readonly message: string;
  readonly source: string;
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
}

/** Un problema que no es del compilador: una clave de challenge-ui.yml y sus datos. */
export interface CsProblem {
  readonly key: string;
  readonly values: Readonly<Record<string, string>>;
}

export interface CsRuleOutcome {
  readonly kind: CsRule['kind'];
  readonly type: string;
  readonly passed: boolean;
}

export interface CsCompileOutcome {
  readonly compiled: boolean;
  readonly compileMs: number;
  readonly diagnostics: readonly CsDiagnostic[];
  readonly rules: readonly CsRuleOutcome[];
  readonly entry?: CsProblem;
}

/** Una excepción del código: su tipo, su mensaje, el método donde ocurrió y, fuera del navegador, la línea. */
export interface CsRuntimeError {
  readonly type: string;
  readonly message: string;
  readonly line?: number;
  readonly member?: string;
}

export interface CsCaseOutcome {
  readonly index: number;
  readonly passed: boolean;
  /** Lo que devolvió el código; falta si lanzó una excepción o si el método no devuelve nada. */
  readonly actual?: unknown;
  readonly error?: CsRuntimeError;
  readonly console: string;
  readonly ms: number;
  readonly problem?: CsProblem;
}

export interface CsPlaygroundOutcome {
  readonly compiled: boolean;
  readonly compileMs: number;
  readonly diagnostics: readonly CsDiagnostic[];
  readonly console: string;
  readonly error?: CsRuntimeError;
  readonly ms: number;
}

/** Una ejecución de un paso del curso: la entrada simulada y lo que se espera que escriba. */
export interface CsCourseRun {
  readonly stdin: string;
  readonly stdout?: string;
  readonly contains?: readonly string[];
  readonly matches?: string;
  readonly throws?: string;
}

/** Una revisión del código de un paso del curso (dotnet/challenges/Core/Course.cs). */
export interface CsCourseRule {
  readonly kind: string;
  readonly name?: string;
  readonly type?: string;
  readonly min?: number;
}

export interface CsProgramRequest {
  readonly code: string;
  readonly runs: readonly CsCourseRun[];
  readonly rules: readonly CsCourseRule[];
}

export interface CsCourseRuleOutcome {
  readonly kind: string;
  readonly name?: string;
  readonly type?: string;
  readonly passed: boolean;
  /** Cuántas veces se pedía, si la revisión cuenta. */
  readonly min?: number;
}

export interface CsProgramCompile {
  readonly compiled: boolean;
  readonly compileMs: number;
  readonly diagnostics: readonly CsDiagnostic[];
  readonly rules: readonly CsCourseRuleOutcome[];
}

/** Qué revisión de la salida falló: `error`, `throws`, `stdout`, `contains` o `matches`. */
export interface CsRunOutcome {
  readonly index: number;
  readonly passed: boolean;
  readonly stdout: string;
  readonly expected?: string;
  readonly failed: readonly string[];
  readonly error?: CsRuntimeError;
  readonly ms: number;
}

export type CsEngineRequest =
  /** Cargar .NET y pagar la primera compilación antes de que el visitante pulse Ejecutar. */
  | { readonly type: 'warm'; readonly id: number; readonly assets: string }
  | {
      readonly type: 'cases';
      readonly id: number;
      /** La carpeta con el motor publicado (dotnet.js y sus archivos). */
      readonly assets: string;
      readonly request: CsRunRequest;
    }
  | {
      readonly type: 'playground';
      readonly id: number;
      readonly assets: string;
      readonly source: string;
    }
  /** El programa de un paso del curso, con sus entradas simuladas y sus revisiones. */
  | {
      readonly type: 'program';
      readonly id: number;
      readonly assets: string;
      readonly request: CsProgramRequest;
    };

export type CsEngineReply =
  /** El motor ya cargó; `warmMs` es lo que tardó la compilación de calentamiento. */
  | { readonly type: 'ready'; readonly id: number; readonly warmMs?: number }
  | { readonly type: 'compiled'; readonly id: number; readonly outcome: CsCompileOutcome }
  /** Empieza el código del visitante en el caso `index` (-1 en el playground). */
  | { readonly type: 'code'; readonly id: number; readonly index: number }
  | { readonly type: 'case'; readonly id: number; readonly outcome: CsCaseOutcome }
  | { readonly type: 'playground'; readonly id: number; readonly outcome: CsPlaygroundOutcome }
  /** Cómo compiló el programa de un paso del curso. */
  | { readonly type: 'program'; readonly id: number; readonly outcome: CsProgramCompile }
  /** Lo que pasó en una ejecución del programa. */
  | { readonly type: 'run'; readonly id: number; readonly outcome: CsRunOutcome }
  | { readonly type: 'done'; readonly id: number }
  /** El motor no pudo correr (no cargó .NET, un error propio); no es un error del código. */
  | { readonly type: 'error'; readonly id: number; readonly message: string };
