// Lo que Jekyll deja en la página para el laboratorio (#sql-data): los textos de la interfaz y, por
// escenario, el nombre de cada lado y los textos de sus controles (_data/labs/sql.yml).

import type { ScenarioId } from './scenario';

/** Los textos de un control: su etiqueta, el formato de un número ({value}) o sus opciones. */
export interface ControlText {
  readonly label: string;
  readonly format?: string;
  readonly options?: Readonly<Record<string, string>>;
}

export type MetricId =
  | 'total'
  | 'server'
  | 'network'
  | 'client'
  | 'logical'
  | 'physical'
  | 'read_ahead'
  | 'rows_read'
  | 'rows'
  | 'trips'
  | 'memory'
  | 'access';

export interface ClientTexts {
  /** Los controles que se repiten entre escenarios (orders, cache, range). */
  readonly controls: Readonly<Record<string, ControlText>>;
  readonly run: string;
  /** Que los números son simulados, debajo de la carrera. */
  readonly disclaimer: string;
  readonly side: string;
  readonly linq: string;
  readonly sql: string;
  readonly sql_generated: string;
  readonly indexes: string;
  readonly indexes_none: string;
  readonly plan: string;
  readonly plan_hint: string;
  readonly plan_cost: string;
  readonly statement: string;
  readonly repeats: string;
  readonly cost: string;
  readonly rows: string;
  readonly rows_read: string;
  readonly executions: string;
  readonly reads: string;
  readonly seek: string;
  readonly predicate: string;
  readonly backward: string;
  readonly messages: string;
  readonly messages_hint: string;
  readonly more_times: string;
  readonly summary: string;
  readonly metrics: Readonly<Record<MetricId, string>>;
  readonly access: string;
  readonly faster: string;
  readonly same: string;
  readonly memory_less: string;
  readonly rows_differ: string;
  readonly announce: string;
}

export interface ScenarioTexts {
  readonly id: ScenarioId;
  /** El nombre de cada lado según su clave (function, range, keyset…). */
  readonly labels: Readonly<Record<string, string>>;
  /** Los controles propios del escenario; Jekyll deja `null` si no tiene. */
  readonly controls: Readonly<Record<string, ControlText>> | null;
}

export interface PageData {
  readonly client: ClientTexts;
  readonly scenarios: readonly ScenarioTexts[];
}

/** Los textos de un control: los del escenario y, si no los tiene, los compartidos. */
export function controlText(client: ClientTexts, scenario: ScenarioTexts, id: string): ControlText {
  const text = scenario.controls?.[id] ?? client.controls[id];
  if (!text) throw new Error(`Falta el texto del control ${id} en ${scenario.id}.`);
  return text;
}

/** Cambia cada {nombre} de la plantilla por su valor. */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

/** Como `fill`, pero los valores son nodos: "Índices: {value} y…" con un <code> en medio. */
export function fillNodes(
  template: string,
  values: Readonly<Record<string, Node | string>>,
): (Node | string)[] {
  const parts: (Node | string)[] = [];
  let index = 0;
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    const value = values[match[1] ?? ''];
    if (value === undefined) continue;
    if (match.index > index) parts.push(template.slice(index, match.index));
    parts.push(value);
    index = match.index + match[0].length;
  }
  if (index < template.length) parts.push(template.slice(index));
  return parts;
}
