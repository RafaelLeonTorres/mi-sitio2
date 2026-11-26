# Plan: curso interactivo de fundamentos de SQL Server (T-SQL)

Un curso nuevo de la sección **Cursos** donde el visitante aprende SQL Server y T-SQL escribiendo código. Cada lección es una serie corta de pasos, con el mismo formato que los cursos de C# y de PostgreSQL: el texto a la izquierda; a la derecha, un editor y el resultado. La diferencia está en el motor: **SQL Server no corre en un navegador**. El curso usa dos niveles, y cada paso dice en cuál está:

- **Ejecutable:** el T-SQL corre en el navegador del visitante. `translate.ts` y `compat.ts` (los que ya usan los retos de SQL) lo traducen a PostgreSQL y lo corren en PGlite. Cada solución se verifica además contra un SQL Server 2022 real.
- **Capturado:** para lo que ninguna traducción puede correr (variables, procedimientos almacenados, `TRY...CATCH`, triggers, aislamiento y bloqueos, planes de ejecución, `tempdb`), la lección muestra la salida pregrabada de un SQL Server real, con su versión, y pide al visitante que **prediga** el resultado antes de verlo.

Así el sitio sigue siendo estático (sin servidor ni cuentas) y el curso no promete lo que el navegador no puede hacer.

Es el segundo de los tres cursos nuevos que hoy salen como "Próximamente" en `_data/course/courses.yml` (`status: soon`). Orden recomendado: PostgreSQL (`PLAN-CURSO-POSTGRESQL.md`), **SQL Server** y Angular (`PLAN-CURSO-ANGULAR.md`). Este curso no empieza antes de que el adaptador SQL del curso de PostgreSQL esté hecho (su fase 4): lo reutiliza completo.

Dónde vive cada cosa:

- **Este plan:** `PLAN-CURSO-SQLSERVER.md` en la raíz del repositorio. Jekyll no lo publica (está en `exclude` de `_config.yml`).
- **Planes hermanos:** `PLAN-CURSO.md` (C#, de donde sale el formato) y `PLAN-CURSO-POSTGRESQL.md` (la plataforma compartida de su sección 4.1 y el adaptador SQL).
- **Plan del laboratorio:** `PLAN.md`, que ya decidió correr SQL en PGlite con funciones que llevan los nombres de T-SQL.

**Estado (23 de noviembre de 2026):** propuesto, sin implementar. Verificado hoy en el SQL Server 2022 local (16.0.1000.6, edición Developer): la intercalación del servidor es `Modern_Spanish_CI_AS`; `'a' = 'A'` es verdadero, `N'é' = N'e'` es falso y `ORDER BY` da `A, a, B, b, é, z`. PGlite usa la intercalación `C` y ordena `A, B, a, b, z, é`; es la primera diferencia que el curso tiene que resolver (sección 4.5).

**Estado (25 de noviembre de 2026):** implementación iniciada. Se adoptaron las opciones recomendadas de la sección 2; cualquier cambio se anota aquí. La traducción (fases 1 y 2) se adelantó a la plataforma compartida (fase 0) porque no depende de ella. Ya traducen `TOP (n)` y `TOP n WITH TIES`, los estilos de `CONVERT` más comunes, `TRY_CAST` y `TRY_CONVERT`, `OUTPUT`, `UPDATE` y `DELETE` con `JOIN` y las CTE recursivas, cada uno con una prueba contra los valores de SQL Server 2022 (`translate.test.ts`, `compat.test.ts` y `dml.test.ts`). También la intercalación (con ICU, no con `citext`: ver la decisión 5), `COLLATE`, `dbo.`, `NEXT VALUE FOR`, `STUFF`, `DATENAME`, `STRING_SPLIT`, `ISDATE` y otras funciones, y hay una lista de cobertura con su prueba (`coverage.ts`). **La fase 2 está hecha**, salvo lo que la lista marca como `gap`. La plataforma compartida (fase 0) quedó completa ese mismo día.

**Estado (25 de noviembre de 2026, fase 3):** **la fase 3 está hecha.** El curso está en `courses.yml` con `status: preview`, un estado nuevo: tiene temario, lecciones y páginas, pero el menú, la portada y el índice lo siguen mostrando como "Próximamente", sin enlace; sus páginas llevan `noindex` y quedan fuera del mapa del sitio. Existen `/curso/sql-server/` y `/en/course/sql-server/`, con los 14 módulos y las dos lecciones piloto, **"Tu primera consulta"** (tres ejercicios ejecutables y una pregunta) y **"Atrapar un error con TRY...CATCH"** (tres pasos capturados y una pregunta). Se leen sin JavaScript, con el nivel de cada paso, el cuadro "Ojo: diferencias" y la salida capturada; todavía no corren, porque falta el adaptador SQL (la fase 4 del curso de PostgreSQL) y la lección interactiva (fase 5). Las salidas capturadas se grabaron del SQL Server 2022 local (16.0.1000.6) con un script provisional en PowerShell; la fase 4 trae el definitivo (`sqlserver-capture.mjs`, con `mssql`).

**Estado (25 de noviembre de 2026, adaptador SQL):** **las lecciones piloto ya son interactivas.** El curso sigue en `preview`. `labs/course/engines/sql.ts` es el adaptador SQL: reutiliza `SqlEngine` (PGlite en su worker, con el tiempo límite de los retos) y los resultados de `challenges/results.ts`; Ejecutar corre el caso de ejemplo y enseña lo que devolvió el código (la tabla, el error con su renglón, lo que no se puede traducir o lo que se tradujo) y Enviar corre todos los casos contra lo que devuelve la solución. Un cuadro con las tablas del ejercicio y sus filas de ejemplo va entre el editor y los botones, y el editor autocompleta sus columnas. El **paso capturado** vive en el núcleo (`lesson.ts`): su predicción se contesta como una pregunta, y **Ver salida** revela lo grabado (visto sin acertar queda en "visto"). `main.ts` descarga el adaptador de SQL solo en las lecciones de SQL (el bundle del curso pasó de 8,8 a 9,7 kB comprimidos). Lo que se hizo para que corra:
- **`runCase`** (compartido con los retos): un caso de resultado sin `expected` espera lo que devuelve la solución en otra base, y un reto con `collation: 'ci'` traduce el esquema y el código con la intercalación sin mayúsculas. Los retos del laboratorio no cambian: todos traen `expected` y ninguno usa `collation`.
- **El caso de ejemplo** (`- sample: true`, sin `tables` ni `generate`) corre con las filas de ejemplo de la base (`caseSql`). Faltaba: corría contra tablas vacías, y las pruebas de lecciones pasaban sin comprobar datos. Ahora `sqlserver-lessons.test.ts` exige que el ejemplo de un ejercicio de resultado devuelva filas.
- **La página** (`lesson.html`) lleva el motor (`engineId`), las tablas que usan los pasos, los textos de los resultados (los de los retos) y la intercalación del curso (`collation: ci` en `courses.yml`); `results.css` es una copia del CSS de los resultados de `labs.css` (una prueba las mantiene iguales); y las claves de C# que seguían en `ui.yml` (`editor_label`, `loading`, `loading_note`, `timeout`, `engine_error` y `failed`) pasaron a `ui-csharp.yml`.
- **Pruebas:** `engines/sql.test.ts` (el adaptador con un motor falso y con PGlite de verdad), `captured.test.ts` (el paso capturado), y los casos nuevos de `runner.test.ts` y `data.test.ts`. En el navegador se probó Ejecutar, Enviar, un error con su renglón, `TOP` traducido, y los pasos capturados (equivocarse, acertar y ver la salida), en español e inglés, en tema claro y oscuro y en 375 px, con contraste de al menos 6:1.
- **Pendiente:** los errores de la base salen como los dice PostgreSQL (en inglés, con renglón y sugerencia), no como SQL Server: falta traducirlos a su número y a la explicación de `errors.yml`. Y el visor de planes, y la revisión de foco y de lector de pantalla.

**Estado (25 de noviembre de 2026, fase 4):** **la fase 4 está hecha**, con su trabajo de CI (`.github/workflows/sqlserver.yml`, sección 10). Cada captura y cada solución se comprueban contra un SQL Server de verdad con un comando: `npm run sqlserver:check` para las capturas, y `npm test` con `MSSQL_CONNECTION` para las soluciones y los ejemplos del texto. Con el servidor local (2022, 16.0.1000.6) todo coincide: las capturas que se habían grabado a mano en la fase 3, las soluciones de los tres ejercicios en cada caso (PGlite y SQL Server dan lo mismo) y los ejemplos del texto, con la cabecera exacta (`Name`, como la escribe SQL Server). Lo mismo da con SQL Server 16.0.4325.4 en un contenedor de Linux, el del CI. **El ejecutor no usa el paquete `mssql`**, como decía el plan: el servidor local solo acepta la autenticación de Windows, que el controlador de Node (tedious) no tiene, y el que sí la tiene (`msnodesqlv8`, por ODBC) ve distinto: da el SQLSTATE en lugar del estado de un error y omite el resultado vacío de una instrucción que falla antes de devolver filas (el `Broken` de `keeps-going`), así que grabaría capturas distintas a las de SSMS. En su lugar, un programa de consola de .NET con `Microsoft.Data.SqlClient`, el cliente de SSMS y de Azure Data Studio (`dotnet/sqlserver/Runner`), que Node llama con `dotnet run`: entra con la autenticación de Windows o con usuario y contraseña, y no suma ningún paquete de npm.

**Estado (26 de noviembre de 2026, módulo 1):** **el módulo 1 está completo**, el primero de la fase 6: cinco lecciones en español e inglés ("SSMS y VS Code", "Tu primera consulta", "Alias y expresiones", "TOP y ORDER BY" y "DISTINCT y la base de ejemplo"). La primera cambió de nombre respecto a la sección 7: Azure Data Studio se retiró el 28 de febrero de 2026 y su reemplazo es VS Code con la extensión MSSQL. Los ejercicios de alias piden los nombres de las columnas (`names`, sección 5): como las columnas se comparan por posición, sin eso un `SELECT Price * 1.16` sin alias pasaba. Verificado: cada solución pasa en PGlite y da lo mismo en el SQL Server 2022 local (16.0.1000.6), los ejemplos del texto son exactos, y las cuatro lecciones nuevas se recorrieron en el navegador en los dos idiomas, sin desbordes a 375 px ni errores en la consola. El módulo cierra remitiendo al playground: ninguno de los 30 retos de SQL se resuelve solo con lo del módulo 1.

---

## 1. Alcance

### Incluye

- **Curso "Fundamentos de SQL Server":** 14 módulos y unas 76 lecciones (sección 7), cada una con 4 a 6 pasos: unos 350 en total. Cerca del 60 % de las lecciones son ejecutables. La primera versión publicada trae los módulos 1 a 5 (27 lecciones), todos ejecutables.
- **Pasos de cinco tipos:** *lectura*, *ejercicio* (ejecutable, o de **concepto**: usa PostgreSQL para mostrar una idea que SQL Server comparte), *capturado* (salida pregrabada con una pregunta de predicción), *pregunta* (opción múltiple) y *simulación* (dos sesiones paso a paso, para la concurrencia).
- **Un rótulo visible en cada paso:** "Ejecutable en tu navegador", "Salida capturada de SQL Server 2022" o "Concepto con PostgreSQL". Nada queda sin rotular.
- **Cuadro "Ojo: diferencias":** en las lecciones ejecutables, lo que SQL Server hace distinto de lo que corre aquí (intercalación, precisión de las fechas, tipos de las funciones de agregado...).
- **Base de ejemplo del laboratorio** (`Customers`, `Categories`, `Products`, `Orders`, `OrderLines`, `ProductPrices`, `OrdersArchive`, `StagingProducts`, `Logins`, `Departments`, `Employees`, `Accounts`), ya escrita en T-SQL, ampliada con lo que pida el curso.
- **Verificación contra un SQL Server real** de cada solución y de cada salida capturada, con un script y pruebas que se omiten cuando no hay servidor (sección 4.6).
- El resto, igual que los otros cursos: errores explicados, ejemplos del texto verificados, pistas, solución explicada, progreso local, enlaces a los retos del laboratorio y la lección completa sin JavaScript.

### No incluye

- Un SQL Server en el navegador: no existe. Lo que no se puede traducir se **captura**, no se simula.
- Un intérprete de T-SQL procedural (variables, `IF`, `WHILE`, `TRY...CATCH`) en la primera versión. Queda como opcional de la sección 10; mientras tanto esas lecciones son capturadas.
- Instalar, administrar o dimensionar un servidor. El módulo 14 es de lectura.
- Cuentas, sincronizar el avance entre dispositivos, ranking o certificados verificables: necesitan servidor.
- Copiar textos, ejercicios ni capturas de la documentación de Microsoft: se enlaza, no se copia.

---

## 2. Decisiones por confirmar

Cada una trae una opción recomendada.

1. **Dónde vive.** **A (recomendada):** `/curso/sql-server/` y `/en/course/sql-server/`. El id interno es `sqlserver` (sin guion, para usarlo en Liquid como `site.data.course.sqlserver`) y la lista de cursos guarda los dos.
2. **Motor.**
   - **A (recomendada):** dos niveles. Lo común de T-SQL corre en PGlite con la traducción; lo demás se captura de un SQL Server real.
   - **B:** todo de solo lectura. Descartada: pierde la práctica, que es lo que enseña.
   - **C:** un intérprete de T-SQL en TypeScript que delegue las consultas a PGlite. Aplazada: es un proyecto aparte (variables, control de flujo, errores, transacciones) y se decide después, con el curso publicado.
3. **Fidelidad.** **A (recomendada):** cada solución ejecutable se verifica contra SQL Server 2022 real en una prueba local, y las diferencias que no se puedan evitar se avisan en el cuadro "Ojo". **B:** confiar en la traducción. Descartada: una traducción hecha con expresiones regulares tiene huecos.
4. **Versión de SQL Server.** **A (recomendada):** 2022 (16.x). Lo exclusivo de 2022 (`DATETRUNC`, `GENERATE_SERIES`, `GREATEST` y `LEAST`, `IS [NOT] DISTINCT FROM`) se marca; lo de 2025 se menciona en notas. Se actualiza cada noviembre.
5. **Intercalación.** **A (recomendada):** las columnas de texto de la base de ejemplo se crean sin distinguir mayúsculas pero sí acentos, como `_CI_AS`. *Cambio del 25 de noviembre de 2026:* el plan decía `citext`, pero PGlite trae ICU y con él hay una forma mejor, que se probó contra SQL Server: una intercalación no determinista (`tsql_ci_as`, de `und@colStrength=secondary`) ordena **igual** que `SQL_Latin1_General_CP1_CI_AS` también con acentos y ñ (con `citext` la é iba después de la z), conserva `varchar(n)`, funciona con `LIKE`, `REPLACE` y `CHARINDEX`, no necesita ninguna extensión ni archivo en el navegador, y permite traducir `COLLATE` (las otras dos, `tsql_ci_ai` y `tsql_cs_as`, dan el orden de `_CI_AI` y `_CS_AS`). Se aplica solo a este curso, con la opción `collation: 'ci'` de `translate()`, no a los retos. **B:** dejar la intercalación `C` y avisar. Descartada: `WHERE Name = 'ana'` daría otra respuesta que en SQL Server.
6. **Base de ejemplo.** **A (recomendada):** la de los retos (`challenge-datasets.yml`), ampliada. Ya está en T-SQL y la traducción la conoce.
7. **Capturas.** **A (recomendada):** un script (`scripts/sqlserver-capture.mjs`) que corre cada paso capturado contra una instancia real y guarda el resultado en el YAML, con la versión y la fecha. **B:** escribir las salidas a mano. Descartada: se desactualizan sin que nadie lo note.
8. **Versión 1.** **A (recomendada):** módulos 1 a 5, todos ejecutables. **B:** esperar a tener los capturados.
9. **Relación con PostgreSQL.** **A (recomendada):** cursos separados. Los dos se leen mejor juntos, y los cuadros "En PostgreSQL..." y "En SQL Server..." (opcionales) enlazan uno con otro.
10. **Plataforma compartida.** La del plan de PostgreSQL (sección 4.1). Aquí no se repite.

---

## 3. Dónde vive en el sitio

| Página | Español | Inglés |
|---|---|---|
| Índice de cursos | `/curso/` | `/en/course/` |
| Temario de SQL Server | `/curso/sql-server/` | `/en/course/sql-server/` |
| Una lección | `/curso/sql-server/<módulo>/<lección>/` | `/en/course/sql-server/<module>/<lesson>/` |

- Cada par de páginas comparte `ref` y los slugs están en el idioma de cada página.
- El submenú de "Cursos" ya trae SQL Server como "Próximamente"; al publicarlo enlaza a su temario. Mientras tanto el curso está en `status: preview`: sus páginas existen (se ven en local y por su dirección) pero nada las enlaza, llevan `noindex` y no están en `sitemap.xml`. Publicarlo es pasar `status` a `published`.
- **Temario:** además del avance, cada lección muestra con tres insignias cuántos pasos son ejecutables, capturados o de concepto, para que el visitante sepa qué esperar.
- Las páginas llevan `course: sqlserver` en el front matter, y los datos viven en `_data/course/sqlserver/`.

---

## 4. Enfoque técnico

### 4.1 Plataforma compartida

La del curso de PostgreSQL (`PLAN-CURSO-POSTGRESQL.md`, sección 4.1 y fase 0): lista de cursos, datos y páginas por curso, textos por motor y el adaptador de motor. Este curso usa el **mismo adaptador SQL** y le suma tres piezas: el paso capturado, el visor de planes de SQL Server y los rótulos de nivel.

### 4.2 Qué se reutiliza

| Pieza | Dónde está | Qué se hace |
|---|---|---|
| Traducción de T-SQL | `labs/challenges/sql/translate.ts` | Se reutiliza y se amplía (sección 4.3). Traduce `GO`, `[corchetes]`, las partes de fecha de `DATEADD`, los tipos de SQL Server, `NONCLUSTERED` y `CLUSTERED`, `BEGIN TRAN`, `IDENTITY`, los hints (`NOLOCK`), `STRING_AGG`, `MERGE ... WHEN NOT MATCHED BY TARGET`, `SET`, las tablas temporales, `CONVERT` y `APPLY` |
| Funciones de T-SQL | `labs/challenges/sql/compat.ts` y `compat.test.ts` | Se reutilizan y se amplían: `YEAR`, `MONTH`, `DAY`, `LEN`, `ISNULL`, `IIF`, `GETDATE`, `CHARINDEX`, `REPLICATE`, `DATEADD`, `DATEDIFF`, `DATEPART`, `DATETRUNC`, `EOMONTH`, `NEWID` y el operador `+` entre textos. La prueba compara cada una con valores obtenidos de SQL Server |
| Runner, base y comparación | `runner.ts`, `pglite.ts`, `compare.ts`, `data.ts` | Se reutilizan tal cual. El runner corre una sentencia a la vez, como SSMS |
| Revisión de planes | `plan-check.ts` | Se reutiliza para los pasos de concepto (planes de PostgreSQL) |
| Base de ejemplo | `_data/labs/challenge-datasets.yml` | Se reutiliza y se amplía |
| Editor | CodeMirror 6 con `lang-sql` en el dialecto de SQL Server | Se reutiliza tal cual |
| Simulador de sesiones | El del curso de PostgreSQL (sección 4.8 de su plan) | Se reutiliza; las salidas se graban de un SQL Server |
| Verificación contra un servidor | `mcp__sql-server` en esta máquina (SQL Server 2022 Developer) | Pasa a un script y a pruebas del repositorio (sección 4.6) |

### 4.3 Qué hay que construir

**Ampliar la traducción.** Hasta el 25 de noviembre de 2026 `translate.ts` detenía con un mensaje lo que no puede correr: `TOP`, variables con `@`, `TRY...CATCH`, procedimientos, control de flujo, `OUTPUT`, `PRINT`, `UPDATE` y `DELETE` con `JOIN`, una CTE como destino de un cambio y los estilos de `CONVERT`. Para un curso de SQL Server, `TOP` y `OUTPUT` son de lo primero que se enseña. Plan:

| T-SQL | Hoy | Plan |
|---|---|---|
| `TOP (n)` y `TOP n WITH TIES` | Bloqueado: el mensaje dice usar `OFFSET ... FETCH` | Traducir a `FETCH FIRST n ROWS ONLY` y `WITH TIES`; `TOP n PERCENT` sigue bloqueado. **Hecho (25 nov):** el número va solo o entre paréntesis, y el límite se pone al final del `SELECT`, aunque sea una subconsulta o `CROSS APPLY`. Siguen bloqueados `PERCENT`, `TOP` con una expresión o una variable, `TOP` en `DELETE`, `UPDATE` o `INSERT`, y `TOP` en una consulta con `UNION`, `INTERSECT` o `EXCEPT` (el límite iría al final y contaría las filas de todas) |
| `UPDATE ... FROM ... JOIN` y `DELETE ... FROM ... JOIN` | Bloqueados | Reescribir a `UPDATE ... FROM ... WHERE` y `DELETE ... USING ... WHERE` en los patrones comunes (un `JOIN` simple). **Hecho (25 nov), con otra forma para `DELETE`:** `UPDATE alias SET … FROM … JOIN …` con `INNER JOIN`, `CROSS JOIN` o comas pasa a `UPDATE tabla AS alias SET … FROM <las demás> WHERE <los ON> AND (<el WHERE>)`. `DELETE alias FROM … JOIN …` (con cualquier tipo de `JOIN`, `LEFT` incluido) pasa a `DELETE FROM tabla WHERE ctid IN (SELECT alias.ctid FROM <el FROM tal como estaba>)`, con `ctid`, el identificador de fila de PostgreSQL. Un `UPDATE` con `LEFT`, `RIGHT` o `FULL JOIN` sigue bloqueado: sin una copia de la tabla no se puede escribir, y la copia (unida por `ctid`) hace ambiguos los nombres de columna sin alias (probado: `column reference "price" is ambiguous`) |
| `OUTPUT inserted.* / deleted.*` | Bloqueado | Traducir a `RETURNING` con `NEW.` y `OLD.`. PostgreSQL 18 lo permite y PGlite 0.5.17 lo corre (verificado: `RETURNING old.v, new.v`). **Hecho (25 nov):** `inserted` pasa a `new`, `deleted` a `old` y `$action` de `MERGE` a `merge_action()`; la cláusula se mueve al final de la sentencia (con `INSERT`, `UPDATE`, `DELETE`, `MERGE`, y con `UPDATE`/`DELETE` con `JOIN`). `OUTPUT … INTO` sigue bloqueado. `MERGE tabla` recibe el `INTO` que PostgreSQL exige |
| CTE recursiva (T-SQL no escribe `RECURSIVE`) | No figura entre lo que traduce (a confirmar en la fase 1) | Agregar `RECURSIVE` cuando la CTE se nombra a sí misma. **Hecho (25 nov):** también se quita `OPTION (…)` (`MAXRECURSION`, `RECOMPILE`…), que PostgreSQL no tiene |
| `CONVERT(tipo, x, estilo)` | Los estilos están bloqueados | Los estilos de uso común (101, 103, 112, 120, 121) con funciones de compatibilidad. **Hecho (25 nov):** 23, 101 a 105, 108, 110 a 112, 120 y 121, de fecha a texto (`tsql_format`) y de texto a `date`, `datetime` o `datetime2` (`tsql_parse`, sin el 108); los demás estilos siguen bloqueados |
| `TRY_CAST` y `TRY_CONVERT` | No figuran en `compat.ts` (a confirmar) | Funciones de compatibilidad que devuelven `NULL` si falla. **Hecho (25 nov):** `try_valid` comprueba el texto con `pg_input_is_valid` (que PGlite trae) y el `CAST` de afuera lo convierte. Imita a SQL Server en lo raro: el texto vacío es 0 para un entero y `1900-01-01` para una fecha (pero `NULL` para un decimal), y `0x10` y `1_000` no son enteros. Está pensado para convertir **texto**; `TRY_CONVERT` con estilo sigue bloqueado |
| Variables `@x` con `DECLARE` y `SET` | Bloqueadas | Opcional: variables escalares resueltas como constantes; el resto sigue como paso capturado |
| `PRINT`, `IF`, `WHILE`, `TRY...CATCH`, procedimientos | Bloqueados | Pasos capturados; el intérprete queda como opcional |

Cada construcción nueva trae su prueba en `compat.test.ts` o en una prueba de la traducción, con el valor que da SQL Server. **Cobertura (hecha, 25 nov):** `labs/challenges/sql/coverage.ts` lista unas 120 construcciones de T-SQL de los módulos 1 a 12, cada una con un ejemplo y su estado: `native` (corre igual), `adapted` (lo adapta `translate.ts` o `compat.ts`), `blocked` (se detiene con un mensaje: la lección lo enseña con un paso capturado) y `gap` (todavía falla: pendiente). `coverage.test.ts` corre los ejemplos en PGlite y falla si alguno no está donde dice la lista; si alguien traduce un `gap`, pide cambiar el estado. **Falta (fase 4):** que la prueba de las lecciones rechace un paso ejecutable cuyo código dé `translate(código).blocked` distinto de vacío, o que use un `gap`.

**Intercalación (hecha, 25 nov).** `translate(código, { collation: 'ci' })` agrega `COLLATE tsql_ci_as` a las columnas de texto de todo `CREATE TABLE` y `ALTER TABLE` (lo que cree el alumno también), y `COLLATE Latin1_General_CS_AS` y parecidos se traducen a las intercalaciones de `compat.ts` (`_CI_AS`, `_CI_AI`, `_CS_AS`, `_BIN`, `DATABASE_DEFAULT`; las demás se detienen). `collation.test.ts` compara con SQL Server (con `SQL_Latin1_General_CP1_CI_AS`) igualdad, `LIKE`, `IN`, `BETWEEN`, `ORDER BY`, `GROUP BY`, `DISTINCT`, `JOIN`, `PARTITION BY`, `REPLACE`, `CHARINDEX` y `UNIQUE` con datos de mayúsculas mezcladas y con acentos, y el orden con `COLLATE` de `_CS_AS` y `_CI_AI`. No hace falta ningún archivo extra en el navegador.

**Paso capturado** (`kind: captured`): el código en un editor de solo lectura, una pregunta opcional de predicción y un botón **Ver salida** que muestra lo grabado: cada resultado, los mensajes (`PRINT`, errores con número, gravedad, estado y línea) y, al pie, "SQL Server 2022 (16.0.1000.6), capturado el 23 de noviembre de 2026".

**Visor de planes de SQL Server:** los pasos del módulo 10 muestran planes de ejecución capturados (`SET STATISTICS XML ON`). Un lector del XML los pinta como un árbol de operadores (`Index Seek`, `Clustered Index Scan`, `Key Lookup`, `Nested Loops`, `Hash Match`...) con las filas estimadas, el costo relativo y el predicado. No se copian los iconos de SSMS.

**Rótulos de nivel** en cada paso y el cuadro "Ojo: diferencias" (YAML `differences`, con texto en los dos idiomas).

### 4.4 Cómo se revisa un ejercicio

Los ejercicios **ejecutables** se revisan como en el curso de PostgreSQL (sección 4.5 de su plan): `rows`, `table`, `error`, `plan`, reglas por palabras clave. La diferencia es que el SQL del visitante pasa primero por `translate()`, y que el mensaje de un error de PostgreSQL se acompaña de lo que habría dicho SQL Server cuando se sabe (por ejemplo, el número 8134 de la división entre cero).

Los pasos **capturados** no se corrigen: se contesta la predicción y se ve la salida. El paso se marca como resuelto al acertar o al ver la salida, y "visto" si se abre sin contestar, como una solución.

Los de **concepto** (planes de PostgreSQL para explicar un índice) llevan el rótulo y, al lado, la captura equivalente de SQL Server.

### 4.5 Qué difiere entre SQL Server y lo que corre aquí

Las diferencias que el curso conoce hoy, y cómo se resuelve cada una:

| Diferencia | Cómo se resuelve |
|---|---|
| Intercalación: SQL Server no distingue mayúsculas (`_CI_`) y ordena `A, a, B, b, é, z`; PGlite usa `C` y ordena `A, B, a, b, z, é` | Resuelta con las columnas `tsql_ci_as` (ICU) de la opción `collation: 'ci'`: el mismo orden y las mismas igualdades, con acentos incluidos (`collation.test.ts`). `Modern_Spanish_CI_AS` (la del servidor de esta máquina) pone la ñ después de la z de la n; la de referencia del curso es `SQL_Latin1_General_CP1_CI_AS` |
| Una comparación sin columnas no usa la intercalación: `'a' = 'A'` es verdadero en SQL Server y falso aquí. `COLLATE` sí la pone | La lección lo enseña con una columna o con `COLLATE`; el caso de los literales, como paso capturado |
| Los espacios al final no cuentan al comparar en SQL Server (`'a ' = 'a'` es verdadero, y `WHERE Name = 'a'` encuentra `'a '`); en PostgreSQL sí | Los datos de ejemplo no llevan espacios al final; la lección de `LEN` y `RTRIM` lo muestra como paso capturado |
| Los comodines `[a-c]` y `[^a]` de `LIKE` no existen en PostgreSQL (los toma como letras) | `translate` los detiene (`like-set`) para no dar un resultado equivocado sin avisar |
| Decimales: `1/3.0` da `0.333333` en SQL Server y 20 cifras en PostgreSQL | Los ejercicios con decimales fijan el tipo con `CAST(... AS decimal(10, 2))`; la prueba contra SQL Server señala cualquier otro caso |
| `COUNT(*)` devuelve `int` en SQL Server y `bigint` en PostgreSQL | Los números se muestran igual; no se enseña el tipo de retorno de los agregados con la salida de PGlite |
| Los encabezados de las columnas: SQL Server los devuelve **tal como se escriben en la consulta** (`Name`, o `name` si escribes `name`: comprobado en 2022); PostgreSQL pasa a minúsculas los que no van entre comillas | El cuadro "Ojo: diferencias" del primer ejercicio lo explica. La comparación de resultados cuenta las columnas por posición y no por nombre (`compare.ts`), y los ejemplos del texto muestran los nombres como los escribe SQL Server (la prueba no distingue mayúsculas en la cabecera) |
| `datetime` redondea a 3,33 ms y `datetime2` no | Se enseña con fechas sin fracciones; los tipos de fecha de SQL Server se traducen a `timestamp` |
| La semana empieza en domingo (`DATEFIRST 7`) | Ya la implementa `compat.ts` y su prueba |
| El orden de las filas sin `ORDER BY` no está definido en ninguno de los dos | Todo ejercicio que compara filas pide `ORDER BY` o se revisa sin orden |
| Los bloqueos, el aislamiento y los planes son del servidor | No se ejecutan: se capturan |
| SQL Server corta una CTE recursiva a los 100 niveles (error 530: «The maximum recursion 100 has been exhausted before statement completion») salvo con `OPTION (MAXRECURSION n)`; PostgreSQL no tiene límite, y una CTE sin condición de parada corre hasta el tiempo límite del laboratorio | Se quita el `OPTION`; la lección del límite es un paso capturado con el error 530 |
| El orden de las filas de `OUTPUT` no está definido en SQL Server (por ejemplo, un `MERGE` devuelve primero el `INSERT` o el `UPDATE` según el plan) | Los ejercicios con `OUTPUT` de varias filas se revisan sin orden |
| `CAST(19.99 AS int)` trunca (19) y `CAST(-19.99 AS int)` da -19; PostgreSQL redondea (20 y -20). A un decimal con menos cifras (`decimal(10, 0)`) los dos redondean | Sin traducir todavía: la lección de `CAST` usa un paso capturado para el entero. Pendiente: traducir `CAST(x AS int)` de un número |
| `CAST('' AS int)` da 0 y `CAST('' AS date)` da `1900-01-01`; PostgreSQL da un error | `TRY_CAST` lo imita; `CAST` no, y la lección lo muestra como paso capturado |
| `CONVERT(varchar, x, 121)` da 3 decimales con `datetime` y 7 con `datetime2` (`2024-03-05 14:07:09.0000000`); con un `date`, los estilos 120 y 121 dan solo la fecha | `tsql_format` da siempre 3 decimales y, para un `date`, la hora en cero: los ejercicios usan `datetime` o cortan con `varchar(10)` |
| `TRY_CAST('true' AS bit)` da 1; `bit` se traduce a `smallint` y da `NULL`. `tinyint` se traduce a `smallint` y acepta más de 255 | Los ejercicios no convierten texto a `bit` ni a `tinyint` |

### 4.6 Verificar contra un SQL Server real

- **`scripts/sqlserver-lessons.test.ts`** (Vitest, con el paquete `mssql` como dependencia de desarrollo): si existe `MSSQL_CONNECTION`, corre la solución de cada ejercicio ejecutable **en el SQL Server real** y compara con las filas que el YAML espera, y con lo que devuelve la traducción en PGlite. Sin esa variable, la prueba se omite con un aviso.
- **Una base temporal** con intercalación explícita (`SQL_Latin1_General_CP1_CI_AS`), creada y borrada por la prueba, para no depender de la intercalación de la máquina (la de este equipo es `Modern_Spanish_CI_AS`). Nunca toca las bases del trabajo.
- **`scripts/sqlserver-capture.mjs`:** corre los pasos capturados, separa los lotes por `GO`, y guarda los resultados, los mensajes (`PRINT` y errores) y `@@VERSION` en el YAML del paso, borrando lo que cambia en cada corrida (fechas, `NEWID()`, nombres del servidor, identificadores de sesión). Un parámetro `--check` vuelve a correrlos y compara, sin escribir.
- **Lo que dejó la fase 3 para el script definitivo.** Las capturas piloto se grabaron con un script provisional (PowerShell y `System.Data.SqlClient` con `FireInfoMessageEventOnUserErrors`, que entrega los errores como mensajes y deja seguir el lote, como SSMS). Lo que se aprendió:
  - El MCP `mcp__sql-server` solo devuelve el primer conjunto de resultados y ningún mensaje (ni `PRINT` ni errores): no sirve para capturar.
  - Un `SELECT` que falla antes de devolver filas (`SELECT 1 / 0`) entrega su conjunto de resultados vacío, con el nombre de la columna: se guarda con `rows: []`.
  - Un error de `INSERT` va seguido del mensaje 3621 ("The statement has been terminated.", gravedad 0): es texto plano, sin encabezado.
  - Los mensajes de los errores 515 y 2628 traen el nombre de la base: la base temporal necesita un nombre fijo (por ejemplo `course_capture`), o el script lo reemplaza, para que la captura no cambie en cada corrida.
  - Los números de línea cuentan desde la primera línea del lote: al partir por `GO` hay que quitar el salto de línea que queda al principio, o todos los números de línea salen una línea más abajo.
  - Los 28 errores de `_data/course/sqlserver/errors.yml` se comprobaron uno por uno provocándolos en SQL Server 2022 (102, 105, 137, 156, 201, 207, 208, 209, 213, 220, 241, 245, 512, 515, 530, 544, 547, 2601, 2627, 2628, 2714, 2812, 3701, 4104, 8114, 8115, 8120 y 8134); la prueba de la fase 4 los vuelve a provocar.
- **CI:** un trabajo opcional con un contenedor de SQL Server 2022 (`mcr.microsoft.com/mssql/server:2022-latest`, que pide aceptar el EULA). En esta máquina se usa la instalación Developer que ya existe; bajar la imagen de Docker pide permiso. La fase 1 decide si el trabajo corre en cada pull request o a mano.
- **Lo que siempre corre** (sin servidor): la forma de los YAML de las capturas, la cobertura de la traducción y las pruebas de datos.
- **Hecho (25 nov, fase 4), cómo se usa:**
  - **La conexión** es `MSSQL_CONNECTION`, una cadena de SqlClient. Con el SQL Server local y la autenticación de Windows: `$env:MSSQL_CONNECTION = "Server=localhost;Integrated Security=true;TrustServerCertificate=true"`. Con un contenedor: `Server=localhost,1433;User Id=sa;Password=...;TrustServerCertificate=true`. Va en un archivo temporal, no en la línea de comandos. Sin la variable, las pruebas con servidor se omiten y el script se detiene.
  - **`dotnet/sqlserver/Runner`** (C#, `Microsoft.Data.SqlClient`; el paquete se restaura de la caché de NuGet o de nuget.org, con `System.Security.Cryptography.Pkcs` 11.0.0 para reemplazar la 9.0.11 que trae, con avisos de seguridad): por cada corrida crea su base (`course_capture_…`, con `SQL_Latin1_General_CP1_CI_AS`), corre los lotes con `FireInfoMessageEventOnUserErrors` (los errores llegan como mensajes y el lote sigue, como en SSMS), devuelve los resultados y los mensajes de cada lote, y la borra. En los mensajes, el nombre de la base se cambia por `CourseDb`.
  - **`scripts/sqlserver-client.mjs`:** `splitBatches` (los lotes por las líneas `GO`; cada uno empieza en la línea que sigue al `GO`, como SSMS, y los números de línea cuentan desde ahí) y `runScripts`.
  - **`npm run sqlserver:capture`** graba los pasos capturados y escribe en cada lección lo que cambió (`--lesson modulo/leccion` para una, `--force` para reescribir aunque no cambie); **`npm run sqlserver:check`** los vuelve a correr y compara, sin escribir. Se comparan los resultados y los mensajes, no la versión ni la fecha: un servidor nuevo que da lo mismo no obliga a tocar nada. Los mensajes de gravedad 10 o menos (`PRINT`, 3621, avisos) se guardan como texto plano. Un script capturado tiene que dar siempre lo mismo: sin `GETDATE()` ni `NEWID()`, que el script no normaliza.
  - **`sqlserver-lessons.test.ts`** corre, con el servidor, cada solución en cada caso (con los datos del caso, en T-SQL) y la compara con lo que da PGlite (`compareResults`), y cada ejemplo del texto, que tiene que ser exacto, también las mayúsculas de la cabecera. Las dos mitades traducen con la `collation` del curso, como el navegador. Se comprobó que la prueba falla si una cabecera cambia de mayúsculas.
  - **`sqlserver-capture.test.ts`** prueba sin servidor `splitBatches`, `toMessages`, la escritura y el reemplazo del bloque `captured` (que el YAML se lea de vuelta igual y que el resto del archivo quede tal cual) y que los bloques de las lecciones estén escritos como los escribe el script.

### 4.7 Ejemplos del texto verificados

El mismo formato del curso de PostgreSQL: un bloque ` ```sql ` seguido de otro ` ```text ` con el resultado se corre en PGlite y se compara. Los bloques de T-SQL capturado se marcan ` ```tsql ` y se comprueban solo por su forma, porque no corren aquí.

**Hecho (25 nov, fase 3):** `scripts/sql-examples.ts` escribe el resultado con el formato de `psql`: la cabecera centrada, una línea de guiones con `+` entre las columnas, las filas con el texto a la izquierda y los números a la derecha, `NULL` para un dato que falta y, al final, `(6 rows)` en inglés o `(6 filas)` en español. Se comparan sin los espacios al final de cada línea y sin distinguir mayúsculas en la cabecera (PostgreSQL escribe en minúsculas lo que SQL Server muestra tal como se escribe). `sqlserver-lessons.test.ts` corre cada ejemplo del texto de las dos lenguas en PGlite con la base de ejemplo del curso, y `course-data-sql.test.ts` rechaza un ` ```text ` sin su ` ```sql ` justo antes.

---

## 5. Formato de una lección

Igual al del curso de PostgreSQL, con los pasos capturados y el nivel:

```yaml
# _data/course/sqlserver/filtering/null.yml
shared:
  minutes: 12
  steps:
    - id: intro
      kind: read
    - id: isnull
      kind: exercise
      level: executable              # executable | concept
      mode: query
      tables: [Customers]
      starter: |
        SELECT Name, Phone FROM Customers;
      solution: |
        SELECT Name, ISNULL(Phone, 'none') AS Phone FROM Customers ORDER BY Name;
      check: rows
      ordered: true
      cases:
        - sample: true
    - id: try-catch
      kind: captured
      script: |
        BEGIN TRY
            SELECT 1 / 0;
        END TRY
        BEGIN CATCH
            PRINT ERROR_MESSAGE();
        END CATCH;
      predict:                       # opcional: se contesta antes de ver la salida
        answer: 0
      captured:                      # lo escribe scripts/sqlserver-capture.mjs
        server: "16.0.1000.6"
        date: 2026-11-23
        batches:
          - messages: ["Divide by zero error encountered."]
            results: []
    - id: quiz
      kind: choice
      answer: 1
es:
  slug: nulos
  title: NULL, ISNULL y COALESCE
  summary: Qué pasa cuando falta un dato y cómo reemplazarlo.
  steps:
    isnull:
      title: Teléfonos que faltan
      text: …
      differences: |           # el cuadro "Ojo: diferencias" de este paso
        …
      instructions: …
      hints: [ …, …, … ]
      explanation: …
      failure: …
    try-catch:
      title: Atrapar un error
      text: …
      predict:
        question: …
        options: [ …, …, … ]
        explanation: …
en:
  slug: nulls
  # …mismos pasos, en inglés
```

- El resto de las reglas del formato son las del curso de C# (`PLAN-CURSO.md`, sección 5): prosa traducida, código en inglés, un `slug` por idioma.
- Los datos de `captured` se escriben solo con el script; una prueba falla si alguien los edita a mano y no coinciden con la salida del servidor (cuando hay uno).
- **Lo que quedó fijo en la fase 3** (lo comprueba `course-data-sql.test.ts`):
  - **Ejercicio ejecutable:** `level` (`executable` o `concept`), `mode` (`query`, `change` o `plan`), `tables` (de la base de ejemplo), `starter`, `solution`, `check` (`rows`, `table`, `error`, `plan` o `index`) y `cases`. Uno de resultado (`rows` o `table`) trae el caso de ejemplo (`sample: true`) y al menos uno con datos propios (`tables:` con filas de las columnas que existen). **Sin `expected`, lo esperado de un caso es lo que devuelve la solución en ese mismo caso:** la solución es la referencia, y la fase 4 la compara con SQL Server. `starter` va en `shared` y, si lleva comentarios, también en cada idioma (en los dos o en ninguno).
  - **Paso capturado:** `script`, `predict: {answer}` (opcional) y `captured: {server, date, batches}`, sin `level` (es capturado por definición). La pregunta de la predicción, sus opciones y su explicación van en cada idioma. `date` va entre comillas (`"2026-11-25"`): sin ellas Jekyll la lee como fecha. Cada lote trae `results` (cada uno con `columns` y `rows`) y `messages`: un `PRINT` es `{text}` y un error, `{number, level, state, line, text}` (gravedad mayor que 10 es un error con su encabezado; menor, texto plano). Cada error necesita su explicación en `errors.yml`, en los dos idiomas.
  - **`differences`** (el cuadro "Ojo: diferencias"): solo en un ejercicio ejecutable, y en los dos idiomas o en ninguno.
  - **Cada paso solo trae las claves de su tipo:** un nombre mal escrito (`levl`) no pasa por un dato más.
  - **Orden y nombres (26 de noviembre de 2026):** `ordered: true` hace que cuente el orden de las filas. Las columnas se comparan por posición; un ejercicio de alias agrega `names: [PriceWithTax]` (solo con `check: rows`), que exige esos nombres, sin distinguir mayúsculas, después de que coinciden los datos. Con SQL Server, la prueba exige además que la solución devuelva esos nombres.

---

## 6. Dirección visual y experiencia

La estructura es la del curso de PostgreSQL (`PLAN-CURSO-POSTGRESQL.md`, sección 6). Lo propio de este curso:

- **Insignia de nivel** junto al título del paso: "Ejecutable en tu navegador" (con el icono del motor), "Salida capturada de SQL Server 2022" o "Concepto con PostgreSQL". El color no es lo único que las distingue: llevan texto.
- **Paso capturado:** el código en un editor de solo lectura, la pregunta de predicción arriba y, al contestar, **Ver salida**. La salida se muestra como la vería SSMS: una pestaña por resultado y una de **Mensajes** con `PRINT` y errores. Al pie, la versión y la fecha de la captura.
- **Cuadro "Ojo: diferencias":** un cuadro de nota, plegado por defecto, en los pasos ejecutables que tienen alguna.
- **Planes de ejecución:** el visor de la sección 4.3, con las filas estimadas y el costo relativo.
- **Simulación:** la del curso de PostgreSQL, con dos sesiones.
- **Carga del motor:** PGlite es el mismo archivo que usa el laboratorio (unos 5,3 MB), y se descarga solo al mostrar intención de ejecutar. Los pasos capturados y de lectura no descargan nada.

---

## 7. Temario

Unas 76 lecciones y unos 350 pasos. La versión 1 son los módulos 1 a 5. La última columna dice el nivel que predomina: **E** ejecutable, **C** capturado, **mixto**.

| # | Módulo | Lecciones | Nivel | Versión 1 |
|---|---|---|---|---|
| 1 | Primeros pasos con T-SQL | SSMS y VS Code · Tu primera consulta · Alias y expresiones · `TOP` y `ORDER BY` · `DISTINCT` y la base de ejemplo | E | Sí |
| 2 | Filtrar y ordenar | `WHERE` · `AND`, `OR` y `NOT` · `BETWEEN`, `IN` y `LIKE` · `NULL`, `ISNULL` y `COALESCE` · `ORDER BY` y `OFFSET ... FETCH` | E | Sí |
| 3 | Tipos y funciones | Números · Texto · Fechas · `CASE` e `IIF` · `CAST`, `CONVERT` y `TRY_CAST` · Intercalación y mayúsculas | E | Sí |
| 4 | Agrupar y resumir | Funciones de agregado · `GROUP BY` · `HAVING` · `STRING_AGG` y `COUNT(DISTINCT)` · `ROLLUP`, `CUBE` y `GROUPING SETS` | E | Sí |
| 5 | Unir tablas | Llaves y relaciones · `INNER JOIN` · `LEFT`, `RIGHT` y `FULL` · Autouniones y `CROSS JOIN` · `CROSS APPLY` y `OUTER APPLY` · Semi y anti-joins con `EXISTS` | E | Sí |
| 6 | Subconsultas y CTE | Subconsultas escalares · `IN` y `EXISTS` · Correlacionadas y tablas derivadas · `WITH` · CTE recursivas · `UNION`, `INTERSECT` y `EXCEPT` | E | No |
| 7 | Funciones de ventana | `OVER` y `PARTITION BY` · `ROW_NUMBER`, `RANK` y `DENSE_RANK` · `LAG` y `LEAD` · Acumulados y marcos · Top-N por grupo | E | No |
| 8 | Modificar datos | `INSERT` · `UPDATE` · `DELETE` · `UPDATE` y `DELETE` con `JOIN` · `OUTPUT` · `MERGE` | E | No |
| 9 | Diseñar tablas | `CREATE TABLE` y tipos · Llaves y restricciones · `IDENTITY` y secuencias · Columnas calculadas · `ALTER TABLE` · Tablas temporales y variables de tabla | mixto | No |
| 10 | Índices y planes | Qué es un índice · Agrupado y no agrupado · Cobertura (`INCLUDE`) y filtrados · Planes de ejecución · Estadísticas · Columnstore | mixto | No |
| 11 | T-SQL programable | Variables · `IF` y `WHILE` · `TRY...CATCH` y `THROW` · Transacciones y `XACT_ABORT` · Cursores · SQL dinámico | C | No |
| 12 | Objetos programables | Vistas · Funciones · Procedimientos almacenados · Triggers · Secuencias | mixto | No |
| 13 | Concurrencia (simulador) | ACID y bloqueos · Aislamiento · Interbloqueos · `NOLOCK` y sus riesgos · Versionado de filas | C | No |
| 14 | Seguridad y operación (lectura) | Inicios de sesión y permisos · Copias de seguridad · Query Store y vistas de administración · `tempdb` y SQL Server Agent | C | No |

Notas: las vistas (módulo 12) se pueden ejecutar; las funciones, los procedimientos y los triggers son capturados. En el módulo 10, crear índices y ver la idea corre con PostgreSQL (nivel de concepto), y los planes de SQL Server son capturados.

---

## 8. Progreso local

El del curso de C# (`PLAN-CURSO.md`, sección 8) y el de PostgreSQL: una sola clave, `mi-sitio2.curso.v1`, organizada por curso; para este, `sqlserver`. Los pasos capturados guardan si se contestó la predicción y si se vio la salida; las simulaciones, el instante al que se llegó.

---

## 9. Pruebas y calidad

- `tsc --noEmit` estricto y Prettier, como el resto de `labs/`.
- **Vitest:**
  - **Traducción y compatibilidad:** las de hoy más las nuevas construcciones (`TOP`, `OUTPUT`, `UPDATE ... JOIN`, CTE recursivas, estilos de `CONVERT`, `TRY_CAST`), cada una con el valor que da SQL Server, y la prueba de **cobertura**.
  - **Datos:** los del curso de PostgreSQL, y además que cada paso tenga su nivel, que un paso capturado traiga `script` y `captured`, que cada diferencia conocida de la sección 4.5 tenga su cuadro cuando la lección la toca, y que no haya `{{` ni `{%`. **Hecho (25 nov, fase 3):** `scripts/course-data-sql.test.ts` (lo propio de SQL) y `scripts/course-lesson-checks.ts` (lo que vale para la lección y el temario de cualquier curso, que ahora comparte con `course-data.test.ts`). Queda sin automatizar lo de las diferencias de la sección 4.5: no hay forma de saber qué lección "toca" cuál; lo revisa quien escribe la lección.
  - **Interfaz:** paso capturado (predicción, salida, mensajes y errores), insignias de nivel y visor de planes, con jsdom.
- **Lecciones en Node** (`scripts/sqlserver-lessons.test.ts`): la solución de cada ejercicio ejecutable pasa por la traducción y en PGlite con sus casos; el código inicial no pasa; los ejemplos del texto dan lo que muestran. Con `MSSQL_CONNECTION`, también en SQL Server. **Hecho a medias (25 nov, fase 3):** la mitad de PGlite ya corre (`sqlserver-lessons.test.ts`: la solución pasa todos los casos, el código inicial no, y cada ejemplo del texto da lo que muestra); falta correrlo en SQL Server (fase 4). Se comprobó que la prueba falla cuando cambia un precio de un ejemplo, cuando el código inicial ya resuelve el ejercicio y cuando falta la explicación de un error.
- **Capturas:** la forma del YAML siempre; con servidor, `sqlserver-capture.mjs --check`.
- **Accesibilidad:** la del curso de PostgreSQL, y que las insignias de nivel se distingan sin color.
- **Rendimiento:** CI revisa el presupuesto del adaptador. El visor de planes y el paso capturado entran en los 30 kB comprimidos de la página, o se cargan aparte si no caben.
- Revisión final en los dos idiomas, tema claro y oscuro, escritorio y móvil.

---

## 10. Fases

Cada fase se trabaja en su rama, entra a `main` con un pull request y termina con algo probado. El mensaje de cada commit sigue el formato del repositorio ("Curso de SQL Server, fase N: …").

### Fase 0. Plataforma compartida
Es la del curso de PostgreSQL (su fase 0) y su adaptador SQL (su fase 4). Este curso espera a que estén hechas. Avance del 25 de noviembre de 2026: ya están `courses.yml` y los datos y páginas por curso (SQL Server figura como `sqlserver`, con carpeta `sql-server` y `status: soon`); el motor y el editor ya están en `labs/shared/`; los errores ya van por curso (`_data/course/<curso>/errors.yml`); los textos de la interfaz ya van por motor (`ui.yml` y `ui-<motor>.yml`: este curso agrega `ui-sql.yml`) y el núcleo de la lección habla con un `CourseEngine` (`labs/course/engine.ts`, con el adaptador de C# en `engines/csharp.ts`). **La fase 0 está completa**, y el adaptador SQL, que según el plan hacía el curso de PostgreSQL (su fase 4), ya existe: lo escribió este curso (ver el estado del 25 de noviembre, adaptador SQL).

### Fase 1. Decisiones y prototipo
- [x] Confirmar las decisiones de la sección 2. Se adoptaron las recomendadas al empezar (25 de noviembre de 2026).
- [x] Probar `TOP`, `OUTPUT` y las CTE recursivas en la traducción, contra SQL Server; confirmar qué traduce `translate.ts` hoy de la sección 4.3 (25 de noviembre de 2026).
- [x] Probar una intercalación sin mayúsculas para la base de ejemplo; medir qué diferencias quedan (25 de noviembre de 2026). Se probó `citext` y una intercalación ICU no determinista; ganó la segunda (decisión 5).
- [x] Prototipo de `sqlserver-capture.mjs` y un paso capturado (25 de noviembre de 2026, en la fase 4). No con el paquete `mssql`, sino con un ejecutor de .NET: ver el estado de la fase 4 y la sección 4.6. Falta decidir si CI corre un contenedor.
- [x] Escribir a mano la lección piloto "Tu primera consulta" (ejecutable) y "Atrapar un error" (capturada), en español e inglés (25 de noviembre de 2026, en la fase 3).

**Entregable:** decisiones aprobadas y un paso de cada nivel que funciona.

### Fase 2. Ampliar la traducción
- [x] `TOP`, estilos comunes de `CONVERT` y `TRY_CAST`/`TRY_CONVERT` (25 de noviembre de 2026).
- [x] `UPDATE`/`DELETE` con `JOIN`, `OUTPUT` y CTE recursivas (25 de noviembre de 2026). Falta el `UPDATE` con `LEFT JOIN`, que sigue bloqueado.
- [x] Opción de intercalación (`collation: 'ci'`, con ICU) y su prueba contra SQL Server (25 de noviembre de 2026).
- [x] La lista de cobertura y su prueba (25 de noviembre de 2026). Pendientes de la lista (estado `gap`, todos con un error de PostgreSQL hoy): `FORMAT`, `PATINDEX`, `CHOOSE`, `ISNUMERIC`, `QUOTENAME`, `GROUP BY … WITH ROLLUP`, `COUNT_BIG`, las columnas calculadas, `ALTER COLUMN`, `CREATE OR ALTER VIEW` y `SET IDENTITY_INSERT`. Se traducen cuando una lección los pida.
- [ ] Los retos de SQL del laboratorio siguen pasando (los de `TOP` ya no se bloquean: se actualiza su mensaje).

**Entregable:** el T-SQL que el curso enseña en los módulos 1 a 8 corre en el navegador y coincide con SQL Server.

### Fase 3. Datos y páginas
- [x] La base de ejemplo ampliada y el esquema de lección con `level`, `kind: captured` y `differences` (25 de noviembre de 2026). La base ganó `Customers.Phone`, una columna que puede faltar (tres clientes con teléfono vacío), al final de la tabla para no mover las demás; los retos del laboratorio siguen pasando. Según el temario, con las demás tablas alcanzan los módulos 1 a 5 (clientes sin pedidos y un producto sin ventas para los `LEFT JOIN`, empleados con jefe y uno sin departamento, precios repetidos para `WITH TIES`); si una lección pide más, se amplía entonces. El esquema de la lección es el de la sección 5.
- [x] `ui-sql.yml` con los textos de los niveles, y un `errors.yml` por número de error de SQL Server (25 de noviembre de 2026). El `errors.yml` trae 28 errores comprobados contra SQL Server 2022. `ui-sql.yml` también lleva el cierre de un módulo sin retos (`practice_none`, `practice_playground` y `practice_all`, que eran de C# en `ui.yml` y pasaron a `ui-csharp.yml`).
- [x] El curso en `courses.yml`, todavía como "Próximamente" (25 de noviembre de 2026). Para que sus páginas existan sin anunciarse hizo falta un estado nuevo, `preview` (sección 3): el índice, el menú y la portada lo siguen mostrando como "Próximamente".
- [x] Pruebas de datos y la lección piloto en el repositorio (25 de noviembre de 2026): las dos lecciones, en español e inglés, y las pruebas de la sección 9.

**Entregable:** las páginas existen y se leen sin JavaScript; los datos se validan en CI. Comprobado: las 6 páginas nuevas (el temario y las dos lecciones, en los dos idiomas) se ven en el navegador en tema claro y oscuro y en 375 px sin desbordar, con contraste de al menos 5,17:1; las 142 páginas del curso de C# solo cambian en el JSON de la página (el nivel de los pasos y los textos de "Para practicar" pasaron a su motor).

### Fase 4. Verificación y capturas
- [x] `scripts/sqlserver-lessons.test.ts` contra SQL Server y la base temporal con intercalación explícita (25 de noviembre de 2026).
- [x] `scripts/sqlserver-capture.mjs` con `--check` (25 de noviembre de 2026).
- [x] El trabajo opcional de CI con el contenedor (25 de noviembre de 2026): `.github/workflows/sqlserver.yml`. Quien mantiene el repositorio aceptó el EULA de SQL Server (`ACCEPT_EULA=Y`, edición Developer) al pedirlo. Es un flujo aparte de "Sitio", con `paths` (solo corre cuando cambia algo del curso de SQL Server, su traducción, su ejecutor o sus pruebas) y a mano; no decide la publicación. Compila el ejecutor, levanta `mcr.microsoft.com/mssql/server:2022-latest` con una contraseña que inventa en cada corrida, espera a que acepte conexiones (`npm run sqlserver:wait`), corre `npm run sqlserver:check` y las pruebas de las lecciones. Probado en un contenedor local (Docker, con los mismos pasos del flujo y el puerto 14333, porque el 1433 es del SQL Server de Windows): SQL Server 16.0.4325.4 sobre Ubuntu 22.04, con el usuario `sa`. Aceptó conexiones a los 17 s, las tres capturas coinciden con las grabadas en Windows (16.0.1000.6) y pasan las 30 pruebas de las lecciones y las capturas. Falta la primera corrida en GitHub, que prueba además lo propio de Actions (`::add-mask::`, `GITHUB_ENV`). `2022-latest` cambia con cada actualización de SQL Server: si una salida capturada cambia, `sqlserver:check` falla y se vuelve a grabar.

**Entregable:** cada solución y cada captura se pueden comprobar contra un servidor real con un comando.

### Fase 5. Página de la lección
- [x] Insignias de nivel, cuadro "Ojo: diferencias" y el paso capturado (25 de noviembre de 2026: las insignias y el cuadro, en el HTML de la fase 3; el paso capturado interactivo, con el adaptador).
- [ ] Visor de planes de SQL Server (XML a árbol).
- [ ] Móvil, temas claro y oscuro, `aria-live` y foco; presupuesto de tamaño y pruebas con jsdom. (Hecho en parte, 25 de noviembre de 2026: móvil, temas, contraste, presupuesto y pruebas con jsdom. Falta revisar el foco y un lector de pantalla.)

**Entregable:** las lecciones piloto funcionan completas en español e inglés.

### Fase 6. Contenido: módulos 1 a 5 (versión 1)
- [ ] Las 27 lecciones de los módulos 1 a 5, en español e inglés, revisadas en el navegador y contra SQL Server. (Módulo 1 hecho el 26 de noviembre de 2026: van 5.)
- [ ] Mini-proyecto del módulo 5: un informe de pedidos por cliente, armado por etapas.
- [ ] Retos del laboratorio al cierre de cada módulo.
- [ ] README: cómo agregar una lección de SQL Server, correr sus pruebas y capturar salidas.
- [ ] Publicar: quitar SQL Server de "próximos" y enlazar su temario.

**Entregable:** el curso, con los módulos 1 a 5, publicado.

### Fase 7. Contenido: módulos 6 a 10
- [ ] Subconsultas y CTE, ventanas, modificar datos, diseñar tablas e índices y planes (29 lecciones).
- [ ] Las primeras capturas de planes de ejecución.

**Entregable:** los módulos 6 a 10 publicados.

### Fase 8. Contenido: módulos 11 a 14
- [ ] T-SQL programable, objetos programables, concurrencia y seguridad y operación (20 lecciones), casi todas con capturas.
- [ ] Mini-proyecto final.

**Entregable:** el temario completo publicado.

### Fase 9. Cierre
- [ ] Revisión de accesibilidad y rendimiento.
- [ ] Revisión en español e inglés, tema claro y oscuro, escritorio y móvil.
- [ ] Probar una lección con alguien que no sepa T-SQL y ajustar lo que se atore.
- [ ] Volver a correr todas las capturas contra la versión vigente de SQL Server.
- [ ] README completo y revisión del sitio publicado.

**Entregable:** el curso publicado y documentado.

### Opcionales
- [ ] **Intérprete de T-SQL procedural** en TypeScript (`DECLARE`, `SET`, `IF`, `WHILE`, `PRINT`, `TRY...CATCH`, `THROW`), que corre las consultas en PGlite. Convertiría en ejecutables muchas lecciones del módulo 11. Se evalúa cuando el curso esté publicado.
- [ ] Cuadros "En PostgreSQL..." que enlacen al otro curso.
- [ ] Racha de días e insignias locales; certificado descargable sin validez verificable.
- [ ] Funcionar sin conexión después de la primera visita, con un service worker que guarde PGlite.
- [ ] Pruebas de extremo a extremo con Playwright y revisión automática con axe.

---

## 11. Criterios de aceptación

1. El curso funciona en español e inglés, en tema claro y oscuro, y en escritorio y móvil.
2. Sin JavaScript, cada lección se lee completa, y los pasos capturados muestran su salida como texto.
3. Cada paso dice en cuál de los tres niveles está, con texto y no solo con color.
4. En un ejercicio ejecutable, **Ejecutar** muestra el resultado de cada sentencia; **Enviar** lo revisa y marca el paso; un error sale con su línea y su explicación; una construcción que no corre aquí se detiene con un mensaje que dice cómo escribirla o que es un paso capturado.
5. En un paso capturado, la salida mostrada es la que grabó un SQL Server real, con su versión y su fecha, y el visitante puede predecirla antes de verla.
6. En CI, siempre: la solución de cada ejecutable pasa en PGlite con la traducción; su código inicial no pasa; los ejemplos del texto dan lo que muestran; la cobertura de la traducción se cumple; la forma de las capturas es válida; cada texto existe en español e inglés. Cuando hay un servidor: cada solución también pasa en SQL Server y cada captura se vuelve a obtener igual.
7. Las diferencias con SQL Server que el curso conoce están en un cuadro "Ojo" en la lección que las toca.
8. Los retos de SQL del laboratorio y el curso de PostgreSQL siguen pasando sus pruebas.
9. El progreso recuerda los pasos resueltos, el código y la última lección; funciona sin `localStorage`; se puede exportar, importar y borrar.
10. El contenido es propio: ningún texto, ejercicio, captura ni marca copiados de otra plataforma o de la documentación de Microsoft.

---

## 12. Riesgos

| Riesgo | Cómo se mitiga |
|---|---|
| La traducción de T-SQL a PostgreSQL es de expresiones regulares y tiene huecos | Lista de cobertura con una prueba; cada construcción nueva se prueba contra SQL Server; lo que no traduce se bloquea con un mensaje, nunca se corre mal en silencio |
| El resultado en PGlite difiere del de SQL Server sin que nadie lo note (intercalación, decimales, fechas, tipos) | La prueba contra SQL Server compara cada solución; la sección 4.5 lista lo que ya se conoce; el cuadro "Ojo" lo avisa en la lección |
| Las capturas se desactualizan con una versión nueva de SQL Server | Cada una lleva la versión y la fecha; `--check` las vuelve a obtener; se revisan cada noviembre |
| Las salidas capturadas traen datos de la máquina (nombres, fechas, identificadores) | El script los borra o los normaliza antes de guardar; la prueba de forma rechaza lo que parezca un nombre de servidor |
| Hay demasiado T-SQL capturado (módulos 11 a 14) y el visitante no practica | El intérprete procedural queda como opcional y se decide con el curso publicado; mientras tanto, las predicciones mantienen al visitante activo |
| Se confunde SQL Server con PostgreSQL | Rótulos de nivel en cada paso, el cuadro "Ojo", y el curso de PostgreSQL como compañero, no como sustituto |
| Mucho contenido en dos idiomas (unos 350 pasos) | Publicar primero los módulos 1 a 5, escribir por módulo, plantillas, la prueba de paridad y la verificación automática |
| La edición Developer y la imagen de Docker tienen términos propios | Las capturas se generan en una instalación Developer para desarrollo y pruebas; antes de poner el contenedor en CI se revisan los términos y el EULA; bajar la imagen en esta máquina pide permiso |
| La verificación contra un servidor depende de una máquina | Es opcional y se omite sin servidor; lo que siempre corre en CI es la forma de los datos y la traducción |
| Las intercalaciones ICU no cubren toda la intercalación de SQL Server (reglas de una intercalación concreta, como la ñ de `Modern_Spanish`; los espacios al final; los comparaciones sin columnas) | La referencia es `SQL_Latin1_General_CP1_CI_AS`, comprobada contra SQL Server con datos con acentos; una lección enseña la intercalación con un ejemplo capturado y el aviso de lo que aquí es una aproximación |
| Rehacer la traducción rompe los retos de SQL | Las pruebas de los retos pasan antes y después; los cambios son aditivos |
| El progreso se pierde al limpiar los datos del navegador | Exportar e importar, un aviso visible y poco volumen guardado |
| Un `{{` o `{%` en una lección rompe el build de Jekyll | La prueba de datos los busca en el texto y en el código |
| Parecerse a otra plataforma o copiar la documentación | Solo se toma el patrón de dos paneles; textos, ejercicios y capturas propios; la documentación de Microsoft se enlaza |

---

## 13. Fuentes

- Referencia de T-SQL (Microsoft Learn): <https://learn.microsoft.com/sql/t-sql/language-reference>
- `SELECT` en T-SQL: <https://learn.microsoft.com/sql/t-sql/queries/select-transact-sql>
- `TRY...CATCH`: <https://learn.microsoft.com/sql/t-sql/language-elements/try-catch-transact-sql>
- Índices: <https://learn.microsoft.com/sql/relational-databases/indexes/indexes>
- Planes de ejecución: <https://learn.microsoft.com/sql/relational-databases/performance/execution-plans>
- Niveles de aislamiento: <https://learn.microsoft.com/sql/t-sql/statements/set-transaction-isolation-level-transact-sql>
- Bloqueos y versionado de filas: <https://learn.microsoft.com/sql/relational-databases/sql-server-transaction-locking-and-row-versioning-guide>
- SQL Server en contenedores de Linux: <https://learn.microsoft.com/sql/linux/sql-server-linux-docker-container-deployment>
- SQL Server Management Studio: <https://learn.microsoft.com/sql/ssms/download-sql-server-management-studio-ssms>
- Retiro de Azure Data Studio: <https://learn.microsoft.com/en-us/azure-data-studio/whats-happening-azure-data-studio>
- Extensión MSSQL para VS Code: <https://learn.microsoft.com/en-us/sql/tools/visual-studio-code-extensions/mssql/mssql-extension-visual-studio-code>
- Controlador `mssql` para Node.js: <https://github.com/tediousjs/node-mssql>
- PGlite, PostgreSQL en WebAssembly: <https://pglite.dev/> y <https://github.com/electric-sql/pglite>
- Documentación de PostgreSQL (la base de la traducción): <https://www.postgresql.org/docs/current/>
