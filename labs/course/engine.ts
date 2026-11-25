// El adaptador de motor: lo único del núcleo de la lección (lesson.ts) que cambia de un curso a otro.
// El núcleo lleva los pasos, el progreso, el editor, las pistas, el pie y el menú; el adaptador trae
// el motor que corre el código y las piezas de la derecha (la entrada y la terminal, o los resultados
// y la vista previa). engines/csharp.ts es el de C#; el de SQL y el de Angular vienen con sus cursos.

import type { EditorOptions } from '../shared/editor-api';
import type { StepData } from './types';

export interface ExecuteRequest {
  readonly step: StepData;
  /** El código del editor; el núcleo ya revisó que no esté vacío. */
  readonly code: string;
  /** La nota de la página para cuando el paso falla, si el paso la trae. */
  readonly failure?: string;
}

export interface ExecuteReport {
  /** El código pasó todas las revisiones del paso; solo `check` lo puede decir. */
  readonly passed: boolean;
  /** El renglón del código que el editor debe marcar, si el motor señaló uno. */
  readonly line?: number;
  /** Lo que se anuncia a los lectores de pantalla. */
  readonly announcement: string;
  /** El motor falló (no cargó o se pasó del tiempo de preparación): no se revisó nada. */
  readonly failed?: true;
}

/** Las piezas propias del motor, que el núcleo coloca en el panel de la derecha. */
export interface EnginePanels {
  /** La entrada del programa, entre el editor y las acciones; null si el motor no la usa. */
  readonly input: HTMLElement | null;
  /** La terminal o los resultados, debajo de las acciones. */
  readonly output: HTMLElement;
  /** El cuerpo de `output`, donde se escribe lo que sale y la solución de un paso. */
  readonly body: HTMLElement;
  /** El código está vacío: lo dice en `body`. */
  empty(): void;
  /** Se abrió un paso de ejercicio: su entrada de ejemplo y el estado en reposo. */
  open(step: StepData): void;
}

export interface CourseEngine {
  readonly id: 'csharp' | 'sql' | 'angular';
  /** El lenguaje del editor. */
  readonly editorLanguage: NonNullable<EditorOptions['language']>;
  /** Las tablas y sus columnas, para el autocompletado del editor (en SQL). */
  readonly editorSchema?: NonNullable<EditorOptions['schema']>;
  /** El nombre del archivo que se ve sobre el editor. */
  readonly fileLabel: string;
  readonly panels: EnginePanels;
  /** El visitante mostró que va a correr código: empieza a descargar y a calentar el motor. */
  warm(): Promise<void>;
  /** Ejecutar: corre el código del paso y muestra lo que sale. */
  run(request: ExecuteRequest): Promise<ExecuteReport>;
  /** Enviar: además corre las revisiones del paso y dice si pasó. */
  check(request: ExecuteRequest): Promise<ExecuteReport>;
}
