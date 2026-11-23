---
title: "What's New in .NET 11 and C# 15, with Examples: Unions, Closed Hierarchies, and Runtime Async"
description: "What's new in .NET 11, the latest release: unions and closed hierarchies in C# 15, runtime async, Zstandard, FullJoin in LINQ, async validation, and what to check before upgrading. The examples were compiled with the 11 SDK."
lang: en
locale: en_US
ref: novedades-dotnet-11
date: 2026-11-23 08:20:00 -0600
permalink: /en/blog/whats-new-dotnet-11/
tags: [".NET 11", "C# 15", "What's new"]
---

.NET 11 shipped on November 10, 2026 together with C# 15. It's a Standard Term Support (STS) release: it gets patches until November 14, 2028, the same date .NET 10, which is LTS, goes out of support. This post goes through what changes when you write code. The examples were compiled and run with SDK 11.0.100, except those for EF Core 11, OpenAPI, and the MCP template, which come from the official documentation.

| Version | Type | End of support |
|---|---|---|
| .NET 9 | STS | November 10, 2026 (already over) |
| .NET 10 | LTS | November 14, 2028 |
| .NET 11 | STS | November 14, 2028 |

The dates come from the [.NET support policy](https://dotnet.microsoft.com/platform/support/policy/dotnet-core).

## C# 15

C# 15 is the default language of projects that target `net11.0` with the 11 SDK, so you don't have to touch `LangVersion`. Only memory safety, which we don't cover here, is still in preview.

### Unions (`union`)

A union is a value that can be one of several types that have nothing in common: no base class and no interface. Until now you had to invent a hierarchy, return `object`, or use a third-party library. In C# 15 you declare it with `union`:

```csharp
public record PaymentApproved(string Authorization);
public record PaymentDeclined(string Reason);
public record PaymentPending(TimeSpan Wait);

public union PaymentResult(PaymentApproved, PaymentDeclined, PaymentPending);

public static class Payments
{
    public static PaymentResult Charge(decimal amount) => amount switch
    {
        <= 0 => new PaymentDeclined("Invalid amount"),
        > 10_000 => new PaymentPending(TimeSpan.FromSeconds(30)),
        _ => new PaymentApproved("A-1234"),
    };

    public static string Describe(PaymentResult result) => result switch
    {
        PaymentApproved a => $"Approved ({a.Authorization})",
        PaymentDeclined d => $"Declined: {d.Reason}",
        PaymentPending p => $"Pending: retry in {p.Wait.TotalSeconds} s",
    };
}
```

```csharp
Console.WriteLine(Payments.Describe(Payments.Charge(250)));
Console.WriteLine(Payments.Describe(Payments.Charge(-5)));
Console.WriteLine(Payments.Describe(Payments.Charge(25_000)));
```

```text
Approved (A-1234)
Declined: Invalid amount
Pending: retry in 30 s
```

Each type converts implicitly to the union (that's why `Charge` returns a `PaymentDeclined` or a `PaymentPending` without explicit conversions) and the `switch` is exhaustive: if you remove a case, the compiler warns with CS8509 and tells you which pattern is missing.

ASP.NET Core 11 and `System.Text.Json` understand unions. An endpoint that returns `PaymentResult` responds with the JSON of the case, with no extra field:

```csharp
app.MapGet("/payment/{amount:decimal}", (decimal amount) => Payments.Charge(amount));
```

```text
GET /payment/250    -> 200 {"authorization":"A-1234"}
GET /payment/-5     -> 200 {"reason":"Invalid amount"}
GET /payment/25000  -> 200 {"wait":"00:00:30"}
```

Since no field identifies the case, if two cases produce the same JSON shape you should disambiguate them with a `[JsonUnion]` classifier. According to the documentation, unions also aren't supported in binding sources other than the request body (route, query string, headers, and forms).

### Closed hierarchies (`closed`)

`closed` fixes the direct descendants of a class: you can only derive from it within the same assembly, so the compiler knows every case and the `switch` doesn't need a `default`:

```csharp
public closed record class OrderState;
public record class Created : OrderState;
public record class Shipped(string Tracking) : OrderState;
public record class Delivered(DateOnly Date) : OrderState;

public static class Orders
{
    public static string Describe(OrderState state) => state switch
    {
        Created => "Waiting to ship",
        Shipped(var tracking) => $"On its way, tracking {tracking}",
        Delivered(var date) => $"Delivered on {date:MM/dd/yyyy}",
    };
}
```

```csharp
Console.WriteLine(Orders.Describe(new Created()));
Console.WriteLine(Orders.Describe(new Shipped("MX-998")));
Console.WriteLine(Orders.Describe(new Delivered(new DateOnly(2026, 11, 20))));
```

```text
Waiting to ship
On its way, tracking MX-998
Delivered on 11/20/2026
```

A `closed` class is implicitly abstract and can't be combined with `sealed` or `static`. The rule isn't transitive: a descendant that isn't `closed` can still be inherited from in other assemblies. If you leave a descendant out of the `switch`, the compiler warns with CS8509.

**Union or closed hierarchy?** A union joins types that already exist and aren't related (one of them can come from another package). A closed hierarchy models a family of your own, with shared data and behavior.

### Collection expression arguments: `with(...)`

A `with(...)` element at the start of a collection expression passes arguments to the collection's constructor or factory method: capacity, comparer, and so on. Before, you had to give up the short `[...]` syntax to configure them.

```csharp
string[] values = ["one", "two", "three"];

List<string> names = [with(capacity: values.Length * 2), .. values];
HashSet<string> set = [with(StringComparer.OrdinalIgnoreCase), "Hello", "HELLO", "hello"];

Console.WriteLine($"{names.Count} items, capacity {names.Capacity}");
Console.WriteLine(set.Count);
```

```text
3 items, capacity 6
1
```

### Extension indexers

C# 14 brought `extension` blocks for properties and methods; C# 15 adds indexers to them. Since an indexer is always an instance member, the block must name the receiver (here, `user`):

```csharp
using System.Security.Claims;

public static class ClaimsExtensions
{
    extension(ClaimsPrincipal user)
    {
        public string? this[string type] => user.FindFirst(type)?.Value;
    }
}
```

```csharp
var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim("email", "ana@example.com")], "test"));
Console.WriteLine(user["email"]);
Console.WriteLine(user["phone"] is null);
```

```text
ana@example.com
True
```

### Labeled `break` and `continue`

`break` and `continue` can now name the loop they refer to. They replace the Boolean flag or the `goto` you used to need to get out of nested loops:

```csharp
public enum RoomState { Free, Occupied, Blocked }

public static class Rooms
{
    public static (int Floor, int Room)? FirstFree(RoomState[,] rooms)
    {
        (int Floor, int Room)? free = null;

        floors:
        for (var floor = 0; floor < rooms.GetLength(0); floor++)
        {
            for (var room = 0; room < rooms.GetLength(1); room++)
            {
                if (rooms[floor, room] == RoomState.Blocked)
                    continue floors; // a floor with one blocked room is discarded entirely

                if (rooms[floor, room] == RoomState.Free)
                {
                    free = (floor, room);
                    break floors;
                }
            }
        }

        return free;
    }
}
```

```csharp
var rooms = new RoomState[,]
{
    { RoomState.Occupied, RoomState.Blocked, RoomState.Free },
    { RoomState.Occupied, RoomState.Free,    RoomState.Free },
    { RoomState.Free,     RoomState.Free,    RoomState.Free },
};
var first = Rooms.FirstFree(rooms);
Console.WriteLine($"floor {first!.Value.Floor}, room {first.Value.Room}");
```

```text
floor 1, room 1
```

The first floor has a free room at the end, but also a blocked one, so `continue floors` discards it entirely and jumps to the next; `break floors` exits both loops as soon as it finds a free room.

C# 15 also lets you declare non-virtual static members in interfaces even when the target runtime doesn't support default interface implementations, and it brings a memory safety preview that requires `LangVersion` set to `preview`.

## Runtime

### Runtime async

Until now, every `async` method generated a state machine written by the compiler. .NET 11 introduces runtime async: the runtime itself manages suspension and resumption. The runtime libraries are already compiled this way. In your project you turn it on with a property (on `net11.0` you don't need `EnablePreviewFeatures`):

```xml
<PropertyGroup>
  <Features>runtime-async=on</Features>
</PropertyGroup>
```

The most visible effect is on live call stacks, the ones the debugger, profilers, and `new StackTrace()` see. With this code:

```csharp
using System.Diagnostics;

await OuterAsync();

static async Task OuterAsync() => await MiddleAsync();

static async Task MiddleAsync() => await InnerAsync();

static async Task InnerAsync()
{
    var frames = new StackTrace().GetFrames();
    Console.WriteLine($"{frames.Length} frames on the stack:");

    foreach (var frame in frames)
    {
        var method = frame.GetMethod();
        Console.WriteLine($"   {method?.DeclaringType?.Name}.{method?.Name}");
    }

    await Task.CompletedTask;
}
```

This is what it prints without `runtime-async`:

```text
13 frames on the stack:
   <<<Main>$>g__InnerAsync|0_2>d.MoveNext
   AsyncMethodBuilderCore.Start
   Program.<<Main>$>g__InnerAsync|0_2
   <<<Main>$>g__MiddleAsync|0_1>d.MoveNext
   AsyncMethodBuilderCore.Start
   Program.<<Main>$>g__MiddleAsync|0_1
   <<<Main>$>g__OuterAsync|0_0>d.MoveNext
   AsyncMethodBuilderCore.Start
   Program.<<Main>$>g__OuterAsync|0_0
   <<Main>$>d__0.MoveNext
   AsyncMethodBuilderCore.Start
   Program.<Main>$
   Program.<Main>
```

And this with `runtime-async=on`:

```text
5 frames on the stack:
   Program.<<Main>$>g__InnerAsync|0_2
   Program.<<Main>$>g__MiddleAsync|0_1
   Program.<<Main>$>g__OuterAsync|0_0
   Program.<Main>$
   Program.<Main>
```

Thirteen frames against five: now you see the real chain of calls. Exceptions (`catch (Exception ex)`) already looked the same with or without runtime async; the improvement is in what you observe while the program runs. The documentation also mentions that continuations no longer capture and restore `ExecutionContext` when there's nothing to restore, which reduces overhead on high-volume asynchronous paths. Runtime async is turned on per project: try it with your load tests before taking it to production.

### Minimum hardware requirements

The CPU floor goes up. .NET 11 requires x86-64-v2 on x86 and x64 (for example, `POPCNT` and `SSE4.2`) and, on Windows running on Arm64, the `LSE` extension. According to the documentation, the last processors that don't meet it left manufacturer support around 2013, but if you have virtual machines or very old equipment, check them before upgrading: on a CPU that doesn't meet it, .NET 11 doesn't start and reports that the CPU is missing baseline instruction sets.

## Libraries

### Built-in Zstandard

`ZstandardStream` and `ZstandardEncoder` live in `System.IO.Compression`, next to `GZipStream` and `BrotliStream`:

```csharp
using System.IO.Compression;

public static class Compression
{
    public static byte[] Compress(byte[] data)
    {
        using var output = new MemoryStream();

        using (var zstd = new ZstandardStream(output, CompressionMode.Compress, leaveOpen: true))
            zstd.Write(data);

        return output.ToArray();
    }

    public static byte[] Decompress(byte[] compressed)
    {
        using var input = new MemoryStream(compressed);
        using var zstd = new ZstandardStream(input, CompressionMode.Decompress);
        using var output = new MemoryStream();

        zstd.CopyTo(output);
        return output.ToArray();
    }
}
```

```csharp
var json = Encoding.UTF8.GetBytes(string.Concat(Enumerable.Repeat("{\"id\":123,\"status\":\"ok\"}", 2000)));
var compressed = Compression.Compress(json);
var restored = Compression.Decompress(compressed);
Console.WriteLine($"{json.Length} bytes -> {compressed.Length} bytes, identical: {restored.AsSpan().SequenceEqual(json)}");
```

```text
48000 bytes -> 41 bytes, identical: True
```

The test JSON is repetitive on purpose, so those 41 bytes say nothing about your real data: measure with your own workloads. For small messages that look alike, `ZstandardDictionary` lets you train a dictionary and improve compression.

### LINQ: `LeftJoin`, `RightJoin`, and `FullJoin`

Outer joins arrive in LINQ and return tuples, so they combine well with patterns. They exist in `Enumerable`, `Queryable`, and `AsyncEnumerable`, and EF Core 11 can translate `FullJoin`. A typical case is reconciling two lists: what the bank reports against what the system recorded.

```csharp
public record Transaction(string Reference, decimal Amount);

public static class Reconciliation
{
    public static IEnumerable<string> Compare(IEnumerable<Transaction> bank, IEnumerable<Transaction> ledger)
    {
        foreach (var (inBank, inLedger) in bank.FullJoin(ledger, b => b.Reference, l => l.Reference))
        {
            yield return (inBank, inLedger) switch
            {
                (null, { } l) => $"{l.Reference}: missing from the bank",
                ({ } b, null) => $"{b.Reference}: missing from the ledger",
                ({ } b, { } l) when b.Amount != l.Amount => $"{b.Reference}: bank {b.Amount} vs ledger {l.Amount}",
                ({ } b, _) => $"{b.Reference}: reconciled",
                _ => throw new InvalidOperationException("FullJoin never returns empty pairs."),
            };
        }
    }
}
```

```csharp
var bank = new List<Transaction> { new("A1", 500m), new("A2", 120m), new("A4", 75m) };
var ledger = new List<Transaction> { new("A1", 500m), new("A2", 100m), new("A3", 40m) };
var result = Reconciliation.Compare(bank, ledger).ToList();
foreach (var line in result) Console.WriteLine(line);
```

```text
A1: reconciled
A2: bank 120 vs ledger 100
A4: missing from the ledger
A3: missing from the bank
```

### Asynchronous validation with DataAnnotations

A validation attribute that needed to query the database or call another API could only block a thread. Now `System.ComponentModel.DataAnnotations` has `AsyncValidationAttribute`, `IAsyncValidatableObject`, and the `Validator.ValidateObjectAsync` and `TryValidateObjectAsync` methods. In ASP.NET Core 11, Minimal APIs run them on their own if you register `AddValidation()`:

```csharp
using System.ComponentModel.DataAnnotations;

public sealed class EmailAvailableAttribute : AsyncValidationAttribute
{
    // The synchronous version isn't used: this attribute only validates asynchronously.
    protected override ValidationResult? IsValid(object? value, ValidationContext context) =>
        throw new InvalidOperationException("Validate this attribute with IsValidAsync.");

    protected override async Task<ValidationResult?> IsValidAsync(
        object? value, ValidationContext context, CancellationToken cancellationToken)
    {
        var users = context.GetRequiredService<IUsers>();

        if (value is string email && await users.EmailExistsAsync(email, cancellationToken))
            return new ValidationResult("That email is already registered.");

        return ValidationResult.Success;
    }
}

public class NewUser
{
    [Required, EmailAddress, EmailAvailable]
    public string Email { get; set; } = "";
}
```

```csharp
builder.Services.AddSingleton<IUsers, InMemoryUsers>();
builder.Services.AddValidation();

var app = builder.Build();

app.MapPost("/users", (NewUser user) => Results.Ok(new { user.Email }));
```

`IUsers` is an interface in your application with `EmailExistsAsync`; in the test, an in-memory implementation that takes 10 milliseconds to simulate the query. These are the responses:

```text
POST /users {"email":"ana@example.com"}  -> 400 {"title":"One or more validation errors occurred.","status":400,"errors":{"Email":["That email is already registered."]}}
POST /users {"email":"new@example.com"}  -> 200 {"email":"new@example.com"}
POST /users {"email":"not-an-email"}     -> 400 {"title":"One or more validation errors occurred.","status":400,"errors":{"Email":["The Email field is not a valid e-mail address."]}}
```

The message for the badly formatted email is the default one from `[EmailAddress]`; set `ErrorMessage` on the attribute to customize it.

## ASP.NET Core 11, in brief

- **`[ShortCircuit]`.** It runs the endpoint right after routing and skips the rest of the middleware, useful for a health check or a `robots.txt`. It also works on controllers:

  ```csharp
  app.MapGet("/health", [ShortCircuit] () => "Healthy");
  ```

  The test answered `200 Healthy`.
- **OpenAPI 3.2 by default.** Generated documents now target that version. If a tool of yours doesn't support it yet, pin the previous one (example from the documentation):

  ```csharp
  builder.Services.AddOpenApi(options =>
  {
      options.OpenApiVersion = Microsoft.OpenApi.OpenApiSpecVersion.OpenApi3_1;
  });
  ```
- **Rate limiting.** `FixedWindowRateLimiter` now reports a `RetryAfter` that matches the next window boundary. If you already copy it into the `Retry-After` header in `OnRejected`, the intervals come out right without changing code.
- **MCP server.** The template now ships in the SDK: `dotnet new mcpserver -o MyMcpServer`.

## SDK and EF Core 11

**File-based apps with `#:include`.** Single-file apps (`dotnet run app.cs`) can now be split across several files. The entry file must start with `#!/usr/bin/env dotnet`; otherwise the analyzer warns with CA2266:

```csharp
#!/usr/bin/env dotnet
#:include "helpers.cs"

Console.WriteLine(Helpers.Greet("Ana"));
```

```csharp
static class Helpers
{
    public static string Greet(string name) => $"Hello, {name}";
}
```

With both files in the same folder, `dotnet run app.cs` prints `Hello, Ana`. And `dotnet run -e KEY=VALUE` passes environment variables to the program without editing launch profiles.

**EF Core 11** (according to its documentation):

- `dotnet ef database update InitialCreate --add` creates and applies a migration in a single step, compiling it with Roslyn on the spot. It's useful in containers and in .NET Aspire, where you can't recompile.
- `MaxByAsync` and `MinByAsync` translate to SQL: `await context.Blogs.MaxByAsync(b => b.Posts.Count())`.
- For SQL Server, JSON indexes and vector search (the latter experimental). The database-side details are in the [SQL Server 2025 post]({{ '/en/blog/whats-new-sql-server-2025/' | relative_url }}).

## Should you upgrade?

1. **If you're still on .NET 9**, it has been out of support since November 10, 2026: move to .NET 10 (LTS) or to .NET 11.
2. **If you're on .NET 10**, both end on the same day, November 14, 2028. Moving to 11 is for the new features (unions, `FullJoin`, runtime async), not for more support time; consider whether you can absorb one upgrade per year.
3. **Check the hardware** your application runs on against the new CPU floor.
4. **Change `TargetFramework` to `net11.0`**, build, run your tests, and read the list of breaking changes in .NET 11.
5. **Confirm that your third-party packages already publish a version for .NET 11**, for example the EF Core providers that aren't from Microsoft.
6. **Turn on `runtime-async` separately** and compare performance before keeping it.

## Summary

| Feature | What it's for | What it needs |
|---|---|---|
| Unions | A value that is one of several unrelated types | `net11.0` (C# 15) |
| Closed hierarchies | Exhaustive `switch` over a family of your own | C# 15 |
| `with(...)` | Capacity or comparer inside `[...]` | C# 15 |
| Extension indexers | `user["email"]` on a type you don't own | C# 15 |
| Labeled `break` and `continue` | Leave nested loops without flags | C# 15 |
| Runtime async | Clearer call stacks, fewer state machines | `<Features>runtime-async=on</Features>` |
| Zstandard | Built-in compression | `System.IO.Compression` |
| `FullJoin` | Reconcile two lists | .NET 11 |
| Async validation | Rules with I/O without blocking threads | `AddValidation()` in Minimal APIs |
