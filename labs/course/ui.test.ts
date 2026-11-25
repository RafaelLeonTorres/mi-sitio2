import { describe, expect, it } from 'vitest';
import { courseUi, lessonData } from './fixtures';
import type { EngineUiKey, LessonPage } from './types';
import { lessonFromPage } from './ui';

const ENGINE_KEYS: readonly EngineUiKey[] = [
  'file',
  'terminal',
  'idle',
  'empty',
  'stdin',
  'stdin_help',
  'output',
  'no_output',
  'compile_error',
  'runtime_error',
  'original_message',
  'rules',
  'rules_min',
  'syntax',
];

describe('lessonFromPage', () => {
  it('une los textos comunes con los del motor, como los textos completos del curso', () => {
    const full = lessonData('es');
    const common = Object.fromEntries(
      Object.entries(full.ui).filter(([key]) => !(ENGINE_KEYS as readonly string[]).includes(key)),
    );
    const engine = Object.fromEntries(ENGINE_KEYS.map((key) => [key, full.ui[key]]));
    const page = { ...full, ui: common, engineUi: engine } as unknown as LessonPage;
    expect(lessonFromPage(page).ui).toEqual(courseUi('es'));
    // Lo demás de la lección pasa tal cual, sin la clave engineUi.
    expect(lessonFromPage(page)).not.toHaveProperty('engineUi');
    expect(lessonFromPage(page).steps).toBe(full.steps);
  });

  it('si una clave está en las dos, gana la del motor', () => {
    const full = lessonData('es');
    const page = {
      ...full,
      ui: { ...full.ui, run: 'común' },
      engineUi: { ...full.ui, run: 'del motor' },
    } as unknown as LessonPage;
    expect(lessonFromPage(page).ui.run).toBe('del motor');
  });
});
