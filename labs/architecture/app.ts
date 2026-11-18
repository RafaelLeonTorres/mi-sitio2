// Simulador de arquitecturas. Toma la página que publica Jekyll (_includes/labs/architecture.html)
// y la vuelve interactiva: una pestaña por arquitectura, flechas en el diagrama, un panel que
// muestra una pieza a la vez y el recorrido de la petición paso a paso.

import { addCopyButton } from '../shared/copy';
import { required } from '../shared/dom';
import { kitStrings } from '../shared/i18n';
import { announce } from '../shared/live';
import { initTabs } from '../shared/tabs';
import { createDiagram, type Diagram, type Edge } from './diagram';
import { neighbor, type Box, type Direction } from './geometry';
import { createStepper } from './stepper';

const PLAY_MS = 2600;

const DIRECTIONS: Record<string, Direction | undefined> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

interface Architecture {
  readonly id: string;
  readonly section: HTMLElement;
  readonly diagram: Diagram;
  /** Muestra una pieza en el panel, o el resumen con `null`. */
  show(node: string | null, updateHash?: boolean): void;
  /** Pone en la dirección lo que se ve ahora (`#clean-api` o `#arch-clean`). */
  syncHash(): void;
  /** Detiene el recorrido si se está reproduciendo. */
  stop(): void;
}

/** Arranca el simulador sobre `.arch-app`. */
export function startArchitectureLab(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const strings = kitStrings(doc);
  for (const pre of root.querySelectorAll<HTMLElement>('pre')) addCopyButton(pre, strings);

  const architectures = [...root.querySelectorAll<HTMLElement>('.arch[data-arch]')].map(setup);
  root.dataset['enhanced'] = '';
  const target = fromHash(doc.location.hash, architectures);

  const tablist = root.querySelector<HTMLElement>('.arch-switch');
  let selectTab: ((tab: HTMLElement) => void) | undefined;
  if (tablist && architectures.length > 1) {
    for (const architecture of architectures) {
      architecture.section.setAttribute('role', 'tabpanel');
      architecture.section.setAttribute('aria-labelledby', `tab-${architecture.id}`);
      architecture.section.querySelector('.arch-title')?.classList.add('visually-hidden');
    }
    if (target) {
      doc.getElementById(`tab-${target.architecture.id}`)?.setAttribute('aria-selected', 'true');
    }
    tablist.hidden = false;
    selectTab = initTabs(tablist, (tab) => {
      for (const architecture of architectures) architecture.stop();
      const id = tab.getAttribute('aria-controls');
      architectures.find((architecture) => `arch-${architecture.id}` === id)?.syncHash();
    });
  }

  if (target?.node) target.architecture.show(target.node, false);

  // Un enlace dentro de la página, como el de Microservicios a CQRS, cambia de pestaña o de pieza.
  const view = doc.defaultView;
  view?.addEventListener('hashchange', () => {
    const next = fromHash(doc.location.hash, architectures);
    if (!next) return;
    const tab = doc.getElementById(`tab-${next.architecture.id}`);
    if (selectTab && tab && tab.getAttribute('aria-selected') !== 'true') selectTab(tab);
    next.architecture.show(next.node);
    next.architecture.section.scrollIntoView?.({ block: 'start', behavior: scrollBehavior(view) });
  });
}

/** Prepara una arquitectura: diagrama, leyenda, panel y recorrido. */
function setup(section: HTMLElement): Architecture {
  const doc = section.ownerDocument;
  const id = section.dataset['arch'] ?? '';
  const diagramRoot = required('.arch-diagram', section);
  const edges = JSON.parse(diagramRoot.dataset['edges'] ?? '[]') as Edge[];
  const diagram = createDiagram(diagramRoot, edges, id);
  keepDrawn(diagramRoot, diagram);
  showLegend(section, edges);
  const side = section.querySelector<HTMLElement>('.arch-side');
  if (side) stickWhenItFits(side);

  const overview = required(`[id="${id}-overview"]`, section);
  const details = new Map<string, HTMLElement>();
  for (const article of section.querySelectorAll<HTMLElement>('.arch-detail[data-node]')) {
    details.set(article.dataset['node'] ?? '', article);
  }
  const hint = overview.querySelector<HTMLElement>('.arch-hint');
  if (hint) hint.hidden = false;

  let selected: string | null = null;
  const hash = () => (selected ? `#${id}-${selected}` : `#arch-${id}`);
  const syncHash = () => doc.defaultView?.history.replaceState(null, '', hash());

  const show = (node: string | null, updateHash = true) => {
    selected = node !== null && details.has(node) ? node : null;
    overview.hidden = selected !== null;
    for (const [key, article] of details) article.hidden = key !== selected;
    for (const [key, element] of diagram.nodes) {
      if (key === selected) element.setAttribute('aria-current', 'true');
      else element.removeAttribute('aria-current');
    }
    if (updateHash) syncHash();
  };
  show(null, false);

  for (const [key, element] of diagram.nodes) {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      show(key);
      reveal(details.get(key));
    });
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        show(null);
        return;
      }
      const direction = DIRECTIONS[event.key];
      if (!direction) return;
      event.preventDefault();
      const elements = [...diagram.nodes.values()];
      const next = neighbor(elements.map(boxOf), elements.indexOf(element), direction);
      elements[next]?.focus();
    });
  }

  for (const link of section.querySelectorAll<HTMLAnchorElement>('.arch-back a')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const previous = selected;
      show(null);
      if (previous) diagram.nodes.get(previous)?.focus();
    });
  }

  const stop = setupFlow(section, diagram);
  return { id, section, diagram, show, syncHash, stop };
}

/** El recorrido de la petición: Reproducir, Anterior y Siguiente. Devuelve la función que lo pausa. */
function setupFlow(section: HTMLElement, diagram: Diagram): () => void {
  const controls = section.querySelector<HTMLElement>('.arch-flow-controls');
  const steps = [...section.querySelectorAll<HTMLElement>('.arch-steps li')];
  if (!controls || steps.length === 0) return () => {};

  const play = required<HTMLButtonElement>('[data-action="play"]', controls);
  const prev = required<HTMLButtonElement>('[data-action="prev"]', controls);
  const next = required<HTMLButtonElement>('[data-action="next"]', controls);
  const label = required<HTMLOutputElement>('.arch-step-label', controls);
  const hint = section.querySelector<HTMLElement>('.arch-step-hint');
  const template = label.dataset['template'] ?? '{n} / {total}';
  const view = section.ownerDocument.defaultView;
  let timer: number | undefined;

  const render = (index: number) => {
    steps.forEach((step, i) => {
      const current = i === index - 1;
      step.classList.toggle('is-current', current);
      if (current) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    const step = steps[index - 1];
    diagram.setActive(step?.dataset['node'] ?? null, step?.dataset['from']);
    label.value = step
      ? template.replace('{n}', String(index)).replace('{total}', String(steps.length))
      : '';
    prev.disabled = index === 0;
    next.disabled = index === steps.length;
    if (hint) hint.hidden = index !== 0;
    if (!step) return;
    announce(`${label.value}. ${step.textContent ?? ''}`, section.ownerDocument);
    keepInView(step);
  };
  const stepper = createStepper(steps.length, render);

  const stop = () => {
    if (timer === undefined) return;
    view?.clearInterval(timer);
    timer = undefined;
    play.textContent = play.dataset['labelPlay'] ?? '';
  };

  play.addEventListener('click', () => {
    if (timer !== undefined) {
      stop();
      return;
    }
    if (stepper.index === 0 || stepper.index === steps.length) stepper.go(1);
    play.textContent = play.dataset['labelPause'] ?? '';
    timer = view?.setInterval(() => {
      if (stepper.index >= steps.length) stop();
      else stepper.next();
    }, PLAY_MS);
  });
  prev.addEventListener('click', () => {
    stop();
    stepper.prev();
  });
  next.addEventListener('click', () => {
    stop();
    stepper.next();
  });

  controls.hidden = false;
  render(0);
  return stop;
}

/** Muestra en la leyenda solo los tipos de conexión que tiene el diagrama. */
function showLegend(section: HTMLElement, edges: readonly Edge[]): void {
  const legend = section.querySelector<HTMLElement>('.arch-legend');
  if (!legend) return;
  const kinds = new Set<string>(edges.map((edge) => edge[2]));
  for (const item of legend.querySelectorAll<HTMLElement>('[data-kind]')) {
    item.hidden = !kinds.has(item.dataset['kind'] ?? '');
  }
  legend.hidden = false;
}

/**
 * En escritorio, el diagrama y el recorrido se quedan a la vista mientras se lee una ficha larga,
 * pero solo si caben completos en la pantalla; si no, la página se desplaza como siempre.
 */
function stickWhenItFits(side: HTMLElement): void {
  const view = side.ownerDocument.defaultView;
  if (!view) return;
  const update = () => {
    const top = Number.parseFloat(view.getComputedStyle(side).top) || 0;
    const height = side.offsetHeight;
    side.toggleAttribute('data-sticky', height > 0 && height + top <= view.innerHeight);
  };
  const Observer = view.ResizeObserver as typeof ResizeObserver | undefined;
  if (Observer) new Observer(update).observe(side);
  view.addEventListener('resize', update);
  update();
}

/** Dibuja las flechas ahora, cuando cargan las fuentes y cada vez que cambia el tamaño. */
function keepDrawn(element: HTMLElement, diagram: Diagram): void {
  const draw = () => diagram.draw();
  const view = element.ownerDocument.defaultView;
  // jsdom y algunos navegadores viejos no tienen ResizeObserver.
  const Observer = view?.ResizeObserver as typeof ResizeObserver | undefined;
  if (Observer) new Observer(draw).observe(element);
  else view?.addEventListener('resize', draw);
  void element.ownerDocument.fonts?.ready.then(draw);
  draw();
}

/**
 * Acerca la ficha recién abierta si no se alcanza a leer: muy abajo (en móvil va después del
 * diagrama) o arriba, después de leer una ficha larga en escritorio. `scroll-margin-top` la deja
 * bajo el encabezado fijo.
 */
function reveal(article: HTMLElement | undefined): void {
  const view = article?.ownerDocument.defaultView;
  if (!article || !view) return;
  const { top } = article.getBoundingClientRect();
  const margin = Number.parseFloat(view.getComputedStyle(article).scrollMarginTop) || 0;
  if (top >= margin && top < view.innerHeight * 0.7) return;
  article.scrollIntoView?.({ block: 'start', behavior: scrollBehavior(view) });
}

/** Si el texto del paso quedó debajo de la pantalla, la recorre lo justo para leerlo. */
function keepInView(element: HTMLElement): void {
  const view = element.ownerDocument.defaultView;
  if (!view || element.getBoundingClientRect().bottom <= view.innerHeight) return;
  element.scrollIntoView?.({ block: 'nearest', behavior: scrollBehavior(view) });
}

/** Sin animación si la persona pidió menos movimiento. */
function scrollBehavior(view: Window): ScrollBehavior {
  const still = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
  return still ? 'auto' : 'smooth';
}

function boxOf(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

/** La arquitectura (y la pieza) que pide la dirección: `#arch-clean` o `#clean-api`. */
function fromHash(
  hash: string,
  architectures: readonly Architecture[],
): { architecture: Architecture; node: string | null } | null {
  let target: string;
  try {
    target = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return null;
  }
  for (const architecture of architectures) {
    if (target === `arch-${architecture.id}`) return { architecture, node: null };
    const node = target.startsWith(`${architecture.id}-`)
      ? target.slice(architecture.id.length + 1)
      : '';
    if (architecture.diagram.nodes.has(node)) return { architecture, node };
  }
  return null;
}
