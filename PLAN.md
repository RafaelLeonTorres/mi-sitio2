# Plan: laboratorio interactivo del sitio

Tres demos para usar en el navegador que muestran cómo trabajo el backend: un **simulador de arquitecturas de software**, un **simulador de API REST** y un **laboratorio de rendimiento SQL**. GitHub Pages solo sirve archivos estáticos, así que todo corre en el navegador con TypeScript: las respuestas, los planes de ejecución y los tiempos son simulados, y cada demo lo dice en pantalla.

Después viene una sección de **retos de código** de C# y SQL para practicar entrevistas de .NET. Ahí el código del visitante sí se ejecuta, también en su navegador: el C# con el compilador de .NET en WebAssembly y el SQL en PostgreSQL compilado a WebAssembly (PGlite).

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
- **Retos de código:** 35 retos de C# y 30 de SQL con editor, casos de prueba y resultados, pistas, solución explicada, playground, modo entrevista y el progreso guardado en el navegador (sección 9). Los de SQL usan la misma tienda, más empleados y departamentos.

### No incluye

- Backend, base de datos o cuentas reales.
- Guardar datos entre visitas: la API simulada vuelve a su estado inicial al recargar la página. La excepción son los retos, cuyo progreso y código quedan solo en el navegador del visitante.
- Ranking de participantes o envío de soluciones a un servidor: necesitarían backend y cuentas.
- Ejecutar T-SQL en un SQL Server real: los retos de SQL corren en PostgreSQL (PGlite), con funciones que llevan los nombres de T-SQL.
- Otros motores en el laboratorio de rendimiento SQL: su variante para PostgreSQL queda como extensión.

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
6. **Extras opcionales.** Calibrar el modelo SQL con un SQL Server real, compilar los ejemplos de C# en CI y pruebas de extremo a extremo con Playwright y axe. Cada uno se puede dejar para después (ver "Opcionales" en la sección 11).

**Retos de código, confirmados el 18 de noviembre de 2026:**

7. **Van después de la fase 4**, como fases 5 y 6; el cierre pasa a ser la fase 7.
8. **C# real en el navegador:** Roslyn compila el código del visitante en WebAssembly, dentro de un Web Worker con tiempo límite. Un servidor propio tendría costo mensual y obligaría a aislar código ajeno.
9. **SQL en PostgreSQL (PGlite)**, con funciones que llevan los nombres de T-SQL. `OFFSET … FETCH`, las CTE y las funciones de ventana se escriben igual que en SQL Server; `TOP` y los procedimientos almacenados no corren. Es la excepción a la decisión 5, y la página lo dice.
10. **Primera versión con pistas y solución, playground, modo entrevista y progreso local.** Quedan fuera el ranking, que necesita servidor y cuentas, y la memoria usada, que en WebAssembly no se mide de forma confiable.
11. **Los retos sí traen paquetes al navegador** (el editor, PGlite y el runtime de .NET), a diferencia de la decisión 3, pero solo en sus páginas y cargados cuando hacen falta.
12. **El catálogo completo desde la primera versión:** 35 retos de C# y 30 de SQL. Cada lenguaje se publica completo: los de SQL al terminar la fase 5 y los de C# al terminar la fase 6.

---

## 3. Dónde vive en el sitio

| Página | Español | Inglés |
|---|---|---|
| Índice | `/laboratorio/` | `/en/lab/` |
| Arquitecturas | `/laboratorio/arquitecturas/` | `/en/lab/architectures/` |
| API REST | `/laboratorio/api-rest/` | `/en/lab/rest-api/` |
| Rendimiento SQL | `/laboratorio/sql/` | `/en/lab/sql/` |
| Retos de código | `/laboratorio/retos/` | `/en/lab/challenges/` |
| Un reto | `/laboratorio/retos/<id>/` | `/en/lab/challenges/<id>/` |

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
- Un bundle por demo (`architecture.js`, `rest-api.js`, `sql.js` y `challenges.js`) y el código compartido en un chunk aparte. `scripts/build-labs.mjs` compila cada `labs/<demo>/main.ts` y, con el metafile de esbuild, revisa el presupuesto de 30 kB comprimidos por demo (`scripts/budget.mjs`): la demo más los chunks que importa al cargar, sin contar lo que se carga con `import()`.
- En los retos, el editor y los dos motores se cargan con `import()` y tienen su propio límite, que el build también revisa: 200 kB comprimidos para el editor y, para cada motor, el tamaño que mida el prototipo de la fase 5.
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
├── shared/                 format.ts, dom.ts, i18n.ts, highlight.ts (JSON y SQL), tabs.ts, copy.ts, bars.ts, range.ts, live.ts
├── architecture/           geometry.ts, diagram.ts, stepper.ts, app.ts, main.ts
├── rest-api/               http.ts, store.ts, validation.ts, jwt.ts, rate-limit.ts, problem.ts, api.ts (el pipeline),
│                           page.ts, token-bar.ts, response.ts, app.ts, main.ts
├── challenges/             catálogo, página del reto, editor, progreso, modo entrevista y los motores (sql/, csharp/)
└── sql/                    schema.ts, cost.ts, operators.ts, scenarios/, plan-view.ts, main.ts
                            (cada módulo con su *.test.ts al lado)
dotnet/challenges/          motor de C# para WebAssembly (Roslyn) y las pruebas de las soluciones de referencia
scripts/                    build-labs.mjs (compila con esbuild y copia PGlite), budget.mjs (presupuesto de tamaño)
                            y challenge-pages.mjs (genera las páginas de los retos)
_data/labs/                 ui.yml, architecture/*.yml, rest-api.yml, sql.yml, challenges/*.yml,
                            challenge-ui.yml y challenge-datasets.yml
_includes/labs/             parciales HTML y code/<demo>/ (el código de ejemplo)
_layouts/lab.html
laboratorio/                páginas en español
en/lab/                     páginas en inglés
assets/css/labs.css         estilos del laboratorio (solo en sus páginas)
assets/js/labs/             salida de esbuild (no se versiona)
assets/labs/                PGlite y el motor de C# publicados por el build (no se versiona)
package.json, package-lock.json, tsconfig.json, tsconfig.node.json, vitest.config.ts,
.prettierrc.json, .prettierignore
```

`_config.yml` excluye del sitio `PLAN.md`, `labs`, `scripts`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.node.json`, `vitest.config.ts` y `Claude outputs`.

### Kit compartido

Pestañas con el patrón de ARIA para el código y las respuestas, botón Copiar con el mismo aspecto que el de las publicaciones, resaltado de JSON y SQL, control segmentado (un grupo de radios), deslizador con su valor visible, barras comparativas en HTML y CSS, una región `aria-live` que anuncia los resultados, y números y duraciones con `Intl.NumberFormat` según el idioma (es-MX o en-US). Todo vive en `labs/shared/`, con sus pruebas.

---

## 5. Dirección visual

Las demos usan los tokens del sitio: Atkinson Hyperlegible Next y Mono, el acento `#512bd4` (`#a794ff` en oscuro) y los temas claro y oscuro. De las tres referencias se toma la estructura, no la marca:

| Referencia | Qué se toma | Qué no |
|---|---|---|
| Grafo de servicios oscuro | Nodos conectados con un panel lateral de detalles; el camino activo se ilumina | El lienzo siempre oscuro y el brillo por todas partes. En tema claro el diagrama usa líneas nítidas; el brillo solo aparece en tema oscuro y solo en el camino activo |
| Swagger Editor | Lista de operaciones con el método en color, candado en las que piden token y prueba en línea | Nombre, logo, barra superior y su distribución exacta |
| pganalyze, comparar planes | Planes A y B lado a lado, métricas por nodo, panel de resumen y nodos caros o mejorados resaltados | Nombre, logo, colores y tipografía |
| LeetCode y HackerRank | Descripción, editor y resultados en tres paneles; casos aprobados y fallidos; Ejecutar y Enviar | Nombre, logo, colores, el tema oscuro fijo y sus enunciados |

**Colores.** Los métodos HTTP y los estados salen de la paleta de resaltado de código que el sitio ya tiene, para que el laboratorio se vea de la casa. Solo se agrega un rojo:

| Uso | Token | Claro | Oscuro |
|---|---|---|---|
| GET, información | `--tok-t` | `#0e6b84` | `#6fd0e8` |
| POST, éxito, mejora | `--ok` | `#0f7b5f` | `#5fd3a9` |
| PUT, advertencia | `--tok-n` | `#a85400` | `#ffb46b` |
| DELETE, error, operador caro | `--bad` (nuevo) | `#b3261e` | `#ff8a80` |
| Selección y camino activo | `--accent` | `#512bd4` | `#a794ff` |

Todos pasan AA (4.5:1) como texto sobre el fondo y como fondo de una etiqueta (con texto blanco en claro y con el color de fondo del sitio en oscuro).

**Movimiento.** Un solo momento animado por demo, siempre como respuesta a un clic: la petición que recorre el diagrama, la que atraviesa el pipeline de la API, las dos consultas que corren a la vez y, en los retos, los casos que se marcan uno por uno al ejecutar. Con `prefers-reduced-motion` se muestra el resultado paso a paso, sin animación.

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

Retos de código (en móvil, los paneles quedan uno debajo del otro):

```text
( Descripción | Pistas | Solución )        C#                          [ Ejecutar ]  [ Enviar ]
Suma de dos               Fácil           public int[] TwoSum(int[] nums, int target)
LINQ y colecciones                         {
                                               // Tu solución
Dado un arreglo de enteros y un objetivo,  }
devuelve los índices de los dos números
que suman el objetivo.                     Resultados: 3 de 3 casos aprobados   12 ms
                                           ✓ Caso 1   ✓ Caso 2   ✓ Caso 3
Ejemplo 1                                  Caso 2   entrada  nums = [3, 2, 4], target = 6
  nums = [2, 7, 11, 15], target = 9                 esperado [1, 2]   obtenido [1, 2]
  resultado: [0, 1]
```

---

## 6. Simulador de arquitecturas

### Qué hace

- Selector de arquitectura. La elección queda en la URL (`#arch-clean`, o `#clean-domain` con una pieza abierta) para poder compartirla.
- **Diagrama:** los nodos son enlaces HTML sobre una cuadrícula y las conexiones son una capa SVG que se recalcula al cambiar el tamaño. Los diagramas van de arriba abajo, en una o dos columnas, para caber junto a la ficha en escritorio y verse igual en móvil. Un marco punteado agrupa piezas: el proceso del monolito, la red interna de los microservicios y los lados de escritura y lectura de CQRS.
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

- Son unos 30 componentes. Cada uno lleva su responsabilidad en dos o tres frases, una lista corta de tecnologías, dos o tres ventajas, dos o tres desventajas y un ejemplo de 10 a 35 líneas (C#, SQL, HTTP o JSON) de 75 columnas como máximo, para que se lea sin desplazarse en escritorio.
- Clean Architecture se dibuja de arriba abajo, con las flechas de dependencia hacia el dominio y la infraestructura a un lado, apuntando a la aplicación: junto a la de capas se ve que la flecha entre negocio y datos se invierte. Los anillos clásicos pueden ser una vista alternativa más adelante.
- En Microservicios, la base de datos de cada servicio va dentro de su pieza ("Servicio con su base"), para que el diagrama quepa en dos columnas.
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

La petición pasa por un pipeline como el de ASP.NET Core, en el orden que recomienda la documentación de Microsoft. El límite de peticiones va después del enrutamiento y antes de autenticar, así que cuenta todas las peticiones, con token o sin él:

```text
manejo de excepciones → registro con correlation id → enrutamiento → límite de peticiones
→ autenticación (JWT) → autorización (roles) → validación → endpoint → servicio → repositorio en memoria
```

- **Recorrido:** cada paso tiene dos carriles, la petición que entra y la respuesta que regresa por los mismos pasos. Marcan hasta dónde llegó la petición y qué paso respondió (por ejemplo, autorización con 403). La pestaña Recorrido cuenta cada paso con su tiempo simulado.
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
- Los textos de cada operación viven en `_data/labs/rest-api.yml` y el C# de cada endpoint, del pipeline y del modelo en `_includes/labs/code/rest-api/`.

---

## 8. Laboratorio de rendimiento SQL

### Datos ficticios

`Customers` (50 mil filas), `Products` (5 mil), `Orders` (1 millón por defecto, ajustable de 10 mil a 10 millones) y `OrderLines` (unas tres por pedido), con fechas de 2020 a 2026. Cada tabla tiene su clave primaria agrupada en `Id`; los demás índices dependen del escenario y se pueden crear o quitar.

### Modelo de costos

Es un modelo simplificado y determinista, basado en cómo trabaja SQL Server:

- Páginas de 8 KB, filas por página según el tamaño de la fila y profundidad del árbol B según el número de páginas.
- Operadores: Clustered Index Scan y Seek, Index Scan y Seek, Key Lookup, Nested Loops, Hash Match (para JOIN, semi join, anti semi join y DISTINCT), Top y Row Count Spool, que son los que usan los seis escenarios.
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

## 9. Retos de código

Una sección para practicar entrevistas de .NET: el visitante elige un reto de C# o de SQL, escribe su solución en el sitio, la corre contra casos de prueba y ve qué pasó. A diferencia de las demos, el código del visitante se ejecuta de verdad en su navegador.

### Qué hace

- **Catálogo** (`/laboratorio/retos/`): los retos por lenguaje, categoría y dificultad (fácil, media y difícil), con el progreso del visitante.
- **Un reto:** en escritorio, la descripción a la izquierda y el editor con los resultados a la derecha, fijos al bajar; en móvil, uno debajo del otro.
  - **Descripción:** el enunciado, los ejemplos y las restricciones. Las pistas se abren una a una, y la solución explicada se muestra al pedirla.
  - **Editor:** resalta C# o T-SQL, empieza con el código inicial del reto y guarda en el navegador lo que se escribe.
  - **Ejecutar** corre los casos de ejemplo y **Enviar** corre además los casos adicionales. En un sitio estático esos casos no se pueden esconder, así que la página no los llama ocultos: solo no se muestran antes de enviar.
  - **Resultados:** los casos aprobados y fallidos, con la entrada, lo esperado y lo obtenido. También los errores del compilador o de PostgreSQL con su línea y el tiempo de ejecución, pero no la memoria, que en WebAssembly no se mide de forma confiable.
- **Playground:** C# o SQL libre, sin reto. El de SQL usa la base de ejemplo.
- **Modo entrevista:** se elige una categoría y salen cinco retos con 30 minutos. Al final hay un resumen de lo resuelto y el tiempo de cada uno.
- **Progreso local:** retos resueltos y pendientes, y el último código de cada reto, en el `localStorage` de ese navegador. Un botón lo borra. No hay cuentas ni ranking.

### Motores

| Motor | Cómo funciona | Tamaño y carga |
|---|---|---|
| C# | Un proyecto de .NET 11 para WebAssembly (`Microsoft.NET.Sdk.WebAssembly`, sin Blazor) con Roslyn (`Microsoft.CodeAnalysis.CSharp`) y ensamblados de referencia. Compila el código del visitante junto con un arnés de pruebas generado a partir del reto, lo carga en memoria y llama al método de cada caso | Varios MB, que mide el prototipo. Se descarga la primera vez que el visitante pulsa Ejecutar, con una barra de progreso, y después queda en la caché del navegador |
| SQL | PGlite 0.5 (PostgreSQL 18 en WebAssembly). Cada caso parte de una base nueva, copiada de una plantilla que ya trae funciones con los nombres de T-SQL, como `YEAR`, `MONTH`, `LEN`, `ISNULL`, `IIF`, `GETDATE`, `CHARINDEX`, `DATEADD`, `DATEDIFF` y `DATETRUNC`, y a esa copia se le agregan el esquema y los datos del reto. Una traducción mínima cubre lo que una función no alcanza, como la parte de fecha sin comillas de `DATEADD(day, 1, OrderDate)`, los corchetes, los tipos de SQL Server, `CONVERT` y `CROSS APPLY`. Las pruebas revisan cada función y cada traducción | Unos 5.3 MB en gzip (`pglite.wasm`, `pglite.data` e `initdb.wasm`), con un presupuesto de 6 MB. Se descarga cuando el visitante va al editor de un reto o del playground, y queda en la caché del navegador. La plantilla tarda unos 2 s la primera vez, y cada caso, unos 250 ms |

- Los dos motores corren en un Web Worker. Si una ejecución pasa del tiempo límite (5 segundos), la página termina el worker y lo vuelve a crear, así que un ciclo infinito no cuelga la página. El tiempo cuenta desde que empieza el código del visitante: preparar la base no cuenta.
- El código del visitante corre solo en su navegador, dentro del worker, sin acceso a la página ni a la red. No hay servidor que proteger.
- Cuando el resultado no basta para revisar un reto de C#, como que un Singleton use `Lazy<T>`, el arnés también revisa el código con Roslyn.
- La página dice qué motor usa. Los retos de SQL corren en PostgreSQL, no en SQL Server, y lo que no corre (`TOP`, procedimientos almacenados, variables con `@`, `TRY…CATCH`, y `UPDATE` o `DELETE` con `JOIN`, entre otros) recibe un mensaje claro que dice cómo escribirlo aquí. Las soluciones de referencia corren igual en los dos motores; si en SQL Server hay una forma más común, como `TOP`, la explicación la menciona.
- GitHub Pages no permite los encabezados que necesita el multihilo de WebAssembly (COOP y COEP), así que los retos de concurrencia usan `async`/`await` en un solo hilo o se dejan fuera.

### Retos de la primera versión

El catálogo completo: 35 retos de C# y 30 de SQL, con retos fáciles, medios y difíciles en cada categoría. Los enunciados son propios: los problemas clásicos, como la suma de dos, se cuentan con otras palabras y otros ejemplos.

| Categoría | Retos | Ejemplos |
|---|---|---|
| C#: fundamentos | 12 | El segundo número más grande, invertir las palabras de una frase, quitar duplicados sin perder el orden |
| C#: LINQ y colecciones | 8 | La suma de dos, caracteres repetidos, agrupar empleados por departamento |
| C#: algoritmos y estructuras de datos | 10 | Una caché LRU, búsqueda binaria, recorrer un árbol |
| C#: .NET avanzado | 3 | Un método de extensión, un repositorio genérico, productor y consumidor con `Channel<T>` y `async` |
| C#: POO y patrones | 2 | Un Singleton con `Lazy<T>` y Strategy |
| SQL: consultas, JOIN y funciones de ventana | 12 | Empleados sin departamento, clientes que nunca compraron, un JOIN con varias condiciones, el segundo salario más alto, los tres salarios más altos por departamento, ventas acumuladas por mes, registros consecutivos |
| SQL: optimización | 10 | Quitar una función de una columna con índice, paginar con `OFFSET … FETCH` o con keyset, crear el índice que necesita una consulta |
| SQL: cambios de datos y transacciones | 8 | Eliminar duplicados conservando uno, `MERGE`, una transferencia con `BEGIN`, `COMMIT` y `ROLLBACK`; se revisan por cómo queda la tabla |

La categoría de procedimientos almacenados de la propuesta queda como cambios de datos y transacciones, porque los procedimientos de T-SQL no corren en PostgreSQL.

Los retos de optimización revisan el resultado y también el plan de PostgreSQL (`EXPLAIN`), por ejemplo, que la consulta reescrita use el índice. Los planes no son los de SQL Server, así que cada reto explica qué cambia allá y, cuando el laboratorio de rendimiento tiene un escenario del tema, enlaza a él. Para que PostgreSQL elija los índices como lo haría con datos reales, esas bases traen decenas de miles de filas generadas al crearlas.

### Contenido y páginas

- Un archivo por reto en `_data/labs/challenges/`, con `es`, `en` y `shared`. `shared` trae los casos, el código inicial, la solución y, en los de SQL, el esquema y los datos.
- `_data/labs/challenge-datasets.yml` trae las tablas que comparten los retos y los generadores de filas, y `_data/labs/challenge-ui.yml`, los textos de la interfaz y el orden del catálogo.
- `scripts/challenge-pages.mjs` (`npm run pages`) genera una página por reto y por idioma, y una prueba avisa si falta o sobra alguna. No es una colección de Jekyll porque el botón de idioma busca la otra versión por `ref` entre las páginas del sitio. Sin JavaScript, cada reto se lee completo, con las pistas y la solución dentro de `<details>`, y se puede enlazar.
- Cada solución de referencia pasa sus casos en CI: las de SQL con PGlite en Node y las de C# con un proyecto de pruebas de .NET.

### Paquetes y build

- npm: `@electric-sql/pglite` y CodeMirror 6 (`@codemirror/state`, `view`, `commands`, `language`, `autocomplete` y `lang-sql`, con el dialecto de SQL Server, y `@lezer/highlight`). El modo de C# llega en la fase 6.
- El build copia los archivos de PGlite a `assets/labs/pglite/` ya comprimidos con gzip, porque GitHub Pages no comprime `.wasm` ni `.data`, y el worker los descomprime. El editor y el worker van en archivos aparte, con su propio presupuesto (200 KB y 250 KB comprimidos).
- NuGet: `Microsoft.CodeAnalysis.CSharp` y los ensamblados de referencia para compilar en el navegador.
- El workflow agrega `actions/setup-dotnet` con .NET 11 y publica el motor de C# antes de construir Jekyll. La salida va a `assets/labs/`, que no se versiona, igual que los bundles. En local hace falta el SDK de .NET 11.
- npm y NuGet siguen bloqueados en el espacio de trabajo de Claude y en la máquina virtual. Los paquetes de npm de la fase 5 se instalaron en local el 19 de noviembre; antes de la fase 6 hay que hacer lo mismo con NuGet o habilitarlo.

---

## 10. Pruebas y calidad

- `tsc --noEmit` estricto y Prettier.
- Vitest:
  - **Arquitecturas:** cada conexión y cada paso de los flujos apuntan a nodos que existen, y cada componente tiene sus cinco apartados.
  - **API:** cada endpoint con cada código de la sección 7, el orden del pipeline, token alterado o vencido (401), rol insuficiente (403), validación (400 con `errors`), SKU repetido (409) y el límite de peticiones (429).
  - **SQL:** propiedades del modelo (con índice nunca se lee más que sin él; keyset no crece con la página y OFFSET sí; el punto de inflexión cae entre "día" y "mes"; N+1 crece en línea recta con N) y el plan esperado en cada escenario.
  - **Retos:** cada solución de referencia pasa sus casos, la capa de compatibilidad de T-SQL traduce lo que debe y rechaza lo que no puede, y el worker se reinicia al pasar el tiempo límite.
  - **Paridad:** cada texto de `_data/labs/` tiene su versión `es` y `en`, y cada id que usa el TypeScript tiene su texto.
- **Accesibilidad:** todo se usa con teclado, con foco visible, contraste AA, `prefers-reduced-motion`, anuncios en `aria-live` y la versión sin JavaScript como alternativa en texto.
- **Rendimiento:** CI revisa el presupuesto de cada bundle y el de los motores de los retos, y las páginas fuera del laboratorio no cargan nada nuevo.
- Revisión final en los dos idiomas, en tema claro y oscuro, y en escritorio y móvil.

---

## 11. Fases

Cada fase se trabaja en su rama, entra a `main` con un pull request y termina con algo publicado y probado.

**Dónde vamos (19 de noviembre de 2026).** Las fases 0 a 5 tienen su commit, cada una en su rama: de `laboratorio-fase-0` a `laboratorio-fase-5`. Para publicar falta mezclar a `main`: un PR desde `laboratorio-fase-0` lleva el rediseño, los CV y la fase 0 (antes de mezclarlo, Pages cambia a GitHub Actions), y después va un PR por fase. Los retos de código entraron al plan como fases 5 y 6, y el cierre pasó a la fase 7.

### Fase 0. Preparación
- [ ] Integrar `rediseno-jekyll-2026` y `cv-carta-latex` en `main`, con el cambio pendiente de `_data/projects.yml`. El cambio ya está en `cv-carta-latex` (`7e55717`); falta el PR, que puede ser el mismo de la fase 0, desde `laboratorio-fase-0`.
- [x] Confirmar las decisiones de la sección 2.
- [x] `package.json`, `tsconfig.json` (strict), esbuild, Vitest y Prettier, con los scripts `dev`, `build`, `test` y `check`.
- [x] `_config.yml` (`exclude`) y `.gitignore` (`node_modules/` y `assets/js/labs/`).
- [x] Con la opción A: workflow `sitio.yml` en `.github/workflows/`, en lugar de `validar-jekyll.yml`.
- [ ] Cambiar *Settings → Pages → Source* a **GitHub Actions** antes de mezclar el PR de esta fase.
- [x] README y tarea de VS Code para correr el sitio y el laboratorio en local.

**Entregable:** un push a `main` compila, prueba y publica el sitio igual que hoy.

### Fase 1. Base del laboratorio
- [x] Layout `lab` y el índice en español e inglés (`/laboratorio/` y `/en/lab/`) con su `ref`; cada demo trae su página en su fase.
- [x] `labs.css` con los colores del laboratorio en los dos temas.
- [x] Kit compartido (sección 4) con sus pruebas.
- [x] Textos de la interfaz en `_data/labs/ui.yml` y el JSON incrustado (`#lab-ui`) en las páginas de demo.
- [x] Prueba de paridad entre español e inglés en CI.

**Entregable:** las páginas del laboratorio existen, todavía sin enlace en el menú, y la base está probada.

### Fase 2. Simulador de arquitecturas
- [x] Modelo de datos (nodos, conexiones y flujos) y la versión sin JavaScript que genera Jekyll.
- [x] Diagrama: cuadrícula, conexiones en SVG, teclado y diseño para móvil.
- [x] Panel del componente y resumen de la arquitectura.
- [x] Simular petición, con avance paso a paso y movimiento reducido.
- [x] Contenido completo de Por capas y Clean Architecture, primero estas dos para validar el formato.
- [x] Contenido de Monolítica, Microservicios y CQRS + RabbitMQ.
- [x] Tabla comparativa y pruebas.
- [x] Enlace al laboratorio en el menú y sección en la portada.

**Entregable:** `/laboratorio/arquitecturas/` y `/en/lab/architectures/` publicadas.

### Fase 3. Simulador de API REST
- [x] Repositorio en memoria con los datos iniciales y Restablecer datos.
- [x] Endpoints tipados y respuestas Problem Details.
- [x] Pipeline de middleware con recorrido y registro.
- [x] JWT con Web Crypto: emitir, decodificar, vencer y detectar alteraciones.
- [x] Validación, 409, 429 y la falla simulada.
- [x] Interfaz: operaciones, panel de prueba, respuesta, `curl` y C#.
- [x] Panel Modelo (entidad y DTOs).
- [x] Pruebas.

**Entregable:** `/laboratorio/api-rest/` publicada; desde la interfaz se pueden provocar 200, 201, 204, 400, 401, 403, 404, 409, 429 y 500.

### Fase 4. Laboratorio de rendimiento SQL
- [x] Esquema, estadísticas y modelo de costos, con sus pruebas de propiedades.
- [x] Constructor de planes que elige el más barato (punto de inflexión).
- [x] Vista de los planes A y B, resumen y salida de `STATISTICS IO, TIME`.
- [x] Escenarios de SQL: SARGabilidad, índices y paginación.
- [x] Escenarios de EF Core (N+1 y `AsNoTracking`) y el de JOIN y subconsultas.
- [x] Textos de "Por qué cambia" con sus enlaces a Microsoft Learn.

**Entregable:** `/laboratorio/sql/` publicada con los seis escenarios.

### Fase 5. Retos de código: base y SQL
- [x] Instalar en local los paquetes de npm (PGlite y CodeMirror). NuGet pasa a la fase 6.
- [x] Prototipo del motor de SQL: unos 5.3 MB en gzip, unos 2 s para la plantilla y 250 ms por caso, y 5 s de tiempo límite. El de C# pasa a la fase 6.
- [x] Datos de los retos, las páginas que genera `scripts/challenge-pages.mjs` y la versión sin JavaScript.
- [x] Catálogo con filtros y progreso local.
- [x] Página del reto: descripción, pistas, solución, editor y resultados.
- [x] Motor de SQL: PGlite en un worker, una base por caso y las funciones de T-SQL con sus pruebas.
- [x] Los 30 retos de SQL, revisados por categoría, con sus casos y sus soluciones probadas en CI, y el playground de SQL.

**Entregable:** `/laboratorio/retos/` publicada con los 30 retos de SQL.

### Fase 6. Retos de código: C# y modo entrevista
- [ ] Habilitar NuGet o instalar los paquetes en local.
- [ ] Prototipo del motor de C# para medir su tamaño y su arranque, y fijar sus límites.
- [ ] Motor de C#: el proyecto de .NET 11 para WebAssembly con Roslyn, en un worker con tiempo límite, publicado por el workflow.
- [ ] Arnés de pruebas: casos de entrada y salida en JSON, comparación de resultados y errores del compilador con su línea.
- [ ] Los 35 retos de C#, revisados por categoría, con sus casos y sus soluciones probadas en CI con un proyecto de .NET.
- [ ] Playground de C#.
- [ ] Modo entrevista: cinco retos de una categoría con 30 minutos y un resumen al final.

**Entregable:** los 35 retos de C# publicados, con el modo entrevista.

### Fase 7. Cierre
- [ ] Revisión de accesibilidad y rendimiento.
- [ ] Revisión en español e inglés, tema claro y oscuro, escritorio y móvil.
- [ ] README: cómo está hecho el laboratorio y cómo agregar un escenario, una arquitectura o un reto.
- [ ] Revisar el sitio publicado.

**Entregable:** las tres demos y los retos publicados y documentados.

### Opcionales
- [ ] Calibrar el modelo SQL con un SQL Server local: un script del repo genera los datos, se miden lecturas y planes reales y el modelo se ajusta para coincidir en orden de magnitud.
- [ ] Compilar los ejemplos de C# en CI con un proyecto que incluya `_includes/labs/code/**/*.cs`.
- [ ] Pruebas de extremo a extremo con Playwright y revisión automática con axe.
- [ ] Documento OpenAPI 3.1 generado desde la misma definición de endpoints, para verlo o descargarlo; ETag e `If-Match` con 412 para concurrencia optimista.
- [ ] Microservicios: simular la caída de un servicio (timeout, reintento y circuit breaker).
- [ ] Reto del día, elegido por la fecha.
- [ ] Variante del laboratorio SQL para PostgreSQL.

---

## 12. Criterios de aceptación

1. Las tres demos y los retos funcionan en español e inglés, en tema claro y oscuro, y en escritorio y móvil.
2. Sin JavaScript, cada página se lee completa.
3. Todo se puede usar solo con teclado, y con movimiento reducido no hay animaciones.
4. Cada componente de las cinco arquitecturas muestra responsabilidad, tecnologías, ventajas, desventajas y código C#, y la petición de ejemplo recorre cada diagrama.
5. En la API se pueden provocar desde la interfaz 200, 201, 204, 400, 401, 403, 404, 409, 429 y 500, y cada error sale como Problem Details.
6. Cada escenario SQL muestra los dos planes, las métricas y la explicación, y el punto de inflexión se puede ver.
7. El workflow corre `tsc`, Vitest y Jekyll antes de publicar, y los bundles caben en su presupuesto.
8. En los retos, el C# y el SQL del visitante corren en su navegador. Cada reto muestra los casos aprobados y fallidos, los errores con su línea y el tiempo, y un ciclo infinito se detiene sin colgar la página.
9. Las soluciones de referencia pasan sus casos en CI, y el editor y los motores se cargan solo en las páginas de los retos, dentro de su límite.

---

## 13. Riesgos

| Riesgo | Cómo se mitiga |
|---|---|
| Mucho texto en dos idiomas (unos 30 componentes, 6 escenarios y 6 endpoints) | Terminar dos arquitecturas antes de escribir las demás, no traducir el código C# y dejar que la prueba de paridad avise lo que falta |
| Números del laboratorio SQL poco creíbles para alguien que conoce SQL Server | Modelo basado en comportamientos documentados (páginas de 8 KB, seeks, lookups y punto de inflexión), pruebas de propiedades, aviso visible y calibración opcional con un SQL Server real |
| Cambiar el despliegue rompe el sitio | Probar el workflow en un PR, sin publicar, antes de cambiar la fuente de Pages; para volver atrás, regresar la fuente a la rama |
| Diagramas y planes en pantallas chicas | Nodos apilados por capas, planes con desplazamiento horizontal y columnas A y B una debajo de la otra |
| Parecer copia de Swagger, pganalyze, LeetCode o HackerRank | Sin sus nombres, logos, colores ni textos; los colores salen de la paleta del sitio y los enunciados de los retos son propios |
| Las licencias de MediatR o MassTransit cambian otra vez | Nota con fecha y enlace a la fuente |
| Que la llave del JWT en el navegador parezca una buena práctica | Aviso en la demo y explicación de cómo funciona en un sistema real |
| Un `{{` o `{%` en el código C# rompe el build de Jekyll | Las pruebas de datos los buscan en `_includes/labs/code/` |
| El motor de C# pesa varios MB | Se descarga solo al pulsar Ejecutar, con progreso visible y caché del navegador; el prototipo mide el tamaño antes de construir la interfaz |
| PGlite pesa unos 5.3 MB y la primera base tarda unos 2 s | Se descarga solo en las páginas de los retos, cuando el visitante va al editor, y queda en la caché. El build lo publica ya en gzip, porque GitHub Pages no comprime `.wasm` ni `.data`, y la CI revisa su presupuesto de 6 MB |
| PostgreSQL no es SQL Server: un T-SQL correcto podría fallar | Funciones con los nombres de T-SQL y sus pruebas, soluciones que corren en los dos motores y un mensaje claro para lo que no corre |
| Un ciclo infinito o una solución muy lenta cuelga la página | El código corre en un Web Worker con tiempo límite; la página lo termina y lo vuelve a crear |
| 65 retos en dos idiomas | Escribirlos y revisarlos por categoría; la prueba de paridad y la de las soluciones avisan lo que falta |
| NuGet bloqueado en el espacio de trabajo de Claude | Habilitarlo antes de la fase 6 o instalar los paquetes en local, como se hizo con npm en la fase 5 |

---

## 14. Fuentes

- GitHub Pages con un workflow propio: <https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>
- EF Core, consultas con y sin seguimiento de cambios: <https://learn.microsoft.com/ef/core/querying/tracking>
- EF Core, consultas eficientes: <https://learn.microsoft.com/ef/core/performance/efficient-querying>
- EF Core, paginación: <https://learn.microsoft.com/ef/core/querying/pagination>
- SQL Server, predicados de búsqueda (seek): <https://learn.microsoft.com/en-us/archive/blogs/craigfr/seek-predicates>
- RFC 9457, Problem Details for HTTP APIs: <https://www.rfc-editor.org/rfc/rfc9457.html>
- MassTransit v9 y su licencia: <https://masstransit.io/introduction/v9-announcement>
- MediatR y su licencia comercial: <https://dariusz-wozniak.github.io/fossed/library/mediatr>
- .NET en Web Workers: <https://learn.microsoft.com/aspnet/core/client-side/dotnet-on-webworkers>
- Un compilador de C# en el navegador con Blazor WebAssembly y Roslyn, de Microsoft Learning: <https://github.com/MicrosoftLearning/c-sharp-minor>
- PGlite, PostgreSQL en WebAssembly: <https://github.com/electric-sql/pglite>
- GitHub Pages y los encabezados COOP y COEP: <https://github.com/orgs/community/discussions/13309>
