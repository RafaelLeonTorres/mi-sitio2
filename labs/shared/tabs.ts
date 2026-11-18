// Pestañas con el patrón de ARIA: con las flechas se pasa de una pestaña a otra y la elegida
// muestra su panel. El HTML trae `role="tablist"`, botones `role="tab"` con `aria-controls`
// y los paneles con `role="tabpanel"`.

/**
 * Conecta las pestañas de un `role="tablist"` con sus paneles y elige la que tenga
 * `aria-selected="true"` (o la primera). Devuelve una función para elegir otra desde el código.
 */
export function initTabs(tablist: HTMLElement): (tab: HTMLElement) => void {
  const tabs = [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')];

  const select = (tab: HTMLElement, focus = false) => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
      const panelId = other.getAttribute('aria-controls');
      const panel = panelId ? tablist.ownerDocument.getElementById(panelId) : null;
      if (panel) panel.hidden = !selected;
    }
    if (focus) tab.focus();
  };

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const index = tabs.indexOf(tab);
      const moves: Record<string, HTMLElement | undefined> = {
        ArrowRight: tabs[(index + 1) % tabs.length],
        ArrowLeft: tabs[(index - 1 + tabs.length) % tabs.length],
        Home: tabs[0],
        End: tabs[tabs.length - 1],
      };
      const next = moves[event.key];
      if (!next) return;
      event.preventDefault();
      select(next, true);
    });
  }

  const initial = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? tabs[0];
  if (initial) select(initial);
  return (tab) => select(tab);
}
