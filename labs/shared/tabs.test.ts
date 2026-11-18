// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { initTabs } from './tabs';

/** Tres pestañas con sus paneles; `selected` marca la que viene elegida en el HTML. */
function setup(selected?: number, onSelect?: (tab: HTMLElement) => void) {
  const tab = (n: number, label: string) =>
    `<button role="tab" id="t${n}" aria-controls="p${n}"${selected === n ? ' aria-selected="true"' : ''}>${label}</button>`;
  document.body.innerHTML = `
    <div role="tablist" aria-label="Código">${tab(1, 'curl')}${tab(2, 'C#')}${tab(3, 'HTTP')}</div>
    <div role="tabpanel" id="p1">uno</div>
    <div role="tabpanel" id="p2">dos</div>
    <div role="tabpanel" id="p3">tres</div>`;
  const tablist = document.querySelector<HTMLElement>('[role="tablist"]');
  if (!tablist) throw new Error('falta el tablist');
  const select = initTabs(tablist, onSelect);
  const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
  return { select, tabs };
}

const shown = () =>
  [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')]
    .filter((panel) => !panel.hidden)
    .map((panel) => panel.id);

const press = (element: HTMLElement, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('initTabs', () => {
  it('elige la primera pestaña si el HTML no dice otra', () => {
    const { tabs } = setup();
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(shown()).toEqual(['p1']);
  });

  it('respeta la pestaña que viene elegida', () => {
    setup(2);
    expect(shown()).toEqual(['p2']);
  });

  it('cambia de panel con un clic', () => {
    const { tabs } = setup();
    tabs[2]?.click();
    expect(shown()).toEqual(['p3']);
  });

  it('se mueve con las flechas, Inicio y Fin, y da vuelta en los extremos', () => {
    const { tabs } = setup();
    const [first, , last] = tabs;
    if (!first || !last) throw new Error('faltan pestañas');
    press(first, 'ArrowRight');
    expect(shown()).toEqual(['p2']);
    expect(document.activeElement?.id).toBe('t2');
    press(first, 'ArrowLeft');
    expect(shown()).toEqual(['p3']);
    press(last, 'Home');
    expect(shown()).toEqual(['p1']);
    press(first, 'End');
    expect(shown()).toEqual(['p3']);
  });

  it('avisa cada vez que se elige otra pestaña, pero no al empezar', () => {
    const chosen: string[] = [];
    const { tabs } = setup(undefined, (tab) => chosen.push(tab.id));
    expect(chosen).toEqual([]);
    tabs[1]?.click();
    if (tabs[1]) press(tabs[1], 'End');
    expect(chosen).toEqual(['t2', 't3']);
  });

  it('devuelve una función para elegir desde el código', () => {
    const { select, tabs } = setup();
    const second = tabs[1];
    if (!second) throw new Error('falta la pestaña');
    select(second);
    expect(shown()).toEqual(['p2']);
  });
});
