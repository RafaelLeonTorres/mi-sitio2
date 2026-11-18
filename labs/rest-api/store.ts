// El repositorio en memoria de la API: productos y categorías, con la búsqueda, la paginación,
// el borrado lógico (IsDeleted) y la auditoría que haría EF Core. Restablecer vuelve a los
// datos iniciales; nada se guarda entre visitas.

export interface Category {
  readonly id: number;
  readonly name: string;
}

/** La entidad completa. La API nunca la devuelve tal cual: responde con `ProductResponse`. */
export interface Product {
  readonly id: number;
  sku: string;
  name: string;
  price: number;
  /** Lo que le cuesta a la tienda: dato interno que el DTO no expone. */
  costPrice: number;
  stock: number;
  categoryId: number;
  /** Cambia con cada escritura, como un `rowversion` de SQL Server. */
  rowVersion: number;
  isDeleted: boolean;
  readonly createdAt: string;
  readonly createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Lo que trae una petición para crear o reemplazar un producto. */
export interface ProductData {
  readonly name: string;
  readonly sku: string;
  readonly price: number;
  readonly stock: number;
  readonly categoryId: number;
}

export interface Seed {
  readonly categories: readonly Category[];
  readonly products: readonly (ProductData & { readonly id: number; readonly costPrice: number })[];
}

export interface Page {
  readonly items: readonly Product[];
  readonly total: number;
}

export interface Store {
  /** Productos vigentes que contienen `search` en el nombre o el SKU, por id. */
  list(page: number, pageSize: number, search: string): Page;
  find(id: number): Product | undefined;
  /** Si otro producto vigente ya usa el SKU (sin distinguir mayúsculas). */
  skuTaken(sku: string, exceptId?: number): boolean;
  category(id: number): Category | undefined;
  create(data: ProductData, user: string): Product;
  update(id: number, data: ProductData, user: string): Product | undefined;
  /** Borrado lógico: el producto deja de verse, pero la fila sigue ahí. */
  remove(id: number, user: string): boolean;
  reset(): void;
}

// Los datos iniciales se crearon a lo largo de enero de 2026.
const SEEDED_FROM = Date.UTC(2026, 0, 5, 15, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

export function createStore(seed: Seed, clock: () => number): Store {
  let products: Product[] = [];
  const categories = new Map(seed.categories.map((category) => [category.id, category]));

  const reset = () => {
    products = seed.products.map((item, index) => ({
      ...item,
      rowVersion: 1,
      isDeleted: false,
      createdAt: new Date(SEEDED_FROM + index * DAY_MS).toISOString(),
      createdBy: 'seed',
      updatedAt: null,
      updatedBy: null,
    }));
  };
  reset();

  const live = () => products.filter((product) => !product.isDeleted);
  const now = () => new Date(clock()).toISOString();

  return {
    list(page, pageSize, search) {
      const wanted = fold(search.trim());
      const matches = live().filter(
        (product) =>
          wanted === '' ||
          fold(product.name).includes(wanted) ||
          fold(product.sku).includes(wanted),
      );
      const start = (page - 1) * pageSize;
      return { items: matches.slice(start, start + pageSize), total: matches.length };
    },
    find(id) {
      return live().find((product) => product.id === id);
    },
    skuTaken(sku, exceptId) {
      const wanted = sku.toUpperCase();
      return live().some(
        (product) => product.sku.toUpperCase() === wanted && product.id !== exceptId,
      );
    },
    category(id) {
      return categories.get(id);
    },
    create(data, user) {
      const id = products.reduce((max, product) => Math.max(max, product.id), 0) + 1;
      const product: Product = {
        id,
        ...data,
        costPrice: 0,
        rowVersion: 1,
        isDeleted: false,
        createdAt: now(),
        createdBy: user,
        updatedAt: null,
        updatedBy: null,
      };
      products.push(product);
      return product;
    },
    update(id, data, user) {
      const product = this.find(id);
      if (!product) return undefined;
      Object.assign(product, data);
      product.rowVersion += 1;
      product.updatedAt = now();
      product.updatedBy = user;
      return product;
    },
    remove(id, user) {
      const product = this.find(id);
      if (!product) return false;
      product.isDeleted = true;
      product.rowVersion += 1;
      product.updatedAt = now();
      product.updatedBy = user;
      return true;
    },
    reset,
  };
}

/** Para buscar sin distinguir mayúsculas ni acentos: "Ratón" se encuentra con "raton". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
