---
title: "SQL Server 2025 con ejemplos: JSON nativo, expresiones regulares, vectores y búsqueda aproximada"
description: "Lo nuevo de T-SQL en SQL Server 2025, la versión más reciente: tipo json con índices, funciones REGEXP, vectores con VECTOR_DISTANCE, EDIT_DISTANCE, el operador || y lo que sigue en vista previa. Consultas de ejemplo basadas en la documentación oficial."
lang: es
locale: es_MX
ref: novedades-sql-server-2025
date: 2026-11-23 08:30:00 -0600
permalink: /blog/novedades-sql-server-2025/
tags: [SQL Server, SQL Server 2025, T-SQL]
---

SQL Server 2025 (versión 17.x) es la versión más reciente del motor y trae la ampliación de T-SQL más grande en años: un tipo `json` nativo con índices, expresiones regulares, vectores para búsqueda semántica y funciones de comparación aproximada de texto. Este post recorre lo que más se nota al escribir consultas.

Las consultas están basadas en los ejemplos de la documentación oficial de Microsoft, con nombres de tablas y columnas adaptados al español; la sintaxis no cambia. Al final hay una tabla con lo que ya es estable y lo que sigue en vista previa, según la documentación a noviembre de 2026.

## Antes de empezar: el nivel de compatibilidad

Las novedades de lenguaje dependen del nivel de compatibilidad de la base de datos. `REGEXP_LIKE` requiere el nivel 170 (el de SQL Server 2025); las demás funciones `REGEXP_*` escalares están disponibles en todos los niveles. El tipo `json` y el tipo `vector` también funcionan en cualquier nivel. Para subir una base existente:

```sql
ALTER DATABASE CURRENT SET COMPATIBILITY_LEVEL = 170;
```

## 1. Tipo `json` nativo e índices JSON

Hasta SQL Server 2022, el JSON vivía en columnas `nvarchar(max)` y se consultaba con `JSON_VALUE` y `OPENJSON`. SQL Server 2025 agrega el tipo `json`, que guarda el documento en un formato binario. Se usa como cualquier otro tipo, y admite restricciones:

```sql
CREATE TABLE dbo.Pedidos
(
    pedido_id INT,
    detalle JSON NOT NULL
        CHECK (JSON_PATH_EXISTS(detalle, '$.canasta') = 1)
);
```

Una columna `json` no puede ser columna clave de un índice normal; solo columna incluida o parte del filtro de un índice filtrado. Para buscar dentro de los documentos existe `CREATE JSON INDEX`:

```sql
CREATE TABLE dbo.Eventos
(
    id INT PRIMARY KEY,
    carga JSON NOT NULL
);

-- Sobre todo el documento...
CREATE JSON INDEX IX_Eventos_carga
    ON dbo.Eventos (carga);
```

O, como alternativa, solo sobre las rutas que consultas, con las mismas opciones de otros índices:

```sql
CREATE JSON INDEX IX_Eventos_carga
    ON dbo.Eventos (carga)
    FOR ('$.cliente.id', '$.pedido.total') WITH (FILLFACTOR = 80);
```

El índice optimiza las consultas que usan `JSON_VALUE`, `JSON_PATH_EXISTS` y `JSON_CONTAINS`. `JSON_VALUE` ahora acepta `RETURNING` para convertir el valor al tipo que necesitas:

```sql
-- Igualdad sobre un número, convertido a int
SELECT *
FROM dbo.Eventos
WHERE JSON_VALUE(carga, '$.cliente.id' RETURNING INT) = 16167;

-- ¿Existe la ruta?
SELECT COUNT(*)
FROM dbo.Eventos
WHERE JSON_PATH_EXISTS(carga, '$.pedido.procesado') = 1;
```

Según la documentación, con el índice se admiten los operadores de comparación `=`; `LIKE` e `IS [NOT] NULL` todavía no.

`JSON_CONTAINS` busca un valor, un objeto o un arreglo dentro de una ruta. Con `[*]` recorre todos los elementos de un arreglo:

```sql
DECLARE @j AS JSON = '{"cliente": {"id": 16167, "etiquetas": ["vip", "mayorista"]}}';

SELECT JSON_CONTAINS(@j, 'vip', '$.cliente.etiquetas[*]') AS lo_contiene;
```

Devuelve `1` si lo encuentra. Y para construir JSON desde un resultado, `JSON_ARRAYAGG` y `JSON_OBJECTAGG` agregan filas en un arreglo o en un objeto. Este ejemplo de la documentación funciona en cualquier base: devuelve, por cada objeto, un arreglo con los nombres de sus columnas en orden.

```sql
SELECT TOP(5) c.object_id, JSON_ARRAYAGG(c.name ORDER BY c.column_id) AS column_list
FROM sys.columns AS c
GROUP BY c.object_id;
```

## 2. Expresiones regulares

Las funciones `REGEXP_*` usan la biblioteca RE2. Eso significa tiempo lineal garantizado y, por diseño, sin referencias hacia atrás ni *lookaround*. Hay cinco funciones escalares, `REGEXP_LIKE`, `REGEXP_REPLACE`, `REGEXP_SUBSTR`, `REGEXP_INSTR` y `REGEXP_COUNT`, y dos que devuelven tablas, `REGEXP_MATCHES` y `REGEXP_SPLIT_TO_TABLE`.

El uso más valioso es validar datos en la propia base, con una restricción `CHECK`:

```sql
CREATE TABLE dbo.Empleados
(
    ID INT IDENTITY (101, 1),
    Nombre VARCHAR (150),
    Correo VARCHAR (320)
        CHECK (REGEXP_LIKE (Correo, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')),
    Telefono NVARCHAR (20)
        CHECK (REGEXP_LIKE (Telefono, '^(\d{3})-(\d{3})-(\d{4})$'))
);
```

Para filtrar, el tercer argumento son banderas; `i` ignora mayúsculas:

```sql
SELECT *
FROM Empleados
WHERE REGEXP_LIKE (Nombre, '^A.*Y$', 'i');
```

Reemplazar, extraer y contar:

```sql
-- Ocultar los últimos cuatro dígitos del teléfono
SELECT REGEXP_REPLACE(Telefono, '\d{4}$', '****')
FROM Clientes;

-- Extraer el dominio de un correo (el último argumento es el grupo de captura)
SELECT REGEXP_SUBSTR(Correo, '@(.+)$', 1, 1, 'i', 1) AS Dominio
FROM Clientes;

-- Contar cuántas palabras tiene un comentario
SELECT REGEXP_COUNT(Comentario, '\w+') AS Palabras
FROM Comentarios;
```

`REGEXP_REPLACE(cadena, patrón, reemplazo, inicio, ocurrencia, banderas)` y `REGEXP_SUBSTR(cadena, patrón, inicio, ocurrencia, banderas, grupo)` toman esos argumentos opcionales en ese orden; por eso, para extraer un grupo, hay que escribir también el inicio, la ocurrencia y las banderas.

Dos detalles de rendimiento y comportamiento que muestran los ejemplos de la documentación: `REGEXP_LIKE` no respeta la intercalación de la columna (usa la bandera `i` para ignorar mayúsculas), y un patrón anclado con `^` puede aprovechar un índice, mientras que uno sin ancla recorre toda la tabla.

## 3. Vectores y búsqueda semántica

El tipo `vector(n)` guarda *embeddings*, los arreglos de números con los que un modelo de IA representa el significado de un texto. Por omisión usa `float32` y admite hasta 1,998 dimensiones; la variante `float16`, de hasta 3,996, está en vista previa en SQL Server 2025.

```sql
CREATE TABLE dbo.vectors
(
    id INT PRIMARY KEY,
    v VECTOR(3) NOT NULL
);

INSERT INTO dbo.vectors (id, v)
VALUES (1, '[0.1, 2, 30]'),
       (2, '[-100.2, 0.123, 9.876]'),
       (3, JSON_ARRAY(1.0, 2.0, 3.0)); -- JSON_ARRAY también produce un vector
```

`VECTOR_DISTANCE(métrica, vector1, vector2)` mide qué tan lejos están dos vectores. Las métricas son `cosine`, `euclidean` y `dot` (esta última devuelve el producto punto negado, así que menos es más parecido):

```sql
DECLARE @v1 AS VECTOR(2) = '[1,1]';
DECLARE @v2 AS VECTOR(2) = '[-1,-1]';

SELECT VECTOR_DISTANCE('euclidean', @v1, @v2) AS euclidean,
       VECTOR_DISTANCE('cosine', @v1, @v2) AS cosine,
       VECTOR_DISTANCE('dot', @v1, @v2) AS negative_dot_product;
```

Los dos vectores apuntan en sentidos opuestos, así que la distancia coseno es 2, el máximo de su rango. Una búsqueda semántica exacta ordena todas las filas por distancia al vector de la consulta:

```sql
DECLARE @consulta AS VECTOR(1536);

SELECT @consulta = vector_titulo
FROM dbo.Articulos
WHERE titulo = 'Alan Turing';

SELECT TOP (10) id,
                titulo,
                VECTOR_DISTANCE('cosine', @consulta, vector_titulo) AS distancia
FROM dbo.Articulos
ORDER BY distancia;
```

Esta búsqueda es exacta: calcula la distancia contra todas las filas, así que se vuelve lenta cuando crece la tabla. Los vectores los produce un modelo: SQL Server 2025 trae `CREATE EXTERNAL MODEL` para registrar un punto de inferencia de IA, `AI_GENERATE_EMBEDDINGS` para generar vectores desde T-SQL y `AI_GENERATE_CHUNKS` para partir textos largos.

### Índices vectoriales: todavía en vista previa

Para tablas grandes, la búsqueda aproximada con un índice `DiskANN` cambia exactitud por velocidad. En SQL Server 2025, `CREATE VECTOR INDEX` y `VECTOR_SEARCH` son características en **vista previa**: hay que activarlas en la base de datos y no se recomiendan para producción. El índice nuevo necesita al menos 100 filas, y la consulta usa `TOP (N) WITH APPROXIMATE`; el parámetro `TOP_N` de `VECTOR_SEARCH` quedó obsoleto.

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

En Azure SQL Database estas dos características ya están disponibles de forma general. EF Core 11 las expone con `HasVectorIndex` y `VectorSearch()`, también como experimentales; hay más en el [post de .NET 11]({{ '/blog/novedades-dotnet-11/' | relative_url }}).

## 4. Búsqueda aproximada de texto

Cuatro funciones comparan cadenas que casi coinciden: `EDIT_DISTANCE` (cuántas inserciones, borrados, sustituciones y transposiciones separan una cadena de otra), `EDIT_DISTANCE_SIMILARITY` (la misma idea como una puntuación de 0 a 100), `JARO_WINKLER_DISTANCE` y `JARO_WINKLER_SIMILARITY` (que da más peso a las cadenas que coinciden desde el principio, también de 0 a 100).

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

`EDIT_DISTANCE` acepta un tercer argumento con la distancia máxima que te interesa: si se supera, devuelve ese máximo más uno.

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

Y `JARO_WINKLER_SIMILARITY('Colour', 'Color')` devuelve `97`. Un uso real es encontrar posibles duplicados en un catálogo de clientes. Comparar todos contra todos es cuadrático, así que conviene acotar los candidatos (aquí, a los nombres con la misma inicial):

```sql
SELECT a.id AS id_a,
       b.id AS id_b,
       a.nombre AS nombre_a,
       b.nombre AS nombre_b,
       EDIT_DISTANCE_SIMILARITY(a.nombre, b.nombre) AS parecido
FROM dbo.Clientes AS a
JOIN dbo.Clientes AS b
    ON a.id < b.id
   AND LEFT(a.nombre, 1) = LEFT(b.nombre, 1)
WHERE EDIT_DISTANCE_SIMILARITY(a.nombre, b.nombre) >= 85
ORDER BY parecido DESC;
```

Dos advertencias de la documentación. Primera: estas funciones son estables desde la actualización acumulativa **CU11** de SQL Server 2025; en compilaciones anteriores están en vista previa y hay que poner `PREVIEW_FEATURES` en `ON`. Segunda: el resultado depende de la intercalación de los argumentos (distinguir mayúsculas y acentos, por ejemplo); se admiten las intercalaciones de Windows y las binarias, no las `SQL_*` no binarias, y puedes forzar una con `COLLATE` en los argumentos. El algoritmo que hay detrás está explicado, con su código en C#, en el [post de algoritmos]({{ '/blog/algoritmos-dotnet-problemas-reales/' | relative_url }}).

## 5. Mejoras pequeñas pero útiles

```sql
-- Concatenar con || (además del + de siempre)
SELECT Apellido || ', ' || Nombre AS NombreCompleto
FROM dbo.Personas;

-- SUBSTRING sin longitud: devuelve el resto de la cadena
SELECT SUBSTRING('SQL Server 2025', 12);

-- La fecha actual, sin hora
SELECT CURRENT_DATE;

-- El producto de una columna, como SUM pero multiplicando
SELECT PRODUCT(factor)
FROM (VALUES (2), (3), (4)) AS t(factor);
```

También llegan `UNISTR` (construye caracteres Unicode desde sus códigos), `BASE64_ENCODE` y `BASE64_DECODE`, y `DATEADD` acepta un `bigint` como cantidad.

## 6. Otras novedades

- **`sp_invoke_external_rest_endpoint`.** Llama a endpoints REST o GraphQL desde T-SQL: una Azure Function, un servicio de Azure OpenAI o uno propio.
- **Change event streaming (vista previa).** Publica los cambios de filas (inserciones, actualizaciones y borrados) casi en tiempo real hacia Azure Event Hubs o Fabric Eventstream, como eventos CloudEvents.
- **Data API builder y SQL MCP Server.** Exponen la base por REST o GraphQL, y a agentes de IA mediante el protocolo MCP.
- **Ediciones.** Standard sube su límite a 4 sockets o 32 núcleos (el menor) y 256 GB de memoria para el buffer pool, y recibe el Resource Governor. La edición Web desaparece. Express sube a 50 GB por base de datos e incluye lo que antes solo traía *Express with Advanced Services*, que también desaparece. Hay ediciones Developer de Standard y de Enterprise, solo para uso que no sea de producción.

## Qué es estable y qué sigue en vista previa

| Novedad | Estado (noviembre de 2026) |
|---|---|
| Tipo `json`, `CREATE JSON INDEX`, `JSON_CONTAINS`, `JSON_ARRAYAGG`, `JSON_OBJECTAGG` | Disponibles |
| Funciones `REGEXP_*` | Disponibles (`REGEXP_LIKE` requiere nivel de compatibilidad 170) |
| Tipo `vector` (`float32`) y `VECTOR_DISTANCE` | Disponibles |
| Tipo `vector` con `float16` | Vista previa |
| `CREATE VECTOR INDEX` y `VECTOR_SEARCH` | Vista previa (`PREVIEW_FEATURES = ON`) |
| `EDIT_DISTANCE`, `EDIT_DISTANCE_SIMILARITY`, `JARO_WINKLER_*` | Estables desde CU11; antes, vista previa |
| Change event streaming | Vista previa |
| Concatenación con doble barra vertical, `CURRENT_DATE`, `PRODUCT`, `SUBSTRING` sin longitud, `UNISTR` | Disponibles |

Si quieres probar todo esto, la edición Developer es gratuita para desarrollo y pruebas. Antes de llevar algo a producción, confirma su estado en la documentación de tu compilación: como muestran las funciones de comparación aproximada, el estado de una característica puede cambiar con una actualización acumulativa.

## Fuentes

- [Novedades de SQL Server 2025](https://learn.microsoft.com/sql/sql-server/what-s-new-in-sql-server-2025)
- [Funciones de expresiones regulares](https://learn.microsoft.com/sql/relational-databases/regular-expressions/overview)
- [Tipo de datos json](https://learn.microsoft.com/sql/t-sql/data-types/json-data-type) y [CREATE JSON INDEX](https://learn.microsoft.com/sql/t-sql/statements/create-json-index-transact-sql)
- [Tipo de datos vector](https://learn.microsoft.com/sql/t-sql/data-types/vector-data-type), [VECTOR_DISTANCE](https://learn.microsoft.com/sql/t-sql/functions/vector-distance-transact-sql), [VECTOR_SEARCH](https://learn.microsoft.com/sql/t-sql/functions/vector-search-transact-sql) y [CREATE VECTOR INDEX](https://learn.microsoft.com/sql/t-sql/statements/create-vector-index-transact-sql)
- [EDIT_DISTANCE](https://learn.microsoft.com/sql/t-sql/functions/edit-distance-transact-sql) y [búsqueda aproximada de cadenas](https://learn.microsoft.com/sql/relational-databases/fuzzy-string-match/overview)
