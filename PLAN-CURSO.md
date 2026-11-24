# Plan: curso interactivo de fundamentos de C#

Una sección nueva del sitio donde el visitante aprende C# desde cero escribiendo código. Cada lección es una serie corta de pasos: el texto y las instrucciones a la izquierda, un editor a la derecha y una terminal con lo que imprime el programa. El código se compila y corre en el navegador del visitante con el mismo motor de C# que ya usan los retos del laboratorio (Roslyn en WebAssembly), así que el sitio sigue siendo estático: sin servidor ni cuentas, y con el avance guardado en el navegador.

**Referencia de experiencia.** El modelo es el de las plataformas de cursos interactivos: la lección a la izquierda; el editor, los botones **Ejecutar** y **Enviar**, las pistas y la terminal a la derecha; una barra de avance por lección y un pie con "Ejercicio 2/5", **Atrás** y **Siguiente**. Se toma la *experiencia* (el patrón de dos paneles), no su marca, su arte ni sus textos.

Dónde vive cada cosa:

- **Este plan:** `PLAN-CURSO.md` en la raíz del repositorio del sitio. Jekyll no lo publica (está en `exclude` de `_config.yml`, igual que `PLAN.md`).
- **Código:** `F:\Respaldo\Respaldo\Cursos\MiSitio2`, junto al resto del sitio.
- **Plan del laboratorio:** `PLAN.md`. El curso se apoya en lo que construyeron sus fases 5 y 6.
- **Planes de los otros cursos:** `PLAN-CURSO-POSTGRESQL.md`, `PLAN-CURSO-SQLSERVER.md` y `PLAN-CURSO-ANGULAR.md`, los tres de la lista de `_data/course/soon.yml`, con este mismo formato. El de PostgreSQL trae la fase 0 de la plataforma compartida.

**Estado (24 de noviembre de 2026):** en implementación en la rama `curso-interactivo`. Las fases 0 a 3 están hechas y el contenido de la versión 1 está escrito: los módulos 1, "Primeros pasos", 2, "Operadores y texto", y 3, "Control de flujo", con su mini-proyecto "Adivina el número". Son 20 lecciones y 126 pasos, en español e inglés, probados en el navegador. La sección se llama "Cursos": su menú abre un submenú con el curso de C# y, como "Próximamente", Angular, SQL Server y PostgreSQL (también en la portada y en el índice). Los módulos 4 a 12 ya están escritos: "Colecciones" (5 lecciones y 28 pasos), "Métodos" (7 y 38), "Clases y objetos" (7 y 37), "Herencia y polimorfismo" (7 y 39, con el mini-proyecto "Lista de tareas"), "Nulos y errores" (6 y 31), "LINQ" (6 y 30), "Genéricos y delegados" (4 y 22), "Asincronía" (3 y 15) y "C# moderno" (6 y 34, con el mini-proyecto final "Conversor de unidades"), con lo que el curso suma 71 lecciones y 400 pasos. Cada módulo cierra con retos del laboratorio y lecturas del blog. Queda lo que sigue sin marcar en cada fase, sobre todo el cierre de la fase 7.

---

## 1. Alcance

### Incluye

- Una sección **Cursos** con un índice de cursos, el temario del curso de C# y una página por lección, en español e inglés.
- **Curso "Fundamentos de C#":** 12 módulos y unas 70 lecciones (sección 7), cada una con 4 a 7 pasos. La primera versión publicada trae los módulos 1 a 3.
- **Pasos de tres tipos:** *lectura* (solo texto), *ejercicio* (código que se ejecuta y se revisa) y *pregunta* (opción múltiple, para ideas que no se escriben en código).
- **En cada ejercicio:** editor con resaltado de C#, **Ejecutar** (muestra lo que imprime el programa), **Enviar** (revisa y marca el paso como resuelto), tres pistas que se abren una a una, solución explicada y terminal con errores del compilador explicados.
- **Entrada simulada:** un cuadro con las líneas que leerá `Console.ReadLine()` (sección 4).
- **Progreso local:** pasos resueltos, último código de cada paso y "Continuar donde lo dejaste", en el `localStorage` del navegador, con exportar, importar y borrar.
- **Enlaces al resto del sitio:** cada módulo termina con retos del laboratorio que practican lo mismo y, cuando existe, la publicación del blog sobre el tema.
- **Sin JavaScript,** cada lección se lee completa, con la solución dentro de `<details>`.

### No incluye

- Cuentas, sincronizar el avance entre dispositivos, ranking o certificados verificables: necesitan servidor.
- Entrada en vivo: `Console.ReadLine()` no puede quedarse esperando al visitante en un sitio estático (sección 4).
- Archivos, red, hilos reales, `Console.ReadKey` ni `Console.Clear`: el navegador no los permite. Las lecciones usan alternativas en memoria (`StringReader`, `MemoryStream`) y lo dicen.
- Proyectos de varios archivos o paquetes NuGet: cada ejercicio es un solo archivo.
- Otros cursos. PostgreSQL, SQL Server y Angular tienen su propio plan (arriba) y no están en este alcance.

---

## 2. Decisiones por confirmar

Cada una trae una opción recomendada.

1. **Dónde vive.**
   - **A (recomendada):** sección propia, `/curso/` y `/en/course/`, con el curso de C# en `/curso/csharp/`. El menú gana "Cursos" / "Courses" entre Laboratorio y Publicaciones.
   - **B:** dentro del laboratorio (`/laboratorio/curso/`), sin entrada nueva en el menú.
2. **Motor.** **A (recomendada):** reutilizar el de los retos y agregarle ejecución de programas con entrada simulada y revisiones. No hay alternativa realista sin servidor.
3. **Entrada de datos.**
   - **A (recomendada):** cuadro "Entrada" con las líneas que leerá `Console.ReadLine()`, prellenado por la lección y editable.
   - **B:** no usar `ReadLine` en el curso.
4. **Formato de las lecciones.**
   - **A (recomendada):** un YAML por lección en `_data/course/`, con `shared`, `es` y `en`, como los retos.
   - **B:** un Markdown con front matter por paso. Es más cómodo de escribir y más difícil de validar.
5. **Primera versión.**
   - **A (recomendada):** módulos 1 a 3 completos (19 lecciones) y el resto por fases.
   - **B:** los 12 módulos antes de publicar.
6. **Idiomas.** **A (recomendada):** español e inglés desde la primera lección, con la prueba de paridad de siempre. **B:** español primero.
7. **Progreso.** **A (recomendada):** solo en el navegador, con exportar, importar y borrar. **B:** cuentas (descartada: necesita servidor).
8. **Navegación entre pasos.**
   - **A (recomendada):** libre hacia atrás y hasta el primer paso sin resolver hacia adelante. Si el visitante pide la solución, el paso queda como "visto" y se desbloquea el siguiente; para marcarlo como resuelto, la envía.
   - **B:** estricta, un paso a la vez sin ver soluciones.
9. **Gamificación.** **A (recomendada):** fuera de la primera versión; después, racha e insignias locales. **B:** puntos desde el inicio.
10. **Referencia visual.** Solo se toma el patrón de dos paneles. El color, la tipografía y los iconos salen de la paleta del sitio, y los textos y ejercicios son propios.

---

## 3. Dónde vive en el sitio

| Página | Español | Inglés |
|---|---|---|
| Índice de cursos | `/curso/` | `/en/course/` |
| Temario de C# | `/curso/csharp/` | `/en/course/csharp/` |
| Una lección | `/curso/csharp/<módulo>/<lección>/` | `/en/course/csharp/<module>/<lesson>/` |

- Cada par de páginas comparte `ref`, como el resto del sitio, para que el botón de idioma las enlace. Los slugs están en el idioma de cada página.
- **Menú** (`_data/ui.yml`): "Cursos" / "Courses" con `page:` y `menu: courses`, entre Laboratorio y Publicaciones. Abre un submenú (`_includes/header.html`) con el curso de C#, que enlaza a su temario, y los que todavía no existen (`_data/course/soon.yml`: Angular, SQL Server y PostgreSQL) como "Próximamente", sin enlace. En pantalla ancha se abre al pasar el puntero o al enfocar con el teclado, y Escape lo cierra; en pantalla pequeña va siempre a la vista, sangrado.
- **Portada:** la sección "Cursos": el de C# enlaza a su temario, los que vienen dicen "Próximamente" y "Ver todos los cursos" lleva al índice. No carga el JavaScript del curso.
- **Índice de cursos:** la tarjeta del curso de C# (con su botón "Temario") y una tarjeta punteada, sin enlace, por cada curso de `soon.yml`. Para publicar uno: crear su temario como el de C#, enlazarlo donde sale el de C# y quitarlo de `soon.yml` (una prueba avisa si su carpeta ya existe).
- **Layout `course`** (hereda de `default`): agrega `course.css`, el bundle de la página como `<script type="module">` y los datos de la lección en un `<script type="application/json">`. Las páginas de lección usan un layout propio, no el de `lab`, porque su estructura de pantalla completa es distinta.
- Cada lección se publica cuando está lista; el temario solo enlaza las terminadas y marca las demás como "Próximamente".

---

## 4. Enfoque técnico

### Qué se reutiliza

| Pieza | Dónde está | Qué se hace |
|---|---|---|
| Compilar y correr C# | `dotnet/challenges/Core/CodeCompiler.cs`, `Playground.cs`, `CaseRunner.cs` | Se reutiliza tal cual. `Playground.Run` ya compila un programa de consola y captura `Console.Out` y `Console.Error` con un límite de tamaño |
| Reglas sobre el código | `Core/CodeRules.cs` (`uses-type`, `avoids-type`, `private-constructor`) | Se amplía con reglas de sintaxis (abajo) |
| Retos de métodos | `Core/ChallengeRunner.cs` | Los ejercicios en los que el alumno implementa un método usan este mismo arnés de casos |
| Puente con JavaScript | `Engine/Exports.cs` (`Warm`, `RunCases`, `RunPlayground`) | Se agrega `RunProgram`, con entrada y revisiones |
| Worker, tiempo límite y carga | `labs/challenges/engine.ts` (`WorkerEngine`, 5 s de código, `warm`, `warmOnIntent`) y `labs/challenges/csharp/` (`engine.ts`, `worker.ts`, `protocol.ts`) | Se reutilizan; el protocolo suma el mensaje del programa |
| Editor | `labs/challenges/editor.ts` y `editor-api.ts` (CodeMirror 6) | Se reutiliza con los mismos límites de tamaño |
| Progreso local | `labs/challenges/progress.ts` | Se usa como modelo, con otra clave y otra estructura |
| Kit compartido | `labs/shared/` (`copy`, `dom`, `highlight`, `i18n`, `live`, `format`) | Se reutiliza |
| Páginas desde datos | `scripts/challenge-pages.mjs` y su prueba | Se usa como modelo para `scripts/course-pages.mjs` |
| Presupuesto, CI y paridad | `scripts/budget.mjs`, `scripts/content-parity.test.ts`, `.github/workflows/sitio.yml` | Se amplían al curso |

Una parte de lo que hoy vive en `labs/challenges/` (el motor y el editor) pasa a `labs/shared/` para que el curso no importe de otra demo. Es un cambio de lugar, sin cambiar comportamiento, y va primero, en la fase 2.

### Qué hay que construir

- **Motor** (`dotnet/challenges`): `CourseRunner`, que compila el programa del alumno, lo corre con una entrada simulada y evalúa las revisiones del paso; las reglas de sintaxis nuevas; el export `RunProgram`; y sus pruebas con xUnit.
- **Interfaz** (`labs/course/`): la lección (pasos, editor, terminal, pistas, pie), el progreso, el temario con avance y la entrada simulada.
- **Datos y páginas:** `_data/course/` (lecciones, textos de la interfaz y explicaciones de errores) y `scripts/course-pages.mjs`.
- **Estilos:** `assets/css/course.css`, solo en las páginas del curso.

### Entrada simulada

GitHub Pages no permite los encabezados que necesita el multihilo de WebAssembly (COOP y COEP; ver `PLAN.md`), así que un programa no puede quedarse bloqueado esperando una tecla. En su lugar, el ejercicio que usa `Console.ReadLine()` trae un cuadro **Entrada** con una línea por lectura:

- `RunProgram` hace `Console.SetIn(new StringReader(entrada))` antes de correr el programa, igual que ya redirige la salida.
- Cuando se acaban las líneas, `ReadLine()` devuelve `null`, como con una entrada cerrada. La lección lo explica, porque es un caso real (`ReadLine` puede devolver `null`).
- Un paso puede traer varias entradas y se revisa cada una, por ejemplo con la edad 17 y la edad 30.
- `Console.ReadKey()` y `Console.Clear()` fallan en el navegador; la terminal muestra un mensaje claro que dice qué usar en su lugar.

### Cómo se revisa un ejercicio

Hay dos modos, según lo que se enseña:

- **Programa:** se corre el programa del alumno con cada entrada simulada y se comparan su salida y su error. Es el de los primeros módulos (Hola, mundo, variables, ciclos).
- **Método:** se pide un método con una firma conocida y se llama con casos, con el arnés de los retos (`ChallengeRunner`). Es el de métodos, clases y LINQ. Los resultados se muestran con las mismas piezas que los retos.

Revisiones de un paso (se combinan; el paso se resuelve cuando pasan todas):

| Revisión | Qué comprueba |
|---|---|
| `stdout` | La salida es exactamente ese texto, normalizando saltos de línea y el salto final |
| `stdout-contains` y `stdout-matches` | La salida contiene un texto o cumple una expresión regular (con tiempo límite) |
| `no-error` y `throws` | El programa termina sin excepción, o lanza la esperada |
| `uses-syntax` y `avoids-syntax` | El código usa o evita una construcción (`ForStatement`, `SwitchExpression`...), revisada con el árbol de sintaxis de Roslyn |
| `declares-variable` | Declara una variable con ese nombre y tipo |
| `calls-method` | Llama a un método, por ejemplo `Console.WriteLine`, al menos N veces |
| `uses-type` y `avoids-type` | Las que ya existen. En el curso, `type` es el nombre de metadatos (`System.Func`2`) y `name` es cómo lo dice el mensaje (`Func<T, TResult>`); una prueba de Vitest exige los dos |

Primero se revisa el resultado y solo se agregan reglas de sintaxis cuando lo que se enseña es la construcción misma (por ejemplo, "usa un `for`"). Cada ejercicio con reglas de sintaxis se prueba con dos o tres soluciones distintas, para no rechazar una válida. Para eso, el nombre de una regla puede traer alternativas separadas por `|` (`PostIncrementExpression|PreIncrementExpression` cuenta tanto `i++` como `++i`) y sus cuentas se suman. Los nombres no son solo nodos: también cuentan palabras (`ConstKeyword`) y comentarios (`SingleLineCommentTrivia`).

Cuando una revisión falla, el mensaje dice qué se esperaba y qué salió, con la diferencia resaltada y, si el paso lo define, una frase sobre el error probable.

### Errores del compilador explicados

Roslyn en el navegador responde en inglés y con códigos como `CS1002`. `_data/course/errors.yml` guarda, por código, una explicación breve en español y en inglés y qué revisar (`CS1002` punto y coma, `CS0103` nombre que no existe, `CS0029` tipo que no se convierte, `CS0165` variable sin asignar...). La terminal muestra la línea, el mensaje original y la explicación. También explica las excepciones de ejecución más comunes, con el nombre corto del tipo como clave (`NullReferenceException`, `DivideByZeroException`...). Crece con las lecciones: cada error nuevo necesita su programa mínimo en `ErrorExplanationTests`, que comprueba que la clave es el código que de verdad da Roslyn o la excepción que de verdad lanza el programa.

### Ejemplos del texto verificados en CI

Un bloque ` ```csharp ` del texto de una lección seguido de su salida en un bloque ` ```text ` es un programa y lo que imprime; si el programa lee, entre los dos va un bloque ` ```input ` con la entrada. `dotnet test` (`ExampleTests`) los compila, los corre y comprueba que la salida coincide, y que ningún bloque de salida o de entrada quede suelto sin su programa. Un bloque ` ```csharp ` sin salida es un fragmento y no se corre. Así un ejemplo del texto nunca queda roto, que es el mismo cuidado que ya tienen las soluciones de los retos. (El plan pensaba marcarlos con ` ```csharp run `, pero kramdown no acepta una segunda palabra después del lenguaje; por eso se reconocen por su posición.) La página muestra los bloques de entrada y de salida con su rótulo, "Entrada" y "Salida".

---

## 5. Formato de una lección

Un archivo por lección, con la misma estructura que los retos: `shared` (lo que no cambia con el idioma: código, revisiones y entradas), `es` y `en` (prosa).

```yaml
# _data/course/csharp/first-steps/hello-world.yml
shared:
  course: csharp
  module: first-steps
  order: 1
  minutes: 12
  steps:
    - id: print
      kind: exercise
      mode: program
      starter: |
        // Escribe tu código abajo
      solution: |
        Console.WriteLine("Hello, World!");
      checks:
        - stdout: "Hello, World!\n"
        - calls-method: { name: Console.WriteLine }
    - id: greet
      kind: exercise
      mode: program
      stdin: ["Ana"]
      starter: |
        Console.Write("Name: ");
        // Lee el nombre y salúdalo
      solution: |
        Console.Write("Name: ");
        var name = Console.ReadLine();
        Console.WriteLine($"Hello, {name}!");
      checks:
        - stdout: "Name: Hello, Ana!\n"
    - id: statements
      kind: choice
      answer: 1                      # índice de la opción correcta
es:
  slug: hola-mundo
  title: Hola, mundo
  summary: Tu primer programa de C#.
  steps:
    # (el paso greet se omite aquí para abreviar)
    print:
      title: Imprimir en la consola
      text: |
        Un programa de C# empieza a ejecutarse en la primera instrucción…
      instructions: |
        Escribe una instrucción que imprima `Hello, World!`.
      hints:
        - Usa `Console.WriteLine`.
        - El texto va entre comillas dobles, dentro de los paréntesis.
        - No olvides el punto y coma al final.
      explanation: |
        `Console.WriteLine` escribe el texto y agrega un salto de línea…
      failure: Revisa que el texto sea exactamente `Hello, World!`, con mayúsculas y signos.
    statements:
      title: ¿Qué es una instrucción?
      text: …
      question: …
      options: [ …, …, … ]
en:
  slug: hello-world
  title: Hello, World
  # …mismos pasos, en inglés
```

- **Pasos de lectura** solo traen `text`. **Preguntas** traen `question`, `options` y la explicación de la respuesta correcta.
- **Pasos en modo método** reemplazan `starter`/`checks` por los campos de los retos (`entry`, `cases`, `expected`, `throws`), así que se pueden mover entre retos y lecciones.
- El código de ejemplo no se traduce: identificadores y mensajes de salida en inglés, pocos comentarios. Se traduce la prosa.
- Un `slug` por idioma y por lección; el módulo trae su propio archivo (`_data/course/csharp/<módulo>/module.yml`) con título, resumen y orden.

---

## 6. Dirección visual y experiencia

Los colores, la tipografía y los dos temas salen de `main.css` y `labs.css`. No se copia el arte de ninguna otra plataforma.

```text
Escritorio (la lección ocupa toda la pantalla)
┌──────────────────────────────────────────────────────────────────────────┐
│ Cursos › C# › Hola, mundo        ████████░░░░░░░░░░ 40 %        ES · ☼   │
├───────────────────────────────────┬──────────────────────────────────────┤
│ LECCIÓN                           │ hola_mundo.cs                        │
│                                   │ ┌──────────────────────────────────┐ │
│ 02. Imprimir en la consola        │ │ 1  // Escribe tu código abajo    │ │
│                                   │ │ 2                                │ │
│ Texto, con `código` en línea,     │ │ 3                                │ │
│ bloques con botón Copiar y        │ └──────────────────────────────────┘ │
│ cuadros de Nota y Ojo.            │ [?] [?] [?]    [▶ Ejecutar] [Enviar] │
│                                   │ ENTRADA (solo si el paso la usa)     │
│ ── Instrucciones ──               │ ┌──────────────────────────────────┐ │
│ 1. Escribe una instrucción…       │ │ Ana                              │ │
│                                   │ └──────────────────────────────────┘ │
│                                   │ TERMINAL                             │
│                                   │ Pulsa Ejecutar para ver el resultado │
├───────────────────────────────────┴──────────────────────────────────────┤
│ ≡  Hola, mundo · Ejercicio 2/5  ✔ Resuelto            [Atrás] [Siguiente]│
└──────────────────────────────────────────────────────────────────────────┘

Móvil: una sola columna (lección, editor, entrada, terminal) y el pie fijo abajo.
```

- **Encabezado:** ruta (curso, lenguaje, lección), barra de avance de la lección (pasos resueltos entre pasos totales), idioma y tema.
- **Panel de la lección:** texto del paso; cuadros de *Nota*, *Ojo* y *Prueba esto* (citas con una clase); instrucciones al final, con el mismo estilo de los retos.
- **Panel del editor:** pestaña con el nombre del archivo, el editor, tres botones de pista que se abren una a una, **Ejecutar** y **Enviar**.
- **Terminal:** muestra la salida, los errores con su línea y su explicación, y el resultado de **Enviar** (pasó, o qué faltó). Es una región `aria-live`.
- **Pie:** el menú de la lección (pasos y estado), "Ejercicio N/M", el estado del paso y los botones Atrás y Siguiente.
- **Atajos:** `Ctrl+Enter` ejecuta y `Ctrl+Shift+Enter` envía. `Esc` y luego `Tab` sacan el foco del editor.
- **Carga del motor:** se descarga cuando el visitante muestra intención de ejecutar (foco o cursor sobre el editor), con una barra de progreso en la terminal; después queda en la caché del navegador. Las lecciones de solo lectura no descargan nada.
- **Accesibilidad:** todo con teclado y foco visible, contraste AA, `prefers-reduced-motion`, anuncios del resultado y la lección completa en texto sin JavaScript.

---

## 7. Temario

Unas 70 lecciones y unos 400 pasos. La versión 1 son los módulos 1 a 3.

| # | Módulo | Lecciones | Versión 1 |
|---|---|---|---|
| 1 | Primeros pasos | Hola, mundo · Comentarios y estilo · Variables · Tipos de datos · Constantes · Entrada de datos | Sí |
| 2 | Operadores y texto | Aritmética · Asignación y operadores compuestos · Comparación y lógica · Cadenas · Interpolación y formato · Conversión de tipos | Sí |
| 3 | Control de flujo | `if` y `else` · `switch` · Ternario y `??` · `while` y `do` · `for` · `foreach` · `break` y `continue` | Sí |
| 4 | Colecciones | Arreglos · `List<T>` · `Dictionary<TKey, TValue>` · `HashSet<T>`, `Queue<T>` y `Stack<T>` · Índices y rangos | No |
| 5 | Métodos | Declarar y llamar · Parámetros y retorno · Opcionales, nombrados y `params` · `ref`, `out` e `in` · Sobrecarga · Recursividad · Funciones locales y alcance | No |
| 6 | Clases y objetos | Clases y objetos · Campos y propiedades · Constructores · `static` · Encapsulación · `record` y `struct` · `enum` | No |
| 7 | Herencia y polimorfismo | Herencia · `virtual` y `override` · Clases abstractas · Interfaces · Composición · `ToString` y `Equals` | No |
| 8 | Nulos y errores | Tipos que aceptan nulos · Referencias que aceptan nulos · `try`, `catch` y `finally` · Lanzar excepciones · Excepciones propias · `using` y `IDisposable` | No |
| 9 | LINQ | `Where` y `Select` · Ordenar · `First`, `Any` y `Count` · `GroupBy` · `Join` y `ToDictionary` · Ejecución diferida | No |
| 10 | Genéricos y delegados | Genéricos · Delegados, `Func` y `Action` · Expresiones lambda · Eventos | No |
| 11 | Asincronía | `Task` y `async`/`await` · `Task.WhenAll` · Cancelación | No |
| 12 | C# moderno | Coincidencia de patrones · Registros y `with` · Constructores primarios · Expresiones de colección · Novedades de C# 14 y 15 | No |

- **Mini-proyectos** al final de los módulos 3, 7 y 12 (por ejemplo, "Adivina el número", "Lista de tareas" y "Conversor de unidades"): un programa de varios pasos que junta lo aprendido.
- **Dominio de los ejemplos:** el mismo de las demos del sitio, una tienda en línea con productos, clientes y pedidos, para que todo se lea como un conjunto.
- **Voz y estilo:** de tú, párrafos cortos, una idea por paso, máximo 7 pasos por lección. Un ejemplo antes de la definición. Los textos son propios: se enlazan la documentación de Microsoft y otras fuentes, no se copian.
- **Versión del lenguaje:** las lecciones corren con la versión de C# del motor (la de .NET 11) y marcan lo que requiere una versión concreta.
- **Cierre de módulo:** una lista de retos del laboratorio que practican lo mismo (el catálogo ya tiene 35 de C#) y, si existe, el post del blog.

---

## 8. Progreso local

Una sola clave, `mi-sitio2.curso.v1`, con la misma tolerancia que `labs/challenges/progress.ts`: si el navegador no deja guardar, el curso funciona sin recordar nada.

```text
{
  "csharp": {
    "last": { "lesson": "first-steps/hello-world", "step": "greet" },
    "lessons": {
      "first-steps/hello-world": {
        "steps": {
          "print": { "status": "done", "code": "Console.WriteLine(\"Hello, World!\");" },
          "greet": { "status": "seen" }
        }
      }
    }
  }
}
```

- Estados de un paso: `done` (resuelto), `seen` (se vio la solución) y, sin entrada, pendiente. Un paso resuelto se queda resuelto aunque el código cambie después.
- La barra de la lección cuenta los pasos `done`. Ver la solución desbloquea el siguiente paso, y enviarla marca el paso como resuelto.
- El código de cada paso se guarda con un tope (20 KB por paso) y se descarta el más viejo si el almacenamiento se llena.
- **Exportar** descarga un JSON; **Importar** lo valida y lo mezcla (gana el paso más avanzado); **Borrar** pide confirmación.
- El temario y el índice leen el progreso al cargar y cuando otra pestaña lo cambia (evento `storage`).

---

## 9. Pruebas y calidad

- `tsc --noEmit` estricto y Prettier, como el resto de `labs/`.
- **Vitest:**
  - **Pasos:** la máquina de pasos (qué se desbloquea, qué estado queda, qué pasa al ver la solución) es pura y se prueba sin navegador.
  - **Progreso:** lectura y escritura, datos corruptos, almacenamiento lleno, exportar e importar, y el tope de código por paso.
  - **Interfaz:** con jsdom, ejecutar y enviar con un motor falso, pistas, entrada simulada, pie y menú de la lección, anuncios en `aria-live`.
  - **Datos:** paridad `es`/`en`, ids únicos, slugs únicos por idioma, 1 a 3 pistas por ejercicio, cada ejercicio con solución y al menos una revisión, cada pregunta con una respuesta correcta, sin `{{` ni `{%` en el texto ni en el código, que los títulos, textos, pistas y opciones sean cadenas (un `: ` sin comillas en YAML los vuelve objetos y la página imprime un hash), y que `errors.yml` cubra los códigos que usan los pasos.
  - **Páginas:** `scripts/course-pages.test.ts` revisa que las páginas estén al día con los datos, como las de los retos.
- **xUnit (`dotnet test dotnet/challenges/Tests`):**
  - El arnés del curso: cada tipo de revisión, la entrada simulada (incluido `null` al acabarse), la normalización de saltos de línea y las reglas de sintaxis, con soluciones alternativas.
  - **Cada lección:** la solución pasa todas sus revisiones y el código inicial compila y no las pasa (salvo los pasos de exploración).
  - **Ejemplos del texto:** cada bloque ejecutable compila y produce la salida que muestra.
- **Accesibilidad:** teclado completo, foco visible, contraste AA, movimiento reducido y la versión sin JavaScript como alternativa.
- **Rendimiento:** CI revisa el presupuesto de `course.js` (30 kB comprimidos, como cada demo). El editor y el motor ya tienen el suyo en los retos, y el curso no los carga hasta que el visitante muestra intención de ejecutar.
- Revisión final en los dos idiomas, tema claro y oscuro, escritorio y móvil.

---

## 10. Fases

Cada fase se trabaja en su rama (`curso-fase-0`, `curso-fase-1`...), entra a `main` con un pull request y termina con algo probado. El mensaje de cada commit sigue el formato del repositorio ("Curso, fase N: …").

### Fase 0. Decisiones y prototipo
- [x] Confirmar las decisiones de la sección 2 (se dieron por aprobadas al pedir la implementación).
- [x] Prototipo del motor: `Console.SetIn` junto a la captura de salida de `Playground`. En el navegador `ReadLine()` devuelve `null` al acabarse la entrada y `ReadKey` lanza `PlatformNotSupportedException`, que la terminal explica. Ojo: leer `Console.In` lanza en WebAssembly, así que `CourseRunner` no lo restaura ahí. Falta medir el tiempo por ejecución con el motor ya cargado.
- [x] Boceto de la lección: se pasó directo a la página real, revisada en escritorio y móvil, en los dos temas.
- [x] Escribir a mano la lección "Hola, mundo" en español e inglés como piloto del formato de la sección 5.

**Entregable:** decisiones y formato aprobados; prototipo medido.

### Fase 1. Datos y páginas
- [x] Esquema de lección y de módulo en `_data/course/`, `ui.yml` y un `errors.yml` inicial.
- [x] `scripts/course-pages.mjs` (`npm run pages:course`), con su prueba de páginas al día.
- [x] Layout `course`, `course.css` base, el índice, el temario y la lección sin JavaScript (texto completo, solución en `<details>`).
- [x] Pruebas de datos: paridad, ids, slugs, revisiones y Liquid (`scripts/course-data.test.ts`).
- [x] La lección piloto en el repositorio, todavía sin enlace en el menú.

**Entregable:** las páginas existen y se leen sin JavaScript; los datos se validan en CI.

### Fase 2. Motor del curso
- [ ] Mover el motor y el editor de `labs/challenges/` a `labs/shared/`, sin cambiar comportamiento, con sus pruebas pasando. Aplazado: el curso importa de `labs/challenges/` y se mueve cuando haga falta un tercer consumidor.
- [x] `CourseRunner` en Core: compilar, correr con entrada simulada y evaluar las revisiones.
- [x] Reglas de sintaxis: `uses-syntax`, `avoids-syntax`, `declares-variable` y `calls-method` (y `uses-type` y `avoids-type`, que ya existían).
- [x] Export `RunProgram`, mensajes del worker y cliente en TypeScript.
- [x] Pruebas xUnit del arnés y de las lecciones (`CourseHarnessTests`, `CourseSolutionTests`).
- [x] Pruebas xUnit de los ejemplos del texto (`ExampleTests`), y de los errores que explica `errors.yml` (`ErrorExplanationTests`).

**Entregable:** `dotnet test` revisa el arnés y cada lección; `npm run csharp` publica el motor con `RunProgram`.

### Fase 3. Página de la lección
- [x] Máquina de pasos y progreso local (con exportar, importar y borrar en `progress.ts`), con sus pruebas.
- [ ] Botones de exportar e importar el avance en el temario (hoy solo está "Borrar mi avance").
- [x] Editor, terminal, **Ejecutar**, **Enviar**, pistas, solución y entrada simulada.
- [x] Errores con su línea y su explicación (`errors.yml`: 11 errores del compilador y 10 excepciones de ejecución).
- [x] Pie con el menú de la lección, Atrás y Siguiente; barra de avance; atajos de teclado.
- [x] Móvil, temas claro y oscuro, `aria-live`, foco y movimiento reducido (la revisión de accesibilidad completa es de la fase 7).
- [x] Presupuesto de tamaño (`course.js` pesa 8 kB comprimidos) y pruebas de interfaz con jsdom.

**Entregable:** la lección piloto funciona completa en español e inglés.

### Fase 4. Contenido: módulos 1 a 3 (versión 1)
- [x] Las 19 lecciones de los módulos 1 a 3, en español e inglés, revisadas en el navegador.
- [x] Mini-proyecto del módulo 3, "Adivina el número": 7 pasos que arman el juego por etapas. Con él, 20 lecciones y 126 pasos.
- [x] Etiquetas legibles para las reglas de sintaxis en los mensajes de Enviar (`ConstKeyword` como "la palabra const"): `syntax` en `ui.yml`. Cada lección nueva que use una regla de sintaxis agrega la etiqueta de su nombre; una prueba lo exige.
- [x] Enlace "Curso" en el menú (entre Laboratorio y Publicaciones) y tarjeta en la portada que lleva al temario, en español e inglés.
- [x] La sección pasa a llamarse "Cursos" / "Courses": el menú abre un submenú con C# y, como "Próximamente", Angular, SQL Server y PostgreSQL, y lo mismo se ve en la portada y en el índice (`_data/course/soon.yml`). El detalle de esos tres cursos queda para más adelante.
- [x] Retos del laboratorio al cierre de cada módulo: `practice` de cada módulo en `catalog.yml` lista los retos de C# que practican lo mismo y las publicaciones del blog sobre el tema. Salen en el temario, debajo de las lecciones, y al final del último paso de la última lección de cada módulo (`_includes/course/practice.html`, enlaces normales que no necesitan JavaScript). Se repartieron los 35 retos de C#, cada uno en un solo módulo y de lo fácil a lo difícil: los de ciclos al 3, los de arreglos, diccionarios y pilas al 4, los de descomposición y recursión al 5, los de clases con estado al 6, la estrategia de envío al 7, los que validan y lanzan excepciones al 8, los de consultas al 9, los de genéricos y ordenar con delegados al 10, `channel-pipeline` al 11 y, para cerrar el curso, el método de extensión y los algoritmos al 12. Los módulos 1 y 2 no traen retos (piden escribir un método con ciclos o colecciones) y remiten al playground de C#. Publicaciones: "Colecciones en C#" al 4; "POO en C# moderno" y "SOLID en la práctica" al 7; "Novedades de .NET 11 y C# 15" al 11 y al 12, este con "POO en C# moderno" y "Algoritmos en .NET". `npm test` revisa que los retos existan, sean de C#, no se repitan y vayan de fácil a difícil, y que cada publicación exista en los dos idiomas.
- [x] README: cómo agregar una lección y cómo correr sus pruebas.

**Entregable:** el curso, con los módulos 1 a 3, publicado.

### Fase 5. Contenido: módulos 4 a 7
- [x] Colecciones (módulo 4): arreglos, listas, diccionarios, conjuntos, colas y pilas, e índices y rangos.
- [x] Métodos (módulo 5): declarar y llamar, parámetros y retorno, opcionales, nombrados y `params`, `ref`, `out` e `in`, sobrecarga, recursividad, y funciones locales y alcance. Los métodos sueltos al final del archivo son funciones locales del programa (no se pueden sobrecargar), así que la lección de sobrecarga usa una `static class` como caja y la presenta como adelanto del módulo 6.
- [x] Clases y objetos (módulo 6): clases y objetos, campos y propiedades, constructores, `static`, encapsulación, `record` y `struct`, y `enum`. El código inicial usa la clase y el alumno la escribe o la arregla; los tipos van al final del archivo, después de las instrucciones y de los métodos sueltos (CS8803 si no).
- [x] Herencia y polimorfismo (módulo 7): herencia, `virtual` y `override`, clases abstractas, interfaces, composición, y `ToString` y `Equals`. Siguen en modo programa: el código inicial usa los tipos que el alumno escribe o arregla, y cada lección trae un error explicado (CS0506, CS0534, CS0535, CS0144...).
- [x] Modo método (casos con argumentos y retorno, con el arnés de los retos) para los ejercicios de LINQ: no hizo falta. Los de métodos, clases y LINQ se revisan en modo programa, con entrada y salida.
- [x] Mini-proyecto "Lista de tareas": la última lección del módulo 7 (`project-tasks`, 7 pasos). Es un programa de comandos (`add`, `list`, `done`, `remove`, `urgent` y `undo`) armado en cinco etapas, y cada etapa parte del código de la anterior: la clase `TaskItem`, los comandos `add` y `list`, `done` y `remove` con un método `TryPick` de parámetro `out`, `urgent` con una clase derivada y `undo` con un `Stack<T>`. Solo usa lo de los módulos 3 a 7. El ciclo que lee los comandos viene escrito desde la etapa 2, con `line.Split(' ', 2)`, y termina con `quit` o cuando se acaba la entrada (`ReadLine()` devuelve `null`). Etiqueta nueva en `ui.yml`: `OutKeyword`.
- [ ] Presentar `Split` en una lección anterior al módulo 9: `Split(' ')` ya se usa en los códigos iniciales de LINQ, asincronía y C# moderno, y solo el mini-proyecto explica `Split(' ', 2)`.
- [ ] Ampliar `errors.yml` con los errores nuevos.

**Entregable:** los módulos 4 a 7 publicados.

### Fase 6. Contenido: módulos 8 a 12
- [x] Nulos y errores (módulo 8): tipos que aceptan nulos, referencias que aceptan nulos, `try`, `catch` y `finally`, lanzar excepciones, excepciones propias, y `using` e `IDisposable`. Siguen en modo programa, y como el motor corre cada ejercicio con varias entradas (una de ellas sin texto, para que `ReadLine()` devuelva `null`), los fallos se ven en la propia prueba. Cada lección trae un error explicado (CS0266, CS0160, CS1524, CS1674, `InvalidOperationException`, `NullReferenceException`, `ArgumentNullException`...).
- [x] LINQ (módulo 9): `Where` y `Select`, ordenar, `First`, `Any` y `Count`, `GroupBy`, `Join` y `ToDictionary`, y ejecución diferida. Siguen en modo programa: los datos van en el código y la entrada (un límite, una categoría, una cantidad) cambia el resultado de cada ejecución, y varios ejercicios parten de código que funciona pero no usa el método de la lección (la regla `calls-method` lo exige). Como las lambdas llegan en el módulo 10, la primera lección las presenta en una frase. Errores explicados nuevos: CS0428 y CS1662; CS1061, `InvalidOperationException` y `ArgumentException` ahora nombran los casos de LINQ.
- [x] Genéricos y delegados (módulo 10): genéricos, delegados con `Func` y `Action`, expresiones lambda y eventos. Siguen en modo programa. Los ejercicios parten de un error del compilador (`T` sin restricción `where`, una clase que no es genérica, un método que no cuadra con el delegado, una lambda sin `return` en un camino, un evento disparado desde fuera), de una excepción (`NullReferenceException` al disparar un evento sin suscriptores) o de código que funciona pero no usa lo de la lección (reglas `uses-syntax`, `declares-variable` y las de tipo, con nombre legible). Errores explicados nuevos: CS0070, CS0123, CS0308, CS0311, CS0407, CS1593 y CS1643; CS1061, CS7036 y `NullReferenceException` ahora nombran los casos de genéricos y eventos. Con `CompareTo` sobre un `T` sin restricción, el compilador de .NET 11 da CS7036 (por un método de extensión nuevo de `ReadOnlySpan<char>`) y no CS1061, por eso el ejercicio de la restricción usa una interfaz propia.
- [x] Asincronía (módulo 11): `Task` y `async`/`await`, `Task.WhenAll` (con `WhenAny`) y cancelación. Siguen en modo programa: el motor espera el `Main` asíncrono directamente (en el navegador no se puede bloquear), así que `await` funciona en las instrucciones de nivel superior. Probado en WebAssembly: `Task.Delay`, `WhenAll`, `WhenAny`, `CancelAfter` y `Delay(ms, token)` funcionan; `Wait()` y `.Result` lanzan `PlatformNotSupportedException` y `Thread` no existe (CS0103). Para que la salida no dependa de la velocidad del equipo, las esperas son de 50 a 300 ms y entre dos sucesos hay siempre 100 ms de margen; lo que se compara es el orden en que terminan las tareas, nunca el tiempo medido. Los ejercicios parten de un error del compilador (`Task<int>` sin `await`, `await` en un método que no es `async`), de una excepción (la de un método `async`, que sale en el `await`), de un resultado equivocado (esperar una tras otra, la consulta `Select` que se recorre dos veces y vuelve a crear las tareas, la cancelación que nadie mira) o de código que funciona pero no usa lo de la lección (reglas `calls-method`, `uses-type` y `uses-syntax`). Errores explicados nuevos: CS1983, CS1997, CS4032, CS4034, `TaskCanceledException` y `OperationCanceledException`; CS0029, CS1061 y `PlatformNotSupportedException` ahora nombran los casos de `async`.
- [x] C# moderno (módulo 12): coincidencia de patrones, registros y `with`, constructores primarios, expresiones de colección, y novedades de C# 14 y 15 (5 lecciones y 27 pasos). Siguen en modo programa. Cada lección marca la versión del lenguaje (C# 12 para los constructores primarios y las expresiones de colección, C# 14 y 15 en la última) y todo lo que usan corre en el motor del navegador; se probó en WebAssembly: `field`, `?.` a la izquierda de `=`, bloques `extension`, `with(...)` en las colecciones, `union`, `closed` y `break` con etiqueta. Los ejercicios parten de un error del compilador (el brazo de `switch` que nunca se alcanzaría, una propiedad `init` asignada, `var` con corchetes, una clase base sin sus argumentos, el tipo `Payment` que no existe), de una excepción (`SwitchExpressionException` con una lista vacía), de un resultado equivocado (el objeto de `with` que nadie guarda, la copia superficial de una lista) o de código que funciona pero no usa lo de la lección (reglas `uses-syntax` y `avoids-syntax`, con etiquetas nuevas en `ui.yml`: `DeclarationPattern`, `PropertyPatternClause`, `WithExpression`, `PrimaryConstructorBaseType`, `CollectionExpression`, `SpreadElement`, `FieldExpression`, `WithElement` y `UnionDeclaration`). Errores explicados nuevos: CS8510, CS8862, CS9176 y `SwitchExpressionException`; CS1061 y CS7036 ahora nombran los casos de constructores primarios.
- [x] Mini-proyecto final, "Conversor de unidades": la última lección del módulo 12 (`project-converter`, 7 pasos). Convierte longitudes, masas, temperaturas y monedas con frases como `10 km to mi`, y se arma en cinco etapas, cada una con el código de la anterior: un `record` y el catálogo con una expresión de colección, la frase leída con un patrón de lista, una excepción propia con constructor primario, las temperaturas con `Func` y lambdas, y las monedas con cotizaciones que llegan de un método `async`. Como en "Lista de tareas", el ciclo lee frases hasta `quit` o hasta que se acaba la entrada. Etiquetas nuevas en `ui.yml`: `ListPattern` y `ThrowStatement|ThrowExpression`. Las cotizaciones son un método que espera 50 ms con `Task.Delay` y devuelve un diccionario fijo, así que la salida no depende de la red ni del equipo.
- [x] Revisar las lecciones de C# moderno contra la versión del motor: hecho en noviembre de 2026 con .NET 11 (C# 15), probando cada novedad en el motor del navegador. Se repite cada noviembre, con la versión nueva de .NET.

**Entregable:** el temario completo publicado.

### Fase 7. Cierre
- [ ] Revisión de accesibilidad y rendimiento.
- [ ] Revisión en español e inglés, tema claro y oscuro, escritorio y móvil.
- [ ] Probar una lección con alguien que no sepa C# y ajustar lo que se atore.
- [ ] README completo y revisión del sitio publicado.

**Entregable:** el curso publicado y documentado.

### Opcionales
- [ ] Racha de días e insignias locales.
- [ ] Certificado de finalización descargable (un PDF generado en el navegador, sin validez verificable).
- [ ] Funcionar sin conexión después de la primera visita, con un service worker que guarde el motor.
- [ ] Botón "Abrir en el playground" con el código del paso.
- [ ] Los cursos de PostgreSQL, SQL Server y Angular, con el mismo formato; cada uno tiene su plan (`PLAN-CURSO-POSTGRESQL.md`, `PLAN-CURSO-SQLSERVER.md` y `PLAN-CURSO-ANGULAR.md`).
- [ ] Pruebas de extremo a extremo con Playwright y revisión automática con axe (es el mismo opcional del plan del laboratorio).

---

## 11. Criterios de aceptación

1. El curso funciona en español e inglés, en tema claro y oscuro, y en escritorio y móvil.
2. Sin JavaScript, cada lección se lee completa.
3. En cada ejercicio, **Ejecutar** muestra lo que imprime el programa; **Enviar** lo revisa y marca el paso; las pistas y la solución están disponibles; un error de compilación sale con su línea y su explicación.
4. Un ciclo infinito se detiene a los 5 segundos sin colgar la página. El motor se descarga solo cuando el visitante muestra intención de ejecutar.
5. En CI: la solución de cada ejercicio pasa; su código inicial no pasa; los ejemplos ejecutables del texto compilan y dan la salida que muestran; y cada texto existe en español e inglés.
6. El progreso recuerda los pasos resueltos, el código y la última lección; funciona sin `localStorage` (sin recordar nada); se puede exportar, importar y borrar.
7. Todo se usa con teclado, con foco visible y contraste AA, y con movimiento reducido no hay animaciones.
8. `course.js` cabe en su presupuesto de 30 kB comprimidos, y las páginas fuera del curso no cargan nada nuevo.
9. El contenido es propio: ningún texto, ejercicio, imagen ni marca copiados de otra plataforma.

---

## 12. Riesgos

| Riesgo | Cómo se mitiga |
|---|---|
| Mucho contenido en dos idiomas (unos 400 pasos) | Publicar primero los módulos 1 a 3, escribir por módulo, una plantilla de lección, la prueba de paridad y la verificación automática de los ejemplos |
| Calidad pedagógica despareja | Guía de estilo (una idea por paso, máximo 7 pasos por lección, ejemplo antes de la definición), revisión en frío de cada módulo y una prueba con alguien sin experiencia en la fase 7 |
| Parecerse a otra plataforma (la de la referencia) | Solo se toma el patrón de dos paneles. Sin sus nombres, logos, arte, tipografía ni textos; los colores salen de la paleta del sitio y los ejercicios son propios |
| `Console.ReadLine()` no puede esperar al visitante (sin COOP ni COEP) | Entrada simulada, prellenada por la lección y explicada en la terminal; el caso de `null` al acabarse la entrada se enseña a propósito |
| La primera ejecución descarga unos 9 MB | Se carga al mostrar intención, con progreso visible y caché del navegador; las lecciones de lectura no la descargan; el service worker queda como opcional |
| Los mensajes del compilador están en inglés y asustan | `errors.yml` los explica en el idioma de la página y la terminal conserva el mensaje original |
| Una revisión por sintaxis rechaza una solución válida | Se revisa primero el resultado, las reglas de sintaxis solo cuando el objetivo es la construcción, y se prueban con soluciones alternativas |
| El progreso se pierde al limpiar los datos del navegador | Exportar e importar, un aviso visible y poco volumen guardado |
| Cada versión de .NET trae C# nuevo | El motor se actualiza con cada versión y el temario se revisa cada noviembre; las lecciones de C# moderno marcan la versión |
| Un `{{` o `{%` en una lección rompe el build de Jekyll | La prueba de datos los busca en el texto y en el código |
| La solución viaja en la página (sitio estático) | Es un curso, no una evaluación: la solución está en `<details>` y no hay ranking ni certificados verificables |
| Escribir código en el celular es incómodo | Ejercicios cortos, plantillas con la mayor parte escrita y la opción de ver la solución |
| Mover el motor y el editor a `labs/shared/` rompe los retos | Va como primer cambio de la fase 2, sin cambiar comportamiento, con las pruebas de los retos pasando antes de seguir |

---

## 13. Fuentes

- Tour de C# (Microsoft Learn): <https://learn.microsoft.com/dotnet/csharp/tour-of-csharp/>
- Referencia del lenguaje C#: <https://learn.microsoft.com/dotnet/csharp/language-reference/>
- Novedades de C# 15: <https://learn.microsoft.com/dotnet/csharp/whats-new/csharp-15>
- .NET desde JavaScript (`JSImport` y `JSExport`): <https://learn.microsoft.com/aspnet/core/client-side/dotnet-interop>
- Roslyn, el compilador de C# y su API de sintaxis: <https://github.com/dotnet/roslyn>
- `SharedArrayBuffer` y los encabezados COOP y COEP que necesita: <https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer>
- `Window.localStorage` y el evento `storage`: <https://developer.mozilla.org/docs/Web/API/Window/localStorage>
