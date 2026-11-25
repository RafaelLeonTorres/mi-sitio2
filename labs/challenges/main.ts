// Punto de entrada de los retos de código (assets/js/labs/challenges.js): el catálogo, la página
// de un reto de SQL o de C#, un playground o el modo entrevista, según lo que traiga la página. El
// editor (CodeMirror) y los motores (PGlite y .NET, cada uno en su worker) se descargan aparte.

import { readJson } from '../shared/i18n';
import { pageLang } from '../shared/format';
import { startCatalog } from './catalog';
import { startChallenge } from './challenge';
import { CsharpEngine } from './csharp/engine';
import { SqlEngine } from './engine';
import { startCsPlayground } from './csharp/playground-page';
import {
  createInterviewStore,
  interviewForChallenge,
  startInterviewPage,
  type InterviewPageData,
} from './interview';
import { csharpLanguage, sqlLanguage } from './languages';
import { startPlayground } from './playground-page';
import { browserStorage, createProgress } from './progress';
import type {
  CatalogPageData,
  ChallengePageData,
  CsChallengePageData,
  CsPlaygroundPageData,
  PlaygroundPageData,
} from './texts';

const storage = browserStorage();
const progress = createProgress(storage);
const interviews = createInterviewStore(storage);
const lang = pageLang();
const loadEditor = () => import('../shared/editor').then((module) => module.createEditor);

const catalog = document.querySelector<HTMLElement>('.ch-catalog');
const page = document.querySelector<HTMLElement>('.ch-page');
const playground = document.querySelector<HTMLElement>('.ch-playground');
const interview = document.querySelector<HTMLElement>('.ch-interview');

if (catalog) {
  const data = readJson<CatalogPageData>('ch-data');
  startCatalog(catalog, data.ui.catalog, { progress });
} else if (page) {
  const data = readJson<ChallengePageData | CsChallengePageData>('ch-data');
  // Si el reto es parte de una entrevista: la barra con el reloj y lo que se anota al resolverlo.
  const session = interviewForChallenge(page, data.id, data.ui, { store: interviews, lang });
  const common = {
    progress,
    lang,
    loadEditor,
    ...(session
      ? { onSolved: () => session.onSolved(), solvedText: () => session.solvedText() }
      : {}),
  };
  if (data.challenge.language === 'csharp') {
    const csharp = data as CsChallengePageData;
    const engine = new CsharpEngine({ worker: csharp.worker, assets: csharp.engine });
    startChallenge(page, csharp, { language: csharpLanguage(engine, csharp, lang), ...common });
  } else {
    const sql = data as ChallengePageData;
    const engine = new SqlEngine({ worker: sql.worker, assets: sql.engine });
    startChallenge(page, sql, { language: sqlLanguage(engine, sql, lang), ...common });
  }
} else if (playground) {
  const data = readJson<PlaygroundPageData | CsPlaygroundPageData>('ch-data');
  if (data.playground === 'csharp') {
    const engine = new CsharpEngine({ worker: data.worker, assets: data.engine });
    startCsPlayground(playground, data, { engine, progress, lang, loadEditor });
  } else {
    const engine = new SqlEngine({ worker: data.worker, assets: data.engine });
    startPlayground(playground, data, { engine, progress, lang, loadEditor });
  }
} else if (interview) {
  const data = readJson<InterviewPageData>('ch-data');
  startInterviewPage(interview, data, { store: interviews, lang });
}
