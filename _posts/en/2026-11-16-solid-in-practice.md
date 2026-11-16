---
title: "SOLID in Practice: Refactoring a .NET Reporting Service"
description: "A service with four reasons to change, refactored step by step with the five SOLID principles, dependency injection, and tests with xUnit and Moq. Includes a correct Liskov substitution example."
lang: en
locale: en_US
ref: solid-en-la-practica
date: 2026-11-16 10:30:00 -0600
permalink: /en/blog/solid-in-practice/
image: /assets/img/og-en.png
tags: [SOLID, C#, Architecture]
---

SOLID is not a set of rules for having more interfaces. It's a way to lower the cost of change, so that adding a report format or switching databases touches one class instead of twenty. Instead of five isolated examples, this post refactors a single service step by step.

## The starting point

A service that generates a pharmacy's inventory report. It works, but it does everything:

```csharp
public class ReportService
{
    public byte[] GenerateInventoryReport(int pharmacyId, string format)
    {
        using var connection = new SqlConnection("Server=...;Database=Pharmacy;...");
        var rows = connection.Query<InventoryRow>(
            "SELECT Code, Description, Quantity FROM Inventory WHERE PharmacyId = @pharmacyId",
            new { pharmacyId }).ToList();

        byte[] content;
        if (format == "excel")
        {
            content = []; // 80 lines building the Excel file…
        }
        else if (format == "pdf")
        {
            content = []; // 120 lines building the PDF…
        }
        else
        {
            throw new ArgumentException("Unsupported format.", nameof(format));
        }

        File.AppendAllText("audit.txt", $"{DateTime.Now}: {format} report{Environment.NewLine}");
        return content;
    }
}
```

This method has at least four reasons to change: the query, the Excel layout, the PDF layout, and the audit log. Adding CSV means editing it, and it can't be tested without a real database or without writing to disk.

## S: single responsibility

Each class should have one reason to change. We separate what varies for different reasons:

```csharp
public sealed record InventoryRow(string Code, string Description, int Quantity);

public enum ReportFormat { Excel, Pdf, Csv }

public interface IInventoryRepository
{
    Task<IReadOnlyList<InventoryRow>> GetAsync(int pharmacyId, CancellationToken ct);
}

public interface IReportGenerator
{
    ReportFormat Format { get; }
    byte[] Generate(IReadOnlyList<InventoryRow> rows);
}

public interface IAuditLog
{
    Task WriteAsync(string message, CancellationToken ct);
}
```

Data access, each format, and the audit log now live in separate classes. If the PDF layout changes, only the PDF generator changes.

## O: open for extension, closed for modification

The service no longer uses `if` to decide which format to build: it receives every registered generator and picks one by its `Format` property.

```csharp
public sealed class ReportService(
    IInventoryRepository inventory,
    IEnumerable<IReportGenerator> generators,
    IAuditLog audit)
{
    private readonly Dictionary<ReportFormat, IReportGenerator> _generators =
        generators.ToDictionary(g => g.Format);

    public async Task<byte[]> GenerateAsync(int pharmacyId, ReportFormat format, CancellationToken ct)
    {
        if (!_generators.TryGetValue(format, out var generator))
            throw new NotSupportedException($"There is no generator for the {format} format.");

        var rows = await inventory.GetAsync(pharmacyId, ct);
        var content = generator.Generate(rows);

        await audit.WriteAsync($"{format} inventory report for pharmacy {pharmacyId}", ct);
        return content;
    }
}
```

Adding CSV is a new class and one registration line; the service stays untouched:

```csharp
public sealed class CsvGenerator : IReportGenerator
{
    public ReportFormat Format => ReportFormat.Csv;

    public byte[] Generate(IReadOnlyList<InventoryRow> rows)
    {
        var csv = new StringBuilder();
        csv.AppendLine("Code,Description,Quantity");

        foreach (var row in rows)
            csv.AppendLine($"{row.Code},{Escape(row.Description)},{row.Quantity}");

        return Encoding.UTF8.GetBytes(csv.ToString());
    }

    private static string Escape(string value) => $"\"{value.Replace("\"", "\"\"")}\"";
}
```

```csharp
builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
builder.Services.AddScoped<IAuditLog, DatabaseAuditLog>();
builder.Services.AddSingleton<IReportGenerator, ExcelGenerator>();
builder.Services.AddSingleton<IReportGenerator, PdfGenerator>();
builder.Services.AddSingleton<IReportGenerator, CsvGenerator>(); // new format: one line
builder.Services.AddScoped<ReportService>();
```

## L: Liskov substitution

A derived type must be usable wherever the base type is expected without making the program behave incorrectly. What matters is **behavior**, not the signature: a class can implement every method of an interface and still break the principle.

> In the earlier version of this post I used the penguin that inherits `Fly()` and leaves it empty. That code doesn't illustrate the principle: it violates it. Here is a more realistic example and its fix.

A read-only catalog that implements a generic repository:

```csharp
public interface IRepository<T>
{
    Task<T?> GetAsync(int id, CancellationToken ct);
    Task SaveAsync(T entity, CancellationToken ct);
}

// Violates LSP: whoever receives an IRepository<T> expects to be able to save.
public sealed class TaxCatalogRepository(CatalogDbContext db) : IRepository<ProductTaxCode>
{
    public Task<ProductTaxCode?> GetAsync(int id, CancellationToken ct) =>
        db.ProductTaxCodes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);

    public Task SaveAsync(ProductTaxCode entity, CancellationToken ct) =>
        throw new NotSupportedException("The tax catalog is read-only.");
}
```

The compiler is happy, but any code that receives an `IRepository<ProductTaxCode>` and calls `SaveAsync` fails in production. The fix is to stop promising what can't be delivered:

```csharp
public interface IReader<T>
{
    Task<T?> GetAsync(int id, CancellationToken ct);
}

public interface IRepository<T> : IReader<T>
{
    Task SaveAsync(T entity, CancellationToken ct);
}

public sealed class TaxCatalogRepository(CatalogDbContext db) : IReader<ProductTaxCode>
{
    public Task<ProductTaxCode?> GetAsync(int id, CancellationToken ct) =>
        db.ProductTaxCodes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);
}
```

Signs that a class breaks Liskov:

- It throws `NotSupportedException` or `NotImplementedException` in an inherited method.
- It demands more than the contract asks for (for example, it rejects values the interface accepts).
- It guarantees less than the contract promises (for example, it returns `null` where the base never does).

## I: interface segregation

No client should depend on methods it doesn't use. The fix above already applies it: readers depend on `IReader<T>`. Likewise, `ReportService` depends on `IInventoryRepository`, which exposes only the query it needs, not a repository with forty methods.

A good practice is to let the consumer define the interface: the service states what it needs and the infrastructure adapts.

## D: dependency inversion

High-level modules don't depend on low-level ones; both depend on abstractions. `ReportService` doesn't know whether data comes from SQL Server or an API, or whether the audit log is a table or a file. That's why it can be tested in milliseconds, with no database:

```csharp
public class ReportServiceTests
{
    [Fact]
    public async Task GenerateAsync_UsesTheGeneratorForTheRequestedFormat()
    {
        var rows = new List<InventoryRow> { new("010.000.0104.00", "Paracetamol 500 mg", 120) };

        var inventory = new Mock<IInventoryRepository>();
        inventory.Setup(r => r.GetAsync(7, It.IsAny<CancellationToken>())).ReturnsAsync(rows);

        var csv = new Mock<IReportGenerator>();
        csv.SetupGet(g => g.Format).Returns(ReportFormat.Csv);
        csv.Setup(g => g.Generate(rows)).Returns(new byte[] { 1, 2, 3 });

        var service = new ReportService(inventory.Object, new[] { csv.Object }, Mock.Of<IAuditLog>());

        var content = await service.GenerateAsync(7, ReportFormat.Csv, CancellationToken.None);

        Assert.Equal(new byte[] { 1, 2, 3 }, content);
        csv.Verify(g => g.Generate(rows), Times.Once);
    }
}
```

## When not to follow SOLID to the letter

- One interface per class, with no second implementation and no test that needs it, only adds noise.
- Abstract when the second case shows up or when the variation point is obvious, not "just in case."
- In a script or a small service, simplicity wins. SOLID is a tool, not a goal.

## Checklist

- How many reasons to change does this class have? If more than one, split it.
- Does adding a new case force me to edit an existing `if` or `switch`?
- Does any inherited method throw `NotSupportedException`?
- Do my interfaces have methods their clients don't use?
- Can I test the business logic without a database, network, or disk?
