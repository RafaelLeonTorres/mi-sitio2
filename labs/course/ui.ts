// Une los textos de la interfaz de una página de lección. La página los trae por separado: los
// comunes a todos los cursos (_data/course/ui.yml) en `ui` y los del motor del curso
// (_data/course/ui-csharp.yml) en `engineUi`. El resto del TypeScript lee un solo `CourseUi`.

import type { LessonData, LessonPage } from './types';

/** La lección con sus textos unidos: lo del motor pisa lo común si una clave se repitiera. */
export function lessonFromPage(page: LessonPage): LessonData {
  const { engineUi, ui, ...rest } = page;
  return { ...rest, ui: { ...ui, ...engineUi } };
}
