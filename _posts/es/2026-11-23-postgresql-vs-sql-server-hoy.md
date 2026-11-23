---
title: "PostgreSQL vs SQL Server hoy: dónde gana PostgreSQL y dónde todavía no"
description: "Costo, adopción, SQL más expresivo, JSON, restricciones temporales, extensiones y las novedades de PostgreSQL 18 y 19 frente a SQL Server 2025, con consultas equivalentes en los dos motores y los casos donde SQL Server sigue siendo la mejor opción."
lang: es
locale: es_MX
ref: postgresql-vs-sql-server-hoy
date: 2026-11-23 08:40:00 -0600
permalink: /blog/postgresql-vs-sql-server-hoy/
tags: [PostgreSQL, SQL Server, Bases de datos]
---

PostgreSQL 19 salió el 19 de noviembre de 2026 y SQL Server 2025 es la versión más reciente de Microsoft. Es buen momento para comparar los dos motores con los datos de hoy y no con la imagen de hace diez años. En mi experiencia profesional pesa más SQL Server, mientras que mis proyectos de portafolio, [Mediateca]({{ '/blog/como-funciona-mediateca/' | relative_url }}) y [Comprobante]({{ '/blog/como-funciona-comprobante/' | relative_url }}), usan PostgreSQL; este post parte de esa mezcla.

Verás las ventajas de PostgreSQL que siguen siendo reales, con consultas equivalentes en los dos motores, y también dónde SQL Server todavía gana. SQL Server 2025 cerró varias brechas (JSON nativo, expresiones regulares, vectores), así que algunas ventajas de PostgreSQL de hace unos años ya no lo son tanto. Las consultas equivalentes se ejecutaron en PostgreSQL 18 y en SQL Server 2022; lo que es exclusivo de PostgreSQL 19 o de SQL Server 2025 viene de la documentación oficial y lo indico.

## El panorama en una tabla

| | PostgreSQL | SQL Server |
|---|---|---|
| Última versión | 19 (19 de noviembre de 2026) | 2025 (17.x) |
| Licencia | PostgreSQL License, código abierto | Comercial: por núcleo, o servidor + CAL en Standard |
| Ediciones | Una sola | Enterprise, Standard, Express y Developer |
| Soporte de cada versión | 5 años desde su lanzamiento | Principal y extendido, según el ciclo de vida de Microsoft |
| Uso entre desarrolladores (Stack Overflow 2026) | 57.9% | 27.1% |

Los porcentajes vienen de la [encuesta de Stack Overflow 2026](https://survey.stackoverflow.co/2026/technology/) (12,061 respuestas), que preguntó en qué bases de datos se ha hecho desarrollo intensivo durante el último año. PostgreSQL encabeza la lista; SQL Server aparece en quinto lugar, detrás de SQLite, MySQL y Redis. La popularidad no demuestra que un motor sea mejor para tu caso, pero sí te dice qué tan fácil es encontrar documentación, herramientas y gente que lo conozca.

## Costo y límites

En SQL Server 2025 Standard, una instancia usa como máximo 4 sockets o 32 núcleos (el menor) y 256 GB de memoria para el buffer pool. Express es gratuita, pero con un tope de 50 GB por base de datos, y las ediciones Developer son solo para desarrollo y pruebas. Las ediciones de producción se licencian por núcleo o, en Standard, por servidor y por usuario o dispositivo (CAL).

PostgreSQL no tiene ediciones: toda la funcionalidad viene en la misma descarga y no hay topes de licencia. Eso no lo hace gratis de operar, porque los respaldos, la alta disponibilidad, el monitoreo y el soporte cuestan tiempo o dinero, pero el costo de la licencia no crece con los núcleos. Los tres grandes proveedores de nube, Azure, AWS y Google Cloud, ofrecen PostgreSQL administrado.

## SQL más expresivo: consultas equivalentes

Estas consultas se ejecutaron en PostgreSQL 18.7 y en SQL Server 2022.

### Insertar o actualizar, y devolver la fila

En PostgreSQL es una sola sentencia atómica, con `ON CONFLICT` y `RETURNING`:

```sql
INSERT INTO clientes (correo, nombre)
VALUES ('ana@example.com', 'Ana')
ON CONFLICT (correo) DO UPDATE SET nombre = EXCLUDED.nombre
RETURNING id, correo, nombre;
```

En SQL Server el patrón es `MERGE`, con `HOLDLOCK` para evitar condiciones de carrera entre peticiones simultáneas, y `OUTPUT` para devolver la fila:

```sql
MERGE clientes WITH (HOLDLOCK) AS destino
USING (VALUES (N'ana@example.com', N'Ana')) AS origen (correo, nombre)
    ON destino.correo = origen.correo
WHEN MATCHED THEN
    UPDATE SET nombre = origen.nombre
WHEN NOT MATCHED THEN
    INSERT (correo, nombre) VALUES (origen.correo, origen.nombre)
OUTPUT inserted.id, inserted.correo, inserted.nombre;
```

Si la fila ya existía, las dos devuelven el mismo `id` con el nombre nuevo. PostgreSQL 19 agrega `ON CONFLICT DO SELECT`, para el patrón "obtener o crear": si hay conflicto, devuelve la fila existente sin modificarla (sintaxis de la documentación de PostgreSQL 19, no la ejecuté):

```sql
INSERT INTO clientes (correo, nombre)
VALUES ('ana@example.com', 'Ana')
ON CONFLICT (correo) DO SELECT
RETURNING id, correo, nombre;
```

### Una fila por grupo

El último pedido de cada cliente. PostgreSQL lo resuelve con `DISTINCT ON`:

```sql
SELECT DISTINCT ON (cliente_id) cliente_id, id, total
FROM pedidos
ORDER BY cliente_id, creado DESC;
```

En SQL Server se numera con `ROW_NUMBER` y se filtra:

```sql
WITH ordenados AS (
    SELECT cliente_id, id, total,
           ROW_NUMBER() OVER (PARTITION BY cliente_id ORDER BY creado DESC) AS posicion
    FROM pedidos
)
SELECT cliente_id, id, total
FROM ordenados
WHERE posicion = 1
ORDER BY cliente_id;
```

Las dos devuelven la misma respuesta con los mismos datos de prueba: el pedido 2 (250.00) del cliente 1 y el pedido 3 (80.00) del cliente 2.

### JSON

PostgreSQL tiene `jsonb`, un JSON binario que se indexa con GIN, desde hace más de diez años. Los operadores de contención (`@>`) y de extracción (`->>`) lo hacen cómodo de consultar:

```sql
CREATE INDEX eventos_datos_idx ON eventos USING gin (datos jsonb_path_ops);

SELECT id
FROM eventos
WHERE datos @> '{"estado":"pagado"}';

SELECT datos->>'tipo' AS tipo, (datos->>'monto')::numeric AS monto
FROM eventos
WHERE datos->>'tipo' = 'pago';
```

En SQL Server 2022 el JSON vivía en texto y se consultaba con `JSON_VALUE`, sin un índice específico para el contenido del documento:

```sql
SELECT id, JSON_VALUE(datos, '$.tipo') AS tipo, CAST(JSON_VALUE(datos, '$.monto') AS DECIMAL(10,2)) AS monto
FROM eventos
WHERE JSON_VALUE(datos, '$.estado') = 'pagado';
```

SQL Server 2025 cierra buena parte de esa brecha con el tipo `json` y `CREATE JSON INDEX`, como se ve en el [post de SQL Server 2025]({{ '/blog/novedades-sql-server-2025/' | relative_url }}). Hoy la diferencia ya no es de capacidad sino de madurez y de ecosistema: `jsonb` tiene operadores de contención, de existencia y de rutas, y una década de uso en producción.

### Sin empalmes, dentro de la base de datos

Una sala no puede tener dos reservaciones al mismo tiempo. PostgreSQL 18 permite declararlo como una clave primaria temporal con `WITHOUT OVERLAPS` (necesita la extensión `btree_gist`, para poder comparar la sala con `=` dentro del mismo índice):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE reservaciones (
    sala int NOT NULL,
    durante tstzrange NOT NULL,
    PRIMARY KEY (sala, durante WITHOUT OVERLAPS)
);

INSERT INTO reservaciones VALUES (1, '[2026-11-23 09:00-06, 2026-11-23 11:00-06)');  -- correcto
INSERT INTO reservaciones VALUES (1, '[2026-11-23 10:00-06, 2026-11-23 12:00-06)');  -- ERROR: se empalma
INSERT INTO reservaciones VALUES (1, '[2026-11-23 11:00-06, 2026-11-23 12:00-06)');  -- correcto: contigua
INSERT INTO reservaciones VALUES (2, '[2026-11-23 10:00-06, 2026-11-23 12:00-06)');  -- correcto: otra sala
```

El segundo `INSERT` falla con `conflicting key value violates exclusion constraint "reservaciones_pkey"`. Como el rango `[inicio, fin)` incluye el inicio y excluye el final, una reservación que empieza justo cuando termina otra es válida. En PostgreSQL 17 y anteriores se logra lo mismo con una restricción `EXCLUDE USING gist`.

En SQL Server no existe una restricción equivalente: la regla se arma con una transacción que bloquea el rango (`UPDLOCK, HOLDLOCK`) y verifica antes de insertar, o con un *trigger*. Y como dos peticiones simultáneas pasarían una validación hecha solo en la aplicación, esta es una de las ventajas más claras de PostgreSQL. El [post de algoritmos]({{ '/blog/algoritmos-dotnet-problemas-reales/' | relative_url }}) muestra cómo detectar el empalme en memoria, cuando también lo necesitas.

### Texto parecido

La extensión `pg_trgm` mide la similitud por trigramas y permite acelerar la búsqueda con índices GIN o GiST; `fuzzystrmatch` trae `levenshtein()`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

SELECT round(similarity('Jose Hernandez Lopez', 'Jose Hernandes Lopez')::numeric, 2) AS parecido;
```

```text
parecido
--------
    0.86
```

Los trigramas distinguen los acentos: "José Hernández López" contra "Jose Hernandes Lopez" da solo 0.37, así que normaliza antes (la extensión `unaccent` sirve para eso). SQL Server 2025 trae sus propias funciones, `EDIT_DISTANCE` y `JARO_WINKLER_SIMILARITY`, que comparan dos cadenas; para no comparar todo contra todo tendrás que acotar los candidatos tú mismo, como se explica en el post de algoritmos.

## Extensiones

`CREATE EXTENSION` instala módulos que se integran al motor: PostGIS para datos geoespaciales, pgvector para vectores, `pg_trgm` para similitud, TimescaleDB para series de tiempo, Citus para distribuir tablas, y cualquiera puede escribir la suya. SQL Server 2025 incorporó de forma nativa varias cosas que en PostgreSQL llegaron como extensiones (vectores, expresiones regulares), y tiene CLR y servicios de lenguajes externos, pero no un mecanismo para agregarle al motor nuevos tipos de índice u operadores.

## Operación y rendimiento: lo nuevo de PostgreSQL 18 y 19

| Versión | Novedades |
|---|---|
| 18 (25 de septiembre de 2025) | E/S asíncrona, `pg_upgrade` conserva las estadísticas del optimizador, *skip scan* en índices B-tree de varias columnas, `uuidv7()`, columnas generadas virtuales (ahora el valor por omisión), autenticación OAuth, `OLD` y `NEW` en `RETURNING`, restricciones temporales |
| 19 (19 de noviembre de 2026) | `REPACK (CONCURRENTLY)`, extensiones `pg_plan_advice` y `pg_stash_advice`, autovacuum paralelo en índices, `WAIT FOR LSN`, replicación lógica de secuencias y sin reiniciar el servidor, `ON CONFLICT DO SELECT`, `COPY` con salida JSON, `IGNORE NULLS` en funciones de ventana |

La lista sale de las notas de versión oficiales. Tres de esas novedades responden a problemas conocidos:

- **El costo de MVCC.** PostgreSQL deja filas muertas al actualizar y borrar, y `VACUUM FULL` bloqueaba la tabla. `REPACK (CONCURRENTLY) pedidos;` recupera ese espacio y reordena la tabla sin bloquear lecturas ni escrituras, y el autovacuum ahora procesa los índices con varios procesos en paralelo.
- **Planes que cambian.** `pg_plan_advice` permite fijar las decisiones del planificador, y `pg_stash_advice` las aplica por consulta sin tocar la aplicación. SQL Server ya tenía Query Store para esto; PostgreSQL empieza a cerrar la brecha.
- **Lecturas en réplicas.** `WAIT FOR LSN` espera, en la réplica, a que se aplique cierto punto del registro de transacciones antes de consultar, lo que da lecturas que reflejan lo que el mismo usuario acaba de escribir en el primario.

Según el anuncio oficial, además, las comprobaciones de llaves foráneas se aceleraron y, en sus pruebas, las inserciones masivas fueron casi dos veces más rápidas.

Sobre concurrencia, en PostgreSQL los lectores no bloquean a los escritores por diseño. En SQL Server el nivel `READ COMMITTED` predeterminado usa bloqueos; para tener ese comportamiento se activa el aislamiento por versiones de fila:

```sql
ALTER DATABASE MiBase SET READ_COMMITTED_SNAPSHOT ON;
```

## Con .NET

Con PostgreSQL se usa Npgsql, el proveedor ADO.NET de código abierto, y su proveedor de EF Core, `Npgsql.EntityFrameworkCore.PostgreSQL`. Con SQL Server, `Microsoft.Data.SqlClient` y `Microsoft.EntityFrameworkCore.SqlServer`, que mantiene Microsoft. Los dos son maduros, y el código del `DbContext` se mueve de uno a otro con pocos cambios:

```csharp
// PostgreSQL
builder.Services.AddDbContext<AppDb>(o => o.UseNpgsql(cadenaPostgres));

// SQL Server
builder.Services.AddDbContext<AppDb>(o => o.UseSqlServer(cadenaSqlServer));
```

La diferencia está en quién los mantiene: el de PostgreSQL es un proyecto de la comunidad, así que antes de actualizar a una versión nueva de .NET confirma que ya exista su versión correspondiente.

### Migrar no es solo traducir SQL

- **Mayúsculas.** Las intercalaciones habituales de SQL Server no distinguen mayúsculas; las de PostgreSQL sí. Usa `ILIKE`, `lower()` o la extensión `citext`.
- **Identificadores.** PostgreSQL convierte a minúsculas los que no llevan comillas.
- **Tipos.** `bit` es `boolean`; `datetime2` es `timestamp` o `timestamptz`; `nvarchar` es `text` o `varchar`; `uniqueidentifier` es `uuid`; `IDENTITY` es `GENERATED ... AS IDENTITY`.
- **Funciones y sintaxis.** `TOP n` es `LIMIT n`; `ISNULL` es `COALESCE`; `GETDATE()` es `now()`. Para concatenar, PostgreSQL usa `||`, y SQL Server 2025 ya lo acepta además del `+`.
- **Procedimientos.** T-SQL y PL/pgSQL no son compatibles: la lógica en procedimientos almacenados se reescribe.

## Dónde SQL Server sigue ganando

- **La pila de datos de Microsoft.** Integration Services, Analysis Services, Reporting Services y Power BI Report Server, además del espejo hacia Fabric de SQL Server 2025. Si tu organización ya los usa, PostgreSQL no los reemplaza.
- **Analítica en el mismo motor.** Los índices *columnstore* y el modo por lotes son una ventaja para consultas analíticas sobre tablas grandes; PostgreSQL no trae almacenamiento columnar en el núcleo.
- **Diagnóstico.** Query Store y el procesamiento inteligente de consultas son maduros y están integrados en las herramientas; `pg_plan_advice` apenas llega.
- **Herramientas y plataforma.** SQL Server Management Studio, SQL Server Agent para programar tareas (en PostgreSQL se usan extensiones o programadores externos como `pg_cron`) y la integración con la autenticación de Windows y de Microsoft Entra.
- **Soporte de primera mano para .NET.** Los proveedores de Microsoft llegan junto con cada versión de .NET.
- **La inversión que ya tienes.** Procedimientos almacenados, equipos que dominan T-SQL y aplicaciones que dependen de él. Migrar cuesta, y no siempre se paga.

## ¿Cuál elegir?

| Situación | Inclinación |
|---|---|
| Proyecto nuevo, sensible al costo o desplegado en contenedores y varias nubes | PostgreSQL |
| Mucha lógica en T-SQL, o SSIS, SSAS, SSRS y Power BI ya integrados | SQL Server |
| Reglas de integridad complejas (rangos, exclusiones), datos geoespaciales o extensiones | PostgreSQL |
| Analítica pesada sobre tablas grandes dentro del mismo motor | SQL Server |
| El equipo domina uno de los dos y el plazo es corto | El que ya dominan |

PostgreSQL gana hoy en costo de licencia, extensibilidad, integridad declarativa y expresividad del SQL; SQL Server 2025 se acercó en JSON, expresiones regulares y vectores, y conserva ventajas en la pila de BI, el almacenamiento columnar y las herramientas. La mejor decisión suele ser la que menos cambia lo que tu equipo ya sabe hacer bien.

## Fuentes

- [Stack Overflow Developer Survey 2026: tecnología](https://survey.stackoverflow.co/2026/technology/)
- [Anuncio de PostgreSQL 19](https://www.postgresql.org/about/news/postgresql-19-released-3449/) y [notas de la versión 19](https://www.postgresql.org/docs/19/release-19.html)
- [Notas de la versión 18](https://www.postgresql.org/docs/18/release-18.html) y [política de versiones de PostgreSQL](https://www.postgresql.org/support/versioning/)
- [`WAIT`](https://www.postgresql.org/docs/19/sql-wait.html), [`INSERT`](https://www.postgresql.org/docs/19/sql-insert.html) y [`REPACK`](https://www.postgresql.org/docs/19/sql-repack.html) en la documentación de PostgreSQL 19
- [Novedades de SQL Server 2025](https://learn.microsoft.com/sql/sql-server/what-s-new-in-sql-server-2025) y [guía de licenciamiento de SQL Server](https://www.microsoft.com/licensing/guidance/sql)
