// Los resultados de C#: si el código no compila, sus errores con la línea; si compila, las reglas
// que se revisan del código y, por caso, la llamada, lo esperado, lo obtenido (o la excepción) y lo
// que escribió en la consola. También los del playground. Todo se arma con nodos: lo que devuelve el
// código del visitante nunca se lee como HTML.

import { h, type Child } from '../../shared/dom';
import { formatDuration, formatNumber, type Lang } from '../../shared/format';
import { fill, inlineCode } from '../../shared/template';
import type { Verdict } from '../results';
import type { CsharpTexts, ResultTexts } from '../texts';
import { showCall, showValue, type CsChallenge } from './data';
import type { CsCaseResult, CsPlaygroundRun, CsRun } from './engine';
import type { CsDiagnostic, CsProblem, CsRuleOutcome, CsRuntimeError } from './protocol';

export interface CsContext {
  readonly results: ResultTexts;
  readonly csharp: CsharpTexts;
  readonly lang: Lang;
  /** El tiempo límite del código del visitante, en segundos. */
  readonly timeoutSeconds: number;
}

/** Un texto con sus valores, y el código entre comillas invertidas como <code>. */
function text(template: string, values: Readonly<Record<string, string | number>> = {}): Child[] {
  return inlineCode(fill(template, values));
}

/** Los errores del compilador: primero los del código del visitante, con su línea. */
function diagnosticList(diagnostics: readonly CsDiagnostic[], context: CsContext): HTMLElement {
  const { csharp } = context;
  return h(
    'ul',
    { class: 'ch-diagnostics' },
    diagnostics.map((diagnostic) => {
      const where =
        diagnostic.source === 'code'
          ? fill(csharp.results.diagnostic, { line: diagnostic.line, column: diagnostic.column })
          : diagnostic.source === 'prelude'
            ? csharp.results.diagnostic_prelude
            : diagnostic.source === 'harness'
              ? csharp.results.diagnostic_harness
              : '';
      return h('li', {}, [
        where ? h('span', { class: 'ch-diagnostic-where' }, [where]) : null,
        h('code', { class: 'ch-diagnostic-id' }, [diagnostic.id]),
        ' ',
        h('span', { class: 'ch-diagnostic-message', lang: 'en' }, [diagnostic.message]),
      ]);
    }),
  );
}

/** Un problema del arnés (una clave de challenge-ui.yml con sus valores). */
function problemText(problem: CsProblem, templates: Readonly<Record<string, string>>): Child[] {
  return text(templates[problem.key] ?? problem.key, problem.values);
}

/** Lo que se revisa del código, con si cumple. */
export function rulesBlock(
  rules: readonly CsRuleOutcome[],
  challenge: CsChallenge,
  context: CsContext,
): HTMLElement | null {
  if (rules.length === 0) return null;
  const { results, csharp } = context;
  return h('div', { class: 'ch-plan' }, [
    h('h4', {}, [csharp.results.rules]),
    h(
      'ul',
      { class: 'ch-rule-list' },
      rules.map((rule) => {
        const name = challenge.rules?.find(
          (item) => item.kind === rule.kind && item.type === rule.type,
        )?.name;
        return h('li', { 'data-ok': rule.passed }, [
          h('span', { class: 'ch-mark', 'aria-hidden': 'true' }, [rule.passed ? '✓' : '✗']),
          h('span', { class: 'visually-hidden' }, [
            `${rule.passed ? results.rule_ok : results.rule_failed}: `,
          ]),
          ...text(csharp.rules[rule.kind], { name: name ?? rule.type }),
        ]);
      }),
    ),
  ]);
}

function errorText(error: CsRuntimeError, context: CsContext): Child[] {
  const { csharp } = context;
  const head = error.member
    ? text(csharp.results.exception_in, { type: error.type, member: error.member })
    : text(csharp.results.exception, { type: error.type });
  return [
    h('strong', {}, head),
    error.line ? ` (${fill(csharp.results.line, { line: error.line })})` : null,
    ': ',
    h('span', { lang: 'en' }, [error.message]),
  ];
}

/** Un valor en un bloque que conserva los espacios y se puede desplazar. */
function valueBlock(value: string): HTMLElement {
  return h('pre', { class: 'ch-value' }, [h('code', {}, [value])]);
}

function caseItem(result: CsCaseResult, challenge: CsChallenge, context: CsContext): HTMLElement {
  const { results, csharp } = context;
  const data = challenge.cases[result.index];
  const sample = data?.sample === true;
  const label = `${fill(results.case, { n: result.index + 1 })}${sample ? ` (${results.sample})` : ''}`;
  const passed = 'outcome' in result && result.outcome.passed;
  const parts: Child[] = [];
  let time: string | null = null;

  if (data) {
    parts.push(
      h('h4', {}, [csharp.results.call]),
      valueBlock(showCall(challenge.entry, data.args ?? [])),
    );
  }
  if ('timedOut' in result) {
    parts.push(
      h('p', { class: 'ch-error' }, [
        fill(results.timeout, { seconds: formatNumber(context.timeoutSeconds, context.lang) }),
      ]),
    );
  } else {
    const outcome = result.outcome;
    time = formatDuration(outcome.ms, context.lang);
    if (outcome.problem) {
      parts.push(
        h('p', { class: 'ch-error' }, problemText(outcome.problem, csharp.results.problem)),
      );
    } else {
      const expected =
        data?.throws !== undefined
          ? h(
              'p',
              { class: 'ch-value-note' },
              text(csharp.results.expected_exception, { type: data.throws }),
            )
          : valueBlock(showValue(data?.expected ?? null));
      const actual = outcome.error
        ? h(
            'p',
            { class: outcome.passed ? 'ch-value-note' : 'ch-error' },
            errorText(outcome.error, context),
          )
        : 'actual' in outcome
          ? valueBlock(showValue(outcome.actual))
          : h('p', { class: 'ch-value-note' }, [csharp.results.no_value]);
      parts.push(
        h('div', { class: 'ch-compare' }, [
          h('div', {}, [h('h4', {}, [results.expected]), expected]),
          h('div', {}, [h('h4', {}, [results.actual]), actual]),
        ]),
      );
    }
    if (outcome.console) {
      parts.push(
        h('h4', {}, [csharp.results.console]),
        valueBlock(outcome.console.replace(/\n$/, '')),
      );
    }
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

/** Los resultados de Ejecutar (los ejemplos) o Enviar (todos los casos). */
export function renderCsCases(
  container: HTMLElement,
  run: CsRun,
  expectedCount: number,
  mode: 'run' | 'submit',
  challenge: CsChallenge,
  context: CsContext,
): Verdict {
  const { results, csharp } = context;
  const compile = run.compile;
  if (compile && !compile.compiled) {
    container.replaceChildren(
      h('div', { class: 'ch-verdict', 'data-tone': 'bad' }, [
        h('p', { class: 'ch-verdict-title' }, [csharp.results.compile_failed]),
      ]),
      diagnosticList(compile.diagnostics, context),
    );
    return { passed: 0, total: expectedCount, allPassed: false };
  }
  if (compile?.entry) {
    container.replaceChildren(
      h('div', { class: 'ch-error' }, [
        h('p', {}, problemText(compile.entry, csharp.results.entry)),
      ]),
    );
    return { passed: 0, total: expectedCount, allPassed: false };
  }

  const rules = compile?.rules ?? [];
  const rulesPassed = rules.every((rule) => rule.passed);
  const passed = run.results.filter((item) => 'outcome' in item && item.outcome.passed).length;
  const casesPassed = passed === expectedCount && run.results.length === expectedCount;
  const allPassed = casesPassed && rulesPassed;
  const headline = fill(results.summary, { passed, total: expectedCount });
  const lead =
    casesPassed && !rulesPassed
      ? csharp.results.rules_failed
      : mode === 'run'
        ? allPassed
          ? results.sample_ok
          : results.sample_failed
        : allPassed
          ? null
          : results.failed;
  container.replaceChildren(
    h('div', { class: 'ch-verdict', 'data-tone': allPassed ? 'good' : 'bad' }, [
      h('p', { class: 'ch-verdict-title' }, [headline]),
      lead ? h('p', {}, [lead]) : null,
      compile
        ? h('p', { class: 'ch-status-note' }, [
            fill(csharp.results.compiled, {
              time: formatDuration(compile.compileMs, context.lang),
            }),
          ])
        : null,
    ]),
    rulesBlock(rules, challenge, context) ?? '',
    h(
      'div',
      { class: 'ch-cases' },
      run.results.map((result) => caseItem(result, challenge, context)),
    ),
  );
  return { passed, total: expectedCount, allPassed };
}

/** La línea del primer error de compilación en el código del visitante, para marcarla. */
export function csErrorLine(run: CsRun): number | undefined {
  return run.compile?.diagnostics.find((diagnostic) => diagnostic.source === 'code')?.line;
}

/** Los resultados del playground: lo que escribió, el error si lo hubo y el tiempo. */
export function renderCsPlayground(
  container: HTMLElement,
  run: CsPlaygroundRun,
  context: CsContext,
): void {
  const { results, csharp } = context;
  if ('timedOut' in run) {
    container.replaceChildren(
      h('div', { class: 'ch-status', 'data-tone': 'bad', role: 'alert' }, [
        h('p', {}, [
          fill(results.timeout, { seconds: formatNumber(context.timeoutSeconds, context.lang) }),
        ]),
      ]),
    );
    return;
  }
  const outcome = run.outcome;
  if (!outcome.compiled) {
    container.replaceChildren(
      h('div', { class: 'ch-verdict', 'data-tone': 'bad' }, [
        h('p', { class: 'ch-verdict-title' }, [csharp.results.compile_failed]),
      ]),
      diagnosticList(outcome.diagnostics, context),
    );
    return;
  }
  const time = formatDuration(outcome.ms, context.lang);
  const compiled = formatDuration(outcome.compileMs, context.lang);
  container.replaceChildren(
    h('p', { class: 'ch-verdict-title' }, [
      fill(outcome.error ? csharp.playground.failed : csharp.playground.finished, { time }),
    ]),
    h('p', { class: 'ch-status-note' }, [fill(csharp.results.compiled, { time: compiled })]),
    h('h4', {}, [csharp.playground.output]),
    outcome.console
      ? valueBlock(outcome.console.replace(/\n$/, ''))
      : h('p', { class: 'ch-value-note' }, [csharp.playground.no_output]),
    outcome.error ? h('p', { class: 'ch-error' }, errorText(outcome.error, context)) : '',
  );
}
