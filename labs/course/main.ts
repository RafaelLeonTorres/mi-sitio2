// Punto de entrada del curso (assets/js/labs/course.js): una lección o el temario, según lo que
// traiga la página. El editor (CodeMirror) y el motor de C# (en su worker) se descargan aparte.

import { CsharpEngine } from '../challenges/csharp/engine';
import { pageLang } from '../shared/format';
import { readJson } from '../shared/i18n';
import { startLesson } from './lesson';
import { browserStorage, createCourseProgress } from './progress';
import { startSyllabus } from './syllabus';
import type { LessonPage, SyllabusData } from './types';
import { lessonFromPage } from './ui';

const progress = createCourseProgress(browserStorage());
const lesson = document.querySelector<HTMLElement>('.cs-lesson');
const syllabus = document.querySelector<HTMLElement>('.cs-syllabus');

if (lesson) {
  const data = lessonFromPage(readJson<LessonPage>('cs-data'));
  const engine = new CsharpEngine({ worker: data.worker, assets: data.engine });
  startLesson(lesson, data, {
    engine,
    progress,
    lang: pageLang(),
    loadEditor: () => import('../shared/editor').then((module) => module.createEditor),
  });
} else if (syllabus) {
  startSyllabus(syllabus, readJson<SyllabusData>('cs-data').ui, progress);
}
