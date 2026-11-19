import { describe, expect, it } from 'vitest';
import { hashMatch, scan, seek, select } from './plan';
import { clusteredIndex, nonclustered, table } from './schema';
import { statisticsText, tableIo } from './statistics';

const orders = table('Orders', 1_000_000);
const customers = table('Customers', 50_000);

describe('SET STATISTICS IO, TIME', () => {
  it('escribe una línea por tabla con el formato de SQL Server 2019 en adelante', () => {
    const plan = select(
      scan(clusteredIndex(orders), { rows: 20, predicate: 'CustomerId = @CustomerId' }),
    );
    const lines = statisticsText(plan, 'warm').split('\n');
    expect(lines[0]).toBe('SQL Server parse and compile time: ');
    expect(lines).toContain('(20 rows affected)');
    expect(lines).toContain(
      "Table 'Orders'. Scan count 1, logical reads 16396, physical reads 0, page server reads 0, " +
        'read-ahead reads 0, page server read-ahead reads 0, lob logical reads 0, lob physical reads 0, ' +
        'lob page server reads 0, lob read-ahead reads 0, lob page server read-ahead reads 0.',
    );
    expect(lines.at(-2)).toBe(' SQL Server Execution Times:');
    expect(lines.at(-1)).toMatch(/^ {3}CPU time = \d+ ms, {2}elapsed time = \d+ ms\.$/);
  });

  it('con la caché fría aparecen las lecturas físicas y la lectura anticipada', () => {
    const plan = select(scan(clusteredIndex(orders), { rows: 20 }));
    const [io] = tableIo(plan, 'cold');
    expect(io?.readAheadReads).toBe(clusteredIndex(orders).shape.leafPages);
    expect(io?.physicalReads).toBeGreaterThan(0);
  });

  it('un Hash Match agrega las líneas de Workfile y Worktable, y cada tabla tiene la suya', () => {
    const byDate = nonclustered(orders, 'IX', ['OrderDate'], ['CustomerId']);
    const plan = select(
      hashMatch(
        seek(byDate, { rows: 100, seek: 's' }),
        scan(clusteredIndex(customers), { rows: 50_000 }),
        90,
        'Right Semi Join',
      ),
    );
    const text = statisticsText(plan, 'warm');
    expect(text).toContain("Table 'Workfile'. Scan count 0");
    expect(text).toContain("Table 'Worktable'. Scan count 0");
    expect(text).toContain("Table 'Orders'. Scan count 1");
    expect(text).toContain("Table 'Customers'. Scan count 1");
    expect(text).toContain('(90 rows affected)');
  });

  it('una fila se cuenta en singular', () => {
    const plan = select(
      seek(clusteredIndex(customers), { rows: 1, seek: 'Id = @p', unique: true }),
    );
    expect(statisticsText(plan, 'warm')).toContain('(1 row affected)');
    // Una igualdad sobre la clave única no cuenta como scan.
    expect(statisticsText(plan, 'warm')).toContain(
      "Table 'Customers'. Scan count 0, logical reads 3",
    );
  });
});
