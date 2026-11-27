# Plan: curso interactivo de Angular

Un curso nuevo de la sección **Cursos** donde el visitante aprende Angular moderno escribiendo componentes. Cada lección es una serie corta de pasos: el texto y las instrucciones a la izquierda; a la derecha, un editor con una pestaña por archivo, la **vista previa** de la aplicación y una consola. El código se transforma y corre en el navegador del visitante, con el tiempo de ejecución de Angular en modo JIT dentro de un iframe, así que el sitio sigue siendo estático: sin servidor ni cuentas, y con el avance guardado en el navegador.

**Referencia de experiencia.** La misma del curso de C# (`PLAN-CURSO.md`): el patrón de dos paneles, con la lección a la izquierda y el editor, los botones **Ejecutar** y **Enviar**, las pistas y el resultado a la derecha. Se toma la *experiencia*, no la marca, el arte ni los textos de ninguna plataforma.

Es el tercero de los tres cursos nuevos que hoy salen como "Próximamente" en `_data/course/courses.yml` (`status: soon`), y el que más motor nuevo necesita. Orden recomendado: PostgreSQL (`PLAN-CURSO-POSTGRESQL.md`), SQL Server (`PLAN-CURSO-SQLSERVER.md`) y **Angular**. Lo único que comparte con los otros dos es la plataforma de la sección 4.1 del plan de PostgreSQL.

Dónde vive cada cosa:

- **Este plan:** `PLAN-CURSO-ANGULAR.md` en la raíz del repositorio. Jekyll no lo publica (está en `exclude` de `_config.yml`).
- **Planes hermanos:** `PLAN-CURSO.md` (C#, de donde sale el formato), `PLAN-CURSO-POSTGRESQL.md` (la plataforma compartida) y `PLAN-CURSO-SQLSERVER.md`.
- **Plan del laboratorio:** `PLAN.md`.

**Estado (23 de noviembre de 2026):** propuesto, sin implementar. Se hizo un prototipo de viabilidad (sección 4.2): Angular 22 corre en una página estática y el tamaño es de unos 440 kB comprimidos. Quedó un hallazgo que el plan tiene que resolver: `input()` y `output()` no funcionan en JIT sin una transformación previa (sección 4.3). **El 27 de noviembre de 2026 se publicó solo el temario** (14 módulos y 81 lecciones como "Próximamente"), sin motor ni lecciones.

---

## 1. Alcance

### Incluye

- **Curso "Angular"** (Angular 22, la versión estable de hoy): 14 módulos y unas 80 lecciones (sección 7), cada una con 4 a 6 pasos: unos 380 en total. La primera versión publicada trae los módulos 1 a 5 (31 lecciones).
- **Angular moderno:** componentes *standalone*, señales, control de flujo de plantillas (`@if`, `@for`, `@switch`, `@defer`), `inject()`, formularios reactivos, `HttpClient`, enrutamiento y RxJS esencial. Sin `zone.js`: el curso usa detección de cambios sin zonas. Los `NgModule` y el resto del Angular anterior van en un apéndice de lectura, porque en el trabajo del visitante conviven versiones antiguas (Angular 16 y 19 en los proyectos del autor).
- **Un módulo inicial de TypeScript esencial**, con comprobación de tipos, que se puede saltar.
- **Pasos de cuatro tipos:** *lectura*, *ejercicio* (de componente o de TypeScript), *pregunta* (opción múltiple) y proyecto guiado por etapas.
- **En cada ejercicio de componente:** editor con una pestaña por archivo (hasta tres), **Ejecutar** (muestra la vista previa y la consola), **Enviar** (revisa con aserciones sobre lo que se ve y reglas sobre el código y marca el paso), tres pistas que se abren una a una, solución explicada y errores de Angular (`NG0303`, `NG0304`...) con su explicación.
- **Ejemplos del texto verificados en CI:** un componente de ejemplo y lo que se ve (sección 4.9).
- **Progreso local:** el mismo del curso de C# (`PLAN-CURSO.md`, sección 8), guardando los archivos de cada paso.
- **Enlaces al resto del sitio:** cada módulo termina con retos del laboratorio que practican lo mismo y, cuando existe, la publicación del blog sobre el tema.
- **Sin JavaScript,** cada lección se lee completa, con la solución dentro de `<details>` y lo que se ve como texto.

### No incluye

- Cuentas, sincronizar el avance entre dispositivos, ranking o certificados verificables: necesitan servidor.
- El CLI de Angular (`ng`), `npm`, SSR, hidratación ni compilación AOT en el navegador: cada ejercicio corre en JIT, en uno a tres archivos.
- Comprobación de tipos de Angular ni de las plantillas en los ejercicios de componente (los `.d.ts` de Angular son enormes). Sí hay tipos en el módulo de TypeScript. Los errores de plantilla salen al ejecutar.
- Pruebas con `TestBed` en la primera alcance (queda en los opcionales).
- Red real: el `HttpClient` de los ejercicios habla con un servidor simulado dentro del iframe.
- Copiar textos o ejemplos de angular.dev: se enlaza, no se copia.

---

## 2. Decisiones por confirmar

Cada una trae una opción recomendada.

1. **Dónde vive.** **A (recomendada):** `/curso/angular/` y `/en/course/angular/`.
2. **Motor.**
   - **A (recomendada):** transformador de TypeScript en un worker, y tiempo de ejecución de Angular en modo JIT dentro de un iframe, con un import map. Funcionó en el prototipo y pesa poco.
   - **B:** WebContainers. Descartada: instalaría paquetes de npm en cada ejercicio, necesita los encabezados COOP y COEP (GitHub Pages no los manda) y hay que revisar sus términos de uso.
   - **C:** StackBlitz embebido. Descartada como motor: no se puede revisar el resultado de forma automática. Queda como enlace opcional "Abrir en StackBlitz" en el proyecto final.
   - **D:** compilar con el compilador AOT de Angular dentro de un worker. Descartada por ahora: revisaría tipos y plantillas, pero necesita todos los `.d.ts` de Angular y un sistema de archivos virtual; es pesada y frágil.
3. **Transpilador.** **A (recomendada):** TypeScript 6.0 (la última línea en JavaScript, 6.0.3 hoy; el compilador de Angular 22 pide exactamente `>=6.0 <6.1`) en un worker: 8,7 MB sin comprimir, 1,57 MB comprimidos; da la sintaxis con su posición, el árbol para las reglas, los transformadores para JIT y, para el módulo de TypeScript, la comprobación de tipos. **B:** `esbuild-wasm`: 13,3 MB, 3,61 MB comprimidos, sin árbol propio ni tipos. Descartada. El TypeScript 7 del repositorio es nativo (binarios por plataforma) y no corre en un navegador; el worker lleva su propia copia, con otro nombre de paquete.
4. **Versión de Angular.** **A (recomendada):** 22.3.0, fija; cada lección lo dice. Se actualiza cada noviembre y cada mayo, con las versiones mayores de Angular. Las APIs que sigan siendo experimentales al escribir una lección se marcan o se dejan fuera.
5. **Estilo.** **A (recomendada):** componentes *standalone*, señales, `@if` y `@for`, `inject()`, `input()` y `output()`. `*ngIf`, `@Input()`, `NgModule` y la inyección por constructor, solo en el apéndice. **B:** enseñar lo anterior primero. Descartada.
6. **Detección de cambios.** **A (recomendada):** sin `zone.js` (`provideZonelessChangeDetection`), que es lo que funcionó en el prototipo. El apéndice explica zone.js.
7. **Módulo de TypeScript.** **A (recomendada):** sí, como módulo 1, con la nota "puedes saltarlo si ya lo conoces".
8. **Archivos por paso.** **A (recomendada):** de uno a tres, con pestañas. Basta para componente, plantilla, estilos o un servicio.
9. **Primera versión.** **A (recomendada):** módulos 1 a 5 (31 lecciones, hasta señales). **B:** todo antes de publicar.
10. **Pruebas con `TestBed`.** **A (recomendada):** fuera de la primera alcance. Es lectura con salidas capturadas en un opcional.
11. **Idiomas, progreso, navegación entre pasos y gamificación.** Lo mismo que el curso de C# (`PLAN-CURSO.md`, sección 2).
12. **Plataforma compartida primero.** Es la fase 0 del plan de PostgreSQL. Este curso no empieza antes.

---

## 3. Dónde vive en el sitio

| Página | Español | Inglés |
|---|---|---|
| Índice de cursos | `/curso/` | `/en/course/` |
| Temario de Angular | `/curso/angular/` | `/en/course/angular/` |
| Una lección | `/curso/angular/<módulo>/<lección>/` | `/en/course/angular/<module>/<lesson>/` |

- Cada par de páginas comparte `ref` y los slugs están en el idioma de cada página.
- El submenú de "Cursos" ya trae Angular como "Próximamente"; al publicarlo enlaza a su temario.
- Los datos viven en `_data/course/angular/` y los archivos del motor en `assets/labs/angular/` (el tiempo de ejecución de Angular) y `assets/labs/typescript/` (el worker y los `lib.d.ts`), ya comprimidos con gzip, como PGlite.

---

## 4. Enfoque técnico

### 4.1 Plataforma compartida

La del curso de PostgreSQL (`PLAN-CURSO-POSTGRESQL.md`, sección 4.1 y fase 0): lista de cursos, datos y páginas por curso, textos por motor y el adaptador de motor. Aquí el adaptador es el de Angular (`labs/course/engines/angular/`): editor con pestañas, vista previa, consola y el protocolo hacia el worker y el iframe.

### 4.2 Cómo corre Angular en una página estática (prototipo del 23 de noviembre de 2026)

Se armó una página de prueba con Angular 22.3.0 empaquetado con esbuild: un import map apunta a un tiempo de ejecución publicado aparte (`core`, `common`, `compiler`, `platform-browser`, `forms`, `router` y `rxjs`, con *code splitting*), y el código del alumno, ya transformado, se carga como módulo. Se sirvió en el navegador integrado, sin los encabezados COOP y COEP.

| Prueba | Resultado |
|---|---|
| Funcionó | Componentes *standalone* con `@Component`; `@Injectable` e `inject()`; `signal` y `computed`; una plantilla con `@if` y `@for`; clic en un botón que cambia una señal; `provideZonelessChangeDetection()` y `bootstrapApplication` |
| No funcionó sin transformar | `input()` y `output()`: el nombre conservaba su valor por defecto y el evento nunca llegaba |
| Con una transformación mínima | Agregar `@Input({ isSignal: true, alias, required, transform })` y `@Output('nombre')` a esos campos antes de ejecutar los hizo funcionar |
| Tamaño del tiempo de ejecución (minificado, comprimido) | Modo desarrollo, con los mensajes `NG` completos: 384 kB lo mínimo (`core`, el compilador y `platform-browser`) y 440 kB con `common`, `forms`, `router` y `rxjs`. Modo producción: 343 kB y 392 kB. El compilador JIT pesa unos 163 kB |
| TypeScript en el navegador | `typescript.js` 6.0.3: 8,7 MB, 1,57 MB comprimidos. `transpileModule` con `experimentalDecorators` emite `__decorate` y no da diagnósticos de más |

El curso usa el **modo desarrollo**: los mensajes de error de Angular traen su código (`NG0303`...), y eso es lo que `errors.yml` explica. Una lección se descarga en unos 2 MB comprimidos (el tiempo de ejecución y TypeScript), contra los 9 MB del curso de C#.

Lo que el prototipo **no** probó, y la fase 1 tiene que probar: la transformación de TypeScript dentro de un worker en el navegador (el prototipo transformó con esbuild en Node), `HttpClient`, `Router` y formularios, los bucles infinitos y el tiempo de una ejecución.

### 4.3 La transformación para JIT

En JIT, Angular no sabe que un campo `name = input('x')` es una entrada: en AOT lo detecta el compilador, y en JIT lo hace un transformador de TypeScript que Angular trae (`getInitializerApiJitTransform`, junto con `angularJitApplicationTransform` y `getDownlevelDecoratorsTransform`, en `packages/compiler-cli/src/ngtsc/transform/jit` del repositorio de Angular). El curso necesita su propia versión, en el navegador:

- Un **transformador personalizado de TypeScript** (`ts.transpileModule` acepta `transformers`) que recorre las clases y, para cada campo cuyo inicializador sea una de las **APIs de inicialización** importadas de `@angular/core`, agrega los decoradores que la transformación oficial agrega: `input()` e `input.required()`, `model()` y `model.required()` (entrada y salida `nombreChange`), `output()` y `outputFromObservable()`, `viewChild()`, `viewChildren()`, `contentChild()` y `contentChildren()`. Respeta alias importados, `readonly`, genéricos, la opción `alias` y `transform`.
- **Prueba con la oficial como oráculo:** una prueba en Node corre las dos transformaciones sobre los mismos ejemplos y compara los decoradores y sus metadatos (no el texto). Vive en un paquete aparte (`tools/angular-aot/`, sección 9) porque `@angular/compiler-cli` pide TypeScript 6.0 y el repositorio usa el 7.
- **Inyección por constructor:** se enseña `inject()`. La inyección por constructor con tipos necesita metadatos de diseño, que el apéndice resuelve con `@Inject(TOKEN)` explícito; si hace falta, se replica `getDownlevelDecoratorsTransform` después.
- **Guardas de bucles:** el mismo transformador envuelve `while`, `for` y `do` con un contador que lanza un error al pasar de un millón de vueltas (sección 4.7).

### 4.4 Qué se reutiliza

| Pieza | Dónde está | Qué se hace |
|---|---|---|
| Worker con tiempo límite y carga a demanda | `labs/shared/engine.ts` (`WorkerEngine`, 5 s, `warm`, `warmOnIntent`) | Se reutiliza el patrón para el worker de TypeScript |
| Editor | `labs/shared/editor.ts` (CodeMirror 6) | Se reutiliza con `@codemirror/lang-javascript` (TypeScript, 6.2.5) y `@codemirror/lang-html` (6.4.12), que hay que agregar; el repositorio solo usa `lang-sql` |
| Núcleo de la lección | `labs/course/` (máquina de pasos, progreso, pie, menú, pistas) | El de la sección 4.1 |
| Publicar un motor ya comprimido | `scripts/build-labs.mjs` (PGlite) y `scripts/csharp-engine.mjs` | Modelo para `scripts/angular-runtime.mjs` |
| Páginas desde datos, presupuesto y paridad | `scripts/course-pages.mjs`, `scripts/budget.mjs`, `scripts/course-data.test.ts` | Se amplían |
| Presentación paso a paso | `labs/architecture/stepper.ts` | Modelo para ver el árbol de componentes en una lección, si hace falta |

### 4.5 Qué hay que construir

- **Fase 0 compartida** de la sección 4.1.
- **Publicador del tiempo de ejecución** (`scripts/angular-runtime.mjs`, `npm run angular`): empaqueta los paquetes de Angular y `rxjs` con esbuild, en modo desarrollo, con *code splitting*, a `assets/labs/angular/`, ya comprimidos, con el archivo de avisos de licencia (Angular es MIT; TypeScript, Apache-2.0, y pide conservar su aviso).
- **Worker de TypeScript:** carga `typescript.js` a demanda, transforma cada archivo (sección 4.3), devuelve el JavaScript y los diagnósticos de sintaxis con su línea, y evalúa las reglas sobre el código.
- **Página del iframe y arnés** (`assets/labs/angular/sandbox.html`): carga el tiempo de ejecución con un import map, arranca la aplicación del paso, expone la consola, y corre las aserciones del paso sobre lo que se ve.
- **Cargador de archivos del alumno:** los `import` entre archivos del paso (`./user.service`) se reescriben a URL de Blob **dentro del iframe**, antes de cargarlos, porque un iframe sin origen no puede importar un Blob creado por otro origen.
- **Servidor simulado** para `HttpClient`: un interceptor que el arnés agrega, con las rutas y las respuestas del YAML del paso (con latencia y errores).
- **Reglas sobre el código** por el árbol de TypeScript (sección 4.6) y el lenguaje de aserciones.
- **`errors.yml` de Angular**, por código `NG` y para los errores de sintaxis de TypeScript.
- **Módulo de TypeScript esencial** con comprobación de tipos: `ts.createProgram` con un servidor de archivos virtual y los `lib.d.ts` publicados en `assets/labs/typescript/lib/` (su tamaño se mide en la fase 1).
- **Pruebas de lecciones en Node:** el mismo arnés sobre jsdom (sección 9).

### 4.6 Cómo se revisa un ejercicio

Dos modos, según el paso:

- **Componente** (`mode: component`): se arma la aplicación con los archivos del alumno y se revisa lo que se ve y lo que pasa al interactuar.
- **TypeScript** (`mode: typescript`): se corre el código, con la consola capturada, y se comparan la salida y los errores de tipos.

Revisiones de un paso (se combinan; el paso se resuelve cuando pasan todas):

| Revisión | Qué comprueba |
|---|---|
| `render` | Un elemento (`selector`) tiene ese `text`, ese `count` de coincidencias, ese atributo o clase, o está visible u oculto |
| `interact` | Una lista de acciones sobre el DOM antes de la siguiente revisión: `click`, `type` (escribe en un campo y dispara `input`), `select` y `press` |
| `console` | La consola no tiene errores (`errors: none`), o contiene exactamente un mensaje |
| `stdout` y `throws` | En el modo TypeScript: la salida es ese texto, o el código lanza esa excepción |
| `types` | En el modo TypeScript: no hay errores de tipos, o hay exactamente ese (`TS2322`...) |
| `uses-syntax` y `avoids-syntax` | El código usa o evita una construcción de TypeScript (`Decorator`, `ArrowFunction`...), con los nombres de `SyntaxKind`, como las reglas de Roslyn del curso de C# |
| `uses-call` y `uses-decorator` | El código llama a `signal`, `computed`, `inject`, `input`... o usa `@Component` y compañía |
| `template-uses` y `template-avoids` | La plantilla (en línea o en su archivo) contiene `@for` o evita `*ngIf`; se revisa con una lectura sencilla de la plantilla, no con el compilador |

Primero se revisa lo que se ve, y las reglas solo cuando lo que se enseña es la construcción misma ("usa `@for`"). Cada ejercicio con reglas se prueba con dos o tres soluciones distintas. Los nombres de las reglas necesitan su etiqueta legible en `ui-angular.yml`, en los dos idiomas.

Cuando una revisión falla, el mensaje dice qué se esperaba y qué se vio ("se esperaba que `#count` dijera «2» y dijo «0»").

### 4.7 Sandbox y límites

- **Un iframe nuevo por ejecución,** con `sandbox="allow-scripts"` (sin origen, sin cookies ni almacenamiento) y una página estática con una política de seguridad de contenido: sin red (`connect-src 'none'`) y sin recursos de otros sitios. El compilador JIT puede necesitar `'unsafe-eval'`; la fase 1 comprueba qué hace falta. Habla con la lección por `postMessage`.
- **Sin compartir código:** el curso no tiene enlaces que lleven el código de un visitante a otro, así que el único código que corre es el que el visitante escribe en su navegador. Importar un avance valida su forma y su tamaño.
- **Bucles infinitos:** el iframe comparte el hilo con la lección si el navegador no lo aísla. Defensa: las guardas del transformador (sección 4.3) detienen los bucles comunes, y la lección espera el mensaje `ready` del iframe durante 5 s antes de retirarlo. No cubre todos los casos (un bucle dentro de una librería), y es el riesgo principal del curso (sección 12).
- **Límites:** 20 KB de código por paso (sumados los archivos), tres archivos, y una consola que guarda como máximo 200 líneas.

### 4.8 Errores de Angular explicados

En desarrollo, Angular escribe sus errores con un código (`NG0100`, `NG0201`, `NG0303`, `NG0304`, `NG0600`, `NG0950`, `NG0955`...) y los muestra con `console.error` o los lanza. El arnés los captura, junto con los errores no atrapados y los rechazos de promesas. `_data/course/angular/errors.yml` guarda, por código, una explicación breve en los dos idiomas, además de las de los errores de sintaxis de TypeScript. Cada código nuevo necesita su programa mínimo en una prueba de Vitest que corre un componente en jsdom y comprueba que el código es el que de verdad da Angular.

### 4.9 Ejemplos del texto verificados en CI

Un bloque ` ```ts ` con un componente seguido de otro ` ```text ` con lo que se ve (el texto visible de la aplicación) es un ejemplo: la prueba lo corre en jsdom y compara. Un bloque ` ```ts ` sin resultado es un fragmento y no se corre. Los bloques de plantilla suelta (` ```html `) se muestran sin correr.

### 4.10 Lo que este motor no hace

- No compila AOT ni revisa las plantillas con `strictTemplates`: una plantilla con un error de tipos puede correr en el curso y fallar en un proyecto real. Para las soluciones, una prueba opcional las compila con el compilador real (sección 9).
- No comprueba los tipos de Angular en los ejercicios de componente.
- No ejecuta `ng`, SSR ni hidratación.
- Los disparadores de `@defer` que dependen de la vista (`on viewport`) no se pueden verificar en jsdom; las lecciones usan `on timer`, `on interaction` e `on immediate`.

---

## 5. Formato de una lección

Un archivo por lección, con la estructura del curso de C#. Cambian los pasos de ejercicio:

```yaml
# _data/course/angular/templates/events.yml
shared:
  minutes: 12
  steps:
    - id: intro
      kind: read
    - id: counter
      kind: exercise
      mode: component                  # component | typescript
      entry: app.ts                    # el archivo con la clase App (selector app-root)
      files:
        - name: app.ts
          starter: |
            import { Component, signal } from '@angular/core';

            @Component({
              selector: 'app-root',
              template: `
                <p id="count">{{ count() }}</p>
                <button id="inc">+1</button>
              `,
            })
            export class App {
              count = signal(0);
            }
          solution: |
            import { Component, signal } from '@angular/core';

            @Component({
              selector: 'app-root',
              template: `
                <p id="count">{{ count() }}</p>
                <button id="inc" (click)="count.update((n) => n + 1)">+1</button>
              `,
            })
            export class App {
              count = signal(0);
            }
      checks:
        - render: { selector: "#count", text: "0" }
        - interact: [{ click: "#inc" }, { click: "#inc" }]
        - render: { selector: "#count", text: "2" }
        - console: { errors: none }
      rules:
        - { kind: uses-call, name: update }
    - id: widen
      kind: exercise
      mode: typescript
      starter: |
        const id: number = "42";
      solution: |
        const id: number = 42;
        console.log(id);
      runs:
        - stdout: "42\n"
      types: { errors: none }
    - id: quiz
      kind: choice
      answer: 1
es:
  slug: eventos
  title: Eventos
  summary: Reaccionar a un clic, a una tecla o a un cambio.
  steps:
    counter:
      title: Un contador
      text: …
      instructions: …
      hints: [ …, …, … ]
      explanation: …
      failure: …
en:
  slug: events
  # …mismos pasos, en inglés
```

- Un ejercicio de componente puede traer un servidor simulado (`backend`) y rutas (`routes`), según la lección.
- Un archivo puede ser de solo lectura (`readonly: true`) para dar el servicio o la plantilla que el paso no pide escribir.
- El código de ejemplo no se traduce: identificadores y textos de la interfaz en inglés, pocos comentarios. Se traduce la prosa.

---

## 6. Dirección visual y experiencia

La estructura es la del curso de C# (`PLAN-CURSO.md`, sección 6). Cambian los paneles de la derecha:

```text
Escritorio (la lección ocupa toda la pantalla)
┌──────────────────────────────────────────────────────────────────────────┐
│ Cursos › Angular › Eventos                ████████░░░░░░ 40 %   ES · ☼   │
├───────────────────────────────────┬──────────────────────────────────────┤
│ LECCIÓN                           │ [app.ts] [user.service.ts]           │
│                                   │ ┌──────────────────────────────────┐ │
│ 02. Un contador                   │ │ 1  import { Component } from …   │ │
│                                   │ │ 2                                │ │
│ Texto, con `código` en línea,     │ │ 3  @Component({                  │ │
│ bloques con botón Copiar y        │ └──────────────────────────────────┘ │
│ cuadros de Nota y Ojo.            │ [?] [?] [?]    [▶ Ejecutar] [Enviar] │
│                                   │ VISTA PREVIA                         │
│ ── Instrucciones ──               │ ┌──────────────────────────────────┐ │
│ 1. Haz que cada clic sume uno     │ │ 0                                │ │
│    al contador.                   │ │ [ +1 ]                           │ │
│                                   │ └──────────────────────────────────┘ │
│                                   │ CONSOLA                              │
├───────────────────────────────────┴──────────────────────────────────────┤
│ ≡  Eventos · Ejercicio 2/6  ✔ Resuelto                [Atrás] [Siguiente]│
└──────────────────────────────────────────────────────────────────────────┘

Móvil: una sola columna (lección, editor, vista previa, consola) y el pie fijo abajo.
```

- **Vista previa:** el iframe con la aplicación. Tiene un nombre accesible ("Vista previa de la aplicación") y se anuncia el resultado de **Enviar** en una región `aria-live`.
- **Consola:** lo que escribe `console.log`, los errores con su código `NG` y su explicación, y los errores de sintaxis de TypeScript con su línea.
- **Pestañas de archivos:** hasta tres; un archivo de solo lectura lleva un candado y su nombre en gris.
- **Módulo de TypeScript:** sin vista previa; la consola y los errores de tipos con su línea.
- **Carga del motor:** el tiempo de ejecución (unos 440 kB) y TypeScript (unos 1,6 MB) se descargan cuando el visitante muestra intención de ejecutar, con barra de progreso, y quedan en la caché del navegador. Las lecciones de lectura no descargan nada.
- **Atajos y accesibilidad:** los del curso de C#. La vista previa no atrapa el foco del teclado.

---

## 7. Temario

Unas 80 lecciones y unos 380 pasos. La versión 1 son los módulos 1 a 5.

| # | Módulo | Lecciones | Versión 1 |
|---|---|---|---|
| 1 | TypeScript esencial | Tipos e inferencia · Funciones · Objetos e interfaces · Uniones y tipos literales · Clases y modificadores · Genéricos básicos · Módulos y decoradores | Sí |
| 2 | Primeros pasos con Angular | Qué es Angular y cómo se organiza una aplicación · Tu primer componente · Interpolación y expresiones · Estilos del componente · Componentes anidados · Un proyecto real (`ng new`, `main.ts`, `app.config.ts`) | Sí |
| 3 | Plantillas y enlaces | Enlace de propiedades · Eventos · Enlace de dos vías (`model()` y `ngModel`) · Clases y estilos · Variables de plantilla · Pipes integrados · Pipes propios | Sí |
| 4 | Control de flujo | `@if` y `@else` · `@for`, `track` y `@empty` · `@switch` · `@let` · `@defer` | Sí |
| 5 | Señales | `signal` · `computed` · `effect` · `linkedSignal` · Señales con objetos y arreglos · Señales y RxJS | Sí |
| 6 | Componentes en profundidad | `input()` · `output()` · `model()` · Proyección de contenido · Consultas (`viewChild`, `contentChild`) · Ciclo de vida y `afterNextRender` · Directivas de atributo | No |
| 7 | Servicios e inyección de dependencias | Servicios con `inject()` · `providedIn` · Alcance de los proveedores · `InjectionToken` · Estado compartido con señales · Servicios y componentes | No |
| 8 | Formularios | Por plantilla · Reactivos · `FormBuilder` · Validadores integrados · Validadores propios · Errores y estados · `FormArray` | No |
| 9 | HTTP y datos | `HttpClient` · Parámetros, cabeceras y errores · Interceptores · `resource` y `httpResource` · Reintentos y caché | No |
| 10 | Enrutamiento | Rutas y `RouterOutlet` · `routerLink` y navegación · Parámetros · Rutas hijas · Guards · Resolvers · Carga diferida | No |
| 11 | RxJS esencial | Observables y suscripciones · `map`, `filter` y `tap` · `switchMap`, `mergeMap` y `concatMap` · `combineLatest` y `forkJoin` · Subjects · `async`, `toSignal` y `toObservable` | No |
| 12 | Rendimiento y buenas prácticas | Detección de cambios sin zone.js · `OnPush` · `track` y listas largas · Carga diferida y tamaño · Accesibilidad y guía de estilo | No |
| 13 | Proyecto final (guiado) | Lista de tareas: la estructura · El estado y los servicios · Formularios y rutas | No |
| 14 | Apéndice: el Angular anterior (lectura) | `NgModule` · `*ngIf` y `*ngFor` · `@Input()` y `@Output()` · Zone.js y la detección de cambios clásica | No |

Las APIs que sigan siendo experimentales en Angular 22 al escribir su lección (por ejemplo `resource` y `httpResource`) se marcan en el texto o se dejan fuera; cada lección se escribe contra la guía vigente de angular.dev.

---

## 8. Progreso local

El del curso de C# (`PLAN-CURSO.md`, sección 8): una sola clave, `mi-sitio2.curso.v1`, organizada por curso; para este, `angular`. Lo que cambia: el código de un paso son **sus archivos** (un objeto con el contenido de cada pestaña), con el mismo tope de 20 KB por paso, sumados.

---

## 9. Pruebas y calidad

- `tsc --noEmit` estricto y Prettier, como el resto de `labs/`.
- **Vitest:**
  - **Transformador:** un ejemplo por cada API de inicialización (`input`, `input.required`, `model`, `output`, `viewChild`, `viewChildren`, `contentChild`, `contentChildren`), con alias, `transform` y genéricos; que no toque lo que no es de Angular; y las guardas de bucles.
  - **Lenguaje de aserciones:** `render`, `interact`, `console`, con mensajes de error legibles.
  - **Núcleo y progreso:** los del curso de C# sobre el adaptador, con un motor falso, y varios archivos por paso.
  - **Datos:** paridad `es`/`en`, ids únicos, slugs únicos, 1 a 3 pistas, solución y al menos una revisión por ejercicio, la regla de las llaves dobles ajustada a lo que decida la fase 2 (ver abajo), etiquetas de las reglas y `errors.yml` completo.
  - **Páginas:** `scripts/course-pages.test.ts`.
- **Lecciones en Node** (`scripts/angular-lessons.test.ts`): el arnés sobre jsdom, TypeScript 6.0 y el tiempo de ejecución de Angular. La solución de cada ejercicio pasa; su código inicial no; los ejemplos del texto muestran lo que dicen; cada código de `errors.yml` se produce.
- **Comprobación AOT opcional** (`tools/angular-aot/`): un paquete aparte, con su propio `package.json` (`@angular/compiler-cli` 22.3.0 pide TypeScript `>=6.0 <6.1`, y el repositorio usa el 7), que compila cada solución con `strictTemplates`, para que ninguna solución publicada falle en un proyecto real. También aloja la prueba del transformador contra el oficial. Corre en su propio trabajo de CI, con Node 24 (Angular 22 pide Node `^22.22.3 || ^24.15.0 || >=26`).
- **Accesibilidad:** teclado completo, foco visible (la vista previa no atrapa el teclado), contraste AA, movimiento reducido y la versión sin JavaScript.
- **Rendimiento:** presupuestos nuevos en `scripts/budget.mjs`: 600 kB comprimidos para el tiempo de ejecución de Angular (medido: 440 kB), 2 MB para el worker de TypeScript (medido: 1,57 MB) y 30 kB para el adaptador. Las páginas fuera del curso no cargan nada nuevo.
- Revisión final en los dos idiomas, tema claro y oscuro, escritorio y móvil.

Nota sobre las llaves dobles: las plantillas de Angular llevan `{{ }}`, y hoy la prueba de datos del curso de C# prohíbe `{{` y `{%` en cualquier texto o código (`scripts/course-data.test.ts`: "Jekyll los leería como Liquid"). Jekyll no vuelve a interpretar lo que imprime desde los datos, así que la regla puede ser solo una precaución. La fase 2 lo comprueba con un paso de prueba que lleve llaves dobles en el texto, en el código y en una plantilla, construido con Jekyll y revisado en el HTML resultante. Si rompen algo, el generador de páginas las escapa; si no, la regla se quita para este curso, y la prueba de datos se ajusta al resultado.

---

## 10. Fases

Cada fase se trabaja en su rama, entra a `main` con un pull request y termina con algo probado. El mensaje de cada commit sigue el formato del repositorio ("Curso de Angular, fase N: …").

### Fase 0. Plataforma compartida
Es la del curso de PostgreSQL (su fase 0). Este curso espera a que esté hecha.

### Fase 1. Decisiones y prototipo
- [x] Prototipo de viabilidad (sección 4.2): JIT en una página estática, tamaños y el hallazgo de `input()` y `output()`.
- [ ] Confirmar las decisiones de la sección 2.
- [ ] **Criterios de éxito del prototipo en el navegador**, con el transformador de TypeScript 6.0 dentro de un worker:
  1. Un componente editado corre y se ve en la vista previa en menos de 1,5 s con el motor ya cargado (se mide).
  2. El transformador produce los mismos decoradores que `getInitializerApiJitTransform` para todas las APIs de inicialización.
  3. `HttpClient` con un servidor simulado, `Router` con ubicación por hash y formularios reactivos corren dentro del iframe.
  4. Un bucle infinito en el código del alumno se detiene sin colgar la página.
  5. Los tamaños caben en los presupuestos de la sección 9, y se averigua qué necesita la política de seguridad (`unsafe-eval`).
  6. Los errores de plantilla (`NG0303`, `NG0304`...) llegan a la consola con su código.
- [ ] **Plan B** si fallan los criterios 1 a 4: lecciones con vista previa estática (el HTML de la solución, generado en el build) y revisión solo sobre el código, más el enlace "Abrir en StackBlitz".
- [ ] Escribir a mano la lección piloto "Tu primer componente" en español e inglés.

**Entregable:** decisiones aprobadas y un componente editable que corre en una página del curso, o el plan B elegido con sus razones.

### Fase 2. Datos y páginas
- [ ] Esquema de lección con archivos, `mode`, `checks` y `rules`; `ui-angular.yml` y un `errors.yml` inicial.
- [ ] Comprobar con un paso de prueba si las llaves dobles de las plantillas rompen el build de Jekyll, y resolverlo (sección 9).
- [x] El curso en `courses.yml` y su temario en `catalog.yml`, todavía como "Próximamente". (Publicado ya, solo el temario.)
- [ ] Pruebas de datos y la lección piloto en el repositorio.

**Entregable:** las páginas existen y se leen sin JavaScript; los datos se validan en CI.

### Fase 3. Motor del curso
- [ ] `scripts/angular-runtime.mjs` y `npm run angular`, con los avisos de licencia.
- [ ] Worker de TypeScript: transformador (con sus guardas de bucles), diagnósticos y reglas sobre el árbol.
- [ ] Página del iframe, arnés, cargador de archivos y servidor simulado.
- [ ] Lenguaje de aserciones (`render`, `interact`, `console`).
- [ ] `scripts/angular-lessons.test.ts` y el paquete `tools/angular-aot/`.

**Entregable:** una prueba en Node revisa cada lección del curso, y una página de prueba corre una en el navegador.

### Fase 4. Página de la lección
- [ ] Adaptador de Angular: pestañas de archivos, vista previa, consola y atajos.
- [ ] Módulo de TypeScript: comprobación de tipos con `ts.createProgram` y los `lib.d.ts`.
- [ ] Móvil, temas claro y oscuro, `aria-live` y foco; presupuestos y pruebas de interfaz con jsdom.

**Entregable:** la lección piloto funciona completa en español e inglés.

### Fase 5. Contenido: módulos 1 a 5 (versión 1)
- [ ] Las 31 lecciones de los módulos 1 a 5, en español e inglés, revisadas en el navegador.
- [ ] Mini-proyecto del módulo 5: un contador de tareas con señales, por etapas.
- [ ] Retos del laboratorio al cierre de cada módulo.
- [ ] README: cómo agregar una lección de Angular, correr sus pruebas y publicar el tiempo de ejecución.
- [x] Publicar: quitar Angular de "próximos" y enlazar su temario. (Solo el temario, a pedido del autor.)

**Entregable:** el curso, con los módulos 1 a 5, publicado.

### Fase 6. Contenido: módulos 6 a 10
- [ ] Componentes en profundidad, servicios, formularios, HTTP y enrutamiento (32 lecciones).
- [ ] La comprobación AOT de las soluciones en CI.

**Entregable:** los módulos 6 a 10 publicados.

### Fase 7. Contenido: módulos 11 a 14
- [ ] RxJS, rendimiento, proyecto final y apéndice (18 lecciones).
- [ ] Revisar las lecciones contra la versión estable de Angular vigente.

**Entregable:** el temario completo publicado.

### Fase 8. Cierre
- [ ] Revisión de accesibilidad y rendimiento.
- [ ] Revisión en español e inglés, tema claro y oscuro, escritorio y móvil.
- [ ] Probar una lección con alguien que no sepa Angular y ajustar lo que se atore.
- [ ] README completo y revisión del sitio publicado.

**Entregable:** el curso publicado y documentado.

### Opcionales
- [ ] Botón "Abrir en StackBlitz" con los archivos del proyecto final.
- [ ] Pruebas con `TestBed` dentro del navegador, con un corredor mínimo.
- [ ] Formularios con señales y otras APIs, cuando dejen de ser experimentales.
- [ ] Compilar con el compilador AOT dentro de un worker, para revisar tipos y plantillas en el editor.
- [ ] Racha de días e insignias locales; certificado descargable sin validez verificable.
- [ ] Funcionar sin conexión después de la primera visita, con un service worker que guarde el motor.
- [ ] Pruebas de extremo a extremo con Playwright y revisión automática con axe.

---

## 11. Criterios de aceptación

1. El curso funciona en español e inglés, en tema claro y oscuro, y en escritorio y móvil.
2. Sin JavaScript, cada lección se lee completa.
3. En cada ejercicio de componente, **Ejecutar** muestra la vista previa y la consola; **Enviar** revisa lo que se ve y marca el paso; las pistas y la solución están disponibles; un error de Angular sale con su código y su explicación, y uno de sintaxis, con su línea.
4. Un bucle infinito en el código del alumno no cuelga la página.
5. El tiempo de ejecución y TypeScript se descargan solo cuando el visitante muestra intención de ejecutar, y caben en sus presupuestos.
6. `input()`, `output()`, `model()` y las consultas por señales funcionan en los ejercicios, con una prueba que las compara con la transformación oficial de Angular.
7. En CI: la solución de cada ejercicio pasa; su código inicial no pasa; los ejemplos del texto muestran lo que dicen; cada código de `errors.yml` se produce; y cada texto existe en español e inglés.
8. Cada solución publicada compila también con el compilador AOT de Angular y `strictTemplates`.
9. El progreso recuerda los pasos resueltos, los archivos y la última lección; funciona sin `localStorage`; se puede exportar, importar y borrar.
10. Todo se usa con teclado, con foco visible y contraste AA, y con movimiento reducido no hay animaciones.
11. El contenido es propio: ningún texto, ejercicio, imagen ni marca copiados de otra plataforma o de angular.dev.

---

## 12. Riesgos

| Riesgo | Cómo se mitiga |
|---|---|
| El código del alumno corre en el mismo hilo que la lección: un bucle infinito la cuelga | Guardas de bucles en el transformador, iframe sin origen (que los navegadores suelen aislar en otro proceso), espera de `ready` de 5 s y el plan B de la fase 1 si no alcanza. Es el riesgo principal |
| El transformador de `input()`, `output()` y compañía se desvía de la transformación oficial al salir una versión nueva de Angular | Prueba con la transformación oficial como oráculo, con la versión de Angular fija, y una revisión en cada versión mayor |
| Angular cambia cada seis meses | Versión fija y escrita en cada lección, revisión cada noviembre y cada mayo, APIs experimentales marcadas o fuera |
| Las plantillas no se revisan con `strictTemplates` en el navegador | Las soluciones se compilan con AOT en CI; el curso lo dice en la sección de límites |
| Sin tipos de Angular, el editor no marca errores que un proyecto real sí marcaría | Se dice en la lección 1 del módulo 2, y el módulo de TypeScript sí los comprueba |
| Las llaves dobles (`{{ }}`) de las plantillas están prohibidas hoy en los datos del curso | La fase 2 construye un paso de prueba con Jekyll para saber si de verdad rompen algo; si es así, el generador de páginas las escapa, y si no, se quita la regla para este curso |
| Hay que descargar unos 2 MB antes de la primera ejecución | Se carga al mostrar intención, con progreso, y queda en la caché; las lecciones de lectura no la descargan |
| TypeScript 7 (nativo) no corre en el navegador y el compilador de Angular 22 pide 6.0 | El worker lleva TypeScript 6.0 con otro nombre de paquete; la comprobación AOT va en un paquete aparte |
| jsdom no es un navegador: algunas revisiones (diseño, `@defer` por vista) no se pueden probar | Las lecciones usan lo que jsdom soporta; la fase 8 repasa en navegador real |
| Licencias de terceros al redistribuir Angular (MIT) y TypeScript (Apache-2.0) | Archivo de avisos publicado junto al motor y revisado en cada actualización |
| WebContainers y StackBlitz tienen términos propios | No se usan como motor; StackBlitz es solo un enlace opcional |
| Mucho contenido en dos idiomas (unos 380 pasos) | Publicar primero los módulos 1 a 5, escribir por módulo, plantillas, la prueba de paridad y la verificación automática |
| Escribir TypeScript y plantillas en el celular es incómodo | Ejercicios cortos, archivos con la mayor parte escrita y la opción de ver la solución |
| El progreso se pierde al limpiar los datos del navegador | Exportar e importar, un aviso visible y poco volumen guardado |
| Parecerse a otra plataforma o copiar la documentación | Solo se toma el patrón de dos paneles; textos, ejercicios y ejemplos propios; angular.dev se enlaza, no se copia |

---

## 13. Fuentes

- Angular: <https://angular.dev/>
- Señales: <https://angular.dev/guide/signals>
- Control de flujo de plantillas: <https://angular.dev/guide/templates/control-flow>
- Entradas y salidas de un componente: <https://angular.dev/guide/components/inputs> y <https://angular.dev/guide/components/outputs>
- Inyección de dependencias: <https://angular.dev/guide/di>
- Formularios: <https://angular.dev/guide/forms>
- `HttpClient`: <https://angular.dev/guide/http>
- Enrutamiento: <https://angular.dev/guide/routing>
- Detección de cambios sin zonas: <https://angular.dev/guide/zoneless>
- Pruebas: <https://angular.dev/guide/testing>
- CLI de Angular: <https://angular.dev/tools/cli>
- Hoja de ruta de Angular: <https://angular.dev/roadmap>
- Repositorio de Angular y su transformación para JIT: <https://github.com/angular/angular> y <https://github.com/angular/angular/tree/main/packages/compiler-cli/src/ngtsc/transform/jit>
- TypeScript (manual): <https://www.typescriptlang.org/docs/handbook/intro.html>
- API del compilador de TypeScript (`transpileModule`, transformadores): <https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API>
- Import maps: <https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/script/type/importmap>
- WebContainers (el motor descartado): <https://webcontainers.io/>
