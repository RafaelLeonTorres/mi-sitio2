---
title: "How Mediateca works: a media library manager with .NET 11, Angular 22 and PostgreSQL"
description: "A walkthrough of a portfolio project: four containers behind a single origin, streaming with Range requests, the database as a scan queue, permissions in the query, metadata from IMDb and AniList, and a player with subtitles and WebGPU upscaling."
lang: en
locale: en_US
ref: como-funciona-mediateca
date: 2026-11-20 12:00:00 -0600
permalink: /en/blog/how-mediateca-works/
tags: [.NET, Angular, PostgreSQL, Docker, Architecture]
---

[Mediateca](https://github.com/RafaelLeonTorres/mediateca) organizes and plays your own collection of movies, series, anime and music in the browser. It takes the basics of Jellyfin as a reference, but the code, the data model and the design are my own. It's a portfolio project, so instead of listing features, this post explains how it's built and why I made each decision.

## What it does

- Movie, series, anime and music libraries in any folder on your drives, picked from the app. Drives are mounted read-only.
- Incremental scanning in a separate process, on demand or on a schedule you change from the admin screen.
- Metadata from IMDb (through OMDb) for movies and series, and from AniList for anime. Music uses the tags in its files.
- A custom player that resumes where you left off, with subtitles and GPU upscaling.
- Users with per-library permissions: whatever isn't yours responds as if it didn't exist.

<figure>
  <img src="{{ '/assets/img/blog/mediateca/ficha.webp' | relative_url }}" alt="Sintel’s page in Mediateca: poster, year, rating, runtime, overview and the Play, Mark as watched, Identify and Refresh metadata buttons." width="780" height="600" loading="lazy">
  <figcaption>A movie’s page (the interface is in Spanish), with the data and poster that come from IMDb through OMDb.</figcaption>
</figure>

## Four containers, one origin

Everything runs with Docker Compose in four containers:

```text
Browser
    |   pages, /api with cookie and XSRF, video and audio with Range
    v
web: nginx serving the Angular build
    |   /api
    v
api: ASP.NET Core 11  ---->  db: PostgreSQL 18  <----  worker: .NET 11 with Quartz
                                                       (scans and metadata)
```

The API and the worker read your drives read-only and store posters and subtitles in a data volume. The browser only talks to `web`: nginx serves the Angular build and forwards `/api` to the API container, so the app and the API share an origin. That simplifies two things: there's no CORS, and the session can live in a cookie.

### Why a cookie and not a JWT

The `<video>` and `<audio>` tags can't send an `Authorization` header, but they do send cookies for their origin. With a JWT I would have had to put the token in the video URL, where it ends up in the browser history and in the logs. With an `HttpOnly`, `SameSite=Lax` cookie, streaming is authenticated with no extra work.

A cookie brings its own risk, CSRF, and ASP.NET Core's antiforgery covers it: every POST, PUT and DELETE carries the token in the `X-XSRF-TOKEN` header, which Angular adds on its own. On top of that, the Identity security stamp is checked every 30 seconds, so changing someone's password or role ends their sessions without waiting for the cookie to expire.

## Streaming with Range

Seeking forward and back in a video depends on the server answering partial requests (`206 Partial Content`). ASP.NET Core already does that with `PhysicalFile`; what matters is where the path comes from:

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

The client never sends file paths: it asks for an id, the path comes from the database and, even then, it's only served if it's inside the media folders. In nginx, `/api` runs unbuffered (`proxy_buffering off`) so partial responses go straight to the browser.

## The database as a scan queue

Scanning a large library takes time. Running it inside the API would compete with the API for memory and CPU, and a restart would cut it in half. So the API only inserts a `ScanJob` in the `Queued` state and responds right away; a separate container, the `worker`, picks the jobs up and runs them.

I didn't add RabbitMQ or any other moving part: the queue is the table. The worker claims the oldest scan with a conditional update:

```csharp
var claimed = await db.ScanJobs
    .Where(j => j.Id == id && j.Status == ScanStatus.Queued)
    .ExecuteUpdateAsync(
        setters => setters
            .SetProperty(j => j.Status, ScanStatus.Running)
            .SetProperty(j => j.StartedAt, now),
        cancellationToken);
```

If `claimed` is 1, the scan is its own; if it's 0, another process got there first and the worker looks again. It's safe with several workers and needs no locks in the application.

The other rule, a single active scan per library, is enforced by PostgreSQL with a partial unique index:

```csharp
builder.HasIndex(j => j.LibraryId)
    .IsUnique()
    .HasFilter("\"Status\" IN ('Queued', 'Running')")
    .HasDatabaseName("IX_ScanJobs_LibraryId_Active");
```

If two requests ask to scan the same library at the same time, the second one hits the index and returns the scan that already exists. On startup, the worker marks as failed any scans left `Running` by a restart. Scheduled scans use Quartz.NET with a cron expression the admin edits in the app; the worker checks the schedule every 30 seconds, so a change takes effect in under a minute without restarting anything.

<figure>
  <img src="{{ '/assets/img/blog/mediateca/escaneo.webp' | relative_url }}" alt="Library admin screen: the movie library with its OMDb metadata counts and its last scan, and the scheduled scan section with the frequency, time zone and next runs." width="780" height="770" loading="lazy">
  <figcaption>Library admin: metadata counts, the last scan and the scan schedule with its next runs.</figcaption>
</figure>

Scanning is incremental: it compares path, size and modification date, and it understands Jellyfin's naming conventions: `Series (Year)/Season 01/… S01E02`, absolute episode numbers for anime, `Lat` and `Sub` folders holding the same episodes in two languages, and `folder.jpg` and `backdrop.jpg` images next to the videos. The name parsers are pure functions, covered by more than a hundred test cases.

## The data model

Movies, series, seasons, episodes, albums and tracks all inherit from `MediaItem` in a single table (TPH inheritance with a discriminator). That way a single query serves search, "Recently added" and "Continue watching". A few PostgreSQL features I used:

- `pg_trgm` with a GIN index on the title, so `ILIKE '%text%'` doesn't scan the whole table.
- `text[]` for genres, studios and library paths, and `jsonb` for the cache of provider responses.
- A `ScanKey` built from the folder's title and year: metadata can change a series' title, but the next scan still recognizes it and doesn't duplicate it.

## Permissions in the query, 404 for everything else

Each user only sees the libraries the admin assigns them. The rule lives in one place, an extension method that every query starts from:

```csharp
public static IQueryable<MediaItem> VisibleItems(this MediatecaDbContext db, Guid userId, bool isAdmin) =>
    isAdmin
        ? db.MediaItems
        : db.MediaItems.Where(item =>
            db.LibraryAccess.Any(access => access.UserId == userId && access.LibraryId == item.LibraryId));
```

An item from another library returns 404, not 403, so its existence isn't revealed. And since permissions are checked on every request, removing someone's access to a library takes effect immediately.

<figure>
  <img src="{{ '/assets/img/blog/mediateca/usuario.webp' | relative_url }}" alt="New user dialog: username, display name, initial password, role and the checkboxes for the libraries the user can see." width="608" height="706" loading="lazy">
  <figcaption>When creating a user, the admin checks the libraries they can see.</figcaption>
</figure>

Where a race could leave invalid data, I use PostgreSQL advisory locks inside the transaction (`pg_advisory_xact_lock`): two simultaneous first-run requests don't create two admins, and two admins demoting themselves at the same time don't leave the system without one.

## Metadata without guessing

Movies and series get their data from IMDb through OMDb, and anime from AniList, over GraphQL. Both have limits: AniList allows up to 90 requests per minute (30 when it's in degraded mode) and blocks you for a minute if you go over, and OMDb gives you 1,000 a day with the free key. That's why:

- Every AniList request goes through a gate that lets one through every 2 seconds, and a 429 pauses the queue for as long as `Retry-After` says, without retrying.
- Every response is cached in the database.
- Search doesn't settle for the first result: a score compares the title (romaji, English, original and synonyms), the year, the season and the format, and below a threshold it leaves the item unmatched instead of picking the wrong one. For those cases there's the Identify dialog, where you can search again or paste the IMDb id or the AniList URL.

The metadata queue also lives in the worker, and images already sitting next to the videos always win over the provider's.

## The player

The video player has custom controls that hide on their own, keyboard shortcuts and full screen. It saves the position every 10 seconds and when you leave; past 90 %, it marks the episode as watched. "Next up" looks for the next episode in the same folder, so the `Lat` and `Sub` versions never get mixed.

**Subtitles** come from three places: text tracks embedded in the video, `.srt`, `.vtt` and `.ass` files next to it, and files any user uploads from the player. Everything is converted to WebVTT, the format the browser understands: SRT with a C# converter, ASS with FFmpeg (or a basic C# converter when FFmpeg isn't installed), and embedded tracks, listed by `ffprobe`, with FFmpeg. Extraction has a limit on concurrent processes, a timeout and a disk cache that's invalidated when the file changes.

**Upscaling** runs in the browser with WebGPU: the video is imported as a texture and drawn on a `<canvas>` on top of the `<video>`, with Original, Enhanced and Compare views. The GPU code is loaded with a dynamic import the first time it's used, and without WebGPU the button is disabled and says why.

<figure>
  <img src="{{ '/assets/img/blog/mediateca/reproductor.webp' | relative_url }}" alt="Mediateca’s player showing Sintel: Spanish subtitles extracted from the MKV, the upscaler’s Compare view with the divider between Original and Enhanced, and the control bar." width="780" height="440" loading="lazy">
  <figcaption>Spanish subtitles pulled from the MKV and the upscaler’s Compare view: left of the divider, the original video; right of it, the GPU-processed one.</figcaption>
</figure>

Music uses a `PlayerService` built on signals and a single `<audio>` element for the whole app, so it keeps playing while you browse and pauses on its own when you open a video.

## Angular 22 without Zone.js

The frontend is Angular 22 with standalone components, signals and zoneless change detection. API reads use `httpResource`, and that's where I learned a lesson: `value()` throws when the resource is in an error state (a 404, a closed session), so you always ask `hasValue()` first:

```typescript
protected readonly nextUpItem = computed(() => (this.nextUp.hasValue() ? this.nextUp.value() : null));
```

Every form uses Signal Forms, stable since Angular 22. The rules for a new password and its confirmation live in one place, shared by the first-run wizard, My account and the admin screens:

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

## Tests and CI

- **Unit (xUnit and Moq):** name parsers, subtitle conversion, candidate scoring and the provider gate. That's 236 test methods, with more than 400 cases in the `[Theory]` tests.
- **Integration (Testcontainers and WebApplicationFactory):** 122 tests against a real PostgreSQL. For example: with two users and two libraries, each gets a 404 on everything that belongs to the other; two simultaneous first-run requests create a single admin; and a session stops working when the password changes.
- **Frontend (Vitest):** 366 tests for services, guards and components.

GitHub Actions runs everything on each pull request and also starts the four containers and calls `/api/health` through nginx.

## Trying it out

On Windows, `setup.ps1` creates the `.env` file, mounts your drives read-only and starts the containers. On macOS or Linux you start it with `docker compose up -d --build --wait` and add your drives by hand, as the README explains. On the first run, the API creates the database and the app asks for the admin account; each library's folders are picked later, from the app. Movie and series metadata needs a free OMDb key in `OMDB_API_KEY`; anime doesn't need a key.

## What's next

Some things I left out on purpose, and the architecture already supports them: transcoding with FFmpeg the formats the browser can't play, adding TMDb for Spanish overviews, and showing scan progress with SignalR instead of polling every 2 seconds.

The code is at [github.com/RafaelLeonTorres/mediateca](https://github.com/RafaelLeonTorres/mediateca).

*Screenshots use* Sintel *(Blender Foundation, CC BY 3.0) as demo content.*
