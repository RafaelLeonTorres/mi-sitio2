// Punto de entrada de los retos de código (assets/js/labs/challenges.js): el catálogo, la página
// de un reto o el playground de SQL, según lo que traiga la página. El editor (CodeMirror) y el
// motor (PGlite, en un worker) se descargan aparte.

import { readJson } from '../shared/i18n';
import { pageLang } from '../shared/format';
import { startCatalog } from './catalog';
import { startChallenge } from './challenge';
import { SqlEngine } from './engine';
import { startPlayground } from './playground-page';
import { browserStorage, createProgress } from './progress';
import type { CatalogPageData, ChallengePageData, PlaygroundPageData } from './texts';

const progress = createProgress(browserStorage());
const lang = pageLang();
const loadEditor = () => import('./editor').then((module) => module.createEditor);

const catalog = document.querySelector<HTMLElement>('.ch-catalog');
const page = document.querySelector<HTMLElement>('.ch-page');
const playground = document.querySelector<HTMLElement>('.ch-playground');

if (catalog) {
  const data = readJson<CatalogPageData>('ch-data');
  startCatalog(catalog, data.ui.catalog, { progress });
} else if (page) {
  const data = readJson<ChallengePageData>('ch-data');
  const engine = new SqlEngine({ worker: data.worker, assets: data.engine });
  startChallenge(page, data, { engine, progress, lang, loadEditor });
} else if (playground) {
  const data = readJson<PlaygroundPageData>('ch-data');
  const engine = new SqlEngine({ worker: data.worker, assets: data.engine });
  startPlayground(playground, data, { engine, progress, lang, loadEditor });
}
