# Sitio personal de Rafael León

Sitio en español e inglés hecho con [Jekyll](https://jekyllrb.com/) y publicado en GitHub Pages:
<https://rafaelleontorres.github.io/mi-sitio2/>

Qué hay: el portafolio, el blog, el laboratorio (simuladores y retos de C# y SQL que corren en el navegador), el curso interactivo de C#, el CV y las cartas en PDF.

## Dónde se edita cada cosa

| Quiero cambiar… | Archivo |
|---|---|
| Textos de la interfaz, "Sobre mí", botones y títulos de sección (ES y EN) | `_data/ui.yml` |
| Experiencia laboral | `_data/experience.yml` |
| Habilidades | `_data/skills.yml` |
| Formación y cursos | `_data/education.yml` |
| Proyectos del portafolio | `_data/projects.yml` |
| La sección Entrevista (por ahora solo avisa "Próximamente"): sus textos, su diseño y sus páginas | `_data/ui.yml` (`interview`), `_layouts/interview.html`, `entrevista/` y `en/interview/` |
| Correo, redes y rutas de los CV | `_data/profile.yml` |
| El bloque de código del inicio | `_includes/record-es.html` y `_includes/record-en.html` |
| Estilos (colores, tipografía, tema oscuro) | `assets/css/main.css` |
| Menú móvil, tema, botón "Copiar" | `assets/js/main.js` |
| CV en español e inglés | `latex/es/` y `latex/en/` (mismos nombres de archivo en los dos idiomas) |
| Cartas de presentación | `latex/carta-es.tex` y `latex/carta-en.tex` |
| Diseño del CV y de las cartas | `latex/yaac-rl.cls` |
| Demos del laboratorio (TypeScript) | `labs/` (cada demo en `labs/<demo>/main.ts`) |
| Compilación del laboratorio y su presupuesto de tamaño | `scripts/build-labs.mjs` y `scripts/budget.mjs` |
| Plan del laboratorio | `PLAN.md` |
| Plan del curso interactivo de C# | `PLAN-CURSO.md` |
| Planes de los cursos de PostgreSQL, SQL Server y Angular (por construir) | `PLAN-CURSO-POSTGRESQL.md`, `PLAN-CURSO-SQLSERVER.md` y `PLAN-CURSO-ANGULAR.md` |
| Textos del laboratorio: índice y piezas compartidas (ES y EN) | `_data/labs/ui.yml` |
| Arquitecturas del simulador: piezas, conexiones, recorrido y textos (ES y EN) | `_data/labs/architecture/` (un archivo por arquitectura) |
| Código de ejemplo de cada pieza de una arquitectura | `_includes/labs/code/architecture/` |
| Comparativa de las arquitecturas | `_data/labs/architecture_comparison.yml` |
| API REST del simulador: catálogo, operaciones, mensajes y textos de la consola (ES y EN) | `_data/labs/rest-api.yml` |
| Código C# de la API: cada endpoint, el pipeline y el modelo | `_includes/labs/code/rest-api/` |
| Laboratorio SQL: escenarios, controles, notas de "Por qué cambia" y textos de la interfaz (ES y EN) | `_data/labs/sql.yml` |
| SQL inicial de cada escenario y el código de EF Core | `_includes/labs/code/sql/` |
| Retos de C# y de SQL: enunciado, casos, pistas, solución y explicación (ES y EN) | `_data/labs/challenges/` (un archivo por reto) |
| Motor de los retos de C# (Roslyn en .NET para WebAssembly), su arnés y sus pruebas | `dotnet/challenges/`: `Core`, `Engine` y `Tests` |
| Tablas que comparten los retos y los generadores de filas | `_data/labs/challenge-datasets.yml` |
| Textos de los retos (catálogo, editor, resultados, playgrounds, modo entrevista y mensajes del motor de C#, ES y EN) y el orden del catálogo | `_data/labs/challenge-ui.yml` |
| Páginas de cada reto (las genera `npm run pages`) | `scripts/challenge-pages.mjs`, que escribe en `laboratorio/retos/` y `en/lab/challenges/` |
| Estilos del laboratorio | `assets/css/labs.css` |
| Curso: temario de cada curso (módulos, lecciones y las que vienen en `planned`, ES y EN) | `_data/course/catalog.yml` (una clave por curso: `csharp`, `sqlserver`) |
| Curso: el cierre de cada módulo (retos del laboratorio y publicaciones del blog sobre el tema) | `practice` de cada módulo en `_data/course/catalog.yml` y `_includes/course/practice.html` |
| Curso: una lección con sus pasos, código, revisiones y textos (ES y EN) | `_data/course/<curso>/<módulo>/<lección>.yml` (`csharp/`, `sqlserver/`) |
| Curso: textos de la interfaz (los comunes y los de cada motor, ES y EN) y explicaciones de errores | `_data/course/ui.yml`, `_data/course/ui-<motor>.yml` (`ui-csharp.yml`: la terminal, la entrada y las etiquetas de sintaxis; `ui-sql.yml`: el nivel de cada paso y las salidas capturadas) y `_data/course/<curso>/errors.yml` (`csharp/errors.yml`, por código del compilador; `sqlserver/errors.yml`, por número de error) |
| Curso: páginas de cada lección (las genera `npm run pages:course`) | `scripts/course-pages.mjs`, que escribe en `curso/<curso>/` y `en/course/<curso>/` por cada curso publicado o en vista previa de `courses.yml` |
| La lista de cursos: los publicados, los que están en vista previa y los que salen como "Próximamente" (el menú, la portada y el índice la recorren) | `_data/course/courses.yml` |
| Curso: el índice de cursos, el temario y la página de una lección | `_includes/course/` y `_layouts/course.html` |
| Curso: estilos y TypeScript de la lección, del temario y del avance (exportar, importar y borrar) | `assets/css/course.css` (y `results.css` en los cursos de SQL) y `labs/course/` (el núcleo de la lección; en `labs/course/engines/`, un adaptador por motor: `csharp.ts` y `sql.ts`) |
| Curso de SQL Server: las capturas de los pasos capturados y la verificación de soluciones y ejemplos contra un SQL Server de verdad | `scripts/sqlserver-capture.mjs`, `scripts/sqlserver-client.mjs`, `scripts/sqlserver-lessons.test.ts` y el ejecutor `dotnet/sqlserver/Runner` (necesitan `MSSQL_CONNECTION`) |

Cada entrada de los archivos de `_data` tiene una parte `es` y otra `en`. Si cambias tu experiencia, actualiza también el CV en `latex/` para que digan lo mismo.

## Cómo agregar una publicación

1. Crea `_posts/es/AAAA-MM-DD-slug.md` y `_posts/en/AAAA-MM-DD-slug.md`.
2. Usa el mismo `ref` en ambos para que el botón de idioma enlace una versión con la otra.
3. Front matter de ejemplo:

```yaml
---
title: "Título del post"
description: "Resumen de una o dos líneas."
lang: es            # en para la versión en inglés
locale: es_MX       # en_US para la versión en inglés
ref: mi-post        # igual en ambas versiones
date: 2026-11-16 10:00:00 -0600
permalink: /blog/mi-post/      # /en/blog/my-post/ en inglés
tags: [C#, .NET]
repo: https://github.com/RafaelLeonTorres/mi-repo   # opcional: agrega el botón "Código en GitHub"
---
```

Escribe el contenido en Markdown. Los bloques de código con ```` ```csharp ```` se resaltan solos y los genéricos (`List<T>`) se muestran correctamente. Evita escribir `{{` o `{%` fuera de un bloque `{% raw %}`, porque Jekyll los interpreta como Liquid.

Las imágenes van en `assets/img/blog/<slug>/`, en WebP. En el post se ponen dentro de un `<figure>` con su `<figcaption>`, con `width` y `height` para que la página no salte al cargar, y con la ruta en `relative_url` para que incluya el `baseurl`:

```html
<figure>
  <img src="{{ '/assets/img/blog/mi-post/captura.webp' | relative_url }}" alt="Qué muestra la imagen" width="780" height="440" loading="lazy">
  <figcaption>Pie de la imagen.</figcaption>
</figure>
```

## Proyectos

Cada proyecto en `_data/projects.yml` aparece como "Próximamente". Cuando uno esté listo, agrega:

```yaml
  url: https://github.com/RafaelLeonTorres/nombre-del-repo
  status: done
```

Si el proyecto tiene un artículo, agrega también `post` con el `ref` del post (por ejemplo, `post: como-funciona-mediateca`): el título lleva al artículo, en el idioma de la página, y aparece "Código" con el enlace al repositorio. En el artículo, `repo` en el front matter agrega el botón "Código en GitHub".

## Ver el sitio en tu computadora

### Dependencias (una sola vez)

1. **Ruby 3.3 con DevKit.** En Windows, en PowerShell:

   ```powershell
   winget install RubyInstallerTeam.RubyWithDevKit.3.3
   ```

   Cierra y vuelve a abrir la terminal (o VS Code) para que reconozca `ruby`.
2. **Bundler y las gemas del sitio**, desde la carpeta del repositorio:

   ```powershell
   gem install bundler
   bundle install
   ```

   `bundle install` instala Jekyll y los mismos plugins que usa GitHub Pages (están en el `Gemfile`). En Linux o macOS instala Ruby 3.x con tu gestor de paquetes y ejecuta los mismos dos comandos.

### Levantar el sitio

Desde la carpeta del repositorio:

```powershell
bundle exec jekyll serve --livereload
```

- Ábrelo en <http://localhost:4000/mi-sitio2/>. Jekyll usa el **puerto 4000** y la ruta `/mi-sitio2/` sale de `baseurl` en `_config.yml`.
- Con `--livereload` el navegador se recarga solo cada vez que guardas un archivo; para eso usa también el puerto 35729.
- Si el puerto 4000 está ocupado: `bundle exec jekyll serve --livereload --port 4001`.
- Los cambios en `_config.yml` necesitan reiniciar el servidor. Para detenerlo, `Ctrl+C`.
- En VS Code también puedes usar *Terminal → Ejecutar tarea… → Sitio: levantar en http://localhost:4000/mi-sitio2/*.

## Laboratorio (demos interactivas)

Las demos del laboratorio están en TypeScript, en `labs/`. esbuild las compila a `assets/js/labs/` y el build copia a `assets/labs/pglite/` el motor de los retos de SQL (PGlite, comprimido con gzip). El motor de los retos de C# es un proyecto de .NET 11 para WebAssembly, con Roslyn, en `dotnet/challenges/`; `npm run csharp` lo publica en `assets/labs/csharp/`. Ninguna de esas carpetas se sube a git: en GitHub las genera el workflow antes de construir el sitio. El plan completo está en `PLAN.md`.

### Dependencias (una sola vez)

1. **Node.js 24 o más nuevo** (el workflow usa el 24). En Windows, en PowerShell:

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

2. **Las dependencias del laboratorio**, desde la carpeta del repositorio:

   ```powershell
   npm install
   ```

   La primera vez crea `package-lock.json`, que sí se sube a git: fija las versiones exactas que instala el workflow con `npm ci`.

3. **El SDK de .NET 11**, para el motor y las pruebas de los retos de C#:

   ```powershell
   winget install Microsoft.DotNet.SDK.11
   ```

### Trabajar en local

Levanta Jekyll como en la sección anterior y, en otra terminal:

```powershell
npm run dev
```

Recompila las demos cada vez que guardas; Jekyll ve el cambio y recarga la página. En VS Code, la tarea *Sitio y laboratorio* abre las dos terminales.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Compila las demos al guardar |
| `npm run build` | Compila como para publicar, copia PGlite y revisa los presupuestos comprimidos: 30 kB por demo, 200 kB el editor de los retos, 250 kB su worker y 6 MB PGlite |
| `npm run pages` | Genera las páginas de los retos a partir de `_data/labs/challenges/`; hace falta al agregar, renombrar o quitar un reto |
| `npm run pages:course` | Genera las páginas de las lecciones del curso a partir de `_data/course/`; hace falta al agregar, renombrar o quitar una lección |
| `npm run csharp` | Publica el motor de C# en `assets/labs/csharp/` (unos 9 MB en gzip) y revisa su presupuesto de 10 MB; `npm run csharp -- --copy` solo vuelve a copiar la última publicación |
| `dotnet test dotnet/challenges/Tests` | Prueba el arnés de C#, cada reto y cada ejercicio del curso: la solución pasa sus casos y sus reglas, y el código inicial no las pasa |
| `npm test` | Corre las pruebas (Vitest); `npm run test:watch` las repite al guardar |
| `npm run check` | Revisa los tipos (TypeScript) y el formato (Prettier) |
| `npm run format` | Corrige el formato con Prettier (solo en `labs/`, `scripts/` y la configuración) |

`npm test` también revisa que cada texto de `_data/labs/` exista en español y en inglés (`scripts/content-parity.test.ts`), que cada arquitectura cuadre: piezas, conexiones, recorrido y código de ejemplo (`scripts/architecture-data.test.ts`), que la API REST cuadre con su simulación: operaciones, ejemplos de cuerpo, catálogo y código (`scripts/rest-api-data.test.ts`), que el laboratorio SQL cuadre con su modelo: escenarios, notas, controles, el SQL inicial y el código de EF Core (`labs/sql/data.test.ts`), que cada reto cuadre: categoría, tablas o método que se llama, casos, reglas, textos y que Jekyll lea su YAML igual que las pruebas (`scripts/challenges-data.test.ts`), que las páginas de los retos estén al día con sus datos (`scripts/challenge-pages.test.ts`), que cada solución de SQL pase sus casos en PGlite (`scripts/challenge-solutions.test.ts`, que tarda cerca de un minuto), que Liquid pueda leer las plantillas del laboratorio, como lo hace Jekyll (`scripts/liquid-templates.test.ts`), que cada lección del curso cuadre: textos en los dos idiomas, pasos, ejecuciones, reglas y pistas (`scripts/course-data.test.ts`), que las páginas de las lecciones estén al día con sus datos (`scripts/course-pages.test.ts`), que la interfaz del curso funcione, con jsdom: la lección, el temario, el avance, los pasos y la terminal (`labs/course/`), y que el menú y la sección Entrevista cuadren (`scripts/site-pages.test.ts`).

### Agregar un reto de SQL

1. Copia un reto de la misma categoría en `_data/labs/challenges/` y ponle de nombre el id del nuevo, en inglés (`<id>.yml`).
2. En `shared` van las tablas que usa, la forma de revisarlo (`check`), el código inicial, la solución y los casos; en `es` y `en`, el `slug` de su página, el enunciado, tres pistas y la explicación. Las tablas compartidas están en `_data/labs/challenge-datasets.yml`.
3. Agrega el id a su categoría en `shared.catalog` de `_data/labs/challenge-ui.yml`.
4. `npm run pages` crea sus dos páginas.
5. `npm test` revisa los datos, que las páginas estén al día y que la solución pase sus casos.

### Agregar un reto de C#

1. Copia un reto de C# de la misma categoría en `_data/labs/challenges/` y ponle de nombre el id del nuevo, en inglés (`<id>.yml`).
2. En `shared` van `language: csharp`, la categoría, la dificultad, el método que se llama (`entry`: el tipo y el método), el código inicial, la solución y los casos, cada uno con sus argumentos (`args`) y el resultado (`expected`) o la excepción que debe lanzar (`throws`). Si hace falta, `prelude` trae tipos que el visitante usa sin escribirlos, `harness` trae el código que llama al suyo (por ejemplo, para revisar cómo quedó un arreglo o correr una lista de órdenes), `compare: unordered` acepta los elementos en cualquier orden y `rules` revisa el código (`uses-type`, `avoids-type` o `private-constructor`, con su `name` para la página). En `es` y `en` van el `slug` de su página, el enunciado, tres pistas y la explicación.
3. Los textos y los ejemplos son propios: nada copiado de sitios de problemas. Los números enteros de más de 2^53 no llegan exactos al navegador: devuélvelos como texto desde el arnés.
4. Agrega el id a su categoría en `shared.catalog` de `_data/labs/challenge-ui.yml` y corre `npm run pages`.
5. `npm test` revisa los datos y las páginas, y `dotnet test dotnet/challenges/Tests` revisa que la solución pase sus casos y sus reglas y que el código inicial compile sin pasarlos.

## Curso de C# (lecciones interactivas)

El curso "Fundamentos de C#" tiene 12 módulos y unas 70 lecciones, en español e inglés. Cada ejercicio se compila y corre en el navegador del visitante con el mismo motor de C# que los retos (Roslyn en WebAssembly), así que el sitio sigue siendo estático: sin servidor ni cuentas. El plan y el estado están en `PLAN-CURSO.md`.

- **Datos:** el temario es `_data/course/catalog.yml` y cada lección, un archivo en `_data/course/csharp/<módulo>/`. Los textos de la interfaz y las explicaciones de los errores del compilador están en `_data/course/ui.yml` (lo común), `_data/course/ui-csharp.yml` (lo del motor) y `_data/course/<curso>/errors.yml` (el de C#, `csharp/errors.yml`).
- **Páginas:** `npm run pages:course` genera una página por lección y por idioma en `curso/csharp/` y `en/course/csharp/`; no se editan a mano. Sin JavaScript, cada lección se lee completa, con la solución dentro de `<details>`.
- **Interfaz:** con JavaScript (`labs/course/`), un paso a la vez, con el editor, las pistas y la terminal.
- **Motor:** el de los retos. Para correr ejercicios en local, publícalo una vez con `npm run csharp` y compila el TypeScript con `npm run build` (o `npm run dev`, como en la sección anterior).
- **Avance:** se guarda en el navegador (`localStorage`, clave `mi-sitio2.curso.v1`): los pasos resueltos, el código de cada paso y la última lección. En el temario se puede exportar a un archivo JSON, importar (se mezcla con lo que ya hay y gana el paso más avanzado) y borrar.

### Agregar una lección del curso de C#

1. Crea `_data/course/csharp/<módulo>/<lección>.yml` (el id de la lección en inglés) copiando una existente, y agrégala a `lessons` de su módulo en `_data/course/catalog.yml`; si estaba en `planned`, quita su título de ahí.
2. En `shared` van `minutes` y `steps`. Cada paso trae su `id` y su `kind`: `read` (solo texto), `exercise` o `choice`. Un ejercicio lleva `starter`, `solution`, las ejecuciones que se revisan (`runs`: `stdin` con las líneas que leerá `Console.ReadLine()`, y `stdout`, `contains`, `matches` o `throws` con lo esperado) y las `rules` sobre el código (`uses-syntax`, `avoids-syntax`, `declares-variable`, `calls-method`, `uses-type` o `avoids-type`, con `name` o `type` y un `min` opcional). Una pregunta lleva `answer`, el número de la opción correcta contando desde 0.
3. En `es` y `en` van el `slug` de su página, el título, el resumen y, por cada paso, sus textos: `title` y `text` en todos; `instructions`, de 1 a 3 `hints`, `explanation` y `failure` (la frase que sale cuando Enviar falla) en los ejercicios; `question`, `options` y `explanation` en las preguntas. Si el código inicial lleva un comentario, ponlo en el `starter` de cada idioma. Las salidas esperadas van entre comillas, porque YAML lee `5` como número. No escribas `{{` ni `{%`: Jekyll los leería como Liquid, y una cadena con `: ` (dos puntos y espacio) va entre comillas, porque YAML la tomaría por una clave.
   - **Ejemplos del texto:** un bloque ` ```csharp ` seguido de otro ` ```text ` es un programa y lo que imprime; si el programa lee, entre los dos va un bloque ` ```input ` con la entrada. `dotnet test` corre cada uno y comprueba que la salida sea la que muestra el texto. Un bloque ` ```csharp ` sin salida es solo un fragmento y no se corre.
   - **Reglas de sintaxis:** `uses-syntax` y `avoids-syntax` llevan un nombre de `SyntaxKind` de Roslyn (`ForStatement`, `ConstKeyword`, `SingleLineCommentTrivia`: nodos, palabras y comentarios). Cada nombre que uses necesita su etiqueta en `syntax` de `_data/course/ui-csharp.yml`, en los dos idiomas, para que el mensaje diga "la palabra const" y no `ConstKeyword`. Varios nombres separados por `|` son alternativas y se suman (`PostIncrementExpression|PreIncrementExpression` cuenta `i++` y `++i`, para no rechazar una solución válida); la etiqueta de la combinación usa esa misma cadena como clave, entre comillas en el YAML.
   - **Errores:** si un paso puede producir un error del compilador o una excepción que `_data/course/csharp/errors.yml` todavía no explica, agrégalo ahí y agrega su programa mínimo en `dotnet/challenges/Tests/ErrorExplanationTests.cs`.
   - **Cierre de módulo:** `practice` de cada módulo en `_data/course/catalog.yml` lista los retos de C# del laboratorio que practican lo mismo (`challenges`, con el id de `_data/labs/challenges/`, de lo fácil a lo difícil y cada reto en un solo módulo) y las publicaciones del blog sobre el tema (`posts`, con su `ref`). Salen en el temario, debajo de las lecciones del módulo, y al final de su última lección (`_includes/course/practice.html`). Un módulo sin retos remite al playground de C#; `npm test` revisa que los retos y las publicaciones existan.
4. `npm run pages:course` crea sus dos páginas.
5. `npm test` revisa los datos y que las páginas estén al día, y `dotnet test dotnet/challenges/Tests` revisa que la solución de cada ejercicio pase y que su código inicial no resuelva nada.

El plan y el estado del curso están en `PLAN-CURSO.md`; su sección 7 trae la guía de estilo de las lecciones (de tú, una idea por paso, un ejemplo antes de la definición y máximo 7 pasos).

## Curso de SQL Server (en vista previa)

El curso "Fundamentos de SQL Server" tiene su temario de 14 módulos y, por ahora, los módulos 1 y 2 completos (diez lecciones) y la lección piloto de `TRY...CATCH` del módulo 11, en español e inglés. Todavía sale como "Próximamente" en el menú, la portada y el índice de cursos: está en `status: preview` en `_data/course/courses.yml`, es decir, sus páginas existen pero el sitio no las enlaza ni las anuncia (llevan `noindex` y quedan fuera del mapa del sitio). Para verlo en local, levanta el sitio como en "Ver el sitio en tu computadora" y abre `/curso/sql-server/` (o `/en/course/sql-server/`); para que corran los ejercicios hace falta compilar el TypeScript (`npm run build`, que también publica PGlite, como en el laboratorio). Sin JavaScript sus lecciones se leen completas; con JavaScript, los ejercicios corren en el navegador con el mismo motor que los retos de SQL (`labs/course/engines/sql.ts`), y los pasos capturados se contestan y se revelan paso a paso. El plan y el estado están en `PLAN-CURSO-SQLSERVER.md`.

Cada paso dice dónde corre su código: **ejecutable** (T-SQL traducido a PostgreSQL, en el navegador) o **capturado** (la salida pregrabada de un SQL Server real, con su versión y fecha, para lo que ninguna traducción puede correr, como `TRY...CATCH`).

- **Datos:** el temario es `sqlserver` en `_data/course/catalog.yml`, y cada lección, un archivo en `_data/course/sqlserver/<módulo>/`. Las explicaciones de los errores, por número (`"8134"`), están en `_data/course/sqlserver/errors.yml`, y los textos propios de los cursos de SQL, en `_data/course/ui-sql.yml`. La base de ejemplo es la de los retos de SQL (`_data/labs/challenge-datasets.yml`).
- **Páginas:** `npm run pages:course` genera las de las lecciones. Un paso muestra su nivel con una insignia, un ejercicio ejecutable puede traer el cuadro plegado "Ojo: diferencias" y un paso capturado trae el código, la pregunta de predicción y, en un `<details>`, la salida grabada (`_includes/course/captured.html`).
- **Cómo se revisa un ejercicio:** Ejecutar corre el código en el caso de ejemplo y enseña lo que devolvió (la tabla, el error con su renglón o lo que no se puede traducir); Enviar lo corre en todos los casos y los compara con lo que devuelve la solución en cada uno. El caso de ejemplo (`- sample: true`, sin `tables`) usa las filas de ejemplo de la base de ejemplo; el código se traduce de T-SQL a PostgreSQL con `collation: ci` (las columnas de texto no distinguen mayúsculas y, al ordenar, los `NULL` van primero con `ASC`, como en SQL Server). Los resultados se dibujan como en los retos (`labs/challenges/results.ts` y `assets/css/results.css`, una copia del CSS de los resultados que `scripts/results-css.test.ts` mantiene igual a la de `labs.css`).
- **Pruebas:** `npm test` revisa la forma de los datos (`scripts/course-data-sql.test.ts`), corre las lecciones en PGlite (`scripts/sqlserver-lessons.test.ts`: la solución de cada ejercicio pasa todos sus casos con datos de verdad, el código inicial no, y cada ejemplo del texto da el resultado que muestra) y prueba el adaptador (`labs/course/engines/sql.test.ts`, también con PGlite) y el paso capturado en el núcleo (`labs/course/captured.test.ts`).
- **Verificar contra un SQL Server de verdad:** las soluciones, los ejemplos del texto y las capturas se pueden comprobar en un SQL Server (2022) con un comando. Hace falta `dotnet` y la cadena de conexión en `MSSQL_CONNECTION`; con el SQL Server local y la autenticación de Windows:

  ```powershell
  $env:MSSQL_CONNECTION = "Server=localhost;Integrated Security=true;TrustServerCertificate=true"
  npm run sqlserver:check
  npm test
  ```

  Con la variable puesta, `npm test` corre además cada solución en cada caso en SQL Server (en una base temporal con la intercalación `SQL_Latin1_General_CP1_CI_AS`, que crea y borra; nunca toca otra) y la compara con lo que da PGlite, y revisa que cada ejemplo del texto sea exacto. Sin la variable, esas pruebas se omiten. `npm run sqlserver:capture` graba las salidas de los pasos capturados en las lecciones. Un contenedor (`mcr.microsoft.com/mssql/server:2022-latest`, que pide aceptar su licencia) sirve igual, con `User Id` y `Password` en la cadena, y es lo que usa CI: `.github/workflows/sqlserver.yml` lo levanta, espera a que acepte conexiones (`npm run sqlserver:wait`) y corre `npm run sqlserver:check` y las pruebas de las lecciones. Ese flujo es aparte de "Sitio": solo corre cuando cambia algo del curso de SQL Server (o a mano, en Actions → SQL Server → Run workflow) y no decide la publicación. Acepta el contrato de licencia de SQL Server (`ACCEPT_EULA=Y`, edición Developer) por pedido de quien mantiene el repositorio. El ejecutor está en `dotnet/sqlserver/Runner` (usa SqlClient, el cliente de SSMS, por eso entra con la autenticación de Windows).

### Agregar una lección del curso de SQL Server

1. Crea `_data/course/sqlserver/<módulo>/<lección>.yml` (los ids, en inglés) copiando una existente (`first-steps/first-query.yml` es ejecutable y `programmable-tsql/try-catch.yml`, capturada) y agrégala a `lessons` de su módulo en `catalog.yml`; quita su título de `planned`.
2. Un **ejercicio** lleva `level` (`executable` o `concept`), `mode` (`query`, `change` o `plan`), `tables` (de la base de ejemplo), `starter`, `solution`, `check` (`rows` o `table`, con su `verify`) y `cases`: el caso de ejemplo (`sample: true`) y al menos uno con datos propios (`tables:` con sus filas; las columnas obligatorias que falten toman el valor de `defaults` en `challenge-datasets.yml`). Sin `expected`, lo esperado de un caso es lo que devuelve la solución en ese mismo caso. Con `ordered: true` cuenta el orden de las filas (el enunciado pide un `ORDER BY`), y `names: [PriceWithTax]` exige esos nombres de columna, sin distinguir mayúsculas, para los ejercicios de alias; sin `names`, las columnas cuentan por posición. Los textos de cada idioma llevan lo mismo que en C#, y `differences` si el motor del navegador hace algo distinto de SQL Server.
3. Un **paso capturado** (en la lección se contesta la predicción y **Ver salida** revela lo grabado; verla sin acertar lo deja en "visto") lleva `script`, `predict: {answer}` (la pregunta, las opciones y la explicación van en cada idioma) y `captured: {server, date, batches}`. `date` va entre comillas. Cada lote trae sus `results` (`columns` y `rows`) y sus `messages`: un `PRINT` es `{text}` y un error, `{number, level, state, line, text}`; cada error necesita su explicación en `errors.yml`. Las capturas no se escriben a mano: `npm run sqlserver:capture` corre el `script` en un SQL Server real y escribe el `captured` del paso (y `npm run sqlserver:check` los vuelve a correr y compara, sin escribir); ver "Verificar contra un SQL Server de verdad". Un script capturado tiene que dar siempre lo mismo: sin `GETDATE()` ni `NEWID()`.
4. **Ejemplos del texto:** un bloque ` ```sql ` seguido de otro ` ```text ` es una consulta y su resultado, con el formato de `psql` (cabecera centrada, números a la derecha, `NULL` para un dato que falta y `(6 filas)` o `(6 rows)` al final); `npm test` los corre en PGlite y los compara. Los encabezados se escriben como los mostraría SQL Server (`Name`) y la prueba no distingue mayúsculas en ellos.
5. `npm run pages:course` crea sus páginas y `npm test` revisa los datos.

## CV y cartas de presentación (LaTeX)

Los PDF que se descargan desde el sitio se generan a partir de `latex/`:

```text
latex/
├── cv-es.tex, cv-en.tex          CV en español e inglés
├── carta-es.tex, carta-en.tex    cartas de presentación
├── es/, en/                      secciones del CV (los mismos archivos en los dos idiomas)
├── yaac-rl.cls                   plantilla: versión modificada de YAAC (Another Awesome CV)
├── fonts/, foto.jpg              fuente Source Sans Pro y foto (cuadrada; se recorta en círculo)
├── compilar.ps1, compilar.sh     compilan y copian los PDF al sitio
├── build/                        archivos de compilación (no se suben a git)
└── privado/                      referencias y respaldo de los proyectos originales (no se suben)
```

### Dependencias para compilar

- **MiKTeX** (Windows). En PowerShell:

  ```powershell
  winget install MiKTeX.MiKTeX
  ```

  Abre una terminal nueva y activa la instalación automática de paquetes, para que MiKTeX no pregunte por cada uno:

  ```powershell
  initexmf --set-config-value=[MPM]AutoInstall=1
  ```

  La primera compilación tarda unos minutos porque MiKTeX descarga los paquetes que faltan (`fontawesome`, `tcolorbox`, `babel`, etc.); las siguientes tardan segundos. Si MiKTeX avisa que nunca has buscado actualizaciones, abre *MiKTeX Console* y busca actualizaciones una vez.
- En Linux o macOS: TeX Live completo (o MacTeX).
- Opcional: la extensión **LaTeX Workshop** de VS Code para editar con vista previa. VS Code la sugiere al abrir el repositorio (`.vscode/extensions.json`).

No necesitas Perl ni `latexmk`: los scripts llaman a XeLaTeX directamente.

### Recompilar los PDF

Desde la carpeta del repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File .\latex\compilar.ps1
```

Compila los cuatro documentos y copia cada PDF a la raíz del repositorio, con el nombre que usa el sitio (así no se rompe ningún enlace):

| Documento | PDF que publica el sitio |
|---|---|
| `latex/cv-es.tex` | `Rafael_Leon_Resume_ES.pdf` |
| `latex/cv-en.tex` | `Rafael_Leon_Resume_EN.pdf` |
| `latex/carta-es.tex` | `Rafael_Leon_Carta_Presentacion_ES.pdf` |
| `latex/carta-en.tex` | `Rafael_Leon_Carta_Presentacion_EN.pdf` |

Otras formas:

- Solo algunos documentos: `powershell -ExecutionPolicy Bypass -File .\latex\compilar.ps1 -Documentos cv-es,carta-es`
- En VS Code: `Ctrl+Shift+B` ejecuta la tarea *LaTeX: compilar CV y cartas*.
- En Linux o macOS: `./latex/compilar.sh` (o `./latex/compilar.sh cv-es`).

Después haz commit de los `.tex` y de los PDF de la raíz: GitHub Pages publica los PDF tal como están en el repositorio.

### Editar con vista previa en VS Code

Con LaTeX Workshop instalado, abre cualquier archivo de `latex/` y guarda: se compila ese documento, el PDF se abre en una pestaña al lado (`Ctrl+Alt+V` si no aparece) y se copia a la ruta del sitio. `Ctrl+clic` sobre el PDF te lleva a la línea del código. La configuración está en `.vscode/settings.json`.

### Personalizar una carta

Al inicio de `carta-es.tex` o `carta-en.tex`:

```latex
\empresa{Contoso}
\puesto{Desarrollador .NET Senior}
```

Si los dejas vacíos, la carta es genérica. Si escribes una empresa o un puesto, el script deja ese PDF en `latex/privado/` y no toca la versión genérica que publica el sitio.

### Referencias (versión privada)

El CV público dice "Referencias disponibles a solicitud". Los datos de contacto de tus referencias están en `latex/privado/referencias-es.tex` y `referencias-en.tex`, que no se suben a git. Para generar los CV con referencias:

```powershell
powershell -ExecutionPolicy Bypass -File .\latex\compilar.ps1 -ConReferencias
```

Quedan en `latex/privado/` como `Rafael_Leon_Resume_ES_con_referencias.pdf` y `..._EN_con_referencias.pdf`.

## Validación y publicación

- Cada pull request y cada push a `main` corren el workflow `Sitio` (`.github/workflows/sitio.yml`): revisa los tipos y el formato, corre las pruebas (el laboratorio y el curso), prueba con .NET los retos de C# y cada ejercicio del curso, publica el motor de C#, compila el laboratorio y construye el sitio con el mismo motor de GitHub Pages.
- En los pull requests también compila los cuatro documentos LaTeX con TeX Live. Los PDF compilados quedan como artefacto `cv-y-cartas` en la ejecución del workflow.
- Al mezclar a `main`, el mismo workflow publica el sitio, solo si todo lo anterior pasó. Para eso, en *Settings → Pages → Build and deployment*, *Source* debe ser **GitHub Actions**. Para volver a publicar directo desde la rama, cambia *Source* a *Deploy from a branch* (`main`, `/ (root)`).
- Las direcciones antiguas (`post1.html`, `Post2.html`, etc.) redirigen a las publicaciones nuevas.
