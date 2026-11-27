// El adaptador de SQL del curso: el motor de SQL de los retos (PGlite en un worker con tiempo límite),
// las tablas del ejercicio y el panel de resultados. Lo que corre y cómo se dibujan los resultados es
// lo del laboratorio (challenges/engine.ts y challenges/results.ts); aquí solo cambia a qué casos
// responde cada botón y cómo se juzga. Ejecutar corre el caso de ejemplo y enseña lo que devolvió el
// código; Enviar corre todos los casos y compara cada uno con lo que devuelve la solución.

import type { CaseResult, CasesRun } from '../../challenges/engine';
import type { SqlCasesEngine } from '../../challenges/languages';
import {
  blockedList,
  errorBlock,
  notesBlock,
  renderCases,
  renderStatus,
  resultTable,
  type Context,
} from '../../challenges/results';
import { editorSchema, type SqlChallenge } from '../../challenges/sql/data';
import type { CaseOutcome } from '../../challenges/sql/runner';
import type { UiTexts } from '../../challenges/texts';
import { h } from '../../shared/dom';
import type { Phase } from '../../shared/engine';
import { formatNumber, type Lang } from '../../shared/format';
import { fill } from '../../shared/template';
import type { CourseEngine, ExecuteReport, ExecuteRequest } from '../engine';
import type { LessonData, SqlLessonPage, StepData } from '../types';
import { challengeOf } from './sql-challenge';

/** Una lección de un curso de SQL: lo de siempre y lo que la página le deja a este adaptador. */
export type SqlLessonData = LessonData & { readonly sql: SqlLessonPage };

const outcomeOf = (result: CaseResult): CaseOutcome | undefined =>
  'outcome' in result ? result.outcome : undefined;

/** El renglón del primer error del código, para marcarlo en el editor. */
function errorLine(run: CasesRun): number | undefined {
  for (const result of run.results) {
    const line = outcomeOf(result)?.error?.line;
    if (line) return line;
  }
  return undefined;
}

export function createSqlAdapter(
  engine: SqlCasesEngine,
  data: SqlLessonData,
  lang: Lang,
): CourseEngine {
  const { ui } = data;
  // Del JSON de la página solo vienen las secciones de challenge-ui.yml que dibujan los resultados.
  const texts = data.sql.ui as UiTexts;
  const { results } = texts;
  const { dialect } = data.sql;
  // En el curso de PostgreSQL, cada error conocido (errors.yml, por SQLSTATE) trae su explicación.
  const context: Context = {
    texts,
    lang,
    timeoutSeconds: engine.timeoutMs / 1000,
    ...(dialect ? { errorNote: (code: string) => data.errors[code]?.[lang] } : {}),
  };

  // Las tablas del ejercicio, con sus filas de ejemplo, entre el editor y los botones.
  const tables = h('details', { class: 'cs-tables', hidden: true });
  const body = h('div', { class: 'cs-terminal-body' });
  const output = h(
    'section',
    { class: 'cs-terminal cs-results', 'aria-labelledby': 'cs-results-title' },
    [h('h2', { id: 'cs-results-title' }, [ui.output]), body],
  );

  function showTables(step: StepData): void {
    const names = step.tables ?? [];
    tables.hidden = names.length === 0;
    tables.replaceChildren(
      h('summary', {}, [`${ui.tables ?? ''}: ${names.join(', ')}`]),
      ...names.flatMap((name) => {
        const table = data.sql.dataset.tables.find((item) => item.id === name);
        return table ? [resultTable(table.sample, context, name)] : [];
      }),
    );
  }

  /** Lo que devolvió el código en el caso de ejemplo, sin juzgarlo (Ejecutar). */
  function renderRun(run: CasesRun, challenge: SqlChallenge): string {
    const result = run.results[0];
    const outcome = result ? outcomeOf(result) : undefined;
    if (!result || !outcome) {
      const text = fill(results.timeout, { seconds: formatNumber(context.timeoutSeconds, lang) });
      renderStatus(body, text, undefined, 'bad');
      return text;
    }
    const parts: (HTMLElement | null)[] = [];
    let announcement = '';
    if (outcome.refusal === 'blocked' && outcome.blocked) {
      parts.push(blockedList(outcome.blocked, context));
      announcement = results.refusal.blocked;
    } else if (outcome.refusal) {
      parts.push(h('div', { class: 'ch-error' }, [h('p', {}, [results.refusal[outcome.refusal]])]));
      announcement = results.refusal[outcome.refusal];
    } else if (outcome.error) {
      parts.push(errorBlock(outcome.error, context, challenge.check === 'table'));
      announcement = outcome.error.message;
    }
    if (outcome.actual && outcome.actual.columns.length > 0) {
      const count = outcome.actual.rows.length;
      const text = count === 1 ? results.row : fill(results.rows, { n: formatNumber(count, lang) });
      parts.push(
        resultTable(
          outcome.actual,
          context,
          challenge.check === 'table' ? results.actual_table : undefined,
        ),
        h('p', { class: 'ch-more-rows' }, [text]),
      );
      announcement ||= text;
    } else if (!outcome.refusal && !outcome.error) {
      parts.push(h('p', { class: 'ch-status-note' }, [ui.no_result ?? '']));
      announcement = ui.no_result ?? '';
    }
    parts.push(notesBlock(outcome.notes, context));
    body.replaceChildren(...parts.filter((part): part is HTMLElement => part !== null));
    return announcement;
  }

  async function execute(
    mode: 'run' | 'submit',
    { step, code, failure }: ExecuteRequest,
  ): Promise<ExecuteReport> {
    const challenge = challengeOf(step, data.sql.collation, dialect);
    const samples = challenge.cases.flatMap((item, index) => (item.sample ? [index] : []));
    const indexes =
      mode === 'submit'
        ? challenge.cases.map((_, index) => index)
        : samples.length > 0
          ? samples
          : [0];
    const status = (phase: Phase, position = 0) =>
      phase === 'loading'
        ? renderStatus(body, results.loading, results.loading_note)
        : renderStatus(body, fill(results.running, { n: position + 1, total: indexes.length }));
    status(engine.loaded ? 'running' : 'loading');
    try {
      const run = await engine.runCases(challenge, data.sql.dataset, indexes, code, status);
      const line = errorLine(run);
      const lineField = line ? { line } : {};
      if (mode === 'run')
        return { passed: false, ...lineField, announcement: renderRun(run, challenge) };
      const verdict = renderCases(body, run, indexes.length, 'submit', challenge, context);
      // La frase de la lección para cuando el paso no pasa, arriba del veredicto.
      if (!verdict.allPassed && failure) body.prepend(h('p', { class: 'ch-why' }, [failure]));
      return {
        passed: verdict.allPassed,
        ...lineField,
        announcement: verdict.allPassed ? ui.verdict_ok : ui.verdict_bad,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const text = fill(results.engine_error, { message });
      renderStatus(body, text, undefined, 'bad');
      return { passed: false, announcement: text, failed: true };
    }
  }

  return {
    id: 'sql',
    editorLanguage: dialect ?? 'sql',
    editorSchema: editorSchema(data.sql.dataset.tables),
    fileLabel: ui.file,
    panels: {
      input: tables,
      output,
      body,
      empty: () => renderStatus(body, ui.empty),
      open: (step) => {
        showTables(step);
        renderStatus(body, ui.idle);
      },
    },
    warm: () => engine.warm(),
    run: (request) => execute('run', request),
    check: (request) => execute('submit', request),
  };
}
