// Los seis escenarios, en el orden de las pestañas.
import type { Scenario, ScenarioId } from '../scenario';
import { indexes } from './indexes';
import { joins } from './joins';
import { nPlusOne } from './n-plus-one';
import { pagination } from './pagination';
import { sargability } from './sargability';
import { tracking } from './tracking';

export const SCENARIOS: readonly Scenario[] = [
  sargability,
  indexes,
  nPlusOne,
  joins,
  pagination,
  tracking,
];

export function scenario(id: ScenarioId): Scenario {
  const found = SCENARIOS.find((item) => item.id === id);
  if (!found) throw new Error(`No hay un escenario ${id}.`);
  return found;
}
