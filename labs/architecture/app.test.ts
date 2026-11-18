// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { startArchitectureLab } from './app';

/** Una arquitectura con la misma forma que publica _includes/labs/architecture.html. */
function architecture(
  id: string,
  name: string,
  nodes: string[],
  edges: string,
  flow: [node: string, from?: string][],
): string {
  const node = (key: string, index: number) =>
    `<a class="arch-node" href="#${id}-${key}" data-node="${key}" style="grid-column: ${index + 1}">${key}</a>`;
  const detail = (key: string) =>
    `<article class="arch-detail" id="${id}-${key}" data-node="${key}">${key}<p class="arch-back"><a href="#arch-${id}">Volver</a></p></article>`;
  const step = ([key, from]: [string, string?]) =>
    `<li data-node="${key}"${from ? ` data-from="${from}"` : ''}>Paso en ${key}</li>`;
  return `
    <section class="arch" id="arch-${id}" data-arch="${id}" aria-labelledby="arch-${id}-title">
      <h2 class="arch-title" id="arch-${id}-title">${name}</h2>
      <div class="arch-stage">
        <div class="arch-side">
          <div class="arch-figure">
            <div class="arch-diagram" data-edges='${edges}'>${nodes.map(node).join('')}</div>
            <ul class="arch-legend" hidden>
              <li data-kind="uses">usa</li><li data-kind="implements">implementa</li><li data-kind="event">mensajes</li>
            </ul>
          </div>
          <div class="arch-flow">
            <div class="arch-flow-controls" hidden>
              <button data-action="play" data-label-play="Reproducir" data-label-pause="Pausa">Reproducir</button>
              <button data-action="prev">Anterior</button>
              <button data-action="next">Siguiente</button>
              <output class="arch-step-label" data-template="Paso {n} de {total}"></output>
            </div>
            <ol class="arch-steps">${flow.map(step).join('')}</ol>
          </div>
        </div>
        <div class="arch-panel">
          <article class="arch-overview" id="${id}-overview">Resumen<p class="arch-hint" hidden>Elige</p></article>
          ${nodes.map(detail).join('')}
        </div>
      </div>
    </section>`;
}

function start(hash = ''): HTMLElement {
  history.replaceState(null, '', `/${hash}`);
  document.body.innerHTML = `
    <script type="application/json" id="lab-ui">{"copy_label": "Copiar", "copied": "Copiado", "copy_failed": "No se pudo copiar"}</script>
    <div class="arch-app">
      <div class="arch-switch" role="tablist" hidden>
        <button role="tab" id="tab-layered" aria-controls="arch-layered">Por capas</button>
        <button role="tab" id="tab-clean" aria-controls="arch-clean">Clean</button>
      </div>
      ${architecture('layered', 'Por capas', ['client', 'presentation'], '[["client","presentation","uses"]]', [['client'], ['presentation', 'client']])}
      ${architecture('clean', 'Clean', ['api', 'domain', 'infrastructure'], '[["api","domain","uses"],["infrastructure","domain","implements"]]', [['api'], ['domain', 'api']])}
    </div>`;
  const root = document.querySelector<HTMLElement>('.arch-app');
  if (!root) throw new Error('falta .arch-app');
  startArchitectureLab(root);
  return root;
}

const element = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`falta ${selector}`);
  return found;
};

/** Ids visibles: ni el elemento ni sus ancestros tienen `hidden`. */
const shown = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)]
    .filter((item) => !item.closest('[hidden]'))
    .map((item) => item.id);

/** La pieza `key` en el diagrama (la primera, si dos arquitecturas la tienen). */
const diagramNode = (key: string) => element(`.arch-node[data-node="${key}"]`);

describe('startArchitectureLab', () => {
  it('convierte cada arquitectura en una pestaña y muestra la primera', () => {
    start();
    expect(element('.arch-switch').hidden).toBe(false);
    expect(shown('.arch')).toEqual(['arch-layered']);
    expect(element('#arch-clean').getAttribute('role')).toBe('tabpanel');
    expect(shown('#arch-layered article')).toEqual(['layered-overview']);
  });

  it('al elegir una pieza muestra su ficha, la marca en el diagrama y cambia la dirección', () => {
    start();
    diagramNode('presentation').click();
    expect(shown('#arch-layered article')).toEqual(['layered-presentation']);
    expect(diagramNode('presentation').getAttribute('aria-current')).toBe('true');
    expect(location.hash).toBe('#layered-presentation');
  });

  it('Escape y "Volver" regresan al resumen', () => {
    start();
    const node = diagramNode('client');
    node.click();
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(shown('#arch-layered article')).toEqual(['layered-overview']);

    node.click();
    element('#layered-client .arch-back a').click();
    expect(shown('#arch-layered article')).toEqual(['layered-overview']);
    expect(document.activeElement).toBe(node);
    expect(location.hash).toBe('#arch-layered');
  });

  it('abre la arquitectura y la pieza que pide la dirección', () => {
    start('#clean-domain');
    expect(shown('.arch')).toEqual(['arch-clean']);
    expect(shown('#arch-clean article')).toEqual(['clean-domain']);
  });

  it('al cambiar de pestaña pone la arquitectura en la dirección', () => {
    start();
    element('#tab-clean').click();
    expect(shown('.arch')).toEqual(['arch-clean']);
    expect(location.hash).toBe('#arch-clean');
  });

  it('recorre la petición paso a paso', () => {
    start();
    const section = element('#arch-layered');
    const next = element<HTMLButtonElement>('#arch-layered [data-action="next"]');
    const prev = element<HTMLButtonElement>('#arch-layered [data-action="prev"]');
    const label = element<HTMLOutputElement>('#arch-layered .arch-step-label');
    expect(prev.disabled).toBe(true);
    expect(label.value).toBe('');

    next.click();
    expect(label.value).toBe('Paso 1 de 2');
    expect(section.querySelector('.arch-steps li')?.getAttribute('aria-current')).toBe('step');
    expect(diagramNode('client').classList.contains('is-active')).toBe(true);
    expect(section.querySelectorAll('line.is-active')).toHaveLength(0);

    next.click();
    expect(label.value).toBe('Paso 2 de 2');
    expect(next.disabled).toBe(true);
    expect(diagramNode('presentation').classList.contains('is-active')).toBe(true);
    expect(section.querySelectorAll('line.is-active')).toHaveLength(1);

    prev.click();
    prev.click();
    expect(label.value).toBe('');
    expect(section.querySelectorAll('.arch-node.is-active')).toHaveLength(0);
  });

  it('muestra en la leyenda solo los tipos de conexión del diagrama', () => {
    start();
    const kinds = (id: string) =>
      [...document.querySelectorAll<HTMLElement>(`#arch-${id} .arch-legend li`)]
        .filter((item) => !item.hidden)
        .map((item) => item.dataset['kind']);
    expect(kinds('layered')).toEqual(['uses']);
    expect(kinds('clean')).toEqual(['uses', 'implements']);
  });
});
