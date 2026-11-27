// Lo que Jekyll deja en la página de la sección Entrevista (#quiz-data), en el idioma de la
// página: los textos y las preguntas por tema (_data/interview/).

export interface Question {
  readonly id: string;
  readonly q: string;
  /** La primera es la correcta; el simulador las revuelve al mostrarlas. */
  readonly options: readonly string[];
  readonly why: string;
}

export interface Reference {
  readonly title: string;
  readonly url: string;
}

export interface Topic {
  readonly id: string;
  readonly title: string;
  readonly refs: readonly Reference[];
  readonly questions: readonly Question[];
}

/** Las claves de `_data/interview/ui.yml` que usa el simulador. */
export type TextKey =
  | 'bank'
  | 'mode_exam'
  | 'mode_exam_help'
  | 'mode_practice'
  | 'pool_exam'
  | 'pool_practice'
  | 'pool_none'
  | 'start_exam'
  | 'start_practice'
  | 'question'
  | 'answered'
  | 'score'
  | 'clock'
  | 'five_left'
  | 'time_up'
  | 'options'
  | 'code_label'
  | 'previous'
  | 'next'
  | 'check'
  | 'choose_first'
  | 'finish_exam'
  | 'finish_practice'
  | 'see_results'
  | 'abandon'
  | 'confirm_abandon'
  | 'confirm_finish'
  | 'navigator'
  | 'nav_answered'
  | 'nav_pending'
  | 'correct'
  | 'incorrect'
  | 'mark_correct'
  | 'mark_wrong'
  | 'why'
  | 'results_title'
  | 'results_score'
  | 'results_none'
  | 'results_time_up'
  | 'results_time'
  | 'by_topic'
  | 'col_topic'
  | 'col_correct'
  | 'col_percent'
  | 'fraction'
  | 'percent'
  | 'review_title'
  | 'only_mistakes'
  | 'no_mistakes'
  | 'your_answer'
  | 'right_answer'
  | 'unanswered'
  | 'study_title'
  | 'restart';

export type QuizTexts = Readonly<Record<TextKey, string>>;

export interface QuizData {
  readonly ui: QuizTexts;
  readonly topics: readonly Topic[];
}
