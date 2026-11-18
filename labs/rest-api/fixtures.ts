// Datos y mensajes pequeños para las pruebas de la API (no se usan en la página).

import type { ApiMessages } from './api';
import type { Seed } from './store';

export const SEED: Seed = {
  categories: [
    { id: 1, name: 'Keyboards' },
    { id: 2, name: 'Mice' },
    { id: 3, name: 'Monitors' },
  ],
  products: [
    {
      id: 1,
      sku: 'KBD-1001',
      name: 'Mechanical keyboard',
      price: 1299,
      costPrice: 780,
      stock: 24,
      categoryId: 1,
    },
    {
      id: 2,
      sku: 'KBD-1002',
      name: 'Low-profile keyboard',
      price: 899,
      costPrice: 520,
      stock: 0,
      categoryId: 1,
    },
    {
      id: 3,
      sku: 'MOU-2001',
      name: 'Ergonomic mouse',
      price: 749,
      costPrice: 410,
      stock: 31,
      categoryId: 2,
    },
    {
      id: 4,
      sku: 'MOU-2002',
      name: 'Ratón inalámbrico',
      price: 399,
      costPrice: 220,
      stock: 58,
      categoryId: 2,
    },
    {
      id: 5,
      sku: 'MON-3001',
      name: '27-inch monitor',
      price: 5499,
      costPrice: 4100,
      stock: 7,
      categoryId: 3,
    },
  ],
};

export const MESSAGES: ApiMessages = {
  validation: {
    required: 'Required.',
    length: 'Must have between {min} and {max} characters.',
    positive: 'Must be greater than 0.',
    notNegative: "Can't be negative.",
    integer: 'Must be a whole number.',
    number: 'Must be a number.',
    skuFormat: 'Must look like ABC-1234.',
    category: 'There is no category with id {value}.',
    role: 'Must be one of: {value}.',
    page: 'Must be 1 or more.',
    pageSize: 'Must be between 1 and {max}.',
  },
  notFound: 'There is no product with id {value}.',
  skuTaken: 'A product with SKU {value} already exists.',
};

/** Ids hexadecimales predecibles: 0001…, 0002… */
export function sequentialHex(): (length: number) => string {
  let counter = 0;
  return (length) => {
    counter += 1;
    return counter.toString(16).padStart(length, '0').slice(-length);
  };
}
