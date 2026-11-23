---
title: "Diseño de APIs REST en ASP.NET Core: más allá del CRUD"
description: "Las decisiones que convierten un CRUD en una API lista para producción: semántica HTTP, contratos, paginación, errores con ProblemDetails, reintentos seguros y un cliente con HttpClient bien configurado."
lang: es
locale: es_MX
ref: apis-rest-aspnet-core
date: 2026-04-23 10:40:00 -0600
permalink: /blog/apis-rest-aspnet-core/
tags: [ASP.NET Core, APIs REST, C#]
redirect_from:
  - /post1.html
  - /Post5.html
---

Un CRUD que responde en Postman no es lo mismo que una API lista para producción. La diferencia está en decisiones pequeñas: qué código de estado devuelves, qué pasa si el cliente repite una petición, cómo paginas una tabla con millones de filas o qué recibe el cliente cuando algo falla. En este post recorro esas decisiones con ASP.NET Core 8 y 9.

## 1. Verbos HTTP con la semántica correcta

Cada método HTTP comunica una intención. Respetarla permite que clientes, proxies y reintentos automáticos se comporten de forma predecible.

| Método | Uso | ¿Seguro? | ¿Idempotente? | Respuesta típica |
|---|---|---|---|---|
| `GET` | Leer un recurso o una colección | Sí | Sí | `200 OK` |
| `POST` | Crear un recurso o ejecutar una acción | No | No | `201 Created` con `Location` |
| `PUT` | Reemplazar un recurso completo | No | Sí | `204 No Content` |
| `PATCH` | Modificar parte de un recurso | No | No necesariamente | `200 OK` o `204 No Content` |
| `DELETE` | Eliminar un recurso | No | Sí | `204 No Content` |

*Seguro* significa que no cambia el estado del servidor. *Idempotente* significa que repetir la petición deja el sistema igual que hacerla una sola vez: si un `DELETE` se reintenta por un timeout, el resultado final es el mismo.

## 2. Contratos explícitos: DTOs, no entidades

Exponer las entidades de Entity Framework acopla tu contrato público al esquema de la base de datos y abre la puerta al *overposting*: que el cliente envíe campos que no debería poder modificar. Define DTOs de entrada y de salida.

```csharp
public sealed record ProductoDto(int Id, string Nombre, decimal Precio);

public sealed record CrearProductoRequest(
    [Required, StringLength(120)] string Nombre,
    [Range(0.01, 1_000_000)] decimal Precio);

public sealed record ActualizarProductoRequest(
    [Required, StringLength(120)] string Nombre,
    [Range(0.01, 1_000_000)] decimal Precio);
```

> En los `record` posicionales, los atributos de validación van en el parámetro. Si los aplicas a la propiedad (`[property: Required]`), ASP.NET Core lo detecta y lanza una excepción al validar el modelo.

## 3. Un controlador que respeta HTTP

```csharp
[ApiController]
[Route("api/v1/productos")]
public sealed class ProductosController(IProductoService productos) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ProductoDto>>> Listar(
        [FromQuery, Range(1, int.MaxValue)] int pagina = 1,
        [FromQuery, Range(1, 100)] int tamanio = 20,
        CancellationToken ct = default)
        => Ok(await productos.ListarAsync(pagina, tamanio, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductoDto>> ObtenerPorId(int id, CancellationToken ct)
    {
        var producto = await productos.ObtenerAsync(id, ct);
        return producto is null ? NotFound() : Ok(producto);
    }

    [HttpPost]
    public async Task<ActionResult<ProductoDto>> Crear(CrearProductoRequest request, CancellationToken ct)
    {
        var creado = await productos.CrearAsync(request, ct);
        return CreatedAtAction(nameof(ObtenerPorId), new { id = creado.Id }, creado);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Actualizar(int id, ActualizarProductoRequest request, CancellationToken ct)
        => await productos.ActualizarAsync(id, request, ct) ? NoContent() : NotFound();

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
        => await productos.EliminarAsync(id, ct) ? NoContent() : NotFound();
}
```

Lo que vale la pena notar:

- `[ApiController]` valida el modelo y responde `400` automáticamente, incluidos los rangos de `pagina` y `tamanio`.
- `CreatedAtAction` responde `201` con el encabezado `Location` apuntando al `GET` por id. Para eso tiene que existir ese endpoint; apuntar a una acción sin `id` genera una URL que no sirve.
- El `CancellationToken` llega hasta la base de datos: si el cliente cancela, la consulta también se cancela.
- El controlador no conoce EF Core. Solo traduce HTTP a llamadas del servicio y resultados a códigos de estado.

## 4. Paginación con metadatos y orden estable

```csharp
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Pagina, int Tamanio, int Total)
{
    public int TotalPaginas => (int)Math.Ceiling(Total / (double)Tamanio);
}

public sealed class ProductoService(AppDbContext db) : IProductoService
{
    public async Task<PagedResult<ProductoDto>> ListarAsync(int pagina, int tamanio, CancellationToken ct)
    {
        var consulta = db.Productos.AsNoTracking();

        var total = await consulta.CountAsync(ct);
        var items = await consulta
            .OrderBy(p => p.Id)   // sin un orden estable, las páginas repiten o saltan filas
            .Skip((pagina - 1) * tamanio)
            .Take(tamanio)
            .Select(p => new ProductoDto(p.Id, p.Nombre, p.Precio))
            .ToListAsync(ct);

        return new PagedResult<ProductoDto>(items, pagina, tamanio, total);
    }
}
```

- `AsNoTracking()` evita el costo del seguimiento de cambios en consultas de solo lectura.
- `Select` proyecta solo las columnas que el DTO necesita.
- El tamaño máximo de página se valida en el controlador; sin ese límite, un cliente puede pedir un millón de filas.

En tablas muy grandes, `Skip` se vuelve más lento conforme avanzan las páginas, porque la base de datos tiene que recorrer todas las filas anteriores. La alternativa es paginar por llave (*keyset*): el cliente envía el último id que recibió.

```csharp
var items = await db.Productos
    .AsNoTracking()
    .Where(p => p.Id > ultimoId)
    .OrderBy(p => p.Id)
    .Take(tamanio)
    .Select(p => new ProductoDto(p.Id, p.Nombre, p.Precio))
    .ToListAsync(ct);
```

## 5. Errores consistentes con ProblemDetails

El cliente debe recibir siempre el mismo formato de error, sin importar si falló la validación, no existe el recurso o hubo una excepción. ASP.NET Core implementa *Problem Details* (RFC 9457).

```csharp
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ConflictoExceptionHandler>();

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
```

```csharp
public sealed class ConflictoException(string mensaje) : Exception(mensaje);

public sealed class ConflictoExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not ConflictoException conflicto)
            return false; // lo atiende el siguiente manejador (500 genérico)

        context.Response.StatusCode = StatusCodes.Status409Conflict;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "El recurso está en conflicto con su estado actual.",
                Detail = conflicto.Message
            }
        });
    }
}
```

La respuesta queda así, con un `traceId` que te permite encontrar la petición en los logs:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  "title": "El recurso está en conflicto con su estado actual.",
  "status": 409,
  "detail": "Ya existe un producto con el nombre 'Paracetamol 500 mg'.",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
}
```

Nunca devuelvas el `StackTrace` al cliente: va en los logs, no en la respuesta.

## 6. Reintentos seguros: idempotencia en POST

`POST` no es idempotente. Si el cliente no recibe respuesta por un timeout y reintenta, puedes terminar con dos pedidos iguales. La solución habitual es el encabezado `Idempotency-Key`:

1. El cliente genera un identificador único por operación y lo envía en cada intento.
2. El servidor guarda la clave junto con el resultado de la primera ejecución.
3. Si llega otra petición con la misma clave, el servidor devuelve el resultado guardado en lugar de ejecutar de nuevo.

Vale la pena en operaciones con efecto económico o difíciles de revertir: pagos, pedidos, dispensaciones.

## 7. Versionado desde el día uno

Incluir la versión en la ruta (`api/v1/...`) cuesta nada al principio y te salva cuando llega el primer cambio incompatible: publicas `v2` en paralelo y das una fecha para retirar `v1`. Si necesitas versionar por encabezado o *query string*, el paquete `Asp.Versioning.Mvc` resuelve ambos casos.

## 8. Consumir la API desde .NET

Crear un `HttpClient` nuevo en cada llamada agota los sockets bajo carga. Registra un cliente tipado con `IHttpClientFactory`:

```csharp
builder.Services
    .AddHttpClient<ProductosClient>(client =>
    {
        client.BaseAddress = new Uri("https://api.midominio.com/");
        client.Timeout = TimeSpan.FromSeconds(10);
    })
    .AddStandardResilienceHandler(); // reintentos con backoff, circuit breaker y timeouts
```

```csharp
public sealed class ProductosClient(HttpClient http)
{
    public Task<PagedResult<ProductoDto>?> ListarAsync(int pagina, CancellationToken ct) =>
        http.GetFromJsonAsync<PagedResult<ProductoDto>>($"api/v1/productos?pagina={pagina}&tamanio=20", ct);

    public async Task<ProductoDto> CrearAsync(CrearProductoRequest request, CancellationToken ct)
    {
        using var respuesta = await http.PostAsJsonAsync("api/v1/productos", request, ct);
        respuesta.EnsureSuccessStatusCode();
        return (await respuesta.Content.ReadFromJsonAsync<ProductoDto>(ct))!;
    }
}
```

`AddStandardResilienceHandler` viene del paquete `Microsoft.Extensions.Http.Resilience`. Si tu `POST` no es idempotente, configura los reintentos solo para métodos seguros o envía una `Idempotency-Key`.

## Checklist antes de publicar una API

- Cada endpoint devuelve el código de estado que corresponde, y `201` con `Location` al crear.
- Entra y sale con DTOs, nunca con entidades.
- La validación es declarativa y el `400` es automático.
- La paginación tiene orden estable, tamaño máximo y total de registros.
- Los errores salen en formato ProblemDetails, también los `404` y los `500`.
- El `CancellationToken` llega hasta la base de datos.
- Los `POST` que pueden reintentarse aceptan `Idempotency-Key`.
- La versión está en la ruta desde la primera publicación.
- Los clientes usan `IHttpClientFactory`, un timeout explícito y una política de resiliencia.
