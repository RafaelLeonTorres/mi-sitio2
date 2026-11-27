// Qué T-SQL enseña el curso de SQL Server y cómo lo corre el navegador (PGlite, con translate.ts y
// compat.ts). Cada construcción lleva un ejemplo contra la base de ejemplo de los retos, y
// coverage.test.ts comprueba que su estado sea verdad. Una lección ejecutable solo puede usar lo que
// aquí es `native` o `adapted`; lo `blocked` se enseña con un paso capturado; lo `gap` todavía no
// corre y está pendiente.

import type { BlockKey } from './translate';

/**
 * - native: corre igual en SQL Server y en PostgreSQL; translate no cambia el texto.
 * - adapted: lo adaptan translate.ts (con una nota) o las funciones de compat.ts.
 * - blocked: no corre aquí; translate lo detiene con un mensaje (`blocked` dice cuál).
 * - gap: tampoco se detiene: PostgreSQL da un error. Es lo que falta por traducir.
 */
export type Coverage = 'native' | 'adapted' | 'blocked' | 'gap';

export interface Construct {
  /** El módulo del curso donde se enseña (sección 7 del plan). */
  readonly module: number;
  readonly status: Coverage;
  readonly name: string;
  /** Un ejemplo en T-SQL, contra la base de ejemplo (challenge-datasets.yml). */
  readonly sql: string;
  /** Con `blocked`, la clave del mensaje con que se detiene. */
  readonly blocked?: BlockKey;
}

type Entry = readonly [number, Coverage, string, string, BlockKey?];

const ENTRIES: readonly Entry[] = [
  // 1. Primeros pasos con T-SQL
  [1, 'native', 'SELECT con columnas', 'SELECT Id, Name FROM Customers;'],
  [
    1,
    'native',
    'expresiones aritméticas',
    'SELECT Price * 1.16 AS PriceWithTax, Price + 10 AS Plus FROM Products;',
  ],
  [
    1,
    'adapted',
    'alias entre corchetes, con espacios',
    'SELECT Name AS [Customer Name] FROM Customers;',
  ],
  [1, 'adapted', 'concatenar con +', "SELECT Name + ' (' + City + ')' AS Label FROM Customers;"],
  [1, 'adapted', 'TOP (n)', 'SELECT TOP (3) Name FROM Customers ORDER BY Id;'],
  [
    1,
    'adapted',
    'TOP (n) WITH TIES',
    'SELECT TOP (2) WITH TIES Name, City FROM Customers ORDER BY City;',
  ],
  [1, 'native', 'DISTINCT', 'SELECT DISTINCT City FROM Customers;'],
  [
    1,
    'native',
    'ORDER BY con varias columnas',
    'SELECT Name FROM Customers ORDER BY City DESC, Name;',
  ],
  [1, 'adapted', 'el esquema dbo', 'SELECT Id FROM dbo.Customers;'],
  [1, 'adapted', 'GETDATE', 'SELECT GETDATE() AS Now;'],
  [
    1,
    'blocked',
    'TOP (n) PERCENT',
    'SELECT TOP (10) PERCENT Name FROM Customers ORDER BY Id;',
    'top',
  ],

  // 2. Filtrar y ordenar
  [
    2,
    'native',
    'WHERE con AND, OR y NOT',
    "SELECT Name FROM Customers WHERE (City = 'CDMX' OR City = 'Puebla') AND NOT CreatedAt < '2024-06-01';",
  ],
  [2, 'native', 'BETWEEN', 'SELECT Name FROM Products WHERE Price BETWEEN 100 AND 300;'],
  [2, 'native', 'IN', "SELECT Name FROM Customers WHERE City IN ('CDMX', 'Puebla');"],
  [
    2,
    'native',
    'LIKE con % y _',
    "SELECT Name FROM Customers WHERE Name LIKE 'A%' OR Email LIKE '_u%';",
  ],
  [
    2,
    'blocked',
    'LIKE con [a-c] y [^a]',
    "SELECT Name FROM Customers WHERE Name LIKE '[A-M]%';",
    'like-set',
  ],
  [2, 'native', 'IS NULL', 'SELECT Id FROM Orders WHERE ShippedAt IS NULL;'],
  [2, 'adapted', 'ISNULL', 'SELECT ISNULL(ShippedAt, OrderDate) AS Moved FROM Orders;'],
  [2, 'native', 'COALESCE', 'SELECT COALESCE(ShippedAt, OrderDate) AS Moved FROM Orders;'],
  [2, 'native', 'NULLIF', "SELECT NULLIF(Status, 'shipped') FROM Orders;"],
  [
    2,
    'native',
    'OFFSET … FETCH',
    'SELECT Id FROM Customers ORDER BY Id OFFSET 2 ROWS FETCH NEXT 3 ROWS ONLY;',
  ],

  // 3. Tipos y funciones
  [
    3,
    'native',
    'ABS, CEILING, FLOOR, POWER, SQRT y SIGN',
    'SELECT ABS(-5), CEILING(4.2), FLOOR(4.8), POWER(2, 10), SQRT(16), SIGN(-3);',
  ],
  [3, 'native', 'ROUND', 'SELECT ROUND(Price, 1) FROM Products;'],
  [3, 'native', 'módulo y división entera', 'SELECT 7 % 3 AS R, 7 / 2 AS Q;'],
  [3, 'adapted', 'LEN', 'SELECT LEN(Name) FROM Customers;'],
  [
    3,
    'native',
    'UPPER, LOWER, LTRIM y RTRIM',
    "SELECT UPPER(Name), LOWER(Name), LTRIM(' a'), RTRIM('a ') FROM Customers;",
  ],
  [
    3,
    'native',
    'LEFT, RIGHT, SUBSTRING, REPLACE y REVERSE',
    "SELECT LEFT(Name, 3), RIGHT(Name, 3), SUBSTRING(Name, 2, 3), REPLACE(Name, 'a', 'x'), REVERSE(Name) FROM Customers;",
  ],
  [
    3,
    'adapted',
    'CHARINDEX, REPLICATE y SPACE',
    "SELECT CHARINDEX('a', Name), REPLICATE('ab', 2), SPACE(3) FROM Customers;",
  ],
  [
    3,
    'native',
    'CONCAT y CONCAT_WS',
    "SELECT CONCAT(Name, '-', City), CONCAT_WS(', ', Name, City) FROM Customers;",
  ],
  [3, 'native', 'TRIM', "SELECT TRIM('  a  ');"],
  [
    3,
    'adapted',
    'STRING_AGG con WITHIN GROUP',
    "SELECT STRING_AGG(Name, ', ') WITHIN GROUP (ORDER BY Name) FROM Customers;",
  ],
  [3, 'adapted', 'STUFF', "SELECT STUFF('abcdef', 2, 3, 'XYZ');"],
  [3, 'adapted', 'STRING_SPLIT', "SELECT value FROM STRING_SPLIT('a,b,c', ',');"],
  [3, 'gap', 'FORMAT', "SELECT FORMAT(Price, 'N2') FROM Products;"],
  [3, 'gap', 'PATINDEX', "SELECT PATINDEX('%a%', Name) FROM Customers;"],
  [3, 'gap', 'CHOOSE', "SELECT CHOOSE(2, 'a', 'b', 'c');"],
  [3, 'gap', 'ISNUMERIC', "SELECT ISNUMERIC('12');"],
  [3, 'gap', 'QUOTENAME', "SELECT QUOTENAME('a b');"],
  [
    3,
    'adapted',
    'DATEADD, DATEDIFF, DATEPART y EOMONTH',
    'SELECT DATEADD(day, 7, OrderDate), DATEDIFF(day, OrderDate, ShippedAt), DATEPART(month, OrderDate), EOMONTH(OrderDate) FROM Orders;',
  ],
  [
    3,
    'adapted',
    'YEAR, MONTH y DAY',
    'SELECT YEAR(OrderDate), MONTH(OrderDate), DAY(OrderDate) FROM Orders;',
  ],
  [
    3,
    'adapted',
    'DATENAME',
    'SELECT DATENAME(month, OrderDate), DATENAME(weekday, OrderDate) FROM Orders;',
  ],
  [
    3,
    'adapted',
    'DATEFROMPARTS y DATETRUNC',
    'SELECT DATEFROMPARTS(2024, 3, 5), DATETRUNC(month, OrderDate) FROM Orders;',
  ],
  [3, 'adapted', 'GETUTCDATE', 'SELECT GETUTCDATE();'],
  [3, 'adapted', 'ISDATE', "SELECT ISDATE('2024-03-05');"],
  [
    3,
    'native',
    'CASE',
    "SELECT CASE WHEN Price > 200 THEN 'high' WHEN Price > 100 THEN 'mid' ELSE 'low' END FROM Products;",
  ],
  [3, 'adapted', 'IIF', "SELECT IIF(Price > 200, 'high', 'low') FROM Products;"],
  [3, 'adapted', 'CAST', 'SELECT CAST(Price AS int), CAST(Id AS nvarchar(10)) FROM Products;'],
  [
    3,
    'adapted',
    'CONVERT, con y sin estilo',
    "SELECT CONVERT(varchar(10), CreatedAt, 23), CONVERT(date, '05/03/2024', 103), CONVERT(nvarchar(10), Id) FROM Customers;",
  ],
  [
    3,
    'adapted',
    'TRY_CAST y TRY_CONVERT',
    "SELECT TRY_CAST('x1' AS int), TRY_CONVERT(date, '2024-13-45');",
  ],
  [3, 'adapted', 'NEWID', 'SELECT NEWID();'],
  [
    3,
    'adapted',
    'comparar texto sin distinguir mayúsculas',
    "SELECT Name FROM Customers WHERE Name = 'ana torres';",
  ],
  [
    3,
    'adapted',
    'COLLATE',
    "SELECT Name FROM Customers WHERE Name = 'ANA TORRES' COLLATE SQL_Latin1_General_CP1_CS_AS;",
  ],
  [
    3,
    'blocked',
    'CONVERT con un estilo sin traducir',
    'SELECT CONVERT(varchar(20), GETDATE(), 106);',
    'convert-style',
  ],
  [
    3,
    'blocked',
    'COLLATE sin equivalente',
    'SELECT Name FROM Customers ORDER BY Name COLLATE Latin1_General_CS_AI;',
    'collate',
  ],

  // 4. Agrupar y resumir
  [
    4,
    'native',
    'COUNT, SUM, AVG, MIN y MAX',
    'SELECT COUNT(*), SUM(Total), AVG(Total), MIN(Total), MAX(Total) FROM Orders;',
  ],
  [
    4,
    'native',
    'GROUP BY y HAVING',
    'SELECT City, COUNT(*) AS N FROM Customers GROUP BY City HAVING COUNT(*) > 1;',
  ],
  [4, 'native', 'COUNT(DISTINCT)', 'SELECT COUNT(DISTINCT CustomerId) FROM Orders;'],
  [
    4,
    'native',
    'ROLLUP',
    'SELECT CategoryId, COUNT(*) FROM Products GROUP BY ROLLUP (CategoryId);',
  ],
  [
    4,
    'native',
    'CUBE',
    'SELECT CustomerId, Status, COUNT(*) FROM Orders GROUP BY CUBE (CustomerId, Status);',
  ],
  [
    4,
    'native',
    'GROUPING SETS y GROUPING',
    'SELECT CustomerId, GROUPING(CustomerId) AS G, COUNT(*) FROM Orders GROUP BY GROUPING SETS ((CustomerId), ());',
  ],
  [4, 'adapted', 'STDEV y VAR', 'SELECT STDEV(Total), VAR(Total) FROM Orders;'],
  [
    4,
    'gap',
    'GROUP BY … WITH ROLLUP',
    'SELECT CategoryId, COUNT(*) FROM Products GROUP BY CategoryId WITH ROLLUP;',
  ],
  [4, 'adapted', 'COUNT_BIG', 'SELECT COUNT_BIG(*) FROM Orders;'],
  [
    4,
    'adapted',
    'GROUPING_ID',
    'SELECT GROUPING_ID(City) AS G FROM Customers GROUP BY ROLLUP (City);',
  ],
  [4, 'adapted', 'STRING_AGG de números', "SELECT STRING_AGG(Id, ',') AS Ids FROM Customers;"],

  // 5. Unir tablas
  [
    5,
    'native',
    'INNER JOIN',
    'SELECT c.Name, o.Id FROM Customers c INNER JOIN Orders o ON o.CustomerId = c.Id;',
  ],
  [
    5,
    'native',
    'LEFT JOIN',
    'SELECT c.Name, o.Id FROM Customers c LEFT JOIN Orders o ON o.CustomerId = c.Id;',
  ],
  [
    5,
    'native',
    'RIGHT JOIN',
    'SELECT c.Name, o.Id FROM Customers c RIGHT JOIN Orders o ON o.CustomerId = c.Id;',
  ],
  [
    5,
    'native',
    'FULL OUTER JOIN',
    'SELECT c.Id, o.Id FROM Customers c FULL OUTER JOIN Orders o ON o.CustomerId = c.Id;',
  ],
  [5, 'native', 'CROSS JOIN', 'SELECT c.Id, k.Id FROM Customers c CROSS JOIN Categories k;'],
  [
    5,
    'native',
    'autounión',
    'SELECT e.Name, m.Name FROM Employees e LEFT JOIN Employees m ON m.Id = e.ManagerId;',
  ],
  [
    5,
    'native',
    'EXISTS y NOT EXISTS',
    'SELECT Name FROM Customers c WHERE NOT EXISTS (SELECT 1 FROM Orders o WHERE o.CustomerId = c.Id);',
  ],
  [
    5,
    'adapted',
    'CROSS APPLY',
    'SELECT c.Name, x.Total FROM Customers c CROSS APPLY (SELECT TOP (1) Total FROM Orders o WHERE o.CustomerId = c.Id ORDER BY Total DESC) AS x;',
  ],
  [
    5,
    'adapted',
    'OUTER APPLY',
    'SELECT c.Name, x.Total FROM Customers c OUTER APPLY (SELECT TOP (1) Total FROM Orders o WHERE o.CustomerId = c.Id ORDER BY Total DESC) AS x;',
  ],

  // 6. Subconsultas y CTE
  [
    6,
    'native',
    'subconsulta escalar',
    'SELECT Name, (SELECT COUNT(*) FROM Orders o WHERE o.CustomerId = c.Id) AS N FROM Customers c;',
  ],
  [
    6,
    'native',
    'IN con una subconsulta',
    'SELECT Name FROM Customers WHERE Id IN (SELECT CustomerId FROM Orders);',
  ],
  [
    6,
    'native',
    'tabla derivada',
    'SELECT x.City, x.N FROM (SELECT City, COUNT(*) AS N FROM Customers GROUP BY City) AS x;',
  ],
  [
    6,
    'native',
    'WITH (CTE)',
    'WITH big AS (SELECT * FROM Orders WHERE Total > 100) SELECT COUNT(*) FROM big;',
  ],
  [
    6,
    'adapted',
    'CTE recursiva, con OPTION (MAXRECURSION)',
    'WITH n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 5) SELECT i FROM n OPTION (MAXRECURSION 100);',
  ],
  [
    6,
    'native',
    'UNION, INTERSECT y EXCEPT',
    'SELECT Id FROM Customers INTERSECT SELECT CustomerId FROM Orders EXCEPT SELECT 1;',
  ],
  [
    6,
    'blocked',
    'borrar a través de una CTE',
    'WITH d AS (SELECT Id FROM Customers) DELETE FROM d WHERE Id = 1;',
    'cte-target',
  ],

  // 7. Funciones de ventana
  [
    7,
    'native',
    'ROW_NUMBER, RANK y DENSE_RANK',
    'SELECT Id, ROW_NUMBER() OVER (ORDER BY Total DESC), RANK() OVER (ORDER BY Total DESC), DENSE_RANK() OVER (ORDER BY Total DESC) FROM Orders;',
  ],
  [
    7,
    'native',
    'PARTITION BY',
    'SELECT CustomerId, Total, SUM(Total) OVER (PARTITION BY CustomerId) FROM Orders;',
  ],
  [
    7,
    'native',
    'LAG y LEAD',
    'SELECT Id, LAG(Total) OVER (ORDER BY OrderDate), LEAD(Total) OVER (ORDER BY OrderDate) FROM Orders;',
  ],
  [
    7,
    'native',
    'acumulado con un marco',
    'SELECT Id, SUM(Total) OVER (ORDER BY OrderDate ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM Orders;',
  ],
  [
    7,
    'native',
    'NTILE y FIRST_VALUE',
    'SELECT Id, NTILE(2) OVER (ORDER BY Total), FIRST_VALUE(Total) OVER (ORDER BY Total) FROM Orders;',
  ],

  // 8. Modificar datos
  [
    8,
    'native',
    'INSERT con VALUES',
    "INSERT INTO Categories (Id, Name) VALUES (90, 'Nueva'), (91, 'Otra');",
  ],
  [
    8,
    'native',
    'INSERT … SELECT',
    'INSERT INTO OrdersArchive SELECT * FROM Orders WHERE Total < 100;',
  ],
  [8, 'native', 'UPDATE', 'UPDATE Products SET Price = Price * 1.1 WHERE CategoryId = 1;'],
  [8, 'native', 'DELETE', "DELETE FROM Logins WHERE LoginDate < '2026-10-13';"],
  [8, 'native', 'TRUNCATE TABLE', 'TRUNCATE TABLE OrdersArchive;'],
  [
    8,
    'adapted',
    'UPDATE con JOIN',
    "UPDATE p SET p.Price = p.Price * 1.1 FROM Products AS p JOIN Categories AS c ON c.Id = p.CategoryId WHERE c.Name = 'Café';",
  ],
  [
    8,
    'adapted',
    'DELETE con JOIN',
    'DELETE l FROM OrderLines AS l LEFT JOIN Orders AS o ON o.Id = l.OrderId WHERE o.Id IS NULL;',
  ],
  [
    8,
    'adapted',
    'OUTPUT',
    'UPDATE Products SET Price = Price + 1 OUTPUT deleted.Price, inserted.Price WHERE CategoryId = 1;',
  ],
  [
    8,
    'adapted',
    'MERGE',
    'MERGE StagingProducts AS t USING (SELECT Sku, Name, CategoryId, Price FROM Products) AS s ON t.Sku = s.Sku WHEN MATCHED THEN UPDATE SET Price = s.Price WHEN NOT MATCHED BY TARGET THEN INSERT (Sku, Name, CategoryId, Price) VALUES (s.Sku, s.Name, s.CategoryId, s.Price);',
  ],
  [
    8,
    'adapted',
    'SCOPE_IDENTITY',
    "INSERT INTO Products (Sku, Name, CategoryId, Price) VALUES ('X-1', 'X', 1, 1); SELECT SCOPE_IDENTITY();",
  ],
  [8, 'adapted', 'SELECT … INTO', 'SELECT Id, Total INTO #Big FROM Orders WHERE Total > 100;'],
  [
    8,
    'blocked',
    'OUTPUT … INTO',
    "DELETE FROM Logins OUTPUT deleted.CustomerId INTO #Gone WHERE LoginDate < '2026-10-13';",
    'output',
  ],
  [
    8,
    'blocked',
    'UPDATE con LEFT JOIN',
    'UPDATE p SET Price = 0 FROM Products p LEFT JOIN Categories c ON c.Id = p.CategoryId;',
    'update-join',
  ],

  // 9. Diseñar tablas
  [
    9,
    'adapted',
    'CREATE TABLE con IDENTITY y tipos de SQL Server',
    'CREATE TABLE Pets (Id int IDENTITY(1, 1) PRIMARY KEY, Name nvarchar(50) NOT NULL, BornAt datetime2, Active bit DEFAULT 1);',
  ],
  [
    9,
    'native',
    'restricciones',
    'CREATE TABLE Pets2 (Id int PRIMARY KEY, Age int CHECK (Age >= 0), Code varchar(5) UNIQUE, OwnerId int REFERENCES Customers (Id));',
  ],
  [
    9,
    'adapted',
    'secuencias',
    'CREATE SEQUENCE dbo.Seq9 START WITH 1 INCREMENT BY 1; SELECT NEXT VALUE FOR dbo.Seq9;',
  ],
  [
    9,
    'adapted',
    'tablas temporales',
    "CREATE TABLE #Tmp (Id int, Name nvarchar(20)); INSERT INTO #Tmp VALUES (1, 'a'); SELECT * FROM #Tmp;",
  ],
  [
    9,
    'native',
    'ALTER TABLE: ADD y DROP COLUMN',
    'ALTER TABLE Categories ADD Note varchar(50); ALTER TABLE Categories DROP COLUMN Note;',
  ],
  [9, 'native', 'DROP TABLE IF EXISTS', 'DROP TABLE IF EXISTS NoSuchTable;'],
  [
    9,
    'adapted',
    'CREATE NONCLUSTERED INDEX con INCLUDE',
    'CREATE NONCLUSTERED INDEX IX_Orders_Date ON Orders (OrderDate) INCLUDE (Total);',
  ],
  [9, 'native', 'CREATE VIEW', 'CREATE VIEW BigOrders AS SELECT * FROM Orders WHERE Total > 100;'],
  [9, 'gap', 'columna calculada', 'CREATE TABLE Calc (A int, B int, C AS (A + B));'],
  [9, 'gap', 'ALTER COLUMN', 'ALTER TABLE Categories ALTER COLUMN Name nvarchar(100) NOT NULL;'],
  [9, 'gap', 'CREATE OR ALTER VIEW', 'CREATE OR ALTER VIEW BigOrders2 AS SELECT * FROM Orders;'],
  [
    9,
    'gap',
    'SET IDENTITY_INSERT',
    "SET IDENTITY_INSERT Products ON; INSERT INTO Products (Id, Sku, Name, CategoryId, Price) VALUES (100, 'Z', 'Z', 1, 1); SET IDENTITY_INSERT Products OFF;",
  ],

  // 11 y 12. T-SQL programable y objetos: lo que el curso enseña con pasos capturados
  [11, 'blocked', 'variables con DECLARE', 'DECLARE @n int = 5; SELECT @n;', 'variable'],
  [
    11,
    'blocked',
    'TRY…CATCH',
    'BEGIN TRY SELECT 1 / 0; END TRY BEGIN CATCH SELECT 1; END CATCH',
    'try-catch',
  ],
  [11, 'blocked', 'PRINT', "PRINT 'hola';", 'print'],
  [11, 'blocked', 'IF', 'IF 1 = 1 SELECT 1;', 'control-flow'],
  [12, 'blocked', 'EXEC', 'EXEC sp_who;', 'procedure'],
  [12, 'blocked', 'CREATE PROCEDURE', 'CREATE PROCEDURE p AS SELECT 1;', 'procedure'],
];

export const COVERAGE: readonly Construct[] = ENTRIES.map(
  ([module, status, name, sql, blocked]) => ({
    module,
    status,
    name,
    sql,
    ...(blocked ? { blocked } : {}),
  }),
);
