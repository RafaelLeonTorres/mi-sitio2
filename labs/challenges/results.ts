// Los resultados de una ejecución: por caso, si pasó, lo esperado y lo obtenido, el error con su
// renglón, el plan de PostgreSQL con sus reglas y lo que se tradujo del T-SQL. También los del
// playground. Todo se arma con nodos: los valores de la base nunca se leen como HTML.

import { h, type Child } from '../shared/dom';
import { formatDuration, formatNumber, type Lang } from '../shared/format';
import { fill, inlineCode } from '../shared/template';
import type { CaseResult, CasesRun, PlaygroundRun } from './engine';
import type { ResultSet } from './sql/compare';
import type { Rows, SqlCase, SqlChallenge } from './sql/data';
import type { PlaygroundOutcome } from './sql/playground';
import type { CaseOutcome, SqlError } from './sql/runner';
import type { Blocked, NoteKey } from './sql/translate';
import type { GeneratorText, UiTexts } from './texts';

/** Las filas que se muestran de un resultado; las demás se cuentan. */
export const ROW_LIMIT = 50;

export interface Context {
  readonly texts: UiTexts;
  readonly lang: Lang;
  /** El tiempo límite del código del visitante, en segundos. */
  readonly timeoutSeconds: number;
  /** Lo que llena cada generador, para describir los datos de un caso. */
  readonly generated?: readonly GeneratorText[];
}

const cell = (value: unknown): Child =>
  value === null || value === undefined
    ? h('span', { class: 'ch-null' }, ['NULL'])
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

/** Un resultado como tabla, con a lo más `limit` filas y un aviso de cuántas faltan. */
export function resultTable(
  result: ResultSet | Rows,
  context: Context,
  caption?: string,
  limit = ROW_LIMIT,
): HTMLElement {
  const { results, challenge } = context.texts;
  const shown = result.rows.slice(0, limit);
  const body =
    shown.length > 0
      ? shown.map((row) =>
          h(
            'tr',
            {},
            row.map((value) => h('td', {}, [cell(value)])),
          ),
        )
      : [
          h('tr', {}, [
            h('td', { class: 'ch-empty', colspan: Math.max(1, result.columns.length) }, [
              challenge.no_rows,
            ]),
          ]),
        ];
  const more = result.rows.length - shown.length;
  return h('div', { class: 'ch-grid' }, [
    h('table', { class: 'ch-table' }, [
      caption ? h('caption', {}, [caption]) : null,
      h('thead', {}, [
        h(
          'tr',
          {},
          result.columns.map((column) => h('th', { scope: 'col' }, [column])),
        ),
      ]),
      h('tbody', {}, body),
    ]),
    more > 0
      ? h('p', { class: 'ch-more-rows' }, [
          fill(results.more_rows, { n: formatNumber(more, context.lang) }),
        ])
      : null,
  ]);
}

export function errorBlock(error: SqlError, context: Context, keptGoing = false): HTMLElement {
  const { results } = context.texts;
  const title = error.line ? fill(results.error_line, { line: error.line }) : results.error;
  return h('div', { class: 'ch-error', role: 'group' }, [
    h('p', { class: 'ch-error-title' }, [h('strong', {}, [`${title}: `]), error.message]),
    error.detail ? h('p', {}, [`${results.error_detail}: `, error.detail]) : null,
    error.hint ? h('p', {}, [`${results.error_hint}: `, error.hint]) : null,
    keptGoing ? h('p', { class: 'ch-error-note' }, [results.error_kept_going]) : null,
  ]);
}

export function blockedList(blocked: readonly Blocked[], context: Context): HTMLElement {
  const { results, blocked: messages } = context.texts;
  return h('div', { class: 'ch-error' }, [
    h('p', { class: 'ch-error-title' }, [h('strong', {}, [results.refusal.blocked])]),
    h(
      'ul',
      {},
      blocked.map((item) =>
        h('li', {}, [
          h('strong', {}, [`${fill(results.line, { line: item.line })}: `]),
          ...inlineCode(messages[item.key]),
        ]),
      ),
    ),
  ]);
}

/** Lo que se tradujo del T-SQL, una nota por cambio. */
export function notesBlock(notes: readonly NoteKey[], context: Context): HTMLElement | null {
  if (notes.length === 0) return null;
  return h('div', { class: 'ch-notes' }, [
    h('h4', {}, [context.texts.results.notes]),
    h(
      'ul',
      {},
      notes.map((note) => h('li', {}, inlineCode(context.texts.notes[note]))),
    ),
  ]);
}

/** Los datos de un caso: sus filas por tabla y lo que se generó. */
function caseInput(data: SqlCase, challenge: SqlChallenge, context: Context): HTMLElement {
  const tables = challenge.tables.flatMap((name) => {
    const rows = data.tables?.[name];
    return rows ? [resultTable(rows, context, name)] : [];
  });
  const lead =
    tables.length > 0 ? context.texts.challenge.generated : context.texts.challenge.generated_only;
  const generated = data.generate?.length
    ? [
        h('p', { class: 'ch-generated' }, [lead]),
        h(
          'ul',
          { class: 'ch-generated-list' },
          data.generate.map((id) =>
            h('li', {}, inlineCode(context.generated?.find((item) => item.id === id)?.text ?? id)),
          ),
        ),
      ]
    : [];
  return h('div', { class: 'ch-input' }, [
    h('h4', {}, [context.texts.results.input]),
    ...tables,
    ...generated,
  ]);
}

function planBlock(plan: NonNullable<CaseOutcome['plan']>, context: Context): HTMLElement {
  const { results, rules } = context.texts;
  return h('div', { class: 'ch-plan' }, [
    h('h4', {}, [results.rules]),
    h(
      'ul',
      { class: 'ch-rule-list' },
      plan.rules.map(({ rule, ok }) => {
        const values = {
          table: 'table' in rule ? rule.table : '',
          max: 'max' in rule ? formatNumber(rule.max, context.lang) : '',
        };
        return h('li', { 'data-ok': ok }, [
          h('span', { class: 'ch-mark', 'aria-hidden': 'true' }, [ok ? '✓' : '✗']),
          h('span', { class: 'visually-hidden' }, [
            `${ok ? results.rule_ok : results.rule_failed}: `,
          ]),
          ...inlineCode(fill(rules[rule.kind], values)),
        ]);
      }),
    ),
    h('h4', {}, [results.plan]),
    h('pre', { class: 'ch-plan-text' }, [h('code', {}, [plan.text])]),
  ]);
}

function mismatchText(outcome: CaseOutcome, context: Context): string | null {
  const mismatch = outcome.mismatch;
  if (!mismatch) return null;
  const template = context.texts.results.mismatch[mismatch.kind];
  if (mismatch.kind === 'columns' || mismatch.kind === 'row-count') {
    return fill(template, { expected: mismatch.expected, actual: mismatch.actual });
  }
  if (mismatch.kind === 'values' || mismatch.kind === 'order')
    return fill(template, { row: mismatch.row + 1 });
  return template;
}

/** Un caso: su encabezado con el resultado y, adentro, por qué. */
function caseItem(
  result: CaseResult,
  challenge: SqlChallenge,
  context: Context,
  showInput: boolean,
): HTMLElement {
  const { results } = context.texts;
  const data = challenge.cases[result.index];
  const sample = data?.sample === true;
  const label = `${fill(results.case, { n: result.index + 1 })}${sample ? ` (${results.sample})` : ''}`;
  const passed = 'outcome' in result && result.outcome.passed;
  const parts: Child[] = [];
  let time: string | null = null;

  if ('timedOut' in result) {
    parts.push(
      h('p', { class: 'ch-error' }, [
        fill(results.timeout, { seconds: formatNumber(context.timeoutSeconds, context.lang) }),
      ]),
    );
  } else {
    const outcome = result.outcome;
    if (outcome.ms !== undefined) time = formatDuration(outcome.ms, context.lang);
    if (outcome.refusal === 'blocked' && outcome.blocked)
      parts.push(blockedList(outcome.blocked, context));
    else if (outcome.refusal)
      parts.push(h('p', { class: 'ch-error' }, [results.refusal[outcome.refusal]]));
    if (outcome.error) parts.push(errorBlock(outcome.error, context, challenge.check === 'table'));
    const why = mismatchText(outcome, context);
    if (why) parts.push(h('p', { class: 'ch-why' }, [why]));
    if (showInput && data && !sample) parts.push(caseInput(data, challenge, context));
    const table = challenge.check === 'table';
    if (outcome.expected || outcome.actual) {
      parts.push(
        h('div', { class: 'ch-compare' }, [
          outcome.expected
            ? h('div', {}, [
                h('h4', {}, [table ? context.texts.challenge.expected_table : results.expected]),
                resultTable(outcome.expected, context),
              ])
            : null,
          outcome.actual
            ? h('div', {}, [
                h('h4', {}, [table ? results.actual_table : results.actual]),
                resultTable(outcome.actual, context),
              ])
            : null,
        ]),
      );
    }
    if (outcome.plan) parts.push(planBlock(outcome.plan, context));
  }

  const summary = h('summary', {}, [
    h('span', { class: 'ch-mark', 'aria-hidden': 'true' }, [passed ? '✓' : '✗']),
    h('span', { class: 'ch-case-name' }, [label]),
    h('span', { class: 'ch-case-state' }, [passed ? results.passed : results.not_passed]),
    time ? h('span', { class: 'ch-case-time' }, [time]) : null,
  ]);
  const details = h('details', { class: 'ch-case', 'data-passed': passed }, [summary, ...parts]);
  details.open = !passed;
  return details;
}

export interface Verdict {
  readonly passed: number;
  readonly total: number;
  /** Todos los casos que se corrieron pasaron y no faltó ninguno. */
  readonly allPassed: boolean;
}

/** Los resultados de Ejecutar (los ejemplos) o Enviar (todos los casos). */
export function renderCases(
  container: HTMLElement,
  run: CasesRun,
  expectedCount: number,
  mode: 'run' | 'submit',
  challenge: SqlChallenge,
  context: Context,
): Verdict {
  const { results } = context.texts;
  const passed = run.results.filter((item) => 'outcome' in item && item.outcome.passed).length;
  const allPassed = passed === expectedCount && run.results.length === expectedCount;
  const headline = fill(results.summary, { passed, total: expectedCount });
  const lead =
    mode === 'run'
      ? allPassed
        ? results.sample_ok
        : results.sample_failed
      : allPassed
        ? null
        : results.failed;
  const first = run.results.find((item) => 'outcome' in item);
  const notes = first && 'outcome' in first ? first.outcome.notes : [];
  // Si el código no corrió (vacío, bloqueado o más de una consulta), lo mismo vale para cada caso.
  const refused = first && 'outcome' in first ? first.outcome : undefined;
  if (refused?.refusal && run.results.every((item) => 'outcome' in item && item.outcome.refusal)) {
    container.replaceChildren(
      refused.refusal === 'blocked' && refused.blocked
        ? blockedList(refused.blocked, context)
        : h('div', { class: 'ch-error' }, [h('p', {}, [results.refusal[refused.refusal]])]),
      notesBlock(notes, context) ?? '',
    );
    return { passed: 0, total: expectedCount, allPassed: false };
  }
  container.replaceChildren(
    h('div', { class: 'ch-verdict', 'data-tone': allPassed ? 'good' : 'bad' }, [
      h('p', { class: 'ch-verdict-title' }, [headline]),
      lead ? h('p', {}, [lead]) : null,
    ]),
    h(
      'div',
      { class: 'ch-cases' },
      run.results.map((result) => caseItem(result, challenge, context, mode === 'submit')),
    ),
    notesBlock(notes, context) ?? '',
  );
  return { passed, total: expectedCount, allPassed };
}

/** Un aviso en el panel de resultados: cargando, corriendo o un error del motor. */
export function renderStatus(
  container: HTMLElement,
  message: string,
  note?: string,
  tone?: 'bad',
): void {
  container.replaceChildren(
    h('div', { class: 'ch-status', 'data-tone': tone, role: tone ? 'alert' : undefined }, [
      h('p', {}, [message]),
      note ? h('p', { class: 'ch-status-note' }, [note]) : null,
    ]),
  );
}

function statementItem(
  statement: PlaygroundOutcome['statements'][number],
  position: number,
  context: Context,
): HTMLElement {
  const { playground } = context.texts;
  const title = fill(playground.statement, { n: position + 1, line: statement.line });
  let body: Child;
  if (statement.error) body = errorBlock(statement.error, context);
  else if (statement.result && statement.result.columns.length > 0)
    body = resultTable(statement.result, context);
  else if (statement.result?.affected !== undefined) {
    const count = statement.result.affected;
    body = h('p', {}, [
      count === 1
        ? playground.affected_one
        : fill(playground.affected, { n: formatNumber(count, context.lang) }),
    ]);
  } else body = h('p', {}, [playground.done]);
  return h('section', { class: 'ch-statement-result', 'data-error': Boolean(statement.error) }, [
    h('h4', {}, [title]),
    body,
  ]);
}

/** Los resultados del playground: cada sentencia, el plan si se pidió y las notas. */
export function renderPlayground(
  container: HTMLElement,
  run: PlaygroundRun,
  context: Context,
): void {
  const { results, playground } = context.texts;
  if ('timedOut' in run) {
    renderStatus(
      container,
      fill(results.timeout, { seconds: formatNumber(context.timeoutSeconds, context.lang) }),
      undefined,
      'bad',
    );
    return;
  }
  const outcome = run.outcome;
  const parts: Child[] = [];
  if (outcome.refusal === 'blocked' && outcome.blocked)
    parts.push(blockedList(outcome.blocked, context));
  else if (outcome.refusal === 'empty') parts.push(h('p', {}, [playground.empty]));
  else {
    const count = outcome.statements.length;
    const time = formatDuration(outcome.ms ?? 0, context.lang);
    parts.push(
      h('p', { class: 'ch-verdict-title' }, [
        count === 1
          ? fill(playground.statements_one, { time })
          : fill(playground.statements, { n: count, time }),
      ]),
    );
    parts.push(
      ...outcome.statements.map((statement, index) => statementItem(statement, index, context)),
    );
    if (outcome.plan) {
      parts.push(
        h('div', { class: 'ch-plan' }, [
          h('h4', {}, [results.plan]),
          h('pre', { class: 'ch-plan-text' }, [h('code', {}, [outcome.plan])]),
        ]),
      );
    }
    if (outcome.planError) parts.push(errorBlock(outcome.planError, context));
  }
  const notes = notesBlock(outcome.notes, context);
  if (notes) parts.push(notes);
  container.replaceChildren(...parts.filter((part): part is Node | string => Boolean(part)));
}
