---
title: "REST API Design in ASP.NET Core: Beyond CRUD"
description: "The decisions that turn a CRUD into a production-ready API: HTTP semantics, contracts, pagination, ProblemDetails errors, safe retries, and a well-configured HttpClient."
lang: en
locale: en_US
ref: apis-rest-aspnet-core
date: 2026-11-16 10:40:00 -0600
permalink: /en/blog/rest-api-design-aspnet-core/
image: /assets/img/og-en.png
tags: [ASP.NET Core, REST APIs, C#]
---

A CRUD that answers in Postman is not the same as an API that is ready for production. The difference lies in small decisions: which status code you return, what happens when a client repeats a request, how you paginate a table with millions of rows, and what the client receives when something fails. This post walks through those decisions with ASP.NET Core 8 and 9.

## 1. HTTP methods with the right semantics

Each HTTP method communicates an intent. Respecting it lets clients, proxies, and automatic retries behave predictably.

| Method | Use | Safe? | Idempotent? | Typical response |
|---|---|---|---|---|
| `GET` | Read a resource or a collection | Yes | Yes | `200 OK` |
| `POST` | Create a resource or run an action | No | No | `201 Created` with `Location` |
| `PUT` | Replace a whole resource | No | Yes | `204 No Content` |
| `PATCH` | Change part of a resource | No | Not necessarily | `200 OK` or `204 No Content` |
| `DELETE` | Delete a resource | No | Yes | `204 No Content` |

*Safe* means it doesn't change server state. *Idempotent* means repeating the request leaves the system as if it ran once: if a `DELETE` is retried after a timeout, the final result is the same.

## 2. Explicit contracts: DTOs, not entities

Exposing Entity Framework entities couples your public contract to the database schema and opens the door to *overposting*: clients sending fields they shouldn't be able to change. Define input and output DTOs.

```csharp
public sealed record ProductDto(int Id, string Name, decimal Price);

public sealed record CreateProductRequest(
    [Required, StringLength(120)] string Name,
    [Range(0.01, 1_000_000)] decimal Price);

public sealed record UpdateProductRequest(
    [Required, StringLength(120)] string Name,
    [Range(0.01, 1_000_000)] decimal Price);
```

> In positional records, validation attributes go on the parameter. If you apply them to the property (`[property: Required]`), ASP.NET Core detects it and throws when validating the model.

## 3. A controller that respects HTTP

```csharp
[ApiController]
[Route("api/v1/products")]
public sealed class ProductsController(IProductService products) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ProductDto>>> List(
        [FromQuery, Range(1, int.MaxValue)] int page = 1,
        [FromQuery, Range(1, 100)] int pageSize = 20,
        CancellationToken ct = default)
        => Ok(await products.ListAsync(page, pageSize, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken ct)
    {
        var product = await products.GetAsync(id, ct);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpPost]
    public async Task<ActionResult<ProductDto>> Create(CreateProductRequest request, CancellationToken ct)
    {
        var created = await products.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateProductRequest request, CancellationToken ct)
        => await products.UpdateAsync(id, request, ct) ? NoContent() : NotFound();

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
        => await products.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
```

Worth noticing:

- `[ApiController]` validates the model and returns `400` automatically, including the `page` and `pageSize` ranges.
- `CreatedAtAction` returns `201` with a `Location` header that points to the `GET` by id. That endpoint has to exist; pointing to an action without an `id` produces a useless URL.
- The `CancellationToken` flows down to the database: if the client cancels, so does the query.
- The controller doesn't know about EF Core. It only translates HTTP into service calls and results into status codes.

## 4. Pagination with metadata and a stable order

```csharp
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total)
{
    public int TotalPages => (int)Math.Ceiling(Total / (double)PageSize);
}

public sealed class ProductService(AppDbContext db) : IProductService
{
    public async Task<PagedResult<ProductDto>> ListAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.Products.AsNoTracking();

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(p => p.Id)   // without a stable order, pages repeat or skip rows
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new ProductDto(p.Id, p.Name, p.Price))
            .ToListAsync(ct);

        return new PagedResult<ProductDto>(items, page, pageSize, total);
    }
}
```

- `AsNoTracking()` avoids the cost of change tracking in read-only queries.
- `Select` projects only the columns the DTO needs.
- The maximum page size is validated in the controller; without that limit, a client can ask for a million rows.

On very large tables, `Skip` gets slower as pages advance, because the database has to walk through every previous row. The alternative is keyset pagination: the client sends the last id it received.

```csharp
var items = await db.Products
    .AsNoTracking()
    .Where(p => p.Id > lastId)
    .OrderBy(p => p.Id)
    .Take(pageSize)
    .Select(p => new ProductDto(p.Id, p.Name, p.Price))
    .ToListAsync(ct);
```

## 5. Consistent errors with ProblemDetails

Clients should always receive the same error format, whether validation failed, the resource doesn't exist, or an exception was thrown. ASP.NET Core implements *Problem Details* (RFC 9457).

```csharp
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ConflictExceptionHandler>();

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
```

```csharp
public sealed class ConflictException(string message) : Exception(message);

public sealed class ConflictExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not ConflictException conflict)
            return false; // let the next handler deal with it (generic 500)

        context.Response.StatusCode = StatusCodes.Status409Conflict;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The resource conflicts with its current state.",
                Detail = conflict.Message
            }
        });
    }
}
```

The response looks like this, with a `traceId` you can use to find the request in your logs:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  "title": "The resource conflicts with its current state.",
  "status": 409,
  "detail": "A product named 'Paracetamol 500 mg' already exists.",
  "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
}
```

Never return the `StackTrace` to the client: it belongs in the logs, not in the response.

## 6. Safe retries: idempotency for POST

`POST` is not idempotent. If a client gets no response because of a timeout and retries, you may end up with two identical orders. The usual solution is the `Idempotency-Key` header:

1. The client generates a unique identifier per operation and sends it on every attempt.
2. The server stores the key together with the result of the first execution.
3. If another request arrives with the same key, the server returns the stored result instead of running again.

It's worth it for operations with financial impact or that are hard to undo: payments, orders, dispensations.

## 7. Versioning from day one

Putting the version in the route (`api/v1/...`) costs nothing at first and saves you when the first breaking change arrives: you publish `v2` side by side and set a date to retire `v1`. If you need to version by header or query string, the `Asp.Versioning.Mvc` package covers both.

## 8. Calling the API from .NET

Creating a new `HttpClient` for every call exhausts sockets under load. Register a typed client with `IHttpClientFactory`:

```csharp
builder.Services
    .AddHttpClient<ProductsClient>(client =>
    {
        client.BaseAddress = new Uri("https://api.example.com/");
        client.Timeout = TimeSpan.FromSeconds(10);
    })
    .AddStandardResilienceHandler(); // retries with backoff, circuit breaker, and timeouts
```

```csharp
public sealed class ProductsClient(HttpClient http)
{
    public Task<PagedResult<ProductDto>?> ListAsync(int page, CancellationToken ct) =>
        http.GetFromJsonAsync<PagedResult<ProductDto>>($"api/v1/products?page={page}&pageSize=20", ct);

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct)
    {
        using var response = await http.PostAsJsonAsync("api/v1/products", request, ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ProductDto>(ct))!;
    }
}
```

`AddStandardResilienceHandler` comes from the `Microsoft.Extensions.Http.Resilience` package. If your `POST` isn't idempotent, configure retries only for safe methods or send an `Idempotency-Key`.

## Checklist before publishing an API

- Every endpoint returns the right status code, and `201` with `Location` on create.
- Requests and responses use DTOs, never entities.
- Validation is declarative and the `400` is automatic.
- Pagination has a stable order, a maximum page size, and a total count.
- Errors use the ProblemDetails format, including `404` and `500`.
- The `CancellationToken` reaches the database.
- `POST` endpoints that can be retried accept an `Idempotency-Key`.
- The version is in the route from the first release.
- Clients use `IHttpClientFactory`, an explicit timeout, and a resilience policy.
