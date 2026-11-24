// La terminal del curso: lo que escribió el programa, los errores del compilador con su explicación
// y el resultado de Enviar. Solo arma el DOM; no sabe de pasos ni de avance.

import type { CsProgramRun } from '../challenges/csharp/engine';
import type { CsDiagnostic } from '../challenges/csharp/protocol';
import { h, type Child } from '../shared/dom';
import type { Lang } from '../shared/format';
import { fill, inlineCode } from '../shared/template';
import type { CourseUi, ErrorNotes } from './types';

export interface TerminalContext {
  readonly ui: CourseUi;
  readonly errors: ErrorNotes;
  readonly lang: Lang;
  readonly timeoutSeconds: number;
  /** La frase del paso para cuando Enviar falla, si la tiene. */
  readonly failure?: string;
}

/** Si el programa compiló, cumplió las reglas y cada ejecución pasó (y no faltó ninguna). */
export function judge(run: CsProgramRun, expectedRuns: number): boolean {
  if (!run.compile?.compiled || !run.compile.rules.every((rule) => rule.passed)) return false;
  return (
    run.runs.length === expectedRuns &&
    run.runs.every((result) => 'outcome' in result && result.outcome.passed)
  );
}

/** Reemplaza lo que hay en la terminal. */
function put(body: HTMLElement, nodes: readonly Child[]): void {
  body.replaceChildren(...h('div', {}, nodes).childNodes);
}

/** Un aviso: cargando, ejecutando, el código vacío o un error del motor. */
export function renderStatus(
  body: HTMLElement,
  text: string,
  note?: string,
  tone: 'info' | 'bad' = 'info',
): void {
  put(body, [
    h('p', { class: tone === 'bad' ? 'cs-bad' : 'cs-muted' }, [text]),
    note ? h('p', { class: 'cs-muted' }, [note]) : null,
  ]);
}

function diagnostic(item: CsDiagnostic, ctx: TerminalContext): HTMLElement {
  const note = ctx.errors[item.id]?.[ctx.lang];
  return h('div', { class: 'cs-diag' }, [
    h('p', { class: 'cs-bad' }, [`${ctx.ui.line} ${item.line}: ${item.id}`]),
    h('p', { class: 'cs-muted' }, [`${ctx.ui.original_message}: ${item.message}`]),
    note ? h('p', {}, inlineCode(note)) : null,
  ]);
}

/**
 * El resultado de una ejecución. Con Ejecutar solo se ve lo que escribió el programa; con Enviar
 * también si pasó o qué falló, con lo esperado junto a lo que salió.
 */
export function renderRun(
  body: HTMLElement,
  run: CsProgramRun,
  ctx: TerminalContext,
  mode: 'run' | 'submit',
  passed: boolean,
  expectedRuns: number,
): void {
  const { ui } = ctx;
  const timeout = () =>
    h('p', { class: 'cs-bad' }, [fill(ui.timeout, { seconds: ctx.timeoutSeconds })]);
  if (!run.compile) return put(body, [timeout()]);
  if (!run.compile.compiled) {
    return put(body, [
      h('p', { class: 'cs-bad' }, [ui.compile_error]),
      ...run.compile.diagnostics.slice(0, 3).map((item) => diagnostic(item, ctx)),
    ]);
  }

  const nodes: Child[] = [];
  if (mode === 'submit') {
    nodes.push(
      h('p', { class: passed ? 'cs-ok' : 'cs-bad' }, [passed ? ui.verdict_ok : ui.verdict_bad]),
    );
  }
  for (const result of run.runs) {
    if (expectedRuns > 1) {
      nodes.push(h('h3', { class: 'cs-run-title' }, [fill(ui.run_n, { n: result.index + 1 })]));
    }
    if ('timedOut' in result) {
      nodes.push(timeout());
      continue;
    }
    const { outcome } = result;
    const differs =
      mode === 'submit' && outcome.failed.includes('stdout') && outcome.expected !== undefined;
    if (differs) nodes.push(h('p', { class: 'cs-muted' }, [`${ui.got}:`]));
    nodes.push(
      outcome.stdout === ''
        ? h('p', { class: 'cs-muted' }, [ui.no_output])
        : h('pre', { class: 'cs-out' }, [outcome.stdout]),
    );
    if (differs) {
      nodes.push(
        h('p', { class: 'cs-muted' }, [`${ui.expected}:`]),
        h('pre', { class: 'cs-out' }, [outcome.expected ?? '']),
      );
    }
    if (outcome.error) {
      const message = fill(ui.runtime_error, {
        type: outcome.error.type,
        message: outcome.error.message,
      });
      nodes.push(h('p', { class: 'cs-bad' }, [message]));
      const note = ctx.errors[outcome.error.type]?.[ctx.lang];
      if (note) nodes.push(h('p', {}, inlineCode(note)));
    }
    if (mode === 'submit') {
      for (const key of outcome.failed) {
        const text = ui.failed[key];
        if (text && !(key === 'error' && outcome.error))
          nodes.push(h('p', { class: 'cs-bad' }, [text]));
      }
    }
  }
  if (mode === 'submit') {
    for (const rule of run.compile.rules) {
      // Si se pedían varias veces, el mensaje lo dice: "al menos 3 veces", no solo "debe llamar".
      const many = rule.min !== undefined && rule.min > 1 ? ui.rules_min[rule.kind] : undefined;
      const template = many ?? ui.rules[rule.kind];
      if (rule.passed || !template) continue;
      // Los nombres de sintaxis de Roslyn (`ForStatement`) se dicen como una persona: "un ciclo for".
      const name = rule.name ?? '';
      const text = fill(template, {
        name: rule.kind.endsWith('-syntax') ? (ui.syntax[name] ?? name) : name,
        // El tipo se identifica con su nombre de metadatos (`System.Func`2`); `name` es cómo se dice.
        type: rule.kind.endsWith('-type') ? (rule.name ?? rule.type ?? '') : (rule.type ?? ''),
        min: rule.min ?? 1,
      });
      nodes.push(h('p', { class: 'cs-bad' }, [text]));
    }
    if (!passed && ctx.failure) nodes.push(h('p', { class: 'cs-tip' }, inlineCode(ctx.failure)));
  }
  put(body, nodes);
}
