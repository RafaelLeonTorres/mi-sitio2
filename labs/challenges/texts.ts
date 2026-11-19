// Los textos de los retos tal como Jekyll los deja en la página (_data/labs/challenge-ui.yml, en el
// idioma de la página) y lo demás que trae el JSON #ch-data de cada página.

import type { Dataset, SqlCategory, SqlChallenge } from './sql/data';
import type { PlanRule } from './sql/data';
import type { BlockKey, NoteKey } from './sql/translate';
import type { Mismatch } from './sql/compare';

export interface CatalogTexts {
  readonly filters_label: string;
  readonly category: string;
  readonly difficulty: string;
  readonly status: string;
  readonly any: string;
  readonly statuses: Readonly<Record<'all' | 'solved' | 'pending', string>>;
  readonly showing: string;
  readonly none: string;
  readonly progress: string;
  readonly solved: string;
  readonly started: string;
  readonly progress_note: string;
  readonly reset: string;
  readonly reset_confirm: string;
  readonly reset_done: string;
}

export interface ChallengeTexts {
  readonly editor_label: string;
  readonly loading_editor: string;
  readonly next_hint: string;
  readonly show_solution: string;
  readonly hide_solution: string;
  readonly reset_confirm: string;
  readonly results_empty: string;
  readonly solved_title: string;
  readonly solved_text: string;
  readonly expected_starter: string;
  readonly expected_query: string;
  readonly expected_table: string;
  readonly input_empty: string;
  readonly no_rows: string;
  readonly generated: string;
  readonly generated_only: string;
}

export interface ResultTexts {
  readonly loading: string;
  readonly loading_note: string;
  readonly running: string;
  readonly summary: string;
  readonly sample_ok: string;
  readonly sample_failed: string;
  readonly failed: string;
  readonly case: string;
  readonly sample: string;
  readonly passed: string;
  readonly not_passed: string;
  readonly timeout: string;
  readonly engine_error: string;
  readonly error: string;
  readonly error_line: string;
  readonly error_detail: string;
  readonly error_hint: string;
  readonly error_kept_going: string;
  readonly expected: string;
  readonly actual: string;
  readonly actual_table: string;
  readonly rows: string;
  readonly row: string;
  readonly more_rows: string;
  readonly input: string;
  readonly mismatch: Readonly<Record<Mismatch['kind'], string>>;
  readonly refusal: Readonly<Record<'empty' | 'single-query' | 'blocked', string>>;
  readonly line: string;
  readonly plan: string;
  readonly rules: string;
  readonly rule_ok: string;
  readonly rule_failed: string;
  readonly notes: string;
}

export interface PlaygroundTexts {
  readonly run: string;
  readonly reset_confirm: string;
  readonly statement: string;
  readonly affected: string;
  readonly affected_one: string;
  readonly done: string;
  readonly empty: string;
  readonly statements: string;
  readonly statements_one: string;
}

export interface UiTexts {
  readonly name: string;
  readonly catalog: CatalogTexts;
  readonly challenge: ChallengeTexts;
  readonly results: ResultTexts;
  readonly rules: Readonly<Record<PlanRule['kind'], string>>;
  readonly blocked: Readonly<Record<BlockKey, string>>;
  readonly notes: Readonly<Record<NoteKey, string>>;
  readonly playground: PlaygroundTexts;
  readonly categories: Readonly<Record<SqlCategory, string>>;
}

/** Lo que llena cada generador de datos, en el idioma de la página. */
export interface GeneratorText {
  readonly id: string;
  readonly text: string;
}

/** El JSON de la página de un reto. */
export interface ChallengePageData {
  readonly id: string;
  readonly challenge: SqlChallenge;
  readonly dataset: Dataset;
  readonly generated: readonly GeneratorText[];
  readonly ui: UiTexts;
  /** La carpeta con los archivos de PGlite. */
  readonly engine: string;
  /** El worker del motor de SQL. */
  readonly worker: string;
}

/** El JSON del playground. */
export interface PlaygroundPageData {
  readonly playground: true;
  readonly starter: string;
  readonly dataset: Dataset;
  readonly ui: UiTexts;
  readonly engine: string;
  readonly worker: string;
}

/** El JSON del catálogo: solo sus textos. */
export interface CatalogPageData {
  readonly catalog: true;
  readonly ui: { readonly catalog: CatalogTexts };
}
