// Lo que las páginas del curso le dejan al TypeScript: los textos de la interfaz (_data/course/ui.yml y,
// los del motor, ui-csharp.yml o ui-sql.yml),
// el código y las revisiones de cada paso (el JSON #cs-data de includes/course/lesson.html) y las
// explicaciones de los errores del compilador (_data/course/csharp/errors.yml).

import type { CsCourseRule } from '../challenges/csharp/protocol';
import type { Dataset, SqlChallenge } from '../challenges/sql/data';
import type { UiTexts } from '../challenges/texts';

export interface CourseUi {
  readonly name: string;
  readonly instructions: string;
  readonly editor_label: string;
  readonly file: string;
  readonly menu: string;
  readonly step_of: string;
  readonly kind: Readonly<Record<string, string>>;
  readonly status: Readonly<Record<string, string>>;
  readonly run: string;
  readonly submit: string;
  readonly hint: string;
  readonly show_solution: string;
  readonly solution_title: string;
  readonly load_solution: string;
  readonly reset: string;
  readonly reset_confirm: string;
  readonly back: string;
  readonly next: string;
  readonly understood: string;
  readonly next_lesson: string;
  readonly to_syllabus: string;
  readonly terminal: string;
  readonly idle: string;
  readonly empty: string;
  readonly stdin: string;
  readonly stdin_help: string;
  readonly loading: string;
  readonly loading_note: string;
  readonly running: string;
  readonly no_output: string;
  readonly verdict_ok: string;
  readonly verdict_bad: string;
  readonly lesson_done: string;
  readonly expected: string;
  readonly got: string;
  readonly run_n: string;
  readonly timeout: string;
  readonly engine_error: string;
  readonly compile_error: string;
  readonly runtime_error: string;
  readonly line: string;
  readonly original_message: string;
  readonly choose: string;
  readonly wrong: string;
  readonly failed: Readonly<Record<string, string>>;
  readonly rules: Readonly<Record<string, string>>;
  /** Como `rules`, para las revisiones que piden varias veces algo: lleva {min}. */
  readonly rules_min: Readonly<Record<string, string>>;
  /** Cómo se llama en esos mensajes cada nombre de sintaxis de Roslyn (`ConstKeyword`: "la palabra const"). */
  readonly syntax: Readonly<Record<string, string>>;
  /** El rótulo de lo que imprime un ejemplo del texto. */
  readonly output: string;
  readonly done_of: string;
  readonly reset_progress_confirm: string;
  /** Exportar e importar el avance, en el temario: los avisos (el de exportar lleva {name}). */
  readonly export_done: string;
  readonly import_done: string;
  readonly import_failed: string;
  /** Solo en los cursos de SQL (ui-sql.yml): el botón que muestra la salida grabada de un paso capturado... */
  readonly show_output?: string;
  /** ...el título del cuadro con las tablas de un ejercicio... */
  readonly tables?: string;
  /** ...y lo que se dice cuando el código corrió y no devolvió ninguna tabla. */
  readonly no_result?: string;
}

/** Una ejecución de un paso, como la escribe el YAML: la entrada es opcional. */
export interface RunData {
  readonly stdin?: string;
  readonly stdout?: string;
  readonly contains?: readonly string[];
  readonly matches?: string;
  readonly throws?: string;
}

/**
 * Lo propio de un ejercicio de SQL, como lo escribe el YAML: lo que revisa el motor es lo mismo que en
 * un reto del laboratorio (`SqlChallenge`), y `level` y `mode` dicen dónde corre y qué pide.
 */
export interface SqlStepData extends Partial<
  Pick<SqlChallenge, 'check' | 'ordered' | 'verify' | 'setup' | 'query' | 'plan' | 'cases'>
> {
  readonly level?: 'executable' | 'concept';
  readonly mode?: 'query' | 'change' | 'plan';
  /** Las tablas de la base de ejemplo que usa. */
  readonly tables?: readonly string[];
}

export interface StepData extends SqlStepData {
  readonly id: string;
  /** `captured`: un paso de SQL con la salida grabada de un servidor real (y una predicción). */
  readonly kind: 'read' | 'exercise' | 'choice' | 'captured';
  readonly starter?: string;
  readonly solution?: string;
  readonly runs?: readonly RunData[];
  readonly rules?: readonly CsCourseRule[];
  /** El índice de la opción correcta, en las preguntas. */
  readonly answer?: number;
  /** En un paso capturado, la opción correcta de su pregunta de predicción, si la trae. */
  readonly predict?: { readonly answer: number };
}

/** Las claves de CourseUi que son del motor (ui-csharp.yml, ui-sql.yml); las demás son comunes (ui.yml). */
export type EngineUiKey =
  | 'file'
  | 'editor_label'
  | 'terminal'
  | 'idle'
  | 'empty'
  | 'stdin'
  | 'stdin_help'
  | 'output'
  | 'no_output'
  | 'loading'
  | 'loading_note'
  | 'timeout'
  | 'engine_error'
  | 'failed'
  | 'compile_error'
  | 'runtime_error'
  | 'original_message'
  | 'rules'
  | 'rules_min'
  | 'syntax'
  | 'show_output'
  | 'tables'
  | 'no_result';

/** Explicaciones de errores por código y por idioma (`es`, `en`). */
export type ErrorNotes = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Lo que la página de una lección de un curso de SQL le deja al adaptador SQL. */
export interface SqlLessonPage {
  /** Las tablas de la base de ejemplo que usan los pasos de la lección. */
  readonly dataset: Dataset;
  /** Los textos de los resultados, de challenge-ui.yml: los mismos de los retos. */
  readonly ui: Pick<UiTexts, 'results' | 'challenge' | 'notes' | 'blocked'>;
  /** La intercalación con la que se traduce el código (`ci`, en el curso de SQL Server). */
  readonly collation: 'ci' | null;
}

export interface LessonData {
  /** `módulo/lección`, la clave del progreso. */
  readonly id: string;
  readonly steps: readonly StepData[];
  /** El código inicial propio de este idioma, por id de paso; si falta, vale el de `steps`. */
  readonly starters: Readonly<Record<string, string>>;
  readonly ui: CourseUi;
  readonly errors: ErrorNotes;
  /** La carpeta con los archivos del motor (.NET o PGlite). */
  readonly engine: string | null;
  readonly worker: string | null;
  /** El motor del curso, para elegir su adaptador; sin él, el de C#. */
  readonly engineId?: 'csharp' | 'sql';
  /** Lo de los cursos de SQL; null en los demás. */
  readonly sql?: SqlLessonPage | null;
  readonly syllabus: string;
  readonly next: { readonly url: string; readonly title: string } | null;
}

/** Lo que trae la página de una lección: los textos comunes y los del motor, por separado (ui.ts los une). */
export interface LessonPage extends Omit<LessonData, 'ui'> {
  readonly ui: Omit<CourseUi, EngineUiKey>;
  readonly engineUi: Pick<CourseUi, EngineUiKey>;
}

/** Los textos que usa el temario. */
export interface SyllabusData {
  readonly ui: Pick<
    CourseUi,
    'done_of' | 'reset_progress_confirm' | 'export_done' | 'import_done' | 'import_failed'
  >;
}
