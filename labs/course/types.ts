// Lo que las páginas del curso le dejan al TypeScript: los textos de la interfaz (_data/course/ui.yml),
// el código y las revisiones de cada paso (el JSON #cs-data de includes/course/lesson.html) y las
// explicaciones de los errores del compilador (_data/course/csharp/errors.yml).

import type { CsCourseRule } from '../challenges/csharp/protocol';

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
}

/** Una ejecución de un paso, como la escribe el YAML: la entrada es opcional. */
export interface RunData {
  readonly stdin?: string;
  readonly stdout?: string;
  readonly contains?: readonly string[];
  readonly matches?: string;
  readonly throws?: string;
}

export interface StepData {
  readonly id: string;
  readonly kind: 'read' | 'exercise' | 'choice';
  readonly starter?: string;
  readonly solution?: string;
  readonly runs?: readonly RunData[];
  readonly rules?: readonly CsCourseRule[];
  /** El índice de la opción correcta, en las preguntas. */
  readonly answer?: number;
}

/** Explicaciones de errores por código y por idioma (`es`, `en`). */
export type ErrorNotes = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface LessonData {
  /** `módulo/lección`, la clave del progreso. */
  readonly id: string;
  readonly steps: readonly StepData[];
  /** El código inicial propio de este idioma, por id de paso; si falta, vale el de `steps`. */
  readonly starters: Readonly<Record<string, string>>;
  readonly ui: CourseUi;
  readonly errors: ErrorNotes;
  readonly engine: string;
  readonly worker: string;
  readonly syllabus: string;
  readonly next: { readonly url: string; readonly title: string } | null;
}

/** Los textos que usa el temario. */
export interface SyllabusData {
  readonly ui: Pick<
    CourseUi,
    'done_of' | 'reset_progress_confirm' | 'export_done' | 'import_done' | 'import_failed'
  >;
}
