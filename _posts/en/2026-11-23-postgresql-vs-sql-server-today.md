---
title: "PostgreSQL vs SQL Server Today: Where PostgreSQL Wins and Where It Still Doesn't"
description: "Cost, adoption, more expressive SQL, JSON, temporal constraints, extensions, and the news in PostgreSQL 18 and 19 compared with SQL Server 2025, with equivalent queries in both engines and the cases where SQL Server is still the better choice."
lang: en
locale: en_US
ref: postgresql-vs-sql-server-hoy
date: 2026-11-23 08:40:00 -0600
permalink: /en/blog/postgresql-vs-sql-server-today/
tags: [PostgreSQL, SQL Server, Databases]
---

PostgreSQL 19 came out on November 19, 2026 and SQL Server 2025 is Microsoft's latest release. It's a good time to compare the two engines with today's data rather than with the picture from ten years ago. In my professional experience SQL Server weighs more, while my portfolio projects, [Mediateca]({{ '/en/blog/how-mediateca-works/' | relative_url }}) and [Comprobante]({{ '/en/blog/how-comprobante-works/' | relative_url }}), use PostgreSQL; this post starts from that mix.

You'll see the advantages of PostgreSQL that are still real, with equivalent queries in both engines, and also where SQL Server still wins. SQL Server 2025 closed several gaps (native JSON, regular expressions, vectors), so some PostgreSQL advantages from a few years ago aren't as big anymore. The equivalent queries were run on PostgreSQL 18 and SQL Server 2022; what's exclusive to PostgreSQL 19 or SQL Server 2025 comes from the official documentation and I say so.

## The picture in one table

| | PostgreSQL | SQL Server |
|---|---|---|
| Latest version | 19 (November 19, 2026) | 2025 (17.x) |
| License | PostgreSQL License, open source | Commercial: per core, or server + CAL in Standard |
| Editions | One | Enterprise, Standard, Express, and Developer |
| Support for each version | 5 years from its release | Mainstream and extended, per Microsoft's lifecycle |
| Use among developers (Stack Overflow 2026) | 57.9% | 27.1% |

The percentages come from the [2026 Stack Overflow survey](https://survey.stackoverflow.co/2026/technology/) (12,061 respondents), which asked which databases people have done extensive development work in over the past year. PostgreSQL tops the list; SQL Server comes in fifth, behind SQLite, MySQL, and Redis. Popularity doesn't prove an engine is better for your case, but it does tell you how easy it is to find documentation, tools, and people who know it.

## Cost and limits

In SQL Server 2025 Standard, an instance uses at most 4 sockets or 32 cores (whichever is lower) and 256 GB of memory for the buffer pool. Express is free, but capped at 50 GB per database, and the Developer editions are only for development and testing. The production editions are licensed per core or, in Standard, per server plus a user or device CAL.

PostgreSQL has no editions: all the functionality comes in the same download and there are no license caps. That doesn't make it free to run, because backups, high availability, monitoring, and support cost time or money, but the license cost doesn't grow with the cores. The three big cloud providers, Azure, AWS, and Google Cloud, offer managed PostgreSQL.

## More expressive SQL: equivalent queries

These queries were run on PostgreSQL 18.7 and SQL Server 2022.

### Insert or update, and return the row

In PostgreSQL it's a single atomic statement, with `ON CONFLICT` and `RETURNING`:

```sql
INSERT INTO customers (email, name)
VALUES ('ana@example.com', 'Ana')
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
RETURNING id, email, name;
```

In SQL Server the pattern is `MERGE`, with `HOLDLOCK` to avoid race conditions between simultaneous requests, and `OUTPUT` to return the row:

```sql
MERGE customers WITH (HOLDLOCK) AS dest
USING (VALUES (N'ana@example.com', N'Ana')) AS src (email, name)
    ON dest.email = src.email
WHEN MATCHED THEN
    UPDATE SET name = src.name
WHEN NOT MATCHED THEN
    INSERT (email, name) VALUES (src.email, src.name)
OUTPUT inserted.id, inserted.email, inserted.name;
```

If the row already existed, both return the same `id` with the new name. PostgreSQL 19 adds `ON CONFLICT DO SELECT`, for the "get or create" pattern: on a conflict it returns the existing row without modifying it (syntax from the PostgreSQL 19 documentation; I didn't run it):

```sql
INSERT INTO customers (email, name)
VALUES ('ana@example.com', 'Ana')
ON CONFLICT (email) DO SELECT
RETURNING id, email, name;
```

### One row per group

Each customer's latest order. PostgreSQL solves it with `DISTINCT ON`:

```sql
SELECT DISTINCT ON (customer_id) customer_id, id, total
FROM orders
ORDER BY customer_id, created_at DESC;
```

In SQL Server you number the rows with `ROW_NUMBER` and filter:

```sql
WITH ranked AS (
    SELECT customer_id, id, total,
           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS position
    FROM orders
)
SELECT customer_id, id, total
FROM ranked
WHERE position = 1
ORDER BY customer_id;
```

Both return the same answer with the same test data: order 2 (250.00) for customer 1 and order 3 (80.00) for customer 2.

### JSON

PostgreSQL has had `jsonb`, a binary JSON you can index with GIN, for more than ten years. The containment (`@>`) and extraction (`->>`) operators make it comfortable to query:

```sql
CREATE INDEX events_payload_idx ON events USING gin (payload jsonb_path_ops);

SELECT id
FROM events
WHERE payload @> '{"status":"paid"}';

SELECT payload->>'type' AS type, (payload->>'amount')::numeric AS amount
FROM events
WHERE payload->>'type' = 'payment';
```

In SQL Server 2022 JSON lived in text and was queried with `JSON_VALUE`, with no specific index for the contents of the document:

```sql
SELECT id, JSON_VALUE(payload, '$.type') AS type, CAST(JSON_VALUE(payload, '$.amount') AS DECIMAL(10,2)) AS amount
FROM events
WHERE JSON_VALUE(payload, '$.status') = 'paid';
```

SQL Server 2025 closes a good part of that gap with the `json` type and `CREATE JSON INDEX`, as you can see in the [SQL Server 2025 post]({{ '/en/blog/whats-new-sql-server-2025/' | relative_url }}). Today the difference is no longer about capability but about maturity and ecosystem: `jsonb` has containment, existence, and path operators, and a decade of production use.

### No overlaps, inside the database

A room can't have two bookings at the same time. PostgreSQL 18 lets you declare it as a temporal primary key with `WITHOUT OVERLAPS` (it needs the `btree_gist` extension, so the room can be compared with `=` inside the same index):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE reservations (
    room int NOT NULL,
    during tstzrange NOT NULL,
    PRIMARY KEY (room, during WITHOUT OVERLAPS)
);

INSERT INTO reservations VALUES (1, '[2026-11-23 09:00-06, 2026-11-23 11:00-06)');  -- succeeds
INSERT INTO reservations VALUES (1, '[2026-11-23 10:00-06, 2026-11-23 12:00-06)');  -- ERROR: overlaps
INSERT INTO reservations VALUES (1, '[2026-11-23 11:00-06, 2026-11-23 12:00-06)');  -- succeeds: back to back
INSERT INTO reservations VALUES (2, '[2026-11-23 10:00-06, 2026-11-23 12:00-06)');  -- succeeds: another room
```

The second `INSERT` fails with `conflicting key value violates exclusion constraint "reservations_pkey"`. Since the `[start, end)` range includes the start and excludes the end, a booking that starts right when another one ends is valid. In PostgreSQL 17 and earlier you get the same with an `EXCLUDE USING gist` constraint.

SQL Server has no equivalent constraint: you build the rule with a transaction that locks the range (`UPDLOCK, HOLDLOCK`) and checks before inserting, or with a trigger. And since two simultaneous requests would pass a validation done only in the application, this is one of PostgreSQL's clearest advantages. The [algorithms post]({{ '/en/blog/algorithms-dotnet-real-problems/' | relative_url }}) shows how to detect the overlap in memory, for when you also need that.

### Similar text

The `pg_trgm` extension measures similarity by trigrams and lets you speed up the search with GIN or GiST indexes; `fuzzystrmatch` brings `levenshtein()`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

SELECT round(similarity('Jose Hernandez Lopez', 'Jose Hernandes Lopez')::numeric, 2) AS similarity;
```

```text
similarity
----------
      0.86
```

Trigrams are accent-sensitive: "José Hernández López" against "Jose Hernandes Lopez" gives only 0.37, so normalize first (the `unaccent` extension is for that). SQL Server 2025 brings its own functions, `EDIT_DISTANCE` and `JARO_WINKLER_SIMILARITY`, which compare two strings; to avoid comparing everything against everything you'll have to narrow the candidates yourself, as the algorithms post explains.

## Extensions

`CREATE EXTENSION` installs modules that plug into the engine: PostGIS for geospatial data, pgvector for vectors, `pg_trgm` for similarity, TimescaleDB for time series, Citus to distribute tables, and anyone can write their own. SQL Server 2025 natively incorporated several things that arrived in PostgreSQL as extensions (vectors, regular expressions), and it has CLR and external language services, but not a mechanism to add new index types or operators to the engine.

## Operations and performance: what's new in PostgreSQL 18 and 19

| Version | What's new |
|---|---|
| 18 (September 25, 2025) | Asynchronous I/O, `pg_upgrade` keeps the optimizer statistics, *skip scan* on multicolumn B-tree indexes, `uuidv7()`, virtual generated columns (now the default), OAuth authentication, `OLD` and `NEW` in `RETURNING`, temporal constraints |
| 19 (November 19, 2026) | `REPACK (CONCURRENTLY)`, the `pg_plan_advice` and `pg_stash_advice` extensions, parallel autovacuum on indexes, `WAIT FOR LSN`, logical replication of sequences and without restarting the server, `ON CONFLICT DO SELECT`, `COPY` with JSON output, `IGNORE NULLS` in window functions |

The list comes from the official release notes. Three of those changes answer well-known problems:

- **The cost of MVCC.** PostgreSQL leaves dead rows behind on updates and deletes, and `VACUUM FULL` used to lock the table. `REPACK (CONCURRENTLY) orders;` reclaims that space and reorders the table without blocking reads or writes, and autovacuum now processes indexes with several parallel workers.
- **Plans that change.** `pg_plan_advice` lets you pin the planner's decisions, and `pg_stash_advice` applies them per query without touching the application. SQL Server already had Query Store for this; PostgreSQL is starting to close the gap.
- **Reads on replicas.** `WAIT FOR LSN` waits, on the replica, for a certain point of the transaction log to be applied before querying, which gives reads that reflect what the same user just wrote on the primary.

According to the official announcement, foreign key checks were also sped up and, in its tests, bulk inserts were almost twice as fast.

On concurrency, in PostgreSQL readers don't block writers by design. In SQL Server the default `READ COMMITTED` level uses locks; to get that behavior you turn on row versioning isolation:

```sql
ALTER DATABASE MyDb SET READ_COMMITTED_SNAPSHOT ON;
```

## With .NET

With PostgreSQL you use Npgsql, the open source ADO.NET provider, and its EF Core provider, `Npgsql.EntityFrameworkCore.PostgreSQL`. With SQL Server, `Microsoft.Data.SqlClient` and `Microsoft.EntityFrameworkCore.SqlServer`, which Microsoft maintains. Both are mature, and the `DbContext` code moves from one to the other with few changes:

```csharp
// PostgreSQL
builder.Services.AddDbContext<AppDb>(o => o.UseNpgsql(postgresConnection));

// SQL Server
builder.Services.AddDbContext<AppDb>(o => o.UseSqlServer(sqlServerConnection));
```

The difference is who maintains them: the PostgreSQL one is a community project, so before upgrading to a new .NET version, confirm that its matching version already exists.

### Migrating is not just translating SQL

- **Case.** SQL Server's usual collations are case-insensitive; PostgreSQL's are case-sensitive. Use `ILIKE`, `lower()`, or the `citext` extension.
- **Identifiers.** PostgreSQL folds unquoted ones to lowercase.
- **Types.** `bit` is `boolean`; `datetime2` is `timestamp` or `timestamptz`; `nvarchar` is `text` or `varchar`; `uniqueidentifier` is `uuid`; `IDENTITY` is `GENERATED ... AS IDENTITY`.
- **Functions and syntax.** `TOP n` is `LIMIT n`; `ISNULL` is `COALESCE`; `GETDATE()` is `now()`. To concatenate, PostgreSQL uses `||`, and SQL Server 2025 now accepts it too, besides `+`.
- **Procedures.** T-SQL and PL/pgSQL aren't compatible: the logic in stored procedures gets rewritten.

## Where SQL Server still wins

- **Microsoft's data stack.** Integration Services, Analysis Services, Reporting Services, and Power BI Report Server, plus SQL Server 2025's mirroring to Fabric. If your organization already uses them, PostgreSQL doesn't replace them.
- **Analytics in the same engine.** *Columnstore* indexes and batch mode are an advantage for analytical queries over large tables; PostgreSQL has no columnar storage in its core.
- **Diagnostics.** Query Store and intelligent query processing are mature and built into the tools; `pg_plan_advice` is only just arriving.
- **Tools and platform.** SQL Server Management Studio, SQL Server Agent for scheduling jobs (in PostgreSQL you use extensions or external schedulers like `pg_cron`), and integration with Windows and Microsoft Entra authentication.
- **First-party .NET support.** Microsoft's providers arrive together with each .NET version.
- **The investment you already have.** Stored procedures, teams that master T-SQL, and applications that depend on it. Migrating costs, and it doesn't always pay off.

## Which one to choose?

| Situation | Leaning |
|---|---|
| New project, cost-sensitive or deployed in containers and several clouds | PostgreSQL |
| A lot of T-SQL logic, or SSIS, SSAS, SSRS, and Power BI already integrated | SQL Server |
| Complex integrity rules (ranges, exclusions), geospatial data, or extensions | PostgreSQL |
| Heavy analytics over large tables inside the same engine | SQL Server |
| The team masters one of the two and the deadline is short | The one they already master |

Today PostgreSQL wins on license cost, extensibility, declarative integrity, and the expressiveness of its SQL; SQL Server 2025 caught up on JSON, regular expressions, and vectors, and keeps advantages in the BI stack, columnar storage, and tooling. The best decision is usually the one that changes the least what your team already does well.

## Sources

- [Stack Overflow Developer Survey 2026: technology](https://survey.stackoverflow.co/2026/technology/)
- [PostgreSQL 19 announcement](https://www.postgresql.org/about/news/postgresql-19-released-3449/) and [version 19 release notes](https://www.postgresql.org/docs/19/release-19.html)
- [Version 18 release notes](https://www.postgresql.org/docs/18/release-18.html) and [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)
- [`WAIT`](https://www.postgresql.org/docs/19/sql-wait.html), [`INSERT`](https://www.postgresql.org/docs/19/sql-insert.html), and [`REPACK`](https://www.postgresql.org/docs/19/sql-repack.html) in the PostgreSQL 19 documentation
- [What's new in SQL Server 2025](https://learn.microsoft.com/sql/sql-server/what-s-new-in-sql-server-2025) and [SQL Server licensing guidance](https://www.microsoft.com/licensing/guidance/sql)
