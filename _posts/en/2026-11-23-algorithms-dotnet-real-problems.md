---
title: "Algorithms in .NET with Real Problems: From the LRU Cache to Dependency Order"
description: "Six algorithms that show up in real systems, with C# code: merging intervals, an LRU cache, the cheapest route with PriorityQueue, similar text with Levenshtein, rate limiting, and topological ordering."
lang: en
locale: en_US
ref: algoritmos-dotnet-problemas-reales
date: 2026-11-23 08:10:00 -0600
permalink: /en/blog/algorithms-dotnet-real-problems/
tags: [Algorithms, C#, .NET]
---

Algorithms aren't just for interviews. These six show up in real systems: bookings that overlap, expensive queries that repeat, delivery routes, names typed two different ways, APIs that need protecting, and steps that depend on each other. For each one you'll see the problem, the idea, the C# code, and what it costs.

All the code was compiled and run on .NET 8 and on .NET 11, with C# 12 pinned as the language version, and the results you see are what it printed. Before you write any of them yourself, check the table at the end: several already exist in the platform or in the database.

## 1. Merging intervals: bookings, appointments, and maintenance windows

**The problem.** You have the bookings for an operating room, a meeting room, or a technician, and you need to know in which continuous blocks it's busy, or whether a new booking collides with the existing ones.

**The idea.** Sort by start and walk through once: if the next interval starts before the current block ends, the block grows; otherwise a new block begins.

```csharp
public readonly record struct Interval(DateTime Start, DateTime End);

public static class Intervals
{
    // Two intervals overlap if each one starts before the other ends.
    public static bool Overlap(Interval a, Interval b) =>
        a.Start < b.End && b.Start < a.End;

    public static List<Interval> Merge(IEnumerable<Interval> intervals)
    {
        var result = new List<Interval>();

        foreach (var current in intervals.OrderBy(i => i.Start))
        {
            if (result.Count > 0 && current.Start <= result[^1].End)
            {
                // It joins the previous block: it only extends it if it ends later.
                var last = result[^1];
                if (current.End > last.End)
                    result[^1] = last with { End = current.End };
            }
            else
            {
                result.Add(current);
            }
        }

        return result;
    }
}
```

With four bookings on the same day:

```csharp
var day = new DateTime(2026, 11, 23);
var bookings = new[]
{
    new Interval(day.AddHours(9),  day.AddHours(11)),
    new Interval(day.AddHours(10), day.AddHours(12)),
    new Interval(day.AddHours(15), day.AddHours(16)),
    new Interval(day.AddHours(12), day.AddHours(13)),
};

var blocks = Intervals.Merge(bookings);
foreach (var block in blocks)
    Console.WriteLine($"{block.Start:HH:mm}-{block.End:HH:mm}");
```

```text
09:00-13:00
15:00-16:00
```

**What it costs.** O(n log n) because of the sort and O(n) memory; the walk itself is linear.

**Details that matter:**

- The test `a.Start < b.End && b.Start < a.End` is the one you need everywhere, SQL included: `WHERE Start < @end AND End > @start`.
- With `<=`, two back-to-back bookings (one ends at 12:00 and the next starts at 12:00) join into a single block, like the 12:00 to 13:00 one in the example. If you want to keep them apart, use `<`.
- Preventing overlapping bookings from being saved isn't solved by validating in memory: two simultaneous requests pass the validation at the same time. That rule belongs to the database; [PostgreSQL already has a constraint for it]({{ '/en/blog/postgresql-vs-sql-server-today/' | relative_url }}).

## 2. LRU cache: bounded memory for expensive lookups

**The problem.** A catalog (exchange rates, tariffs, permissions) that you query thousands of times. You want to keep the most used entries without letting memory grow without limit.

**The idea.** A dictionary to find each element in O(1) and a linked list to know which one was used the longest time ago. Every read moves the element to the front; when the cache is full, the last one is evicted.

```csharp
public sealed class LruCache<TKey, TValue> where TKey : notnull
{
    private readonly int _capacity;
    private readonly Dictionary<TKey, LinkedListNode<(TKey Key, TValue Value)>> _nodes;
    private readonly LinkedList<(TKey Key, TValue Value)> _recent = new();
    private readonly object _lock = new();

    public LruCache(int capacity)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(capacity);
        _capacity = capacity;
        _nodes = new(capacity);
    }

    public bool TryGet(TKey key, out TValue value)
    {
        lock (_lock)
        {
            if (_nodes.TryGetValue(key, out var node))
            {
                // Reading is also "using": it moves to the front of the list.
                _recent.Remove(node);
                _recent.AddFirst(node);
                value = node.Value.Value;
                return true;
            }
        }

        value = default!;
        return false;
    }

    public void Set(TKey key, TValue value)
    {
        lock (_lock)
        {
            if (_nodes.TryGetValue(key, out var existing))
            {
                existing.Value = (key, value);
                _recent.Remove(existing);
                _recent.AddFirst(existing);
                return;
            }

            if (_nodes.Count == _capacity)
            {
                // The last node in the list is the one used the longest time ago.
                var leastRecent = _recent.Last!;
                _recent.RemoveLast();
                _nodes.Remove(leastRecent.Value.Key);
            }

            _nodes[key] = _recent.AddFirst((key, value));
        }
    }
}
```

```csharp
var cache = new LruCache<string, string>(capacity: 2);
cache.Set("MXN", "Mexican peso");
cache.Set("USD", "US dollar");
cache.TryGet("MXN", out _);   // MXN becomes the most recent
cache.Set("EUR", "Euro");     // evicts USD

Console.WriteLine(cache.TryGet("USD", out _));
Console.WriteLine(cache.TryGet("MXN", out var name) + " " + name);
```

```text
False
True Mexican peso
```

**What it costs.** O(1) for reads and writes. A single `lock` protects both structures: even reading changes the order, so a read-only lock doesn't work.

**Before you write it.** `IMemoryCache` with `SizeLimit` already bounds memory and, when it reaches the limit, evicts entries by priority and by recent use; it also brings expiration. Write your own LRU when you need exactly that policy or don't want the dependency.

## 3. Cheapest route: Dijkstra with `PriorityQueue`

**The problem.** Taking supplies from a warehouse to a hospital through branches; every leg costs minutes. What's the cheapest path?

**The idea.** Always expand the node with the lowest known accumulated cost. `PriorityQueue<TElement, TPriority>` (since .NET 6) gives it to you in O(log n). It doesn't let you lower the priority of an element that's already in the queue, so you enqueue it again with the better cost and discard the stale entries when they come out.

```csharp
public static class Routes
{
    public static (int Cost, List<string> Path)? CheapestPath(
        IReadOnlyDictionary<string, List<(string Destination, int Cost)>> graph,
        string origin,
        string destination)
    {
        var cost = new Dictionary<string, int> { [origin] = 0 };
        var previous = new Dictionary<string, string>();
        var pending = new PriorityQueue<string, int>();
        pending.Enqueue(origin, 0);

        while (pending.TryDequeue(out var current, out var currentCost))
        {
            // PriorityQueue can't "lower" an element's priority: duplicates are
            // enqueued and the stale entries are discarded here.
            if (currentCost > cost[current])
                continue;

            if (current == destination)
                return (currentCost, BuildPath(previous, origin, destination));

            if (!graph.TryGetValue(current, out var neighbors))
                continue;

            foreach (var (next, weight) in neighbors)
            {
                var newCost = currentCost + weight;

                if (!cost.TryGetValue(next, out var known) || newCost < known)
                {
                    cost[next] = newCost;
                    previous[next] = current;
                    pending.Enqueue(next, newCost);
                }
            }
        }

        return null; // no path
    }

    private static List<string> BuildPath(Dictionary<string, string> previous, string origin, string destination)
    {
        var path = new List<string> { destination };

        while (path[^1] != origin)
            path.Add(previous[path[^1]]);

        path.Reverse();
        return path;
    }
}
```

```csharp
var graph = new Dictionary<string, List<(string Destination, int Cost)>>
{
    ["Warehouse"] = [("Center", 25), ("North", 40)],
    ["Center"] = [("North", 10), ("South", 30), ("Hospital", 60)],
    ["North"] = [("Hospital", 35)],
    ["South"] = [("Hospital", 20)],
};

var route = Routes.CheapestPath(graph, "Warehouse", "Hospital");
Console.WriteLine($"{route!.Value.Cost} min: {string.Join(" → ", route.Value.Path)}");
```

```text
70 min: Warehouse → Center → North → Hospital
```

Going straight through the North costs 75 minutes and going through the South also costs 75; the 70-minute path only shows up if you go through the Center and then the North.

**What it costs.** On the order of O((V + E) log V), with V nodes and E legs. It only accepts non-negative costs: with negative costs you need Bellman-Ford. If you have an estimate of the distance to the destination, A* gets there faster.

## 4. Similar text: Levenshtein distance

**The problem.** "José Hernández López", "Jose Hernandez Lopez", and "JOSE HERNANDES LOPEZ" are the same person typed three ways. To detect duplicates, or to offer a "did you mean…?", you need to measure how similar two texts are.

**The idea.** Levenshtein distance counts the minimum insertions, deletions, and substitutions needed to turn one text into another. It's computed with dynamic programming: cell `[i, j]` is the cost of turning the first `i` characters of one into the first `j` of the other, and it only depends on the previous row, so two rows are enough.

```csharp
using System.Globalization;
using System.Text;

public static class Text
{
    // "José Hernández" and "JOSE HERNANDEZ" must compare as equal.
    public static string Normalize(string text)
    {
        var decomposed = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);

        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(char.ToUpperInvariant(c));
        }

        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    // How many insertions, deletions, or substitutions separate one text from another.
    public static int LevenshteinDistance(ReadOnlySpan<char> a, ReadOnlySpan<char> b)
    {
        if (a.Length < b.Length)
        {
            // b must be the shorter one: the rows are b.Length + 1 long.
            var temp = a;
            a = b;
            b = temp;
        }

        if (b.Length == 0)
            return a.Length;

        Span<int> previous = b.Length < 128 ? stackalloc int[b.Length + 1] : new int[b.Length + 1];
        Span<int> current = b.Length < 128 ? stackalloc int[b.Length + 1] : new int[b.Length + 1];

        for (var j = 0; j <= b.Length; j++)
            previous[j] = j;

        for (var i = 1; i <= a.Length; i++)
        {
            current[0] = i;

            for (var j = 1; j <= b.Length; j++)
            {
                var substitution = previous[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1);
                var deletion = previous[j] + 1;
                var insertion = current[j - 1] + 1;
                current[j] = Math.Min(substitution, Math.Min(deletion, insertion));
            }

            var swap = previous;
            previous = current;
            current = swap;
        }

        return previous[b.Length];
    }

    // 1.0 = identical, 0.0 = nothing in common.
    public static double Similarity(string a, string b)
    {
        var x = Normalize(a);
        var y = Normalize(b);
        var length = Math.Max(x.Length, y.Length);

        return length == 0 ? 1.0 : 1.0 - (double)LevenshteinDistance(x, y) / length;
    }
}
```

```csharp
Console.WriteLine(Text.LevenshteinDistance("kitten", "sitting"));
Console.WriteLine(Text.Normalize("José Hernández López"));
Console.WriteLine(Text.LevenshteinDistance(Text.Normalize("José Hernández López"), Text.Normalize("Jose Hernandes Lopez")));
Console.WriteLine(Text.Similarity("José Hernández López", "Jose Hernandes Lopez").ToString("F2"));
Console.WriteLine(Text.Similarity("José Hernández López", "María Torres Gómez").ToString("F2"));
```

```text
3
JOSE HERNANDEZ LOPEZ
1
0.95
0.30
```

`Normalize` strips accents and case before comparing; without that step, "é" against "e" counts as a difference. A threshold of 0.85 or 0.90 usually separates variants of the same name from different people well, but tune it with your own data.

**What it costs.** O(n · m) time and O(min(n, m)) memory. The real problem shows up when you compare everything against everything: with N records that's N² comparisons. Compare only within groups that already look alike (the same first letter, the same birth date) and leave the rest out.

**Before you write it.** If the data lives in a database, let it do the work: SQL Server 2025 brings [`EDIT_DISTANCE`]({{ '/en/blog/whats-new-sql-server-2025/' | relative_url }}) and PostgreSQL has `levenshtein()` in the `fuzzystrmatch` extension.

## 5. Rate limiting: the token bucket

**The problem.** An API, yours or someone else's, only tolerates a certain number of requests per second, with short bursts. You want to reject or delay the excess without losing control.

**The idea.** A bucket with capacity C refills at R tokens per second and each request spends one; if none are left, it's rejected. You don't need a timer: when a request arrives you compute how many tokens accumulated since the previous one. Receiving a `TimeProvider` (.NET 8) lets you test it without waiting.

```csharp
public sealed class TokenBucket
{
    private readonly double _capacity;
    private readonly double _tokensPerSecond;
    private readonly TimeProvider _clock;
    private readonly object _lock = new();
    private double _tokens;
    private long _lastRefill;

    public TokenBucket(int capacity, double tokensPerSecond, TimeProvider? clock = null)
    {
        _capacity = capacity;
        _tokensPerSecond = tokensPerSecond;
        _clock = clock ?? TimeProvider.System;
        _tokens = capacity; // starts full: it allows an initial burst
        _lastRefill = _clock.GetTimestamp();
    }

    public bool TryConsume(int amount = 1)
    {
        lock (_lock)
        {
            // Tokens aren't generated in the background: they're computed when each request arrives.
            var now = _clock.GetTimestamp();
            var seconds = _clock.GetElapsedTime(_lastRefill, now).TotalSeconds;
            _tokens = Math.Min(_capacity, _tokens + seconds * _tokensPerSecond);
            _lastRefill = now;

            if (_tokens < amount)
                return false;

            _tokens -= amount;
            return true;
        }
    }
}
```

For the test, a clock that only advances when asked to:

```csharp
// A clock that only advances when asked to (to test without waiting).
sealed class ManualClock : TimeProvider
{
    private long _ticks;
    public override long TimestampFrequency => 1000;
    public override long GetTimestamp() => _ticks;
    public void Advance(TimeSpan time) => _ticks += (long)(time.TotalSeconds * TimestampFrequency);
}
```

```csharp
var clock = new ManualClock();
var bucket = new TokenBucket(capacity: 5, tokensPerSecond: 1, clock);

var first = Enumerable.Range(0, 6).Select(_ => bucket.TryConsume()).ToArray();
Console.WriteLine(string.Join(" ", first));

clock.Advance(TimeSpan.FromSeconds(2));
var later = Enumerable.Range(0, 3).Select(_ => bucket.TryConsume()).ToArray();
Console.WriteLine(string.Join(" ", later));
```

```text
True True True True True False
True True False
```

The bucket starts full, so it absorbs a burst of five; the sixth request is rejected. Two seconds later there are two new tokens: two requests pass and the third is rejected.

**What it costs.** O(1) per request and one `lock`.

**Before you write it.** To protect your own API, use the ASP.NET Core middleware (`AddRateLimiter`) with `TokenBucketRateLimiter`, from `System.Threading.RateLimiting`. The version above is useful when you're the client, for example when calling an external service with its own limit, or to understand how it works. With several instances of the service, the bucket has to live in a shared store (like Redis) or at the entry point: otherwise each instance would have its own and the real limit would multiply.

## 6. Dependency order: topological sorting

**The problem.** A deployment has five steps: build, back up, migrate the database, deploy the API, and run smoke tests. Each needs others to finish first. In what order do they run? And what happens if two steps wait for each other?

**The idea.** Kahn's algorithm: count how many requirements each task is still missing and run the ones that have none. Each time one finishes, subtract one from the tasks that were waiting for it; the ones that reach zero are ready. If tasks are left at the end but none is ready, there's a cycle.

```csharp
public static class Dependencies
{
    // dependencies["Deploy"] = ["Build", "Migrate"] means that Deploy
    // needs Build and Migrate to finish first.
    public static List<string> Order(IReadOnlyDictionary<string, string[]> dependencies)
    {
        var missing = new Dictionary<string, int>();               // task -> unmet requirements
        var dependents = new Dictionary<string, List<string>>();   // requirement -> tasks waiting for it

        foreach (var (task, requirements) in dependencies)
        {
            missing.TryAdd(task, 0);

            foreach (var requirement in requirements)
            {
                missing.TryAdd(requirement, 0);
                missing[task]++;

                if (!dependents.TryGetValue(requirement, out var list))
                    dependents[requirement] = list = new List<string>();

                list.Add(task);
            }
        }

        // Tasks without requirements can start now (sorted by name so the result is stable).
        var ready = new Queue<string>(missing.Where(m => m.Value == 0).Select(m => m.Key).Order());
        var order = new List<string>(missing.Count);

        while (ready.TryDequeue(out var task))
        {
            order.Add(task);

            if (!dependents.TryGetValue(task, out var next))
                continue;

            foreach (var dependent in next)
            {
                if (--missing[dependent] == 0)
                    ready.Enqueue(dependent);
            }
        }

        // If tasks are left unordered, they wait for each other: there's a cycle.
        if (order.Count != missing.Count)
        {
            var inCycle = missing.Where(m => m.Value > 0).Select(m => m.Key).Order();
            throw new InvalidOperationException($"Circular dependency between: {string.Join(", ", inCycle)}");
        }

        return order;
    }
}
```

```csharp
var steps = new Dictionary<string, string[]>
{
    ["Migrate database"] = ["Back up"],
    ["Deploy API"] = ["Migrate database", "Build"],
    ["Smoke tests"] = ["Deploy API"],
    ["Build"] = [],
};

var order = Dependencies.Order(steps);
Console.WriteLine(string.Join(" → ", order));
```

```text
Back up → Build → Migrate database → Deploy API → Smoke tests
```

And with a cycle:

```csharp
Dependencies.Order(new Dictionary<string, string[]> { ["A"] = ["B"], ["B"] = ["A"], ["C"] = [] });
```

```text
InvalidOperationException: Circular dependency between: A, B
```

**What it costs.** O(V + E). Back up and Build were ready at the same time because they don't depend on each other; if you run by "levels" instead of one at a time, those tasks can run in parallel. The same algorithm works for ordering migrations, service initialization, or loading tables with foreign keys.

## How to choose

| Problem | Algorithm | Cost | Before writing it, check |
|---|---|---|---|
| Bookings that overlap | Sort and walk | O(n log n) | The constraint in the database |
| Repeated reads | LRU cache | O(1) | `IMemoryCache` with `SizeLimit` |
| Cheapest route | Dijkstra | O((V + E) log V) | A graph library if the problem grows |
| Similar names | Levenshtein | O(n · m) | `EDIT_DISTANCE` (SQL Server 2025), `fuzzystrmatch` (PostgreSQL) |
| Rate limiting | Token bucket | O(1) | `System.Threading.RateLimiting` |
| Order of steps or migrations | Topological sort (Kahn) | O(V + E) | Nothing in the platform |

If you want to practice this kind of exercise, the [Lab]({{ '/en/lab/challenges/' | relative_url }}) has C# challenges with test cases that run in the browser.
