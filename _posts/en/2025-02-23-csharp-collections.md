---
title: "C# Collections: Choosing by Cost and Concurrency"
description: "What each operation costs in List, Dictionary, HashSet, queues, and concurrent collections, when to use Channel or FrozenDictionary, and a real N+1 problem solved with a dictionary."
lang: en
locale: en_US
ref: colecciones-csharp
date: 2025-02-23 10:20:00 -0600
permalink: /en/blog/csharp-collections/
image: /assets/img/og-en.png
tags: [C#, .NET, Performance]
---

You choose a collection by the operations you will run most often, not by habit. `List<T>` is an excellent default, but searching it inside a loop can turn a process that takes seconds into one that takes minutes. This post summarizes what each operation costs and when a different structure pays off.

## What each operation costs

| Collection | Find | Add | Remove | Use it for |
|---|---|---|---|---|
| `List<T>` | O(n) by value, O(1) by index | Amortized O(1) at the end | O(n) | Sequences you walk through entirely |
| `Dictionary<TKey, TValue>` | Average O(1) by key | Average O(1) | Average O(1) | Lookups by key |
| `HashSet<T>` | Average O(1) | Average O(1) | Average O(1) | Membership and duplicates |
| `SortedDictionary<TKey, TValue>` | O(log n) | O(log n) | O(log n) | Keys that must stay sorted |
| `Queue<T>` / `Stack<T>` | — | O(1) | O(1) | FIFO / LIFO processing |
| `PriorityQueue<TElement, TPriority>` | O(1) for the top item | O(log n) | O(log n) | Processing by priority |

The "average O(1)" of dictionaries depends on a good `GetHashCode`. With string keys, always set the comparer (`StringComparer.Ordinal` or `OrdinalIgnoreCase`) instead of relying on the default.

## A real case: an N+1 solved with a dictionary

A report walks through thousands of inventory movements and, for each one, queries its stock record. It works in development with 50 rows and takes minutes in production.

```csharp
// Before: one query per movement (N+1)
foreach (var movement in movements)
{
    var stock = await db.Stock
        .FirstOrDefaultAsync(s => s.Id == movement.StockId, ct);

    rows.Add(new ReportRow(movement, stock));
}
```

The fix is to load what you need at once and look it up in memory:

```csharp
// After: a single query and O(1) lookups in memory
var ids = movements.Select(m => m.StockId).Distinct().ToList();

var stockById = await db.Stock
    .AsNoTracking()
    .Where(s => ids.Contains(s.Id))
    .ToDictionaryAsync(s => s.Id, ct);

foreach (var movement in movements)
{
    stockById.TryGetValue(movement.StockId, out var stock);
    rows.Add(new ReportRow(movement, stock));
}
```

EF Core translates `ids.Contains(...)` into a single parameterized query (depending on the version, with `OPENJSON` or a list of parameters). Even so, if the list grows to tens of thousands of ids, process it in batches to avoid huge queries.

## HashSet: membership and duplicates

When validating a bulk upload, finding repeated keys with `List.Contains` is O(n²). `HashSet<T>.Add` returns `false` if the item already existed, so the check takes a single pass:

```csharp
var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

foreach (var row in excelRows)
{
    if (!keys.Add(row.Key))
        errors.Add($"Row {row.Number}: the key {row.Key} is duplicated.");
}
```

## Queues, stacks, and priorities

`Queue<T>` processes items in arrival order and `Stack<T>` in reverse order (handy for undo or depth-first traversals). When the order depends on a priority, use `PriorityQueue<TElement, TPriority>`: it serves the lowest priority value first.

```csharp
var pending = new PriorityQueue<string, int>();
pending.Enqueue("Monthly report", 3);
pending.Enqueue("Urgent prescription", 1);
pending.Enqueue("Nightly backup", 5);

while (pending.TryDequeue(out var task, out var priority))
    Console.WriteLine($"{priority}: {task}"); // 1, 3, 5
```

## Concurrency: pick the tool first, then the collection

**`ConcurrentDictionary`** works for caches shared across threads. Careful: the `GetOrAdd` factory can run more than once if two threads request the same key at the same time. If creating the value is expensive, wrap it in `Lazy<T>`:

```csharp
private readonly ConcurrentDictionary<string, Lazy<Task<Rate>>> _rates = new();

public Task<Rate> GetRateAsync(string key) =>
    _rates.GetOrAdd(key, k => new Lazy<Task<Rate>>(() => LoadRateAsync(k))).Value;
```

If the task fails, the `Lazy` holding the exception stays in the cache; remove it with `TryRemove` to allow another attempt.

**`Channel<T>`** is the modern option for producer-consumer scenarios. With a bounded capacity, the producer waits when the consumer falls behind instead of filling up memory:

```csharp
var channel = Channel.CreateBounded<Order>(new BoundedChannelOptions(100)
{
    FullMode = BoundedChannelFullMode.Wait
});

// Producer
await channel.Writer.WriteAsync(order, ct);

// Consumer
await foreach (var next in channel.Reader.ReadAllAsync(ct))
{
    await processor.ProcessAsync(next, ct);
}
```

One warning: when contention is low, a plain `Dictionary` guarded by a `lock` is usually simpler and faster. Concurrent collections are not something to use "just in case."

## Immutable and frozen collections

For catalogs built once and read millions of times, `FrozenDictionary` and `FrozenSet` (since .NET 8) optimize reads in exchange for slower creation:

```csharp
private static readonly FrozenDictionary<string, string> States =
    new Dictionary<string, string>
    {
        ["GT"] = "Guanajuato",
        ["JC"] = "Jalisco",
        ["DF"] = "Mexico City",
    }.ToFrozenDictionary(StringComparer.OrdinalIgnoreCase);
```

To share state that must not change between components, `ImmutableArray<T>` and `ImmutableDictionary<TKey, TValue>` guarantee nobody modifies it by accident.

## Exposing collections without losing control

- Return `IReadOnlyList<T>` or `IReadOnlyCollection<T>` instead of `List<T>`: callers can read but can't add or remove.
- If you know the final size, reserve the capacity: `new List<ReportRow>(movements.Count)` avoids reallocations.
- Don't materialize a whole query with `ToList()` just to filter it in memory afterward; filter in the query.

## Common mistakes

- `List.Contains` or `Any` inside a loop: O(n²) that nobody notices in development.
- Modifying a collection while iterating it with `foreach` (`InvalidOperationException`).
- String-keyed dictionaries without an explicit comparer.
- Using `ConcurrentDictionary` where there is no real concurrency.

## Summary

| If you need to… | Use |
|---|---|
| Iterate in order and access by index | `List<T>` |
| Look up by key | `Dictionary<TKey, TValue>` |
| Check whether something already exists | `HashSet<T>` |
| Process by priority | `PriorityQueue<TElement, TPriority>` |
| Produce and consume across threads | `Channel<T>` |
| Share a cache across threads | `ConcurrentDictionary` (with `Lazy<T>` if values are expensive) |
| Read a static catalog very often | `FrozenDictionary<TKey, TValue>` |
