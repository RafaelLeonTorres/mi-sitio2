# Plan: laboratorio interactivo del sitio

Tres demos para usar en el navegador que muestran cómo trabajo el backend: un **simulador de arquitecturas de software**, un **simulador de API REST** y un **laboratorio de rendimiento SQL**. GitHub Pages solo sirve archivos estáticos, así que todo corre en el navegador con TypeScript: las respuestas, los planes de ejecución y los tiempos son simulados, y cada demo lo dice en pantalla.

Dónde vive cada cosa:

- **Este plan:** `PLAN.md` en la raíz del repositorio del sitio. Jekyll no lo publica (está en `exclude` de `_config.yml`).
- **Código:** `F:\Respaldo\Respaldo\Cursos\MiSitio2`, junto al resto del sitio.
- **Repositorio:** <https://github.com/RafaelLeonTorres/mi-sitio2>
- **Sitio publicado:** <https://rafaelleontorres.github.io/mi-sitio2/>

---

## 1. Alcance

### Incluye

- Una sección **Laboratorio** con un índice y una página por demo, en español e inglés.
- **Arquitecturas:** monolítica, por capas, Clean Architecture, microservicios y CQRS con RabbitMQ como diagramas interactivos. Cada componente muestra su responsabilidad, tecnologías, ventajas, desventajas y un ejemplo de C#, y una petición de ejemplo recorre el diagrama paso a paso.
- **API REST:** una consola de prueba con los cinco endpoints de productos y uno para pedir un token. Se editan parámetros y cuerpo, se envía la petición y se ve la respuesta JSON. Muestra JWT, validaciones, códigos HTTP, DTOs, middleware y manejo de errores.
- **Rendimiento SQL:** dos consultas lado a lado con su plan de ejecución, tiempo, lecturas, filas examinadas e índice usado, en seis escenarios: SARGabilidad, índices, N+1, JOIN y subconsultas, paginación y `AsNoTracking`.
- Las tres demos comparten un dominio ficticio, una tienda en línea con productos, clientes y pedidos, para que se lean como un conjunto.

### No incluye

- Backend, base de datos o cuentas reales.
- Guardar datos entre visitas: la API simulada vuelve a su estado inicial al recargar la página.
- Otros motores de base de datos. PostgreSQL queda como extensión.

---

## 2. Decisiones

**Confirmadas el 18 de noviembre de 2026** con las opciones recomendadas: integrar primero el rediseño y trabajar con una rama y un PR por fase, publicar con GitHub Actions (opción A), TypeScript sin framework, el orden arquitecturas → API → SQL y solo SQL Server. Los extras opcionales quedan para después.

1. **Integrar primero el rediseño en `main`.** Hoy `main` (`2a1c42c`) tiene el sitio anterior; el rediseño (`rediseno-jekyll-2026`) y los CV en LaTeX (`cv-carta-latex`) siguen en sus ramas, y `_data/projects.yml` tiene un cambio sin commit. Recomiendo integrarlos antes de empezar y trabajar cada fase en su propia rama con pull request. De paso se practica el pendiente de ramas y PR de Mediateca.
2. **Cómo se compila y publica el TypeScript.**
   - **A (recomendada):** un workflow de GitHub Actions compila, corre las pruebas, construye Jekyll con la misma acción que usa GitHub Pages y publica. Si algo falla, no se publica. Requiere cambiar una sola vez *Settings → Pages → Build and deployment → Source* a **GitHub Actions**.
   - **B:** versionar los `.js` compilados en `assets/js/labs/` y dejar que Pages siga publicando desde la rama. No cambia la configuración, pero el código generado vive en git y hay que acordarse de compilar antes de cada commit. La CI del PR lo detectaría, pero un push directo a `main` publicaría un `.js` viejo.
3. **TypeScript sin framework (recomendado).** Bundles pequeños, cero dependencias en el navegador y el mismo espíritu que `main.js`. La alternativa es una librería ligera, como Lit o Preact, si prefieres plantillas declarativas.
4. **Orden de las demos.** El de tu mensaje: arquitecturas, API y SQL. La alternativa es empezar por la API, que tiene menos texto y valida antes la base técnica.
5. **Solo SQL Server (T-SQL) en la primera versión.** Tus ejemplos ya son T-SQL (`YEAR()`, `'20260101'`).
6. **Extras opcionales.** Calibrar el modelo SQL con un SQL Server real, compilar los ejemplos de C# en CI y pruebas de extremo a extremo con Playwright y axe. Cada uno se puede dejar para después (ver "Opcionales" en la sección 10).

---

## 3. Dónde vive en el sitio

| Página | Español | Inglés |
|---|---|---|
| Índice | `/laboratorio/` | `/en/lab/` |
| Arquitecturas | `/laboratorio/arquitecturas/` | `/en/lab/architectures/` |
| API REST | `/laboratorio/api-rest/` | `/en/lab/rest-api/` |
| Rendimiento SQL | `/laboratorio/sql/` | `/en/lab/sql/` |

- Cada par de páginas comparte `ref`, como el resto del sitio, para que el botón de idioma las enlace.
- **Menú** (`_data/ui.yml`): "Laboratorio" / "Lab" entre Proyectos y Publicaciones, con `page:`.
- **Portada:** una sección corta después de Proyectos. Presenta cada demo por la pregunta que responde (por ejemplo, "¿por qué `YEAR(OrderDate)` lee varias veces más páginas que un rango de fechas?") y enlaza a ella. No carga el JavaScript de las demos.
- **Layout `lab`** (hereda de `default`): agrega `labs.css`, el bundle de la página como `<script type="module">` y los datos de la demo en un `<script type="application/json">`.
- **Cada página:** qué muestra la demo en dos o tres líneas, la demo, "Cómo funciona esta simulación" y un enlace a su código en GitHub.
- Cada demo se publica en cuanto está lista; el índice solo enlaza las terminadas.

---

## 4. Enfoque técnico

### Compilación y despliegue (opción A)

```text
push o PR → npm ci → tsc --noEmit → vitest run → esbuild (assets/js/labs/*.js)
          → jekyll-build-pages → upload-pages-artifact → deploy-pages (solo en main)
```

- Un solo workflow, `sitio.yml`, reemplaza a `validar-jekyll.yml`. En un PR compila y prueba sin publicar; en `main` además publica. Usa `jekyll-build-pages@v1`, `upload-pages-artifact@v4` y `deploy-pages@v4`, con el entorno `github-pages` y los permisos `pages: write` e `id-token: write` solo en el trabajo que publica. `configure-pages` no hace falta, porque `_config.yml` ya fija `url` y `baseurl`.
- La compilación de los CV y las cartas con LaTeX pasa al mismo workflow y corre en los pull requests.
- `jekyll-build-pages` construye con las mismas versiones que el gem `github-pages`, así que Jekyll se comporta igual que hoy.
- `assets/js/labs/` va al `.gitignore`: lo genera el workflow.
- Como `.github/workflows` está protegido para mí, te dejo el workflow en `Claude outputs/` para que lo muevas, igual que la tarea de VS Code.
- Para volver atrás, basta con regresar *Source* a la rama.
- En local: `bundle exec jekyll serve --livereload` en una terminal y `npm run dev` (esbuild en modo watch) en otra. Una tarea nueva de VS Code levanta las dos.

### TypeScript

- `strict`, módulos ES y cero dependencias en el navegador. TypeScript 7 (el compilador nativo) revisa los tipos, esbuild compila y Vitest prueba.
- Dependencias de desarrollo: `typescript`, `esbuild`, `vitest`, `prettier` (con el estilo de Mediateca: printWidth 100 y comillas simples) y `@types/node`. `jsdom` y `yaml` llegan en la fase 1, con las primeras pruebas de interfaz y la de paridad.
- Un bundle por demo (`architecture.js`, `rest-api.js` y `sql.js`) y el código compartido en un chunk aparte. `scripts/build-labs.mjs` compila cada `labs/<demo>/main.ts` y, con el metafile de esbuild, revisa el presupuesto de 30 kB comprimidos por demo (`scripts/budget.mjs`): la demo más los chunks que importa al cargar, sin contar lo que se carga con `import()`.
- La lógica (modelos y simuladores) es pura y no toca el DOM, así que se prueba sin navegador. Todo lo simulado es determinista o usa una semilla fija, para que las pruebas den siempre lo mismo.
- La interfaz usa un helper `h()` mínimo y custom elements que se montan sobre el HTML que ya generó Jekyll.

### Contenido en datos, comportamiento en TypeScript

- **Lo que se lee** vive en `_data/labs/`, con una parte `es` y otra `en` como en `projects.yml`, y en `_includes/labs/`. Ahí los ejemplos de C# son archivos `.cs` que Rouge resalta al construir.
- **Lo que se calcula** (respuestas, planes y métricas) vive en TypeScript.
- Jekyll publica todo el contenido como HTML normal. Sin JavaScript, cada página se lee como un documento completo, y los buscadores la indexan. El panel de cada componente reutiliza ese HTML; el TypeScript solo lo muestra.
- El JSON incrustado lleva solo la estructura (nodos, conexiones, pasos) y las etiquetas cortas de la interfaz. Así el TypeScript no tiene textos fijos ni hace peticiones.
- El código C# no se traduce: identificadores en inglés y pocos comentarios. Se traduce la prosa.
- Los nombres de los operadores de SQL Server (Index Seek, Key Lookup…) quedan en inglés en los dos idiomas, como aparecen en la documentación.
- Una prueba revisa que los ejemplos de C# no tengan `{{` ni `{%`, porque Jekyll los interpretaría como Liquid (la misma advertencia que hace el README para las publicaciones).

### Estructura

```text
labs/                       código TypeScript (Jekyll no lo publica)
├── shared/                 format.ts (ya está), dom.ts, i18n.ts, highlight.ts (JSON y SQL), code-tabs.ts, bars.ts, live.ts
├── architecture/           model.ts, layout.ts, diagram.ts, flow.ts, main.ts
├── rest-api/               store.ts, endpoints.ts, pipeline/, jwt.ts, problem.ts, ui/, main.ts
└── sql/                    schema.ts, cost.ts, operators.ts, scenarios/, plan-view.ts, main.ts
                            (cada módulo con su *.test.ts al lado)
scripts/                    build-labs.mjs (compila con esbuild) y budget.mjs (presupuesto de tamaño)
_data/labs/                 ui.yml, architecture/*.yml, rest-api.yml, sql.yml
_includes/labs/             parciales HTML y csharp/**/*.cs
_layouts/lab.html
laboratorio/                páginas en español
en/lab/                     páginas en inglés
assets/css/labs.css         estilos del laboratorio (solo en sus páginas)
assets/js/labs/             salida de esbuild (no se versiona)
package.json, package-lock.json, tsconfig.json, tsconfig.node.json, vitest.config.ts,
.prettierrc.json, .prettierignore
```

`_config.yml` excluye del sitio `PLAN.md`, `labs`, `scripts`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.node.json`, `vitest.config.ts` y `Claude outputs`.

### Kit compartido

Pestañas de código con botón de copiar (reutiliza el de `main.js` si se puede), resaltado de JSON y SQL, control segmentado, deslizador con su valor visible, barras comparativas en SVG, una región `aria-live` que anuncia los resultados, y números y duraciones con `Intl.NumberFormat` según el idioma (es-MX o en-US).

---

## 5. Dirección visual

Las demos usan los tokens del sitio: Atkinson Hyperlegible Next y Mono, el acento `#512bd4` (`#a794ff` en oscuro) y los temas claro y oscuro. De las tres referencias se toma la estructura, no la marca:

| Referencia | Qué se toma | Qué no |
|---|---|---|
| Grafo de servicios oscuro | Nodos conectados con un panel lateral de detalles; el camino activo se ilumina | El lienzo siempre oscuro y el brillo por todas partes. En tema claro el diagrama usa líneas nítidas; el brillo solo aparece en tema oscuro y solo en el camino activo |
| Swagger Editor | Lista de operaciones con el método en color, candado en las que piden token y prueba en línea | Nombre, logo, barra superior y su distribución exacta |
| pganalyze, comparar planes | Planes A y B lado a lado, métricas por nodo, panel de resumen y nodos caros o mejorados resaltados | Nombre, logo, colores y tipografía |

**Colores.** Los métodos HTTP y los estados salen de la paleta de resaltado de código que el sitio ya tiene, para que el laboratorio se vea de la casa. Solo se agrega un rojo:

| Uso | Token | Claro | Oscuro |
|---|---|---|---|
| GET, información | `--tok-t` | `#0e6b84` | `#6fd0e8` |
| POST, éxito, mejora | `--ok` | `#0f7b5f` | `#5fd3a9` |
| PUT, advertencia | `--tok-n` | `#a85400` | `#ffb46b` |
| DELETE, error, operador caro | `--bad` (nuevo) | `#b3261e` | `#ff8a80` |
| Selección y camino activo | `--accent` | `#512bd4` | `#a794ff` |

Todos pasan AA (4.5:1) como texto sobre el fondo y como fondo de una etiqueta (con texto blanco en claro y con el color de fondo del sitio en oscuro).

**Movimiento.** Un solo momento animado por demo, siempre como respuesta a un clic: la petición que recorre el diagrama, la que atraviesa el pipeline de la API y las dos consultas que corren a la vez. Con `prefers-reduced-motion` se muestra el resultado paso a paso, sin animación.

### Bocetos

Arquitecturas (en móvil, el panel queda debajo del diagrama):

```text
( Monolítica | Por capas | Clean Architecture | Microservicios | CQRS + RabbitMQ )

Diagrama                                                      Panel del componente
                                                              ────────────────────
[Cliente] ──▶ [API Gateway] ──▶ [Pedidos] ──▶ [BD Pedidos]    Pedidos
                    │               │                         Responsabilidad
                    ▼               ▼                         Tecnologías
               [Identidad]     [RabbitMQ] ──▶ [Pagos]         Ventajas
                                                              Desventajas
[ Simular POST /api/orders ]   ◀  paso 3 de 7  ▶              Ejemplo de C#

Paso 3: Pedidos guarda la orden y publica OrderPlaced en RabbitMQ.
Debajo: comparativa de las cinco arquitecturas.
```

API REST:

```text
Token   Rol ( Lector | Editor | Admin )   [ Obtener token ]   eyJhbGciOiJIUzI1NiIs…   [ Ver ]  [ Vencer ]

Autenticación
  POST    /api/auth/token                       Obtener un token de demostración
Productos
  GET     /api/products                         Listar productos
  GET     /api/products/{id}                    Obtener un producto
  POST    /api/products               candado   Crear un producto
▾ PUT     /api/products/{id}          candado   Actualizar un producto
  │ id [ 1 ]    Cuerpo { "name": "", "price": 0 }    [x] Usar token    [ Enviar ]
  │
  │ 400 Bad Request    38 ms
  │ ( Cuerpo | Encabezados | Recorrido | Registro | curl | C# )
  │ Excepciones ✓ → Registro ✓ → Autenticación ✓ → Autorización ✓ → Límite ✓ → Validación ✗ 400
  DELETE  /api/products/{id}          candado   Eliminar un producto
```

Rendimiento SQL:

```text
( SARGabilidad | Índices | N+1 | JOIN y subconsultas | Paginación | AsNoTracking )
Filas en Orders [ 1,000,000 ▾ ]   Caché ( caliente | fría )   Rango ( año | mes | día )
Columnas ( Id, OrderDate, Total | * )   Índice IX_Orders_OrderDate (OrderDate) INCLUDE (Total) [x]

[ Ejecutar las dos ]
A  ████████████████████████████████████████
B  █████

Consulta A                               Consulta B
SELECT Id, OrderDate, Total              SELECT Id, OrderDate, Total
FROM Orders                              FROM Orders
WHERE YEAR(OrderDate) = 2026;            WHERE OrderDate >= '20260101'
                                           AND OrderDate <  '20270101';

Plan                                     Plan
Index Scan (IX_Orders_OrderDate)         Index Seek (IX_Orders_OrderDate)
  Predicate: YEAR(OrderDate) = 2026        Seek Predicate: rango de 2026
  revisa todas las filas                   lee solo las filas de 2026

Resumen: tiempo, lecturas lógicas, filas examinadas, índice usado y cuántas veces mejor sale B
Por qué cambia: YEAR() envuelve la columna, así que el índice no sirve para buscar…
```

---

## 6. Simulador de arquitecturas

### Qué hace

- Selector de arquitectura. La elección queda en la URL (`#clean`) para poder compartirla.
- **Diagrama:** los nodos son botones HTML sobre una cuadrícula y las conexiones son una capa SVG que se recalcula al cambiar el tamaño. En pantallas angostas los nodos se apilan por capas.
- **Panel:** un clic o Enter sobre un nodo muestra su **responsabilidad, tecnologías, ventajas, desventajas y ejemplo de C#**. Sin un nodo seleccionado, resume la arquitectura: cuándo conviene y cuándo no.
- **Simular petición:** `POST /api/orders` recorre los nodos con una explicación por paso; se avanza con botones o se reproduce sola. En CQRS se ve la consistencia eventual: el comando responde y la proyección actualiza la base de lectura un momento después.
- **Teclado:** Tab entre nodos, flechas para seguir las conexiones y Esc para cerrar el panel. Cada paso se anuncia en `aria-live`.
- **Comparativa:** al final, una tabla de las cinco arquitecturas por complejidad inicial, despliegue, escalabilidad, consistencia de datos, tamaño de equipo y costo de operación, con valores cualitativos y su porqué.

### Componentes propuestos

| Arquitectura | Componentes | Lo que enseña el flujo |
|---|---|---|
| Monolítica | Cliente, aplicación ASP.NET Core (catálogo, pedidos y clientes como módulos de un solo despliegue) y base de datos | Todo pasa en un proceso y una transacción: es simple de operar, pero se escala completo |
| Por capas | Presentación (controladores), negocio (servicios), acceso a datos (repositorios con EF Core) y base de datos | Cada capa llama solo a la de abajo, así que el negocio depende del acceso a datos |
| Clean Architecture | API (Minimal APIs y registro de dependencias), aplicación (casos de uso, puertos, DTOs y validación), dominio (entidades, objetos de valor y eventos), infraestructura (EF Core y servicios externos) y base de datos | Las dependencias apuntan al dominio, e infraestructura implementa los puertos de aplicación |
| Microservicios | Cliente, API Gateway (YARP), identidad, catálogo, pedidos, pagos, bus de mensajes, una base por servicio y observabilidad (OpenTelemetry) | El gateway valida el token y enruta; pedidos consulta a catálogo, guarda y publica un evento que consume pagos |
| CQRS + RabbitMQ | API, comandos y sus handlers, modelo de escritura (SQL Server), outbox, RabbitMQ (exchange y colas), consumidor que proyecta, modelo de lectura, y consultas y sus handlers | Escritura y lectura van por separado; el evento sale por el outbox y la lectura se actualiza después |

### Notas de contenido

- Son unos 30 componentes. Cada uno lleva su responsabilidad en dos o tres frases, una lista corta de tecnologías, dos o tres ventajas, dos o tres desventajas y un ejemplo de C# de 10 a 25 líneas.
- Clean Architecture se dibuja en columnas, con las flechas de dependencia hacia el dominio, para que junto a la de capas se vea que la flecha entre negocio y datos se invierte. Los anillos clásicos pueden ser una vista alternativa más adelante.
- CQRS incluye el patrón **outbox**: sin él, guardar en la base y publicar el mensaje no son atómicos, que es el error más común al empezar con mensajería.
- Los ejemplos de CQRS usan handlers propios y `RabbitMQ.Client`. Una nota con fecha explica que MediatR (desde la v13, julio de 2025) y MassTransit (v9, 2026) pasaron a licencia comercial, que MassTransit v8 sigue siendo de código abierto y qué alternativas hay.
- Cuando Mediateca sea pública, Clean Architecture puede enlazarla como ejemplo real de esa organización (`Api`, `Core` e `Infrastructure`).

---

## 7. Simulador de API REST

### Endpoints

| Operación | Token | Respuestas que se pueden provocar |
|---|---|---|
| `POST /api/auth/token` | No | 200 con un JWT del rol elegido |
| `GET /api/products?page=&pageSize=&search=` | No | 200 con la página y sus metadatos; 400 si `pageSize` pasa de 50 |
| `GET /api/products/{id}` | No | 200; 404 |
| `POST /api/products` | Editor o Admin | 201 con `Location`; 400; 401; 403; 409 si el SKU ya existe |
| `PUT /api/products/{id}` | Editor o Admin | 204; 400; 401; 403; 404; 409 |
| `DELETE /api/products/{id}` | Admin | 204; 401; 403; 404 |

Además, en cualquier operación: 429 con `Retry-After` si se envían más de 10 peticiones en 10 segundos, y 500 si se activa **Simular falla del servidor**.

### Token (JWT)

- No hay contraseña: el visitante elige un rol (Lector, Editor o Admin) y pide un token de demostración. Así la demo no invita a escribir contraseñas en un formulario de juguete.
- El token es un JWT de verdad, con encabezado, contenido y firma HMAC-SHA256 hecha con Web Crypto, y vence en 5 minutos. Se puede ver decodificado, vencer con un botón o editar: si cambias el rol a mano, la firma deja de coincidir y la respuesta es 401 con `WWW-Authenticate: Bearer error="invalid_token"`.
- La página aclara que la llave está en el navegador solo porque es una simulación. En un sistema real, el token lo emite el servidor o un proveedor de identidad.

### Middleware

La petición pasa por un pipeline como el de ASP.NET Core. El orden exacto se toma de la documentación de Microsoft al implementarlo:

```text
manejo de excepciones → registro con correlation id → autenticación (JWT) → autorización (roles)
→ límite de peticiones → validación → endpoint → servicio → repositorio en memoria
```

- **Recorrido:** la respuesta muestra cada paso con ✓, o el punto donde se cortó la petición (por ejemplo, autorización → 403), con un tiempo simulado por paso.
- **Registro:** las líneas que dejaría la petición, al estilo de `ILogger`, con el mismo id que el encabezado `X-Correlation-Id`.

### Errores, validación y DTOs

- Todos los errores son Problem Details (`application/problem+json`, RFC 9457) con `type`, `title`, `status`, `detail`, `instance` y `traceId`. La validación agrega `errors` por campo, como `ValidationProblem` de ASP.NET Core.
- Reglas: `name` obligatorio (de 3 a 100 caracteres), `price` mayor que 0, `sku` con formato `ABC-1234` y único, `stock` mayor o igual que 0 y `categoryId` existente.
- La falla simulada (500) no expone detalles internos; una nota muestra qué cambia en el entorno de desarrollo.
- **Modelo:** un panel pone la entidad `Product` (con `CostPrice`, `RowVersion`, `IsDeleted` y auditoría) junto a `ProductResponse`, `CreateProductRequest` y `UpdateProductRequest`, con el mapeo escrito a mano.
- Si el cuerpo trae campos que el DTO no tiene (`id`, `costPrice`), se ignoran y la respuesta lo señala. Así se ve cómo un DTO evita el *overposting* (asignación masiva).

### Interfaz

- Operaciones agrupadas (Autenticación y Productos), con el método en color, la ruta, un resumen y un candado si piden token.
- Al abrir una: parámetros editables, editor del cuerpo JSON que avisa errores de sintaxis, la casilla **Usar token** y el botón **Enviar**.
- Respuesta: código y texto, duración simulada, encabezados, cuerpo JSON resaltado, recorrido, registro y pestañas con el `curl` equivalente (armado con lo que enviaste) y el endpoint en C#.
- **Restablecer datos** vuelve al catálogo inicial de unos 25 productos ficticios.
- Los ejemplos de C# usan lo que trae ASP.NET Core, sin librerías extra: `TypedResults`, grupos de endpoints, la validación integrada de Minimal APIs, `AddProblemDetails`, `IExceptionHandler`, autenticación JWT Bearer y `AddRateLimiter`, con el detalle de que este responde 503 si no se configura `RejectionStatusCode = 429`.
- Los textos de cada operación viven en `_data/labs/rest-api.yml` y el C# de cada endpoint en `_includes/labs/csharp/rest-api/`.

---

## 8. Laboratorio de rendimiento SQL

### Datos ficticios

`Customers` (50 mil filas), `Products` (5 mil), `Orders` (1 millón por defecto, ajustable de 10 mil a 10 millones) y `OrderLines` (unas tres por pedido), con fechas de 2020 a 2026. Cada tabla tiene su clave primaria agrupada en `Id`; los demás índices dependen del escenario y se pueden crear o quitar.

### Modelo de costos

Es un modelo simplificado y determinista, basado en cómo trabaja SQL Server:

- Páginas de 8 KB, filas por página según el tamaño de la fila y profundidad del árbol B según el número de páginas.
- Operadores: Clustered Index Scan, Index Scan, Index Seek, Key Lookup, Nested Loops, Hash Match, Merge Join, Sort, Top, Filter y Compute Scalar.
- Métricas: lecturas lógicas, filas examinadas y devueltas, CPU estimada y tiempo simulado, con caché caliente o fría.
- Un "optimizador" calcula las alternativas y elige la más barata. Eso reproduce el **punto de inflexión** (*tipping point*): cuando la consulta devuelve muchas filas, buscar en el índice y hacer un Key Lookup por fila cuesta más que leer toda la tabla.
- Muestra una salida al estilo de `SET STATISTICS IO, TIME ON` (`Table 'Orders'. Scan count 1, logical reads …`), marcada como simulada.

**Sobre tu ejemplo de `YEAR(OrderDate)`.** Con `SELECT *` y un índice solo en `OrderDate`, un año completo (cerca de una séptima parte de la tabla) pasa el punto de inflexión: SQL Server preferiría leer toda la tabla en las dos consultas y casi no se vería la diferencia. Por eso el escenario empieza con un índice que cubre las columnas de la consulta (`INCLUDE`) y una lista corta de columnas; así la consulta B hace un Index Seek claro. El interruptor **`SELECT *`** y el rango (año, mes o día) muestran el punto de inflexión, que también es una lección. Una nota menciona la excepción conocida: `CAST(OrderDate AS date) = '20261118'` sí puede buscar en el índice.

### Escenarios

| Escenario | Consulta A | Consulta B | Lo que se ve |
|---|---|---|---|
| SARGabilidad | `WHERE YEAR(OrderDate) = 2026` | `WHERE OrderDate >= '20260101' AND OrderDate < '20270101'` | La función sobre la columna impide el Index Seek y obliga a revisar todas las filas; el rango sí permite buscar |
| Índices | `WHERE CustomerId = @id` sin índice | El mismo filtro con índice y luego con `INCLUDE` | Scan, luego Seek con Key Lookup y al final Seek sin lookups, con la sugerencia de índice faltante |
| N+1 (EF Core) | Un bucle que carga el cliente de cada pedido (1 + N consultas) | `Include` o proyección a un DTO (una consulta) | Viajes a la base, latencia acumulada con un RTT ajustable y filas transferidas; nota sobre `AsSplitQuery` |
| JOIN y subconsultas | `IN (SELECT …)` y `EXISTS` | `JOIN` | Muchas veces el plan es el mismo (semi join). Las diferencias reales: un JOIN de uno a muchos duplica filas (y pide `DISTINCT`) y `NOT IN` falla cuando la subconsulta devuelve NULL |
| Paginación | `OFFSET @n ROWS FETCH NEXT 20 ROWS ONLY` | Keyset: `WHERE OrderDate < @d OR (OrderDate = @d AND Id < @id)` | Las lecturas de OFFSET crecen con la página y las de keyset no; un deslizador va de la página 1 a la 50,000. SQL Server no compara tuplas, por eso el `OR`. En EF Core, `Skip`/`Take` contra keyset |
| AsNoTracking | Consulta con seguimiento de cambios | `AsNoTracking()` y proyección | El SQL es el mismo; cambian la memoria y el tiempo del lado de .NET. Notas sobre `AsNoTrackingWithIdentityResolution` y el comportamiento por defecto del contexto |

### Presentación

- Controles del escenario (tamaño de la tabla, caché, índices y parámetros) y el botón **Ejecutar las dos**: las barras de tiempo avanzan a la vez, en proporción al tiempo simulado.
- Dos columnas, A y B: la consulta resaltada (y el LINQ en los escenarios de EF Core), el árbol del plan con flechas cuyo grosor sigue a las filas, como en SSMS, y las métricas de cada operador. Los operadores caros se marcan en rojo y las mejoras en verde. En móvil, una columna va debajo de la otra.
- **Resumen:** tiempo, lecturas lógicas, filas examinadas, índice usado (seek o scan) y cuántas veces mejor sale B.
- **Por qué cambia:** explicación en lenguaje llano, con enlace a la documentación.
- Un aviso visible dice que es una simulación educativa y que los números salen de un modelo simplificado, no de un motor real.

---

## 9. Pruebas y calidad

- `tsc --noEmit` estricto y Prettier.
- Vitest:
  - **Arquitecturas:** cada conexión y cada paso de los flujos apuntan a nodos que existen, y cada componente tiene sus cinco apartados.
  - **API:** cada endpoint con cada código de la sección 7, el orden del pipeline, token alterado o vencido (401), rol insuficiente (403), validación (400 con `errors`), SKU repetido (409) y el límite de peticiones (429).
  - **SQL:** propiedades del modelo (con índice nunca se lee más que sin él; keyset no crece con la página y OFFSET sí; el punto de inflexión cae entre "día" y "mes"; N+1 crece en línea recta con N) y el plan esperado en cada escenario.
  - **Paridad:** cada texto de `_data/labs/` tiene su versión `es` y `en`, y cada id que usa el TypeScript tiene su texto.
- **Accesibilidad:** todo se usa con teclado, con foco visible, contraste AA, `prefers-reduced-motion`, anuncios en `aria-live` y la versión sin JavaScript como alternativa en texto.
- **Rendimiento:** CI revisa el presupuesto de cada bundle, y las páginas fuera del laboratorio no cargan nada nuevo.
- Revisión final en los dos idiomas, en tema claro y oscuro, y en escritorio y móvil.

---

## 10. Fases

Cada fase se trabaja en su rama, entra a `main` con un pull request y termina con algo publicado y probado.

**Dónde vamos (18 de noviembre de 2026).** Las decisiones están confirmadas y la fase 0 tiene su commit en la rama `laboratorio-fase-0`. Para cerrarla faltan dos pull requests: primero el del rediseño (`cv-carta-latex` → `main`) y después el de esta fase; antes de mezclar el segundo, Pages cambia a GitHub Actions.

### Fase 0. Preparación
- [ ] Integrar `rediseno-jekyll-2026` y `cv-carta-latex` en `main`, con el cambio pendiente de `_data/projects.yml`. El cambio ya está en `cv-carta-latex` (`7e55717`); falta el PR.
- [x] Confirmar las decisiones de la sección 2.
- [x] `package.json`, `tsconfig.json` (strict), esbuild, Vitest y Prettier, con los scripts `dev`, `build`, `test` y `check`.
- [x] `_config.yml` (`exclude`) y `.gitignore` (`node_modules/` y `assets/js/labs/`).
- [x] Con la opción A: workflow `sitio.yml` en `.github/workflows/`, en lugar de `validar-jekyll.yml`.
- [ ] Cambiar *Settings → Pages → Source* a **GitHub Actions** antes de mezclar el PR de esta fase.
- [x] README y tarea de VS Code para correr el sitio y el laboratorio en local.

**Entregable:** un push a `main` compila, prueba y publica el sitio igual que hoy.

### Fase 1. Base del laboratorio
- [ ] Layout `lab` y páginas en español e inglés con su `ref`.
- [ ] `labs.css` con los colores del laboratorio en los dos temas.
- [ ] Kit compartido (sección 4) con sus pruebas.
- [ ] Textos de la interfaz en `_data/labs/ui.yml` y el JSON incrustado de cada página.
- [ ] Prueba de paridad entre español e inglés en CI.

**Entregable:** las páginas del laboratorio existen, todavía sin enlace en el menú, y la base está probada.

### Fase 2. Simulador de arquitecturas
- [ ] Modelo de datos (nodos, conexiones y flujos) y la versión sin JavaScript que genera Jekyll.
- [ ] Diagrama: cuadrícula, conexiones en SVG, teclado y diseño para móvil.
- [ ] Panel del componente y resumen de la arquitectura.
- [ ] Simular petición, con avance paso a paso y movimiento reducido.
- [ ] Contenido completo de Por capas y Clean Architecture, primero estas dos para validar el formato.
- [ ] Contenido de Monolítica, Microservicios y CQRS + RabbitMQ.
- [ ] Tabla comparativa y pruebas.
- [ ] Enlace al laboratorio en el menú y sección en la portada.

**Entregable:** `/laboratorio/arquitecturas/` y `/en/lab/architectures/` publicadas.

### Fase 3. Simulador de API REST
- [ ] Repositorio en memoria con los datos iniciales y Restablecer datos.
- [ ] Endpoints tipados y respuestas Problem Details.
- [ ] Pipeline de middleware con recorrido y registro.
- [ ] JWT con Web Crypto: emitir, decodificar, vencer y detectar alteraciones.
- [ ] Validación, 409, 429 y la falla simulada.
- [ ] Interfaz: operaciones, panel de prueba, respuesta, `curl` y C#.
- [ ] Panel Modelo (entidad y DTOs).
- [ ] Pruebas.

**Entregable:** `/laboratorio/api-rest/` publicada; desde la interfaz se pueden provocar 200, 201, 204, 400, 401, 403, 404, 409, 429 y 500.

### Fase 4. Laboratorio de rendimiento SQL
- [ ] Esquema, estadísticas y modelo de costos, con sus pruebas de propiedades.
- [ ] Constructor de planes que elige el más barato (punto de inflexión).
- [ ] Vista de los planes A y B, resumen y salida de `STATISTICS IO`.
- [ ] Escenarios de SQL: SARGabilidad, índices y paginación.
- [ ] Escenarios de EF Core (N+1 y `AsNoTracking`) y el de JOIN y subconsultas.
- [ ] Textos de "Por qué cambia" con sus enlaces.

**Entregable:** `/laboratorio/sql/` publicada con los seis escenarios.

### Fase 5. Cierre
- [ ] Revisión de accesibilidad y rendimiento.
- [ ] Revisión en español e inglés, tema claro y oscuro, escritorio y móvil.
- [ ] README: cómo está hecho el laboratorio y cómo agregar un escenario o una arquitectura.
- [ ] Revisar el sitio publicado.

**Entregable:** las tres demos publicadas y documentadas.

### Opcionales
- [ ] Calibrar el modelo SQL con un SQL Server local: un script del repo genera los datos, se miden lecturas y planes reales y el modelo se ajusta para coincidir en orden de magnitud.
- [ ] Compilar los ejemplos de C# en CI con un proyecto que incluya `_includes/labs/csharp/**/*.cs`.
- [ ] Pruebas de extremo a extremo con Playwright y revisión automática con axe.
- [ ] Documento OpenAPI 3.1 generado desde la misma definición de endpoints, para verlo o descargarlo; ETag e `If-Match` con 412 para concurrencia optimista.
- [ ] Microservicios: simular la caída de un servicio (timeout, reintento y circuit breaker).
- [ ] Variante del laboratorio SQL para PostgreSQL.

---

## 11. Criterios de aceptación

1. Las tres demos funcionan en español e inglés, en tema claro y oscuro, y en escritorio y móvil.
2. Sin JavaScript, cada página se lee completa.
3. Todo se puede usar solo con teclado, y con movimiento reducido no hay animaciones.
4. Cada componente de las cinco arquitecturas muestra responsabilidad, tecnologías, ventajas, desventajas y código C#, y la petición de ejemplo recorre cada diagrama.
5. En la API se pueden provocar desde la interfaz 200, 201, 204, 400, 401, 403, 404, 409, 429 y 500, y cada error sale como Problem Details.
6. Cada escenario SQL muestra los dos planes, las métricas y la explicación, y el punto de inflexión se puede ver.
7. El workflow corre `tsc`, Vitest y Jekyll antes de publicar, y los bundles caben en su presupuesto.

---

## 12. Riesgos

| Riesgo | Cómo se mitiga |
|---|---|
| Mucho texto en dos idiomas (unos 30 componentes, 6 escenarios y 6 endpoints) | Terminar dos arquitecturas antes de escribir las demás, no traducir el código C# y dejar que la prueba de paridad avise lo que falta |
| Números del laboratorio SQL poco creíbles para alguien que conoce SQL Server | Modelo basado en comportamientos documentados (páginas de 8 KB, seeks, lookups y punto de inflexión), pruebas de propiedades, aviso visible y calibración opcional con un SQL Server real |
| Cambiar el despliegue rompe el sitio | Probar el workflow en un PR, sin publicar, antes de cambiar la fuente de Pages; para volver atrás, regresar la fuente a la rama |
| Diagramas y planes en pantallas chicas | Nodos apilados por capas, planes con desplazamiento horizontal y columnas A y B una debajo de la otra |
| Parecer copia de Swagger o pganalyze | Sin sus nombres, logos ni colores; los colores por método HTTP salen de la paleta del sitio |
| Las licencias de MediatR o MassTransit cambian otra vez | Nota con fecha y enlace a la fuente |
| Que la llave del JWT en el navegador parezca una buena práctica | Aviso en la demo y explicación de cómo funciona en un sistema real |
| Un `{{` o `{%` en el código C# rompe el build de Jekyll | Una prueba los busca en `_includes/labs/csharp/` |

---

## 13. Fuentes

- GitHub Pages con un workflow propio: <https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>
- EF Core, consultas con y sin seguimiento de cambios: <https://learn.microsoft.com/ef/core/querying/tracking>
- EF Core, consultas eficientes: <https://learn.microsoft.com/ef/core/performance/efficient-querying>
- EF Core, paginación: <https://learn.microsoft.com/ef/core/querying/pagination>
- SQL Server, predicados de búsqueda (seek): <https://learn.microsoft.com/en-us/archive/blogs/craigfr/seek-predicates>
- RFC 9457, Problem Details for HTTP APIs: <https://www.rfc-editor.org/rfc/rfc9457.html>
- MassTransit v9 y su licencia: <https://masstransit.io/introduction/v9-announcement>
- MediatR y su licencia comercial: <https://dariusz-wozniak.github.io/fossed/library/mediatr>
