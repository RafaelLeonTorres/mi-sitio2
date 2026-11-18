// Lo que Jekyll deja en la página para la consola (#api-data): el catálogo de `shared` y los
// textos de `client` en el idioma de la página (_data/labs/rest-api.yml).

import type { ApiMessages, Outcome, StepId } from './api';
import type { Seed } from './store';

export interface SharedProduct {
  readonly id: number;
  readonly sku: string;
  readonly price: number;
  readonly costPrice: number;
  readonly stock: number;
  readonly categoryId: number;
}

export interface TokenStrings {
  readonly valid: string;
  readonly expired: string;
  readonly tampered: string;
  readonly malformed: string;
  readonly got: string;
}

export type TabId = 'body' | 'headers' | 'trace' | 'log' | 'curl';

export interface StepStrings {
  readonly name: string;
  readonly notes: Readonly<Record<string, string>>;
}

export interface Client {
  readonly categories: readonly { readonly id: number; readonly name: string }[];
  readonly products: readonly { readonly id: number; readonly name: string }[];
  readonly messages: ApiMessages;
  readonly token: TokenStrings;
  readonly json_error: string;
  readonly time: string;
  readonly announce: string;
  readonly ignored: string;
  readonly development: string;
  readonly reset_done: string;
  readonly tabs: Readonly<Record<TabId, string>>;
  readonly no_body: string;
  readonly correlation: string;
  readonly lanes: { readonly request: string; readonly response: string };
  readonly reasons: Readonly<Record<string, string>>;
  readonly outcomes: Readonly<Record<Outcome, string>>;
  readonly steps: Readonly<Record<StepId, StepStrings>>;
  readonly skipped: string;
}

export interface PageData {
  readonly shared: { readonly products: readonly SharedProduct[] };
  readonly client: Client;
}

/** El catálogo inicial: los datos de `shared` con los nombres en el idioma de la página. */
export function seedFrom(data: PageData): Seed {
  const names = new Map(data.client.products.map((product) => [product.id, product.name]));
  return {
    categories: data.client.categories.map(({ id, name }) => ({ id, name })),
    products: data.shared.products.map((product) => ({
      ...product,
      name: names.get(product.id) ?? product.sku,
    })),
  };
}
