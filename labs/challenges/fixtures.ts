// Para las pruebas: los textos reales de _data/labs/challenge-ui.yml y una página de reto mínima con
// los mismos elementos que _includes/labs/challenge.html.
import { parse } from 'yaml';
import uiSource from '../../_data/labs/challenge-ui.yml?raw';
import type { SqlChallenge } from './sql/data';
import type { ChallengePageData, UiTexts } from './texts';

export function uiTexts(lang: 'es' | 'en' = 'es'): UiTexts {
  return (parse(uiSource) as Record<'es' | 'en', UiTexts>)[lang];
}

export const challenge: SqlChallenge = {
  language: 'sql',
  category: 'queries',
  difficulty: 'easy',
  tables: ['Customers'],
  check: 'rows',
  starter: 'SELECT Id FROM Customers;',
  solution: 'SELECT Id FROM Customers WHERE Id > 1;',
  cases: [
    {
      sample: true,
      tables: { Customers: { columns: ['Id'], rows: [[1], [2]] } },
      expected: { columns: ['Id'], rows: [[2]] },
    },
    {
      tables: { Customers: { columns: ['Id'], rows: [[3]] } },
      expected: { columns: ['Id'], rows: [[3]] },
    },
  ],
};

export function pageData(lang: 'es' | 'en' = 'es'): ChallengePageData {
  return {
    id: 'demo',
    challenge,
    dataset: {
      tables: [
        {
          id: 'Customers',
          ddl: 'CREATE TABLE Customers (\n  Id int PRIMARY KEY\n);',
          sample: { columns: ['Id'], rows: [] },
        },
      ],
      generators: [],
    },
    generated: [],
    ui: uiTexts(lang),
    engine: '/pglite/',
    worker: '/w.js',
  };
}

/** El HTML que Jekyll deja para un reto, reducido a lo que usa el TypeScript. */
export function challengeHtml(): string {
  return `
<div class="ch-page">
  <p class="ch-meta"><span class="ch-chip ch-badge" data-status="solved" hidden>Resuelto</span></p>
  <div class="ch-hints" data-next="Ver la pista {n} de {total}">
    <details class="ch-hint"><summary>Pista 1</summary><p>Uno</p></details>
    <details class="ch-hint"><summary>Pista 2</summary><p>Dos</p></details>
  </div>
  <details class="ch-solution" data-show="Ver la solución" data-hide="Ocultar la solución"><summary>Ver la solución</summary><p>SELECT</p></details>
  <section class="ch-work">
    <div class="ch-editor" data-label="Código SQL"><p class="ch-nojs">Sin JS</p><pre>SELECT</pre></div>
    <div class="ch-actions" hidden>
      <button class="ch-run" type="button">Ejecutar</button>
      <button class="ch-submit" type="button">Enviar</button>
      <button class="ch-reset" type="button">Volver</button>
    </div>
    <p class="ch-help" hidden>Ayuda</p>
  </section>
  <section class="ch-results" hidden><div class="ch-results-body"><p>Vacío</p></div></section>
  <nav class="ch-pager"><a class="ch-next" href="/siguiente/">Siguiente: Otro</a></nav>
</div>`;
}
