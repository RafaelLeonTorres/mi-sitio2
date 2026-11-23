---
title: "SQL Server 2025 by Example: Native JSON, Regular Expressions, Vectors, and Fuzzy Matching"
description: "What's new in T-SQL in SQL Server 2025, the latest release: the json type with indexes, REGEXP functions, vectors with VECTOR_DISTANCE, EDIT_DISTANCE, the || operator, and what's still in preview. Sample queries based on the official documentation."
lang: en
locale: en_US
ref: novedades-sql-server-2025
date: 2026-11-23 08:30:00 -0600
permalink: /en/blog/whats-new-sql-server-2025/
tags: [SQL Server, SQL Server 2025, T-SQL]
---

SQL Server 2025 (version 17.x) is the engine's latest release and brings the biggest expansion of T-SQL in years: a native `json` type with indexes, regular expressions, vectors for semantic search, and functions for fuzzy text comparison. This post goes through what you notice most when writing queries.

The queries are based on the examples in Microsoft's official documentation, with table and column names adapted; the syntax doesn't change. At the end there's a table with what's already stable and what's still in preview, according to the documentation as of November 2026.

## Before you start: the compatibility level

The language features depend on the database compatibility level. `REGEXP_LIKE` requires level 170 (the SQL Server 2025 level); the other scalar `REGEXP_*` functions are available at all levels. The `json` type and the `vector` type also work at any level. To raise an existing database:

```sql
ALTER DATABASE CURRENT SET COMPATIBILITY_LEVEL = 170;
```

## 1. Native `json` type and JSON indexes

Up to SQL Server 2022, JSON lived in `nvarchar(max)` columns and was queried with `JSON_VALUE` and `OPENJSON`. SQL Server 2025 adds the `json` type, which stores the document in a binary format. You use it like any other type, and it supports constraints:

```sql
CREATE TABLE dbo.Orders
(
    order_id INT,
    details JSON NOT NULL
        CHECK (JSON_PATH_EXISTS(details, '$.basket') = 1)
);
```

A `json` column can't be a key column in a regular index; only an included column or part of the filter of a filtered index. To search inside the documents there's `CREATE JSON INDEX`:

```sql
CREATE TABLE dbo.Events
(
    id INT PRIMARY KEY,
    payload JSON NOT NULL
);

-- On the whole document...
CREATE JSON INDEX IX_Events_payload
    ON dbo.Events (payload);
```

Or, as an alternative, only on the paths you query, with the same options as other indexes:

```sql
CREATE JSON INDEX IX_Events_payload
    ON dbo.Events (payload)
    FOR ('$.customer.id', '$.order.total') WITH (FILLFACTOR = 80);
```

The index optimizes queries that use `JSON_VALUE`, `JSON_PATH_EXISTS`, and `JSON_CONTAINS`. `JSON_VALUE` now accepts `RETURNING` to convert the value to the type you need:

```sql
-- Equality on a number, converted to int
SELECT *
FROM dbo.Events
WHERE JSON_VALUE(payload, '$.customer.id' RETURNING INT) = 16167;

-- Does the path exist?
SELECT COUNT(*)
FROM dbo.Events
WHERE JSON_PATH_EXISTS(payload, '$.order.processed') = 1;
```

According to the documentation, the index supports the `=` comparison operators; `LIKE` and `IS [NOT] NULL` aren't supported yet.

`JSON_CONTAINS` looks for a value, an object, or an array inside a path. With `[*]` it walks through all the elements of an array:

```sql
DECLARE @j AS JSON = '{"customer": {"id": 16167, "tags": ["vip", "wholesale"]}}';

SELECT JSON_CONTAINS(@j, 'vip', '$.customer.tags[*]') AS contains_it;
```

It returns `1` if it finds it. And to build JSON from a result, `JSON_ARRAYAGG` and `JSON_OBJECTAGG` aggregate rows into an array or an object. This example from the documentation works in any database: it returns, for each object, an array with the names of its columns in order.

```sql
SELECT TOP(5) c.object_id, JSON_ARRAYAGG(c.name ORDER BY c.column_id) AS column_list
FROM sys.columns AS c
GROUP BY c.object_id;
```

## 2. Regular expressions

The `REGEXP_*` functions use the RE2 library. That means guaranteed linear time and, by design, no backreferences or lookaround. There are five scalar functions, `REGEXP_LIKE`, `REGEXP_REPLACE`, `REGEXP_SUBSTR`, `REGEXP_INSTR`, and `REGEXP_COUNT`, and two that return tables, `REGEXP_MATCHES` and `REGEXP_SPLIT_TO_TABLE`.

The most valuable use is validating data in the database itself, with a `CHECK` constraint:

```sql
CREATE TABLE dbo.Employees
(
    ID INT IDENTITY (101, 1),
    [Name] VARCHAR (150),
    Email VARCHAR (320)
        CHECK (REGEXP_LIKE (Email, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')),
    Phone_Number NVARCHAR (20)
        CHECK (REGEXP_LIKE (Phone_Number, '^(\d{3})-(\d{3})-(\d{4})$'))
);
```

To filter, the third argument is flags; `i` ignores case:

```sql
SELECT *
FROM Employees
WHERE REGEXP_LIKE (FIRST_NAME, '^A.*Y$', 'i');
```

Replacing, extracting, and counting:

```sql
-- Hide the last four digits of the phone number
SELECT REGEXP_REPLACE(PHONE_NUMBER, '\d{4}$', '****')
FROM CUSTOMERS;

-- Extract the domain from an email (the last argument is the capture group)
SELECT REGEXP_SUBSTR(EMAIL, '@(.+)$', 1, 1, 'i', 1) AS DOMAIN
FROM CUSTOMERS;

-- Count how many words a comment has
SELECT REGEXP_COUNT(COMMENT, '\w+') AS WORDS
FROM FEEDBACK;
```

`REGEXP_REPLACE(string, pattern, replacement, start, occurrence, flags)` and `REGEXP_SUBSTR(string, pattern, start, occurrence, flags, group)` take those optional arguments in that order; that's why, to extract a group, you also have to write the start, the occurrence, and the flags.

Two details about performance and behavior that the documentation examples show: `REGEXP_LIKE` doesn't respect the column's collation (use the `i` flag to ignore case), and a pattern anchored with `^` can use an index, while one without an anchor scans the whole table.

## 3. Vectors and semantic search

The `vector(n)` type stores *embeddings*, the arrays of numbers an AI model uses to represent the meaning of a text. By default it uses `float32` and supports up to 1,998 dimensions; the `float16` variant, up to 3,996, is in preview in SQL Server 2025.

```sql
CREATE TABLE dbo.vectors
(
    id INT PRIMARY KEY,
    v VECTOR(3) NOT NULL
);

INSERT INTO dbo.vectors (id, v)
VALUES (1, '[0.1, 2, 30]'),
       (2, '[-100.2, 0.123, 9.876]'),
       (3, JSON_ARRAY(1.0, 2.0, 3.0)); -- JSON_ARRAY also produces a vector
```

`VECTOR_DISTANCE(metric, vector1, vector2)` measures how far apart two vectors are. The metrics are `cosine`, `euclidean`, and `dot` (the last one returns the negated dot product, so less means more similar):

```sql
DECLARE @v1 AS VECTOR(2) = '[1,1]';
DECLARE @v2 AS VECTOR(2) = '[-1,-1]';

SELECT VECTOR_DISTANCE('euclidean', @v1, @v2) AS euclidean,
       VECTOR_DISTANCE('cosine', @v1, @v2) AS cosine,
       VECTOR_DISTANCE('dot', @v1, @v2) AS negative_dot_product;
```

The two vectors point in opposite directions, so the cosine distance is 2, the maximum of its range. An exact semantic search sorts all the rows by distance to the query vector:

```sql
DECLARE @query AS VECTOR(1536);

SELECT @query = title_vector
FROM dbo.Articles
WHERE title = 'Alan Turing';

SELECT TOP (10) id,
                title,
                VECTOR_DISTANCE('cosine', @query, title_vector) AS distance
FROM dbo.Articles
ORDER BY distance;
```

This search is exact: it computes the distance against every row, so it gets slow as the table grows. The vectors come from a model: SQL Server 2025 brings `CREATE EXTERNAL MODEL` to register an AI inference endpoint, `AI_GENERATE_EMBEDDINGS` to generate vectors from T-SQL, and `AI_GENERATE_CHUNKS` to split long texts.

### Vector indexes: still in preview

For large tables, approximate search with a `DiskANN` index trades accuracy for speed. In SQL Server 2025, `CREATE VECTOR INDEX` and `VECTOR_SEARCH` are **preview** features: you have to enable them in the database and they aren't recommended for production. The new index needs at least 100 rows, and the query uses `TOP (N) WITH APPROXIMATE`; the `TOP_N` parameter of `VECTOR_SEARCH` is deprecated.

```sql
ALTER DATABASE SCOPED CONFIGURATION
SET PREVIEW_FEATURES = ON;
GO

CREATE VECTOR INDEX vec_idx ON Articles(embedding)
WITH (METRIC = 'cosine', TYPE = 'diskann');
GO

DECLARE @qv VECTOR(5) = '[0.3, 0.3, 0.3, 0.3, 0.3]';

SELECT TOP (3) WITH APPROXIMATE
    t.id,
    t.title,
    s.distance
FROM
    VECTOR_SEARCH(
        TABLE = Articles AS t,
        COLUMN = embedding,
        SIMILAR_TO = @qv,
        METRIC = 'cosine'
    ) AS s
ORDER BY s.distance, t.title;
```

In Azure SQL Database these two features are already generally available. EF Core 11 exposes them with `HasVectorIndex` and `VectorSearch()`, also as experimental; there's more in the [.NET 11 post]({{ '/en/blog/whats-new-dotnet-11/' | relative_url }}).

## 4. Fuzzy text matching

Four functions compare strings that almost match: `EDIT_DISTANCE` (how many insertions, deletions, substitutions, and transpositions separate one string from another), `EDIT_DISTANCE_SIMILARITY` (the same idea as a score from 0 to 100), `JARO_WINKLER_DISTANCE`, and `JARO_WINKLER_SIMILARITY` (which gives more weight to strings that match from the beginning, also 0 to 100).

```sql
SELECT 'Colour' AS WordUK,
       'Color' AS WordUS,
       EDIT_DISTANCE('Colour', 'Color') AS Distance;
```

```text
WordUK WordUS Distance
------ ------ -----------
Colour Color  1
```

`EDIT_DISTANCE` accepts a third argument with the maximum distance you care about: if it's exceeded, it returns that maximum plus one.

```sql
SELECT Source,
       Target,
       EDIT_DISTANCE(Source, Target) AS ActualDistance,
       EDIT_DISTANCE(Source, Target, 2) AS LimitedDistance
FROM (VALUES ('Chocolate', 'Sweets')) AS compare(Source, Target);
```

```text
Source    Target    ActualDistance LimitedDistance
--------- --------- -------------- ---------------
Chocolate Sweets    8              3
```

And `JARO_WINKLER_SIMILARITY('Colour', 'Color')` returns `97`. A real use is finding possible duplicates in a customer catalog. Comparing everything against everything is quadratic, so narrow down the candidates (here, to names with the same initial):

```sql
SELECT a.id AS id_a,
       b.id AS id_b,
       a.name AS name_a,
       b.name AS name_b,
       EDIT_DISTANCE_SIMILARITY(a.name, b.name) AS similarity
FROM dbo.Customers AS a
JOIN dbo.Customers AS b
    ON a.id < b.id
   AND LEFT(a.name, 1) = LEFT(b.name, 1)
WHERE EDIT_DISTANCE_SIMILARITY(a.name, b.name) >= 85
ORDER BY similarity DESC;
```

Two warnings from the documentation. First: these functions are stable starting with SQL Server 2025 cumulative update **CU11**; on earlier builds they're in preview and you have to set `PREVIEW_FEATURES` to `ON`. Second: the result depends on the collation of the arguments (case and accent sensitivity, for example); Windows collations and binary collations are supported, non-binary `SQL_*` collations aren't, and you can force one with `COLLATE` on the arguments. The algorithm behind them is explained, with its C# code, in the [algorithms post]({{ '/en/blog/algorithms-dotnet-real-problems/' | relative_url }}).

## 5. Small but useful improvements

```sql
-- Concatenate with || (besides the usual +)
SELECT LastName || ', ' || FirstName AS FullName
FROM dbo.People;

-- SUBSTRING without a length: returns the rest of the string
SELECT SUBSTRING('SQL Server 2025', 12);

-- The current date, without a time
SELECT CURRENT_DATE;

-- The product of a column, like SUM but multiplying
SELECT PRODUCT(factor)
FROM (VALUES (2), (3), (4)) AS t(factor);
```

`UNISTR` (builds Unicode characters from their code points), `BASE64_ENCODE` and `BASE64_DECODE` also arrive, and `DATEADD` accepts a `bigint` as the amount.

## 6. Other news

- **`sp_invoke_external_rest_endpoint`.** Calls REST or GraphQL endpoints from T-SQL: an Azure Function, an Azure OpenAI service, or one of your own.
- **Change event streaming (preview).** Publishes row changes (inserts, updates, and deletes) in near real time to Azure Event Hubs or Fabric Eventstream, as CloudEvents.
- **Data API builder and SQL MCP Server.** They expose the database over REST or GraphQL, and to AI agents through the MCP protocol.
- **Editions.** Standard raises its limit to 4 sockets or 32 cores (whichever is lower) and 256 GB of memory for the buffer pool, and gets Resource Governor. The Web edition goes away. Express rises to 50 GB per database and includes what used to ship only in *Express with Advanced Services*, which also goes away. There are Developer editions of Standard and Enterprise, only for non-production use.

## What's stable and what's still in preview

| Feature | Status (November 2026) |
|---|---|
| `json` type, `CREATE JSON INDEX`, `JSON_CONTAINS`, `JSON_ARRAYAGG`, `JSON_OBJECTAGG` | Available |
| `REGEXP_*` functions | Available (`REGEXP_LIKE` requires compatibility level 170) |
| `vector` type (`float32`) and `VECTOR_DISTANCE` | Available |
| `vector` type with `float16` | Preview |
| `CREATE VECTOR INDEX` and `VECTOR_SEARCH` | Preview (`PREVIEW_FEATURES = ON`) |
| `EDIT_DISTANCE`, `EDIT_DISTANCE_SIMILARITY`, `JARO_WINKLER_*` | Stable since CU11; preview before |
| Change event streaming | Preview |
| Concatenation with a double vertical bar, `CURRENT_DATE`, `PRODUCT`, `SUBSTRING` without a length, `UNISTR` | Available |

If you want to try all this, the Developer edition is free for development and testing. Before taking anything to production, confirm its status in the documentation for your build: as the fuzzy matching functions show, a feature's status can change with a cumulative update.

## Sources

- [What's new in SQL Server 2025](https://learn.microsoft.com/sql/sql-server/what-s-new-in-sql-server-2025)
- [Regular expressions functions](https://learn.microsoft.com/sql/relational-databases/regular-expressions/overview)
- [json data type](https://learn.microsoft.com/sql/t-sql/data-types/json-data-type) and [CREATE JSON INDEX](https://learn.microsoft.com/sql/t-sql/statements/create-json-index-transact-sql)
- [vector data type](https://learn.microsoft.com/sql/t-sql/data-types/vector-data-type), [VECTOR_DISTANCE](https://learn.microsoft.com/sql/t-sql/functions/vector-distance-transact-sql), [VECTOR_SEARCH](https://learn.microsoft.com/sql/t-sql/functions/vector-search-transact-sql), and [CREATE VECTOR INDEX](https://learn.microsoft.com/sql/t-sql/statements/create-vector-index-transact-sql)
- [EDIT_DISTANCE](https://learn.microsoft.com/sql/t-sql/functions/edit-distance-transact-sql) and [fuzzy string matching](https://learn.microsoft.com/sql/relational-databases/fuzzy-string-match/overview)
