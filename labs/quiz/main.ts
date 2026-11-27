// Punto de entrada del simulador de la sección Entrevista (assets/js/labs/quiz.js).

import { browserStorage } from '../challenges/progress';
import { readJson } from '../shared/i18n';
import { startQuiz } from './page';
import type { QuizData } from './types';

const root = document.querySelector<HTMLElement>('.quiz');
if (root) startQuiz(root, readJson<QuizData>('quiz-data'), { storage: browserStorage() });
