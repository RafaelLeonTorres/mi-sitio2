# Plan: curso interactivo de fundamentos de PostgreSQL

Un curso nuevo de la sección **Cursos** donde el visitante aprende PostgreSQL escribiendo SQL. Cada lección es una serie corta de pasos: el texto y las instrucciones a la izquierda; a la derecha, un editor, el resultado de la consulta en una tabla y, cuando hace falta, el esquema de las tablas. El SQL corre en el navegador del visitante con PGlite, PostgreSQL real compilado a WebAssembly (el mismo motor de los retos de SQL del laboratorio), así que el sitio sigue siendo estático: sin servidor ni cuentas, y con el avance guardado en el navegador.

**Referencia de experiencia.** La misma del curso de C# (`PLAN-CURSO.md`): el patrón de dos paneles, con la lección a la izquierda y el editor, los botones **Ejecutar** y **Enviar**, las pistas y el resultado a la derecha. Se toma la *experiencia*, no la marca, el arte ni los textos de ninguna plataforma.

Este es el primero de los tres cursos nuevos que hoy salen como "Próximamente" en `_data/course/courses.yml` (`status: soon`). Se construye primero porque su motor ya existe (PGlite, el runner, la comparación de resultados y la revisión de planes están en `labs/challenges/sql/`) y porque su fase 0 deja lista la plataforma que también necesitan el curso de SQL Server (`PLAN-CURSO-SQLSERVER.md`) y el de Angular (`PLAN-CURSO-ANGULAR.md`). Orden recomendado: **PostgreSQL, SQL Server, Angular**.

Dónde vive cada cosa:

- **Este plan:** `PLAN-CURSO-POSTGRESQL.md` en la raíz del repositorio. Jekyll no lo publica (está en `exclude` de `_config.yml`, igual que `PLAN.md` y `PLAN-CURSO.md`).
- **Plan del curso de C#:** `PLAN-CURSO.md`. De ahí salen el formato de lección, el progreso local, la máquina de pasos y casi todo el estilo; este plan solo dice lo que cambia.
- **Código:** `F:\Respaldo\Respaldo\Cursos\MiSitio2`, junto al resto del sitio.
- **Plan del laboratorio:** `PLAN.md`. El curso se apoya en lo que construyó su fase 5 (retos de SQL en PGlite) y su sección 8 (laboratorio de rendimiento).

**Estado (27 de noviembre de 2026):** publicado con el módulo 1, en construcción. Decisiones de la sección 2 aprobadas (las recomendadas; PGlite sigue en 0.5.17). La plataforma compartida ya existía por el curso de SQL Server. Hecho: el dialecto PostgreSQL en el motor, la base de ejemplo, los errores por SQLSTATE, las páginas y **el módulo 1 completo (5 lecciones)**, publicado a pedido del autor antes de terminar la versión 1. Sigue: los módulos 2 a 5.

---

## 1. Alcance

### Incluye

- **Curso "Fundamentos de PostgreSQL":** 14 módulos y unas 80 lecciones (sección 7), cada una con 4 a 6 pasos: unos 380 en total. La primera versión publicada trae los módulos 1 a 5 (28 lecciones).
- **Pasos de cuatro tipos:** *lectura* (solo texto), *ejercicio* (SQL que se ejecuta y se revisa), *pregunta* (opción múltiple) y *simulación* (el recorrido paso a paso de dos sesiones, para la concurrencia; sección 4.8).
- **Tres clases de ejercicio:** *consulta* (se revisa el resultado), *cambio* (se revisa cómo quedó una tabla, o el error que debía darse) y *plan* (se revisa el plan de `EXPLAIN`).
- **En cada ejercicio:** editor con resaltado de SQL (dialecto de PostgreSQL), **Ejecutar** (muestra el resultado de cada sentencia, los avisos de `RAISE NOTICE` y los errores), **Enviar** (revisa y marca el paso como resuelto), tres pistas que se abren una a una y solución explicada.
- **Panel "Tablas":** el esquema de la base de ejemplo (tablas, columnas, tipos, llaves) y las primeras filas de cada tabla, siempre a mano.
- **Base de ejemplo propia del curso:** una tienda con clientes, productos, pedidos y empleados, en SQL de PostgreSQL (nombres en `snake_case`), con generadores deterministas para las lecciones de índices.
- **Errores de PostgreSQL explicados** en el idioma de la página, por código SQLSTATE (sección 4.6).
- **Ejemplos del texto verificados en CI:** un bloque ` ```sql ` seguido de otro ` ```text ` con su resultado es una consulta y lo que devuelve (sección 4.7).
- **Progreso local:** el mismo del curso de C# (`PLAN-CURSO.md`, sección 8): pasos resueltos, último código de cada paso y "Continuar donde lo dejaste", con exportar, importar y borrar.
- **Enlaces al resto del sitio:** cada módulo termina con retos del laboratorio que practican lo mismo y, cuando existe, la publicación del blog sobre el tema.
- **Sin JavaScript,** cada lección se lee completa, con la solución dentro de `<details>` y los resultados de los ejemplos como texto.

### No incluye

- Cuentas, sincronizar el avance entre dispositivos, ranking o certificados verificables: necesitan servidor.
- Un servidor de PostgreSQL de verdad. PGlite es una sola conexión, sin red, sin replicación, sin procesos en segundo plano y con un solo usuario de trabajo. Los módulos de concurrencia (11) y administración (14) se enseñan con simuladores pregrabados y lectura, y lo dicen en cada paso.
- Entrada de archivos: `COPY ... FROM STDIN` y los comandos de `psql` (`\dt`, `\d`) no corren. La terminal avisa qué usar en su lugar (el panel Tablas, `information_schema`).
- Extensiones que PGlite no trae (PostGIS, y las demás que no estén en su carpeta `contrib`; la fase 1 revisa si trae `pgvector`).
- Otros dialectos. SQL Server tiene su propio curso (`PLAN-CURSO-SQLSERVER.md`).
- Proyectos con varias bases de datos o conexiones.

---

## 2. Decisiones por confirmar

Cada una trae una opción recomendada.

1. **Dónde vive.**
   - **A (recomendada):** `/curso/postgresql/` y `/en/course/postgresql/`, como `/curso/csharp/`.
   - **B:** dentro del laboratorio. Descartada: el curso ya tiene su sección.
2. **Motor.** **A (recomendada):** PGlite, el de los retos de SQL. Es PostgreSQL de verdad (versión 18.7 hoy), corre en un worker con tiempo límite y no necesita servidor. No hay alternativa realista en un sitio estático.
3. **Versión de PGlite.** **A (recomendada):** quedarse en la 0.5.17 mientras dure la fase 1 y evaluar la 0.6.0 (ya publicada) con las pruebas de los retos antes de subir. Subir de versión cambia planes y mensajes, y todas las pruebas lo detectan.
4. **Base de ejemplo.**
   - **A (recomendada):** propia del curso, en PostgreSQL nativo (`customers`, `categories`, `products`, `orders`, `order_items`, `departments`, `employees`), con datos inventados y la misma historia que los retos (una tienda) para que se sienta parte del mismo sitio.
   - **B:** reutilizar tal cual la base de los retos. Descartada: está escrita en T-SQL (`NVARCHAR`, `IDENTITY`, nombres en PascalCase) y se traduce al correr.
5. **Dialecto.** **A (recomendada):** SQL de PostgreSQL sin la traducción de T-SQL ni las funciones de compatibilidad (`translate.ts` y `compat.ts` son para el curso de SQL Server). El runner gana una opción `dialect` (sección 4.2).
6. **Cómo se revisa un ejercicio.** **A (recomendada):** primero el resultado (o cómo queda la tabla); las reglas sobre el SQL solo cuando lo que se enseña es la construcción misma ("usa `LEFT JOIN`"), y las de plan solo en el módulo de índices. **B:** comparar el texto de la consulta. Descartada: rechaza soluciones válidas.
7. **Concurrencia (módulo 11).**
   - **A (recomendada):** simulador paso a paso con salidas pregrabadas, verificadas contra un PostgreSQL real con un script (sección 4.8).
   - **B:** omitir el módulo. Es de lo más preguntado en entrevistas y vale el esfuerzo.
8. **Primera versión.**
   - **A (recomendada):** módulos 1 a 5 (28 lecciones, hasta los `JOIN`) y el resto por fases.
   - **B:** los 14 módulos antes de publicar.
9. **Relación con SQL Server.** **A (recomendada):** cursos separados; más adelante, cuadros opcionales "En SQL Server..." que enlazan al otro curso (sección 10, opcionales).
10. **Idiomas, progreso, navegación entre pasos y gamificación.** Lo mismo que el curso de C# (`PLAN-CURSO.md`, sección 2, decisiones 6 a 9).
11. **Plataforma compartida primero.** **A (recomendada):** hacer la fase 0 de la sección 4.1 antes de empezar este curso, porque la usan los otros dos. **B:** copiar `labs/course/` para SQL. Descartada: tres copias del curso.

---

## 3. Dónde vive en el sitio

| Página | Español | Inglés |
|---|---|---|
| Índice de cursos | `/curso/` | `/en/course/` |
| Temario de PostgreSQL | `/curso/postgresql/` | `/en/course/postgresql/` |
| Una lección | `/curso/postgresql/<módulo>/<lección>/` | `/en/course/postgresql/<module>/<lesson>/` |

- Cada par de páginas comparte `ref` y los slugs están en el idioma de cada página, como en el curso de C#.
- **Menú, portada e índice:** el submenú de "Cursos" ya trae PostgreSQL como "Próximamente". Al publicarlo pasa a enlazar a su temario (sección 4.1: la lista de cursos con su estado).
- **Layout `course`:** el mismo. Las páginas llevan `course: postgresql` en el front matter y el layout carga el adaptador de su motor (sección 4.1).
- Cada lección se publica cuando está lista; el temario solo enlaza las terminadas y marca las demás como "Próximamente".

---

## 4. Enfoque técnico

### 4.1 Plataforma compartida (la fase 0 de los tres cursos)

Hoy el curso es de C# en muchos lugares. Antes de sumar un segundo motor hay que generalizar, sin cambiar lo que ve el visitante del curso de C#. Esta sección es la referencia de los otros dos planes.

| Pieza | Hoy (solo C#) | Después |
|---|---|---|
| Lista de cursos | `_data/course/soon.yml` trae solo los que vienen; C# está escrito a mano en `_includes/course/index.html`, `_layouts/home.html` y `_includes/header.html` | `_data/course/courses.yml` con todos: `id`, `slug`, `status` (`published` o `soon`), `engine` y título y resumen en los dos idiomas. El menú, la portada y el índice lo recorren. `soon.yml` desaparece, y la prueba que avisa si ya existe la carpeta de un curso "próximo" pasa a leer `courses.yml` |
| Temarios | `_data/course/catalog.yml` solo con `csharp` | Una clave por curso (`csharp`, `postgresql`, `sqlserver`, `angular`) con la misma forma |
| Lecciones | `_data/course/csharp/<módulo>/<lección>.yml` | Igual, en `_data/course/<curso>/`. La prueba de datos recorre todos los cursos |
| Páginas | `scripts/course-pages.mjs` escribe `curso/csharp/` y `en/course/csharp/`; `lesson.html` y `syllabus.html` leen `site.data.course.csharp` | El script recorre los cursos publicados; las páginas llevan `course:` y los includes leen `site.data.course[page.course]` |
| Textos de la interfaz | `_data/course/ui.yml` mezcla lo común (botones, avance, pasos) con lo de C# (entrada, terminal, `programa.cs`, etiquetas de sintaxis) | `ui.yml` con lo común y un `ui-<motor>.yml` por motor (`csharp`, `sql`, `angular`). La página inyecta lo común y lo de su motor |
| Interfaz de la lección | `labs/course/` habla directo con el motor de C# | Un **núcleo** (máquina de pasos, progreso, pie, menú, pistas) y un **adaptador de motor** por curso (sección siguiente) |
| Explicaciones de errores | `_data/course/errors.yml`, con códigos de Roslyn | Uno por motor: `_data/course/<curso>/errors.yml` |
| Progreso | `mi-sitio2.curso.v1` ya guarda por curso (`csharp`) | Sin cambio de formato; exportar e importar recorren todos los cursos |
| Motor y editor | Viven en `labs/challenges/` | Pasan a `labs/shared/`. El plan de C# lo dejó aplazado "hasta que haga falta un tercer consumidor": ya hay tres |
| Presupuestos y CI | `scripts/budget.mjs` y `.github/workflows/sitio.yml` | Una línea de presupuesto por motor y un trabajo de pruebas por curso |

El **adaptador de motor** es la única pieza que cambia entre cursos:

```ts
interface CourseEngine {
  readonly id: 'csharp' | 'sql' | 'angular';
  /** El visitante mostró intención de ejecutar: empieza a descargar y a calentar el motor. */
  warm(): void;
  /** Ejecutar: corre el código del paso y devuelve lo que hay que mostrar. */
  run(step: Step, files: Files, input: Input): Promise<RunReport>;
  /** Enviar: corre las revisiones del paso y dice cuáles pasaron. */
  check(step: Step, files: Files, input: Input): Promise<CheckReport>;
  /** Las piezas propias del motor: entrada, terminal, resultados o vista previa. */
  readonly panels: EnginePanels;
}
```

**Criterio de salida de la fase 0:** el curso de C# se ve y se comporta igual. Pasan las mismas pruebas (Vitest y xUnit) y las páginas generadas solo cambian en el `course:` del front matter.

**Lo que sumó la fase 3 del curso de SQL Server (25 de noviembre de 2026), y este curso hereda:**
- **Estado `preview`** en `courses.yml` (además de `published` y `soon`): el curso tiene temario, lecciones y páginas, pero el menú, la portada y el índice lo muestran como "Próximamente", sin enlace; sus páginas llevan `noindex` y `sitemap: false`. Es la forma de revisar un curso en local y por su dirección antes de publicarlo. `course-pages.mjs` genera las páginas de los cursos publicados y de los que están en vista previa; las de un motor sin adaptador (hoy, todos menos `csharp`) no cargan el JavaScript de la lección.
- **Textos por motor:** `ui-sql.yml` ya existe (el nivel de cada paso, el cuadro "Ojo: diferencias" y la salida capturada, además del cierre de un módulo sin retos: `practice_none`, `practice_playground` y `practice_all`, que pasaron de `ui.yml` a `ui-csharp.yml` y `ui-sql.yml`). Este curso suma sus claves en ese archivo, no en uno nuevo, y las del adaptador (el editor, los resultados, los errores de la base) cuando llegue; las claves de C# que seguían en `ui.yml` (`editor_label`, `loading`, `loading_note`, `timeout`, `engine_error` y `failed`) ya pasaron a `ui-csharp.yml`.
- **Pruebas de datos para todos los cursos:** `scripts/course-lesson-checks.ts` trae lo que vale para la lección y el temario de cualquier curso, y `course-data-sql.test.ts` lo propio de SQL (el curso de PostgreSQL entra en esa prueba al pasar de `soon` a `preview`; su `errors.yml` es por SQLSTATE y hay que sumar su forma a `ERROR_CODE`). `sql-examples.ts` escribe y compara los ejemplos del texto con el formato de `psql` (sección 4.7), y `sqlserver-lessons.test.ts` es la prueba de lecciones en PGlite que este curso puede copiar.
- **Lo esperado de un caso** sin `expected` es lo que devuelve la solución en ese mismo caso: `runCase` ya lo hace con los de resultado (`rows` y `table`), igual que traduce con la `collation` del reto, y el caso de ejemplo (`- sample: true`, sin `tables` ni `generate`) corre con las filas de ejemplo de la base.
- **El adaptador SQL ya existe** (`labs/course/engines/sql.ts`; lo escribió el curso de SQL Server, ver su plan): reutiliza `SqlEngine` y los resultados de los retos, y `main.ts` lo descarga solo en las lecciones de SQL. Este curso le suma la opción `dialect: 'postgresql'` (sin `translate()`), sus revisiones (`uses-keyword`, `error`...) y sus errores por SQLSTATE; el paso capturado, que es del núcleo, lo puede usar si lo necesita.

### 4.2 Qué se reutiliza del laboratorio

| Pieza | Dónde está | Qué se hace |
|---|---|---|
| Base de datos de cada caso | `labs/challenges/sql/pglite.ts` | Se reutiliza: abre PGlite desde una plantilla (el primer `initdb` tarda unos 2 s; las bases siguientes arrancan en unos 250 ms) |
| Runner | `labs/challenges/sql/runner.ts` | Se reutiliza. Corre una sentencia a la vez, como en SSMS: sin `BEGIN`, cada una se confirma sola. Gana la opción `dialect: 'postgresql'`, que se salta `translate()` |
| Comparación de resultados | `labs/challenges/sql/compare.ts` | Se reutiliza tal cual |
| Revisión de planes | `labs/challenges/sql/plan-check.ts` | Se reutiliza (`index`, `index-only`, `semi-join`, `no-subplan`, `no-dedupe`, `max-rows`) y se amplía con reglas de nodo (`WindowAgg`, `Hash Join`...) |
| Datos de un caso | `labs/challenges/sql/data.ts` | Se reutilizan `Rows`, `Dataset`, `Generator`, `insertSql` y la forma de los casos |
| Worker, tiempo límite y carga | `labs/shared/engine.ts` (`WorkerEngine`, 5 s de código, `warm`, `warmOnIntent`) y `labs/challenges/sql/worker.ts` | Se reutilizan; el protocolo suma los mensajes del paso |
| Editor | `labs/shared/editor.ts` (CodeMirror 6 con `lang-sql`) | Se reutiliza con el dialecto de PostgreSQL |
| Resultados y planes en pantalla | `labs/challenges/results.ts` y el visor de planes de `labs/sql/` | Se reutilizan para la tabla de resultados, la diferencia con lo esperado y el plan |
| Máquina de pasos, progreso, pie, menú | `labs/course/` | Es el núcleo de la sección 4.1 |
| Presentación paso a paso | `labs/architecture/stepper.ts` | Modelo para el simulador de sesiones (sección 4.8) |
| Páginas desde datos y presupuesto | `scripts/course-pages.mjs`, `scripts/budget.mjs` | Se amplían a los cursos |

### 4.3 Qué hay que construir

- **Fase 0 compartida** de la sección 4.1.
- **Adaptador SQL** (`labs/course/engines/sql/`): paneles de resultados, de tablas y de mensajes; el editor con el dialecto de PostgreSQL; el protocolo hacia el worker. **Hecho en lo común (25 de noviembre de 2026, por el curso de SQL Server):** `labs/course/engines/sql.ts` trae el panel de resultados, el cuadro de tablas y el autocompletado, con el worker de los retos; faltan los mensajes (`RAISE NOTICE`), `dialect: 'postgresql'` y las revisiones propias de este curso.
- **Base de ejemplo y generadores** (`_data/course/postgresql/dataset.yml`), con la forma de `challenge-datasets.yml` pero en PostgreSQL nativo.
- **Reglas sobre el SQL** por palabras clave (sección 4.5) y las reglas de plan nuevas.
- **Revisión de errores** (`check: error`, por SQLSTATE) y de avisos (`RAISE NOTICE`).
- **Carga de extensiones por paso:** un paso declara `extensions: [pg_trgm]` y el worker carga solo esas (sección 4.9).
- **Simulador de sesiones** y el script que graba sus salidas (sección 4.8).
- **Pruebas de lecciones en Node** (`scripts/postgresql-lessons.test.ts`), con PGlite.

### 4.4 La base de cada paso

- Cada ejecución abre una base **nueva** a partir de la plantilla, crea las tablas del paso (`tables`), inserta los datos del caso, corre el SQL oculto del paso (`setup`) y, por último, el código del visitante. Nada se arrastra de una ejecución a otra.
- **Casos:** el *caso de ejemplo* usa la base del curso, tal cual, y es el que corre **Ejecutar**. **Enviar** corre todos los casos; cada consulta trae al menos uno con datos propios (filas con `NULL`, repetidas, tablas vacías) para que no valga una respuesta escrita a mano.
- **Reloj y zona horaria:** ninguna revisión depende de `now()`. La base arranca con `SET TimeZone = 'UTC'`, y los ejercicios de fechas usan fechas fijas.
- **Intercalación:** PGlite usa la intercalación `C`: ordena todas las mayúsculas antes que las minúsculas y los acentos después de la `z`. La lección de `ORDER BY` lo enseña a propósito, y los datos del curso van en ASCII para que el orden no sorprenda.
- **Límites:** 5 s por ejecución (el worker se termina y se levanta otro), y la tabla muestra como máximo 200 filas con "mostrando 200 de N".

### 4.5 Cómo se revisa un ejercicio

Revisiones de un paso (se combinan; el paso se resuelve cuando pasan todas):

| Revisión | Qué comprueba |
|---|---|
| `check: rows` | El resultado de la última consulta contra el esperado, con `ordered: true` cuando el enunciado pide `ORDER BY` (como los retos). Las columnas cuentan por posición; en los ejercicios de alias, `names` exige además esos nombres (ya existe en `runCase`) |
| `check: table` | Después de correr el código, lo que devuelve `verify`: cómo quedó la tabla tras un `INSERT`, `UPDATE`, `DELETE` o `MERGE` |
| `check: error` | El código debe fallar con ese SQLSTATE (por ejemplo `23505`, valor duplicado en una llave única); es la forma de revisar las restricciones |
| `check: plan` e `index` | El plan de `EXPLAIN (ANALYZE, FORMAT JSON)` cumple las reglas de `plan-check.ts`; en `index` el código crea índices y `query` debe dar lo mismo con el plan nuevo |
| `notices` | Los avisos de `RAISE NOTICE` (PL/pgSQL) son exactamente esos |
| `uses-keyword` y `avoids-keyword` | El código usa o evita una construcción (`WHERE`, `LEFT JOIN`, `OVER`, `WITH RECURSIVE`, `LATERAL`), revisada con los elementos del analizador léxico de SQL de CodeMirror, sin importar mayúsculas ni espacios |
| `uses-function` y `avoids-select-star` | Llama a una función (`COUNT`, `COALESCE`) o evita `SELECT *` |

Primero se revisa el resultado, y las reglas solo cuando el objetivo es la construcción. Cada ejercicio con reglas se prueba con dos o tres soluciones distintas. Los nombres de las reglas necesitan su etiqueta legible en `ui-sql.yml`, en los dos idiomas, como en el curso de C#.

Cuando una revisión falla, el mensaje dice qué se esperaba y qué salió, con la diferencia entre filas resaltada (la de los retos).

### 4.6 Errores de PostgreSQL explicados

PostgreSQL responde en inglés y con un código SQLSTATE. `_data/course/postgresql/errors.yml` guarda, por código, una explicación breve en español y en inglés: `42601` error de sintaxis, `42P01` tabla que no existe, `42703` columna que no existe, `42803` columna fuera del `GROUP BY`, `42883` función que no existe, `42804` tipos que no coinciden, `22P02` texto que no es un número, `22012` división entre cero, `21000` una subconsulta devolvió más de una fila, `23502` `NOT NULL`, `23503` llave foránea, `23505` llave única, `23514` `CHECK`, `25P02` transacción fallida, `40001` serialización, `40P01` interbloqueo. La terminal muestra la línea (PGlite da la posición; `sqlError()` ya la convierte en línea), el mensaje original y la explicación. Cada código nuevo necesita su programa mínimo en una prueba de Vitest que lo ejecuta en PGlite y comprueba que el código es el que de verdad devuelve PostgreSQL.

### 4.7 Ejemplos del texto verificados en CI

Un bloque ` ```sql ` seguido de otro ` ```text ` es una consulta y su resultado, con el formato de `psql` (cabecera, filas y "(3 filas)"). La prueba los corre en PGlite con la base del curso y comprueba que el texto coincide, y que ningún bloque de resultado quede suelto. Un bloque ` ```sql ` sin resultado es un fragmento y no se corre. Es el mismo cuidado que ya tienen los ejemplos del curso de C#.

### 4.8 Concurrencia como simulador

PGlite es una sola conexión: no puede mostrar a dos sesiones peleando por una fila. El módulo 11 usa un paso `simulation`: dos columnas (sesión A y sesión B) con una línea de tiempo y botones **Siguiente** y **Atrás**. Cada instante trae el SQL que corre una sesión y lo que devolvió (filas, errores, esperas), y de vez en cuando una pregunta ("¿qué ve B ahora?") que se contesta antes de ver el resultado.

- Las salidas **se graban** con `scripts/postgres-capture.mjs`, que corre cada escenario contra un PostgreSQL real con dos conexiones (un contenedor de Docker, o una instalación local) y guarda el resultado en el YAML del paso, con la versión del servidor.
- Una prueba comprueba la **forma** del YAML (sesiones, instantes, preguntas) y, si hay un servidor disponible (`PG_CONNECTION`), vuelve a correr los escenarios y compara con lo grabado. Sin servidor, se omite.
- Si la 0.6 de PGlite permite dos sesiones sobre la misma base, el simulador puede correr de verdad y se retira la grabación (la fase 1 lo revisa).

### 4.9 Lo que PGlite sí y no puede (sondeo del 23 de noviembre de 2026)

PGlite 0.5.17, PostgreSQL 18.7 en `wasm32-unknown-emscripten`, intercalación `C`, zona horaria `GMT`.

| Corre | No corre, o no sirve en el navegador |
|---|---|
| `jsonb` y sus operadores, `JSON_TABLE`, rutas SQL/JSON | `COPY ... FROM STDIN` (en el sondeo se quedó esperando datos) y los comandos de `psql` (`\dt`: error de sintaxis). `COPY ... TO STDOUT` sí se ejecuta |
| Funciones de ventana con marcos (`ROWS` probado; `RANGE` y `GROUPS` se prueban en la fase 1) | Varias sesiones a la vez (concurrencia real, bloqueos entre sesiones, interbloqueos) |
| `MERGE` con `merge_action()`, `WHEN NOT MATCHED BY SOURCE` y `RETURNING` | `pg_dump`, `pg_restore`, replicación y copias (no existen en el navegador) |
| `INSERT ... ON CONFLICT` y `RETURNING OLD` / `NEW` (PostgreSQL 18) | `auto_explain` (no se puede cargar) |
| PL/pgSQL: `DO`, funciones, `CALL`, `EXCEPTION`, `RAISE NOTICE`, triggers | Autovacuum y el resto de procesos en segundo plano |
| Particiones, columnas generadas (`STORED` y `VIRTUAL`), `IDENTITY`, `uuidv7()`, restricciones `NOT ENFORCED` | Medir tiempos con rigor: el reloj es el de WebAssembly |
| Texto completo (`to_tsvector('spanish', ...)`), rangos, arreglos, `enum` y dominios, expresiones regulares | |
| `EXPLAIN (ANALYZE, BUFFERS)` en texto y en JSON | |
| Roles, `GRANT` y `SET ROLE`, `SAVEPOINT`, niveles de aislamiento (la sintaxis; sin otra sesión no hay conflicto que ver) | |
| Vistas y vistas materializadas, CTE recursivas, `LATERAL`, `VACUUM (ANALYZE)`, `information_schema`, `pg_stat_user_tables`, `pg_locks` | |
| Casi todas las extensiones de `contrib`: `amcheck`, `bloom`, `btree_gin`, `btree_gist`, `citext`, `cube`, `dict_int`, `dict_xsyn`, `earthdistance`, `file_fdw`, `fuzzystrmatch`, `hstore`, `intarray`, `isn`, `lo`, `ltree`, `moddatetime`, `pageinspect`, `pg_buffercache`, `pg_freespacemap`, `pg_stat_statements`, `pg_surgery`, `pg_trgm`, `pg_visibility`, `pg_walinspect`, `pgcrypto`, `seg`, `tablefunc`, `tcn`, `tsm_system_rows`, `tsm_system_time`, `unaccent`, `uuid-ossp` | |

Notas: `SET statement_timeout` se acepta, pero no se confía en que corte una consulta; el tiempo límite lo pone el worker. Las extensiones se descargan una por una al crearlas (cada una es un `.tar.gz` pequeño), así que el build las publica ya comprimidas en `assets/labs/pglite/contrib/` y cada paso declara las que necesita.

---

## 5. Formato de una lección

Un archivo por lección, con la misma estructura del curso de C# (`shared`, `es` y `en`). Cambian los campos de los ejercicios:

```yaml
# _data/course/postgresql/filtering/where.yml
shared:
  minutes: 12
  steps:
    - id: intro
      kind: read
    - id: lima
      kind: exercise
      mode: query                    # query | change | plan
      tables: [customers]            # lo que muestra el panel Tablas y lo que se crea
      starter: |
        SELECT * FROM customers;
      solution: |
        SELECT name, city FROM customers WHERE city = 'Lima' ORDER BY name;
      check: rows
      ordered: true
      cases:
        - sample: true               # la base del curso, tal cual
        - tables:                    # un caso con datos propios
            customers:
              columns: [id, name, city]
              rows: [[1, Ana, Lima], [2, Luis, null], [3, Bea, Lima]]
      rules:
        - { kind: uses-keyword, name: WHERE }
    - id: duplicate
      kind: exercise
      mode: change
      tables: [customers]
      starter: |
        INSERT INTO customers (id, name, city) VALUES (1, 'Otra', 'Cusco');
      solution: |
        INSERT INTO customers (id, name, city) VALUES (999, 'Otra', 'Cusco');
      check: table
      verify: SELECT count(*) AS total FROM customers
    - id: unique
      kind: exercise
      mode: change
      starter: |
        -- Provoca el error de llave duplicada.
      check: error
      sqlstate: "23505"
    - id: quiz
      kind: choice
      answer: 1
es:
  slug: filtrar-con-where
  title: Filtrar con WHERE
  summary: Quedarte solo con las filas que cumplen una condición.
  steps:
    lima:
      title: Los clientes de Lima
      text: …
      instructions: …
      hints: [ …, …, … ]
      explanation: …
      failure: …
en:
  slug: filtering-with-where
  # …mismos pasos, en inglés
```

- **Pasos de lectura, preguntas y simulaciones** siguen la forma del curso de C#; la simulación trae `sessions` e `instants` (sección 4.8).
- El código de ejemplo no se traduce: tablas, columnas y valores en inglés, pocos comentarios. Se traduce la prosa. Los nombres de la base del curso ya están en inglés para que el SQL se lea igual en los dos idiomas.
- Un `slug` por idioma y por lección; el módulo trae su propio título y resumen en `catalog.yml`.

---

## 6. Dirección visual y experiencia

Los colores, la tipografía y los dos temas salen de `main.css` y `course.css`. La estructura es la del curso de C# (`PLAN-CURSO.md`, sección 6); cambian los paneles de la derecha:

```text
Escritorio (la lección ocupa toda la pantalla)
┌──────────────────────────────────────────────────────────────────────────┐
│ Cursos › PostgreSQL › Filtrar con WHERE   ████████░░░░░░ 40 %   ES · ☼   │
├───────────────────────────────────┬──────────────────────────────────────┤
│ LECCIÓN                           │ consulta.sql              [Tablas ▾] │
│                                   │ ┌──────────────────────────────────┐ │
│ 02. Los clientes de Lima          │ │ 1  SELECT *                      │ │
│                                   │ │ 2  FROM customers;               │ │
│ Texto, con `código` en línea,     │ │ 3                                │ │
│ bloques con botón Copiar y        │ └──────────────────────────────────┘ │
│ cuadros de Nota y Ojo.            │ [?] [?] [?]    [▶ Ejecutar] [Enviar] │
│                                   │ RESULTADO                            │
│ ── Instrucciones ──               │ ┌────┬────────┬──────────┐           │
│ 1. Muestra solo el nombre y la    │ │ id │ name   │ city     │  5 filas  │
│    ciudad de los clientes de      │ ├────┼────────┼──────────┤           │
│    Lima, ordenados por nombre.    │ │ 1  │ Ana    │ Lima     │           │
│                                   │ │ …  │ …      │ …        │           │
│                                   │ └────┴────────┴──────────┘           │
├───────────────────────────────────┴──────────────────────────────────────┤
│ ≡  Filtrar con WHERE · Ejercicio 2/6  ✔ Resuelto      [Atrás] [Siguiente]│
└──────────────────────────────────────────────────────────────────────────┘

Móvil: una sola columna (lección, editor, resultado) y el pie fijo abajo.
```

- **Resultado:** una pestaña por sentencia, con encabezado fijo, `NULL` en gris, el número de filas y el tiempo. Debajo, los avisos y los errores (con línea y explicación). Al fallar **Enviar**, la tabla marca las filas que sobran y las que faltan.
- **Panel Tablas:** una hoja que se abre desde el botón del editor, con cada tabla de `tables`, sus columnas con tipo y llave, y las primeras filas.
- **Plan:** en los pasos de plan, `EXPLAIN` se muestra con el visor de planes del laboratorio, con el nodo que cumple (o incumple) la regla resaltado.
- **Simulación:** dos columnas con una línea de tiempo, instantes que se revelan con **Siguiente**, y la pregunta del instante antes de mostrar el resultado.
- **Carga del motor:** PGlite (unos 5,3 MB) se descarga cuando el visitante muestra intención de ejecutar, con barra de progreso, y queda en la caché del navegador; es el mismo archivo que usa el laboratorio. Las lecciones de lectura no descargan nada.
- **Atajos y accesibilidad:** los del curso de C#. Las tablas de resultados son tablas reales (`<table>`), con encabezados.

---

## 7. Temario

Unas 80 lecciones y unos 380 pasos. La versión 1 son los módulos 1 a 5.

| # | Módulo | Lecciones | Versión 1 |
|---|---|---|---|
| 1 | Leer datos con SELECT | Bases de datos y tablas · Tu primera consulta · Columnas y alias · Expresiones y literales · `DISTINCT`, `LIMIT` y la base de ejemplo | Sí |
| 2 | Filtrar y ordenar | `WHERE` · `AND`, `OR` y `NOT` · `BETWEEN`, `IN` y `LIKE` · `NULL` · `ORDER BY` · `LIMIT`, `OFFSET` y `FETCH` | Sí |
| 3 | Tipos y funciones | Números · Texto · Fechas e intervalos · `CASE`, `COALESCE` y `NULLIF` · Conversión de tipos · Funciones escalares comunes | Sí |
| 4 | Agrupar y resumir | Funciones de agregado · `GROUP BY` · `HAVING` · `FILTER`, `string_agg` y `array_agg` · `ROLLUP`, `CUBE` y `GROUPING SETS` | Sí |
| 5 | Unir tablas | Llaves y relaciones · `INNER JOIN` · `LEFT`, `RIGHT` y `FULL` · Autouniones y `CROSS JOIN` · Varios `JOIN` y `USING` · Semi y anti-joins con `EXISTS` | Sí |
| 6 | Subconsultas y CTE | Subconsultas escalares · `IN` y `EXISTS` · Correlacionadas · `WITH` · `WITH RECURSIVE` · `LATERAL` · `UNION`, `INTERSECT` y `EXCEPT` | No |
| 7 | Funciones de ventana | `OVER` y `PARTITION BY` · Rankings · `LAG` y `LEAD` · Acumulados y marcos · Top-N por grupo | No |
| 8 | Modificar datos | `INSERT` · `UPDATE` · `DELETE` y `TRUNCATE` · `RETURNING` · `ON CONFLICT` · `MERGE` | No |
| 9 | Diseñar tablas | `CREATE TABLE` y tipos · Llaves y restricciones · Identidad y secuencias · `ALTER TABLE` · Esquemas · Normalización | No |
| 10 | Índices y planes | Qué es un índice · `EXPLAIN` · Leer un plan · Compuestos y de cobertura · Parciales y de expresión · GIN, GiST y BRIN · Estadísticas y `ANALYZE` | No |
| 11 | Transacciones y concurrencia (simulador) | Transacciones y ACID · `SAVEPOINT` · MVCC · Niveles de aislamiento · Bloqueos · Interbloqueos | No |
| 12 | Programar en la base | Vistas y vistas materializadas · Funciones SQL · PL/pgSQL · Procedimientos · Triggers · Errores con `EXCEPTION` | No |
| 13 | Tipos de PostgreSQL y extensiones | `jsonb` · Arreglos · Rangos · `enum` y dominios · Texto completo · Extensiones (`pg_trgm`, `unaccent`, `citext`, `hstore`, `ltree`) | No |
| 14 | Administración (lectura) | Roles y permisos · El catálogo · `VACUUM` y mantenimiento · Copias y replicación | No |

Los módulos 1 a 8 y 12 a 13 son de ejercicios. El 9 mezcla ejercicios y lectura. El 10 usa los pasos de plan. El 11 y el 14 son simulaciones y lectura, y lo dicen en cada paso.

---

## 8. Progreso local

El del curso de C# (`PLAN-CURSO.md`, sección 8): una sola clave, `mi-sitio2.curso.v1`, organizada por curso. Para este curso la clave es `postgresql`, con la misma forma. Lo que cambia:

- El código de cada paso es el SQL del editor, con el mismo tope de 20 KB por paso.
- Los pasos de simulación guardan solo el instante al que llegó el visitante.
- Exportar, importar y borrar recorren todos los cursos; al importar, gana el paso más avanzado.

---

## 9. Pruebas y calidad

- `tsc --noEmit` estricto y Prettier, como el resto de `labs/`.
- **Vitest:**
  - **Núcleo y progreso:** los del curso de C#, ahora sobre el adaptador (se prueba con un motor falso).
  - **Adaptador SQL:** paneles de resultados, tablas y mensajes con jsdom; tabla vacía, `NULL`, límite de filas y error con línea.
  - **Datos:** paridad `es`/`en`, ids únicos, slugs únicos por idioma, 1 a 3 pistas por ejercicio, cada ejercicio con solución y al menos una revisión, cada pregunta con una respuesta correcta, sin `{{` ni `{%`, etiquetas de las reglas y que `errors.yml` cubra los códigos que usan los pasos.
  - **Páginas:** `scripts/course-pages.test.ts` revisa que estén al día.
- **Lecciones en Node** (`scripts/postgresql-lessons.test.ts`, con PGlite):
  - **Cada ejercicio:** la solución pasa todos sus casos y reglas, y el código inicial no (salvo los de exploración).
  - **Ejemplos del texto:** cada ` ```sql ` con su ` ```text ` da lo que muestra.
  - **Errores:** cada código de `errors.yml` se produce con su programa mínimo.
  - **Tiempo:** con unos 380 pasos y varios casos cada uno, la prueba se parte por módulo (`vitest --shard`) y corre en su propio trabajo de CI. Cada caso abre una base nueva en unos 250 ms.
- **Simulaciones:** la forma del YAML siempre; la comparación con un PostgreSQL real solo si hay `PG_CONNECTION`.
- **Accesibilidad:** teclado completo, foco visible, contraste AA, movimiento reducido, tablas con encabezados y la versión sin JavaScript.
- **Rendimiento:** CI revisa el presupuesto del adaptador (30 kB comprimidos, como cada demo). PGlite ya tiene su presupuesto de 6 MB y el curso no lo carga hasta que el visitante muestra intención de ejecutar.
- Revisión final en los dos idiomas, tema claro y oscuro, escritorio y móvil.

---

## 10. Fases

Cada fase se trabaja en su rama, entra a `main` con un pull request y termina con algo probado. El mensaje de cada commit sigue el formato del repositorio ("Curso de PostgreSQL, fase N: …").

### Fase 0. Plataforma compartida (la hace el primer curso que empiece)
- [x] Mover el motor y el editor de `labs/challenges/` a `labs/shared/`, sin cambiar comportamiento, con las pruebas de los retos pasando (25 de noviembre de 2026). `WorkerEngine`, `EngineError` y `warmOnIntent` quedan en `labs/shared/engine.ts`; el motor de SQL (`SqlEngine`) sigue en `labs/challenges/engine.ts`.
- [x] `courses.yml` y el menú, la portada y el índice a partir de él; `soon.yml` se retira (25 de noviembre de 2026).
- [x] Datos y páginas por curso (`catalog.yml`, `course-pages.mjs`, includes con `page.course`) (25 de noviembre de 2026).
- [x] Textos de la interfaz por motor y explicaciones de errores por curso (25 de noviembre de 2026).
- [x] Adaptador de motor: el núcleo de `labs/course/` y el adaptador de C# (25 de noviembre de 2026). `labs/course/engine.ts` define `CourseEngine` (`run`, `check`, `warm`, `panels`, el lenguaje del editor y el nombre del archivo); `lesson.ts` es el núcleo y `labs/course/engines/csharp.ts`, el adaptador con la entrada, la terminal y el motor de C#.
- [x] El curso de C# se ve y se comporta igual; pasan las pruebas de Vitest y de xUnit (25 de noviembre de 2026).

**Entregable:** la plataforma admite un segundo motor sin tocar la experiencia de C#.

**Estado (25 de noviembre de 2026):** hechos `courses.yml` (con `id`, `slug`, `name`, `status`, `engine`, `code_lang` y `playground`; el menú, la portada y el índice lo recorren) y los datos y las páginas por curso (`course-pages.mjs` recorre los cursos publicados, las páginas llevan `course:` y los includes leen `page.course`). El HTML generado es el mismo, salvo que el JSON de la interfaz ya no trae `course_title` ni `course_summary` (pasaron a `courses.yml`). También está hecho el movimiento del motor y el editor a `labs/shared/` (`engine.ts`, `editor.ts`, `editor-api.ts`, `gzip.ts` y `csharp-mode.ts`, con `mv` normal, aprobado por el usuario): `WorkerEngine`, `EngineError` y `warmOnIntent` son de `shared/engine.ts` y `SqlEngine` sigue en `challenges/engine.ts`. Los errores de C# ya están en `_data/course/csharp/errors.yml` (con `mv` normal, aprobado por el usuario): los lee `lesson.html` con `page.course`, el TypeScript de las pruebas y las pruebas de xUnit. Los textos de la interfaz se partieron en `ui.yml` (59 claves comunes) y `ui-csharp.yml` (14 del motor: el archivo, la terminal, la entrada, los errores del compilador y las etiquetas de sintaxis): la lección inyecta `ui` y `engineUi` por separado (`ui-<motor>` sale de `engine` en `courses.yml`) y `labs/course/ui.ts` los une, así que el resto del TypeScript sigue leyendo un solo `CourseUi`. **La fase 0 está completa:** el núcleo de la lección (`labs/course/lesson.ts`) ya no sabe nada de C#. Habla con un `CourseEngine` (`labs/course/engine.ts`) y el de C# vive en `labs/course/engines/csharp.ts` (la entrada, la terminal y el motor); el siguiente curso trae el suyo en `engines/`. Las pruebas de la lección pasaron sin cambiar lo que comprueban (solo cambió cómo arman el motor falso), y hay pruebas propias del adaptador.

### Fase 1. Decisiones y prototipo
- [x] Sondeo de PGlite: versión, intercalación, funciones, extensiones y límites (sección 4.9).
- [x] Confirmar las decisiones de la sección 2.
- [ ] Evaluar PGlite 0.6.0 con las pruebas de los retos; decidir si se sube.
- [ ] Revisar qué extensiones externas trae PGlite (`pgvector`) y si permite dos sesiones sobre la misma base.
- [x] Prototipo del paso `query` con el runner en el adaptador; medir el tiempo por ejecución con el motor ya cargado. (Hecho el paso; el tiempo no se midió.)
- [x] Escribir a mano la lección piloto "Tu primera consulta" en español e inglés.

**Entregable:** decisiones aprobadas y un paso de consulta que corre en una página del curso.

### Fase 2. Datos y páginas
- [x] La base de ejemplo del curso (`dataset.yml`) y sus generadores deterministas. (Los generadores llegan con el módulo de índices.)
- [x] Esquema de lección y de módulo, `ui-sql.yml` y un `errors.yml` inicial por SQLSTATE.
- [x] El curso en `courses.yml` y su temario en `catalog.yml`, todavía como "Próximamente".
- [x] Pruebas de datos: paridad, ids, slugs, revisiones y Liquid.
- [x] La lección piloto en el repositorio.

**Entregable:** las páginas existen y se leen sin JavaScript; los datos se validan en CI.

### Fase 3. Motor del curso
- [ ] Opción `dialect` en el runner y carga de extensiones por paso. (La opción `dialect` ya está; falta cargar extensiones.)
- [ ] Revisiones nuevas: `table`, `error` (SQLSTATE), `notices`, reglas por palabras clave y reglas de nodo en el plan.
- [x] Traducción de errores de PostgreSQL a `errors.yml`.
- [x] `scripts/postgresql-lessons.test.ts` con soluciones, códigos iniciales, ejemplos del texto y errores.

**Entregable:** una prueba en Node revisa cada lección del curso con PGlite.

### Fase 4. Página de la lección
- [ ] Adaptador SQL: editor, paneles de resultados, tablas y mensajes, atajos. (Resultados, tablas y editor ya están en `labs/course/engines/sql.ts`; faltan los mensajes y el dialecto.)
- [x] Panel Tablas con el esquema y las primeras filas.
- [ ] Visor de planes en los pasos de plan.
- [x] Móvil, temas claro y oscuro, `aria-live` y foco.
- [x] Presupuesto de tamaño y pruebas de interfaz con jsdom.

**Entregable:** la lección piloto funciona completa en español e inglés.

### Fase 5. Contenido: módulos 1 a 5 (versión 1)
- [ ] Las 28 lecciones de los módulos 1 a 5, en español e inglés, revisadas en el navegador.
- [ ] Mini-proyecto del módulo 5: un informe de ventas armado por etapas.
- [ ] Retos del laboratorio al cierre de cada módulo.
- [ ] README: cómo agregar una lección de SQL y cómo correr sus pruebas.
- [x] Publicar: quitar PostgreSQL de "próximos" y enlazar su temario. (Con el módulo 1.)

**Entregable:** el curso, con los módulos 1 a 5, publicado.

### Fase 6. Contenido: módulos 6 a 10
- [ ] Subconsultas y CTE, ventanas, modificar datos, diseñar tablas e índices y planes (31 lecciones).
- [ ] Mini-proyecto del módulo 10: acelerar una consulta lenta.

**Entregable:** los módulos 6 a 10 publicados.

### Fase 7. Contenido: módulos 11 a 14
- [ ] `scripts/postgres-capture.mjs`, el paso `simulation` y su prueba.
- [ ] Transacciones y concurrencia, programar en la base, tipos de PostgreSQL y administración (22 lecciones).
- [ ] Mini-proyecto final.

**Entregable:** el temario completo publicado.

### Fase 8. Cierre
- [ ] Revisión de accesibilidad y rendimiento.
- [ ] Revisión en español e inglés, tema claro y oscuro, escritorio y móvil.
- [ ] Probar una lección con alguien que no sepa SQL y ajustar lo que se atore.
- [ ] Revisar las lecciones contra la versión de PostgreSQL de PGlite.
- [ ] README completo y revisión del sitio publicado.

**Entregable:** el curso publicado y documentado.

### Opcionales
- [ ] Cuadros "En SQL Server..." que enlacen al otro curso, con las diferencias más comunes.
- [ ] Racha de días e insignias locales; certificado descargable sin validez verificable.
- [ ] Funcionar sin conexión después de la primera visita, con un service worker que guarde PGlite.
- [ ] Botón "Abrir en el playground" con el SQL del paso.
- [ ] Extensiones externas (`pgvector`) si PGlite las trae.
- [ ] Pruebas de extremo a extremo con Playwright y revisión automática con axe (el mismo opcional de los otros planes).

---

## 11. Criterios de aceptación

1. El curso funciona en español e inglés, en tema claro y oscuro, y en escritorio y móvil.
2. Sin JavaScript, cada lección se lee completa.
3. En cada ejercicio, **Ejecutar** muestra el resultado de cada sentencia; **Enviar** lo revisa y marca el paso; las pistas y la solución están disponibles; un error de PostgreSQL sale con su línea y su explicación.
4. Una consulta que no termina se detiene a los 5 segundos sin colgar la página. PGlite se descarga solo cuando el visitante muestra intención de ejecutar.
5. En CI: la solución de cada ejercicio pasa; su código inicial no pasa; los ejemplos del texto dan el resultado que muestran; cada código de `errors.yml` se produce; y cada texto existe en español e inglés.
6. El curso de C# sigue igual: sus pruebas pasan y sus páginas no cambian.
7. El progreso recuerda los pasos resueltos, el SQL y la última lección; funciona sin `localStorage`; se puede exportar, importar y borrar.
8. Los módulos de concurrencia y administración dicen en cada paso que son simulaciones o lectura, y sus salidas se pueden volver a grabar con un script.
9. El adaptador cabe en su presupuesto de 30 kB comprimidos, y las páginas fuera del curso no cargan nada nuevo.
10. El contenido es propio: ningún texto, ejercicio, imagen ni marca copiados de otra plataforma o de la documentación de PostgreSQL.

---

## 12. Riesgos

| Riesgo | Cómo se mitiga |
|---|---|
| PGlite no es un servidor completo (una conexión, sin replicación ni procesos en segundo plano) | La sección 4.9 lo enumera; los módulos 11 y 14 son simulaciones y lectura, y cada paso lo dice; no se promete nada que PGlite no haga |
| Subir de versión de PGlite o de PostgreSQL cambia planes y mensajes | Las reglas de plan miran tipos de nodo y no costos; se fija la versión, se sube con las pruebas de los retos y del curso, y se revisa cada noviembre |
| Un plan depende de las estadísticas y de los datos | Generadores deterministas, `ANALYZE` antes de revisar y reglas sobre el tipo de nodo; ninguna revisión compara costos ni tiempos |
| La concurrencia no se puede ejecutar de verdad | Simulador con salidas grabadas de un PostgreSQL real, con script, versión del servidor y prueba de forma; si PGlite 0.6 permite dos sesiones, se ejecuta de verdad |
| Mucho contenido en dos idiomas (unos 380 pasos) | Publicar primero los módulos 1 a 5, escribir por módulo, una plantilla de lección, la prueba de paridad y la verificación automática de los ejemplos |
| Las pruebas de lecciones tardan en CI | Un trabajo propio, partido por módulo con `--shard`; cada caso abre una base nueva en unos 250 ms |
| Una revisión por palabras clave rechaza una solución válida | Se revisa primero el resultado, las reglas solo cuando el objetivo es la construcción, y se prueban con soluciones alternativas |
| La intercalación `C` sorprende (mayúsculas antes que minúsculas, acentos después de la `z`) | Datos en ASCII, una lección que lo explica y `COLLATE` en los ejercicios de orden |
| El visitante escribe una consulta enorme (`generate_series` de miles de millones) | Tiempo límite de 5 s en el worker, que se termina y se levanta de nuevo; la tabla solo pinta 200 filas |
| Los mensajes de PostgreSQL están en inglés y asustan | `errors.yml` los explica por SQLSTATE en el idioma de la página y la terminal conserva el mensaje original |
| Hacer la plataforma compartida rompe el curso de C# | Es la fase 0, con las pruebas de C# pasando antes de seguir, y sin cambios visibles |
| El progreso se pierde al limpiar los datos del navegador | Exportar e importar, un aviso visible y poco volumen guardado |
| Un `{{` o `{%` en una lección rompe el build de Jekyll | La prueba de datos los busca en el texto y en el código |
| Parecerse a otra plataforma o copiar la documentación | Solo se toma el patrón de dos paneles; textos, ejercicios y datos propios; la documentación de PostgreSQL se enlaza, no se copia |

---

## 13. Fuentes

- Documentación de PostgreSQL: <https://www.postgresql.org/docs/current/>
- Referencia de comandos SQL: <https://www.postgresql.org/docs/current/sql-commands.html>
- PL/pgSQL: <https://www.postgresql.org/docs/current/plpgsql.html>
- `EXPLAIN` y cómo leer un plan: <https://www.postgresql.org/docs/current/using-explain.html>
- Control de concurrencia (MVCC): <https://www.postgresql.org/docs/current/mvcc.html>
- Códigos de error (SQLSTATE): <https://www.postgresql.org/docs/current/errcodes-appendix.html>
- Módulos adicionales (`contrib`): <https://www.postgresql.org/docs/current/contrib.html>
- PGlite, PostgreSQL en WebAssembly: <https://pglite.dev/> y <https://github.com/electric-sql/pglite>
- Analizador léxico de SQL de CodeMirror: <https://github.com/codemirror/lang-sql>
- Web Workers: <https://developer.mozilla.org/docs/Web/API/Web_Workers_API>
