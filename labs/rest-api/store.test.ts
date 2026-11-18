import { describe, expect, it } from 'vitest';
import { SEED } from './fixtures';
import { createStore } from './store';

const NOW = Date.UTC(2026, 10, 18, 21, 0, 0);
const store = () => createStore(SEED, () => NOW);

describe('createStore', () => {
  it('pagina los productos vigentes por id', () => {
    const page = store().list(2, 2, '');
    expect(page.items.map((product) => product.id)).toEqual([3, 4]);
    expect(page.total).toBe(5);
  });

  it('busca en el nombre y el SKU sin distinguir mayúsculas ni acentos', () => {
    expect(
      store()
        .list(1, 10, 'RATON')
        .items.map((product) => product.id),
    ).toEqual([4]);
    expect(
      store()
        .list(1, 10, 'mou-')
        .items.map((product) => product.id),
    ).toEqual([3, 4]);
  });

  it('crea con el siguiente id, la versión 1 y la auditoría', () => {
    const s = store();
    const product = s.create(
      { name: 'Webcam', sku: 'CAM-4001', price: 999, stock: 5, categoryId: 3 },
      'demo-editor',
    );
    expect(product.id).toBe(6);
    expect(product.rowVersion).toBe(1);
    expect(product.costPrice).toBe(0);
    expect(product.createdBy).toBe('demo-editor');
    expect(product.createdAt).toBe(new Date(NOW).toISOString());
  });

  it('al actualizar sube la versión y anota quién y cuándo', () => {
    const s = store();
    const product = s.update(
      1,
      { name: 'Keyboard', sku: 'KBD-1001', price: 1199, stock: 20, categoryId: 1 },
      'demo-admin',
    );
    expect(product?.price).toBe(1199);
    expect(product?.rowVersion).toBe(2);
    expect(product?.updatedBy).toBe('demo-admin');
  });

  it('borra de forma lógica y el SKU queda libre', () => {
    const s = store();
    expect(s.remove(3, 'demo-admin')).toBe(true);
    expect(s.find(3)).toBe(undefined);
    expect(s.remove(3, 'demo-admin')).toBe(false);
    expect(s.skuTaken('mou-2001')).toBe(false);
    expect(s.list(1, 10, '').total).toBe(4);
  });

  it('revisa el SKU sin contar al mismo producto', () => {
    const s = store();
    expect(s.skuTaken('kbd-1001')).toBe(true);
    expect(s.skuTaken('KBD-1001', 1)).toBe(false);
  });

  it('restablece los datos iniciales', () => {
    const s = store();
    s.remove(1, 'demo-admin');
    s.create(
      { name: 'Webcam', sku: 'CAM-4001', price: 999, stock: 5, categoryId: 3 },
      'demo-editor',
    );
    s.reset();
    expect(s.list(1, 10, '').items.map((product) => product.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
