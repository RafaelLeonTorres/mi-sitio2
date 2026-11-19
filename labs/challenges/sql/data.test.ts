import { describe, expect, it } from 'vitest';
import {
  caseSql,
  editorSchema,
  insertSql,
  literal,
  schemaSql,
  tableColumns,
  type Dataset,
  type SqlChallenge,
} from './data';

const dataset: Dataset = {
  tables: [
    {
      id: 'Products',
      ddl: 'CREATE TABLE Products (\n  Id int IDENTITY(1, 1) PRIMARY KEY,\n  Sku nvarchar(20) NOT NULL UNIQUE,\n  Price decimal(10, 2) NOT NULL\n);',
      defaults: { Price: 100 },
      sample: { columns: ['Id', 'Sku', 'Price'], rows: [] },
    },
    {
      id: 'OrderLines',
      ddl: 'CREATE TABLE OrderLines (\n  OrderId int NOT NULL,\n  LineNumber int NOT NULL,\n  PRIMARY KEY (OrderId, LineNumber)\n);',
      sample: { columns: ['OrderId', 'LineNumber'], rows: [] },
    },
  ],
  generators: [
    { id: 'lines', sql: 'INSERT INTO OrderLines SELECT i, 1 FROM generate_series(1, 3) AS i;' },
  ],
};

const challenge: SqlChallenge = {
  language: 'sql',
  category: 'changes',
  difficulty: 'easy',
  tables: ['Products', 'OrderLines'],
  setup: 'CREATE INDEX IX_Products_Sku ON Products (Sku);',
  check: 'table',
  verify: 'SELECT 1;',
  starter: 'SELECT 1;',
  solution: 'SELECT 2;',
  cases: [
    {
      sample: true,
      tables: { Products: { columns: ['Id', 'Sku'], rows: [[1, "O'Brien"]] } },
      generate: ['lines'],
    },
  ],
};

describe('literal e insertSql', () => {
  it('escribe los valores como literales de SQL', () => {
    expect(literal(null)).toBe('NULL');
    expect(literal(12.5)).toBe('12.5');
    expect(literal("O'Brien")).toBe("'O''Brien'");
  });

  it('agrega las columnas obligatorias que el caso no trae', () => {
    expect(
      insertSql(
        'Products',
        {
          columns: ['Id', 'Sku'],
          rows: [
            [1, 'A'],
            [2, 'B'],
          ],
        },
        { Price: 100, sku: 'x' },
      ),
    ).toBe("INSERT INTO Products (Id, Sku, Price) VALUES\n  (1, 'A', 100),\n  (2, 'B', 100);");
    expect(insertSql('Products', { columns: ['Id'], rows: [] })).toBe('');
  });
});

describe('schemaSql y caseSql', () => {
  it('el esquema son las tablas del reto y lo que agrega', () => {
    const schema = schemaSql(challenge, dataset);
    expect(schema.startsWith('CREATE TABLE Products')).toBe(true);
    expect(schema.endsWith('CREATE INDEX IX_Products_Sku ON Products (Sku);')).toBe(true);
  });

  it('los datos: los INSERT, los generadores y el contador de IDENTITY al día', () => {
    const sql = caseSql(challenge, challenge.cases[0] ?? {}, dataset);
    expect(sql.split('\n\n')).toEqual([
      "INSERT INTO Products (Id, Sku, Price) VALUES\n  (1, 'O''Brien', 100);",
      'INSERT INTO OrderLines SELECT i, 1 FROM generate_series(1, 3) AS i;',
      "SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(Id), 0) + 1, false) FROM Products;",
    ]);
  });

  it('avisa si falta una tabla o un generador', () => {
    expect(() => schemaSql({ ...challenge, tables: ['Nope'] }, dataset)).toThrow();
    expect(() => caseSql(challenge, { generate: ['nope'] }, dataset)).toThrow();
  });
});

describe('tableColumns y editorSchema', () => {
  it('las columnas en orden, sin las restricciones de tabla', () => {
    expect(tableColumns(dataset.tables[1]?.ddl ?? '')).toEqual(['OrderId', 'LineNumber']);
    expect(editorSchema(dataset.tables)).toEqual({
      Products: ['Id', 'Sku', 'Price'],
      OrderLines: ['OrderId', 'LineNumber'],
    });
  });
});
