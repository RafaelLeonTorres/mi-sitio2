---
title: "Cómo funciona Mediateca: un gestor multimedia con .NET 11, Angular 22 y PostgreSQL"
description: "Recorrido por un proyecto de portafolio: cuatro contenedores con un solo origen, streaming con Range, la base de datos como cola de escaneos, permisos en la consulta, metadatos de IMDb y AniList, y un reproductor con subtítulos y reescalado con WebGPU."
lang: es
locale: es_MX
ref: como-funciona-mediateca
date: 2026-11-20 12:00:00 -0600
permalink: /blog/como-funciona-mediateca/
tags: [.NET, Angular, PostgreSQL, Docker, Arquitectura]
repo: https://github.com/RafaelLeonTorres/mediateca
---

[Mediateca](https://github.com/RafaelLeonTorres/mediateca) organiza y reproduce tu propia colección de películas, series, anime y música desde el navegador. Toma como referencia lo básico de Jellyfin, pero el código, el modelo de datos y el diseño son míos. Es un proyecto de portafolio, así que en este post, más que listar funciones, cuento cómo está armado y por qué tomé cada decisión.

## Qué hace

- Bibliotecas de películas, series, anime y música en cualquier carpeta de tus discos, elegidas desde la app. Los discos se montan de solo lectura.
- Escaneo incremental en un proceso aparte, a mano o con un horario que se cambia desde la administración.
- Metadatos de IMDb (a través de OMDb) para películas y series, y de AniList para el anime. La música usa las etiquetas de sus archivos.
- Un reproductor propio que retoma donde te quedaste, con subtítulos y reescalado con la tarjeta gráfica.
- Usuarios con permisos por biblioteca: lo que no te toca responde como si no existiera.

<figure>
  <img src="{{ '/assets/img/blog/mediateca/ficha.webp' | relative_url }}" alt="Ficha de Sintel en Mediateca: póster, año, calificación, duración, resumen y los botones Reproducir, Marcar como visto, Identificar y Actualizar metadatos." width="780" height="600" loading="lazy">
  <figcaption>La ficha de una película, con los datos y el póster que llegan de IMDb a través de OMDb.</figcaption>
</figure>

## Cuatro contenedores y un solo origen

Todo corre con Docker Compose en cuatro contenedores:

```text
Navegador
    |   páginas, /api con cookie y XSRF, video y audio con Range
    v
web: nginx con el build de Angular
    |   /api
    v
api: ASP.NET Core 11  ---->  db: PostgreSQL 18  <----  worker: .NET 11 con Quartz
                                                       (escaneos y metadatos)
```

La API y el worker leen tus discos de solo lectura y guardan los pósters y los subtítulos en un volumen de datos. El navegador solo habla con `web`: nginx sirve el build de Angular y pasa `/api` al contenedor de la API, así que la app y la API comparten origen. Eso simplifica dos cosas: no hay CORS y la sesión puede ir en una cookie.

### Por qué cookie y no JWT

Las etiquetas `<video>` y `<audio>` no pueden mandar la cabecera `Authorization`, pero sí mandan las cookies de su origen. Con un JWT habría tenido que poner el token en la URL del video, donde termina en el historial y en los registros. Con una cookie `HttpOnly` y `SameSite=Lax`, el streaming queda autenticado sin hacer nada especial.

La cookie trae su propio riesgo, CSRF, y lo cubre el antiforgery de ASP.NET Core: cada POST, PUT y DELETE lleva el token en la cabecera `X-XSRF-TOKEN`, que Angular agrega solo. Además, el sello de seguridad de Identity se revisa cada 30 segundos, así que cambiar la contraseña o el rol de alguien cierra sus sesiones sin esperar a que caduque la cookie.

## Streaming con Range

Adelantar y regresar un video depende de que el servidor responda solicitudes parciales (`206 Partial Content`). ASP.NET Core ya lo hace con `PhysicalFile`; lo importante es de dónde sale la ruta:

```csharp
var path = await db.VisibleItems(user.GetId(), user.IsAdmin())
    .OfType<PlayableItem>()
    .Where(i => i.Id == id)
    .Select(i => i.FilePath)
    .FirstOrDefaultAsync(cancellationToken);

if (string.IsNullOrEmpty(path) || !storage.Value.IsInsideMediaRoots(path) || !File.Exists(path))
{
    return TypedResults.NotFound();
}

http.Response.Headers.CacheControl = "private";
return TypedResults.PhysicalFile(
    path,
    MediaFiles.ContentTypeOf(path) ?? "application/octet-stream",
    lastModified: new DateTimeOffset(File.GetLastWriteTimeUtc(path), TimeSpan.Zero),
    enableRangeProcessing: true);
```

El cliente nunca manda rutas: pide un id, la ruta sale de la base de datos y, aun así, solo se sirve si está dentro de las carpetas de medios. En nginx, `/api` va sin búfer (`proxy_buffering off`) para que las respuestas parciales lleguen directo al navegador.

## La base de datos como cola de escaneos

Escanear una biblioteca grande tarda. Si corriera dentro de la API, competiría con ella por memoria y CPU, y un reinicio lo cortaría a la mitad. Por eso la API solo inserta un `ScanJob` en estado `Queued` y responde al instante; un contenedor aparte, el `worker`, los toma y los corre.

No agregué RabbitMQ ni otra pieza: la cola es la tabla. El worker reclama el escaneo más antiguo con una actualización condicional:

```csharp
var claimed = await db.ScanJobs
    .Where(j => j.Id == id && j.Status == ScanStatus.Queued)
    .ExecuteUpdateAsync(
        setters => setters
            .SetProperty(j => j.Status, ScanStatus.Running)
            .SetProperty(j => j.StartedAt, now),
        cancellationToken);
```

Si `claimed` vale 1, el escaneo es suyo; si vale 0, otro proceso se lo ganó y vuelve a mirar. Funciona aunque haya varios workers y no necesita candados en la aplicación.

La otra regla, un solo escaneo activo por biblioteca, la garantiza PostgreSQL con un índice único parcial:

```csharp
builder.HasIndex(j => j.LibraryId)
    .IsUnique()
    .HasFilter("\"Status\" IN ('Queued', 'Running')")
    .HasDatabaseName("IX_ScanJobs_LibraryId_Active");
```

Si dos solicitudes piden escanear la misma biblioteca a la vez, la segunda choca con el índice y devuelve el escaneo que ya existe. Al arrancar, el worker marca como fallidos los escaneos que se quedaron en `Running` por un reinicio. El escaneo automático usa Quartz.NET con un cron que el administrador cambia desde la app; el worker revisa el horario cada 30 segundos, así que un cambio se aplica en menos de un minuto sin reiniciar nada.

<figure>
  <img src="{{ '/assets/img/blog/mediateca/escaneo.webp' | relative_url }}" alt="Administración de bibliotecas: la biblioteca de películas con sus metadatos de OMDb y su último escaneo, y la sección Escaneo automático con la frecuencia, la zona horaria y los próximos escaneos." width="780" height="770" loading="lazy">
  <figcaption>La administración de bibliotecas: los conteos de metadatos, el último escaneo y el horario del escaneo automático con sus próximas ejecuciones.</figcaption>
</figure>

El escaneo es incremental: compara ruta, tamaño y fecha de modificación, y entiende las convenciones de nombres de Jellyfin: `Serie (Año)/Temporada 01/… S01E02`, episodios con número absoluto en el anime, carpetas `Lat` y `Sub` con los mismos episodios en dos idiomas, y las imágenes `folder.jpg` y `backdrop.jpg` junto a los videos. Los analizadores de nombres son funciones puras, cubiertas con más de cien casos de prueba.

## El modelo de datos

Películas, series, temporadas, episodios, álbumes y pistas heredan de `MediaItem` en una sola tabla (herencia TPH con discriminador). Así una sola consulta sirve para buscar, para "Agregado recientemente" y para "Continuar viendo". Algunos detalles de PostgreSQL que aproveché:

- `pg_trgm` con un índice GIN sobre el título, para que `ILIKE '%texto%'` no recorra toda la tabla.
- `text[]` para géneros, estudios y rutas de las bibliotecas, y `jsonb` para la caché de respuestas de los proveedores.
- Una `ScanKey` con el título y el año de la carpeta: los metadatos pueden cambiar el título de una serie, pero el siguiente escaneo la sigue reconociendo y no la duplica.

## Permisos en la consulta, 404 en lo ajeno

Cada usuario ve solo las bibliotecas que el administrador le asigna. La regla vive en un solo lugar, un método de extensión del que parten todas las consultas:

```csharp
public static IQueryable<MediaItem> VisibleItems(this MediatecaDbContext db, Guid userId, bool isAdmin) =>
    isAdmin
        ? db.MediaItems
        : db.MediaItems.Where(item =>
            db.LibraryAccess.Any(access => access.UserId == userId && access.LibraryId == item.LibraryId));
```

Un elemento de otra biblioteca responde 404, no 403, para no revelar que existe. Y como los permisos se consultan en cada solicitud, quitarle una biblioteca a alguien se nota al instante.

<figure>
  <img src="{{ '/assets/img/blog/mediateca/usuario.webp' | relative_url }}" alt="Diálogo Nuevo usuario: usuario, nombre visible, contraseña inicial, rol y las casillas de las bibliotecas que podrá ver." width="608" height="706" loading="lazy">
  <figcaption>Al crear un usuario, el administrador marca las bibliotecas que podrá ver.</figcaption>
</figure>

Donde una carrera podría dejar datos inválidos, uso candados de PostgreSQL dentro de la transacción (`pg_advisory_xact_lock`): dos solicitudes simultáneas del primer arranque no crean dos administradores, y dos administradores que se quitan el cargo a la vez no dejan el sistema sin ninguno.

## Metadatos sin adivinar

Las películas y series toman sus datos de IMDb a través de OMDb, y el anime de AniList, por GraphQL. Los dos tienen límites: AniList permite hasta 90 solicitudes por minuto (30 cuando está en modo degradado) y bloquea un minuto a quien se pasa, y OMDb da 1,000 al día con la clave gratuita. Por eso:

- Todas las solicitudes a AniList pasan por una compuerta de una cada 2 segundos, y un 429 pausa la cola el tiempo que pide `Retry-After`, sin reintentar.
- Cada respuesta se guarda en una caché en la base de datos.
- La búsqueda no se queda con el primer resultado: un puntaje compara el título (romaji, inglés, original y sinónimos), el año, la temporada y el formato, y por debajo de un umbral deja el elemento sin resultado en lugar de equivocarse. Para esos casos está el diálogo Identificar, donde se busca de nuevo o se pega el id de IMDb o la dirección de AniList.

La cola de metadatos también vive en el worker, y las imágenes que ya están junto a los videos siempre mandan sobre las del proveedor.

## El reproductor

El reproductor de video tiene controles propios que se ocultan solos, atajos de teclado y pantalla completa. Guarda la posición cada 10 segundos y al salir; pasado el 90 %, marca el episodio como visto. "A continuación" busca el siguiente episodio dentro de la misma carpeta, así que las versiones `Lat` y `Sub` nunca se mezclan.

Los **subtítulos** salen de tres lugares: las pistas de texto incrustadas en el video, los archivos `.srt`, `.vtt` y `.ass` que están junto a él, y los que sube cualquier usuario desde el reproductor. Todo se convierte a WebVTT, el formato que entiende el navegador: los SRT con un convertidor en C#, los ASS con FFmpeg (o con un convertidor básico en C# si no está) y las pistas incrustadas, que lista `ffprobe`, con FFmpeg. La extracción tiene un límite de procesos a la vez, un tiempo máximo y una caché en disco que se invalida cuando cambia el archivo.

El **reescalado** se calcula en el navegador con WebGPU: el video se importa como textura y se dibuja en un `<canvas>` encima del `<video>`, con las vistas Original, Mejorado y Comparar. El código de la GPU se carga con una importación dinámica la primera vez que se usa, y sin WebGPU el botón se deshabilita con el motivo.

<figure>
  <img src="{{ '/assets/img/blog/mediateca/reproductor.webp' | relative_url }}" alt="Reproductor de Mediateca con Sintel: subtítulos en español extraídos del MKV, la vista Comparar del reescalado con el divisor entre Original y Mejorado, y la barra de controles." width="780" height="440" loading="lazy">
  <figcaption>Subtítulos en español sacados del MKV y la vista Comparar del reescalado: a la izquierda del divisor, el video original; a la derecha, el que procesa la GPU.</figcaption>
</figure>

La música usa un `PlayerService` con signals y un solo `<audio>` para toda la app, así que sigue sonando mientras navegas y se pausa sola al abrir un video.

## Angular 22 sin Zone.js

El frontend es Angular 22 con componentes standalone, signals y detección de cambios sin Zone.js. Las lecturas de la API usan `httpResource`, y ahí aprendí una lección: `value()` lanza una excepción cuando el recurso está en error (un 404, una sesión cerrada), así que siempre se pregunta primero con `hasValue()`:

```typescript
protected readonly nextUpItem = computed(() => (this.nextUp.hasValue() ? this.nextUp.value() : null));
```

Todos los formularios usan Signal Forms, estables desde Angular 22. Las reglas de una contraseña nueva con su confirmación están en un solo lugar y las comparten el primer arranque, Mi cuenta y la administración:

```typescript
export function newPasswordRules(password: SchemaPath<string>, confirm: SchemaPath<string>): void {
  required(password);
  minLength(password, MIN_PASSWORD_LENGTH);
  required(confirm);
  validate(confirm, ({ value, valueOf }) =>
    value() !== '' && value() !== valueOf(password) ? { kind: PASSWORDS_MISMATCH } : undefined,
  );
}
```

## Pruebas y CI

- **Unitarias (xUnit y Moq):** los analizadores de nombres, la conversión de subtítulos, el puntaje de candidatos y la compuerta de los proveedores. Son 236 métodos de prueba, con más de 400 casos en los `[Theory]`.
- **Integración (Testcontainers y WebApplicationFactory):** 122 pruebas contra un PostgreSQL real. Por ejemplo: con dos usuarios y dos bibliotecas, cada uno recibe 404 en todo lo del otro; dos primeros arranques simultáneos crean un solo administrador, y una sesión deja de valer al cambiar la contraseña.
- **Frontend (Vitest):** 366 pruebas de servicios, guards y componentes.

GitHub Actions corre todo en cada pull request y, además, levanta los cuatro contenedores y consulta `/api/health` a través de nginx.

## Cómo probarlo

En Windows, `setup.ps1` crea el archivo `.env`, monta tus discos de solo lectura y levanta los contenedores. En macOS o Linux se levanta con `docker compose up -d --build --wait`, y los discos se agregan a mano, como explica el README. La primera vez, la API crea la base de datos y la app pide la cuenta de administrador; las carpetas de cada biblioteca se eligen después, desde la app. Para los metadatos de películas y series hace falta una clave gratuita de OMDb en `OMDB_API_KEY`; el anime no necesita clave.

## Lo que sigue

Hay cosas que dejé fuera a propósito y que la arquitectura ya admite: transcodificar con FFmpeg los formatos que el navegador no reproduce, agregar TMDb para tener resúmenes en español y mostrar el avance de los escaneos con SignalR en lugar de consultarlo cada 2 segundos.

El código está en [github.com/RafaelLeonTorres/mediateca](https://github.com/RafaelLeonTorres/mediateca).

*Las capturas usan* Sintel *(Blender Foundation, CC BY 3.0) como contenido de demostración.*
