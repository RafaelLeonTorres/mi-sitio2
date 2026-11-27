// Punto de entrada del curso (assets/js/labs/course.js): una lección o el temario, según lo que
// traiga la página. El editor (CodeMirror) y el motor de cada curso se descargan aparte: el de C# (en
// su worker) con su adaptador, y el de SQL (PGlite, en su worker) con el suyo, que solo se carga en
// las lecciones de SQL.

import { CsharpEngine } from '../challenges/csharp/engine';
import { pageLang, type Lang } from '../shared/format';
import { readJson } from '../shared/i18n';
import type { CourseEngine } from './engine';
import { createCsharpAdapter } from './engines/csharp';
import { startLesson } from './lesson';
import { browserStorage, createCourseProgress } from './progress';
import { startSyllabus } from './syllabus';
import type { LessonData, LessonPage, SyllabusData } from './types';
import { lessonFromPage } from './ui';

/** El adaptador del motor del curso: el de SQL se descarga solo en sus lecciones. */
async function createAdapter(data: LessonData, lang: Lang): Promise<CourseEngine> {
  if (data.engineId === 'sql' && data.sql && data.worker && data.engine) {
    const [{ createSqlAdapter }, { SqlEngine }] = await Promise.all([
      import('./engines/sql'),
      import('../challenges/engine'),
    ]);
    const { dialect } = data.sql;
    const engine = new SqlEngine({
      worker: data.worker,
      assets: data.engine,
      ...(dialect ? { warm: { dialect } } : {}),
    });
    return createSqlAdapter(engine, { ...data, sql: data.sql }, lang);
  }
  return createCsharpAdapter(
    new CsharpEngine({ worker: data.worker ?? '', assets: data.engine ?? '' }),
    data,
    lang,
  );
}

const progress = createCourseProgress(browserStorage());
const lesson = document.querySelector<HTMLElement>('.cs-lesson');
const syllabus = document.querySelector<HTMLElement>('.cs-syllabus');

if (lesson) {
  const data = lessonFromPage(readJson<LessonPage>('cs-data'));
  const lang = pageLang();
  void createAdapter(data, lang).then((engine) =>
    startLesson(lesson, data, {
      engine,
      progress,
      lang,
      loadEditor: () => import('../shared/editor').then((module) => module.createEditor),
    }),
  );
} else if (syllabus) {
  startSyllabus(syllabus, readJson<SyllabusData>('cs-data').ui, progress);
}
