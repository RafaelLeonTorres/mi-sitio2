---
title: "Modern OOP in C#: Real Encapsulation, Composition, and Pattern Matching"
description: "The four pillars of object-oriented programming applied to production code: classes that protect their rules, composition instead of deep hierarchies, records, and pattern matching in C# 12."
lang: en
locale: en_US
ref: poo-csharp-moderno
date: 2024-07-23 18:10:00 -0600
permalink: /en/blog/modern-oop-csharp/
image: /assets/img/og-en.png
tags: [C#, OOP, Design]
---

Encapsulation, abstraction, inheritance, and polymorphism are the starting point. In production code, something else matters: classes that protect their rules, and business changes that touch few files. This post revisits each pillar with C# 12 and .NET 8 examples.

## Encapsulation: protect rules, not just fields

Encapsulation is not adding `get; set;` to everything. This class compiles, but anyone can leave it in an invalid state:

```csharp
public class Prescription
{
    public string Number { get; set; } = "";
    public DateOnly ValidUntil { get; set; }
    public List<PrescriptionLine> Lines { get; set; } = new();
}
```

Nothing prevents an expiration date before the issue date, a repeated medication, or replacing the whole list from outside. The encapsulated version validates on construction and only allows changes that respect the rules:

```csharp
public sealed class Prescription
{
    private readonly List<PrescriptionLine> _lines = [];

    public Prescription(string number, DateOnly issuedOn, int validDays)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(number);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(validDays);

        Number = number;
        IssuedOn = issuedOn;
        ValidUntil = issuedOn.AddDays(validDays);
    }

    public string Number { get; }
    public DateOnly IssuedOn { get; }
    public DateOnly ValidUntil { get; }
    public IReadOnlyList<PrescriptionLine> Lines => _lines;

    public bool IsValidOn(DateOnly today) => today <= ValidUntil;

    public void AddMedication(string code, int units)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(units);

        if (_lines.Any(l => l.Code == code))
            throw new InvalidOperationException($"Medication {code} is already in the prescription.");

        _lines.Add(new PrescriptionLine(code, units));
    }
}

public sealed record PrescriptionLine(string Code, int Units);
```

The rule "a medication can't be repeated" lives in one place. If it changes tomorrow, you change one method, not every screen that adds medications.

## Abstraction: depend on what something does

Abstraction means exposing what matters and hiding the how. A classic case is the current date: if the code calls `DateTime.Now`, you can't test what happens on the day a prescription expires. Since .NET 8 there is `TimeProvider`, an injectable clock abstraction:

```csharp
public sealed class DispensingService(TimeProvider clock)
{
    public bool CanDispense(Prescription prescription)
    {
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
        return prescription.IsValidOn(today);
    }
}
```

In production you register `TimeProvider.System`; in tests you use `FakeTimeProvider` (from the `Microsoft.Extensions.TimeProvider.Testing` package) and set whatever date you need.

## Inheritance and composition

Inheritance fits "is a" relationships with shared rules, but deep hierarchies become fragile: a change in the base class breaks every child. When what varies is a behavior, composition is usually better. For example, pricing rules that combine:

```csharp
public interface IPriceRule
{
    decimal Apply(decimal price);
}

public sealed class PercentageDiscount(decimal percentage) : IPriceRule
{
    public decimal Apply(decimal price) => price * (1 - percentage / 100m);
}

public sealed class MinimumPrice(decimal minimum) : IPriceRule
{
    public decimal Apply(decimal price) => Math.Max(price, minimum);
}

public sealed class PriceCalculator(IEnumerable<IPriceRule> rules)
{
    public decimal Calculate(decimal basePrice) =>
        rules.Aggregate(basePrice, (price, rule) => rule.Apply(price));
}
```

A new rule is a new class; nothing has to inherit from anything, and existing rules stay untouched. Use inheritance when you truly share rules and identity, and mark as `sealed` what isn't designed to be inherited.

## Polymorphism and pattern matching

Polymorphism means treating different objects through the same interface, with each one responding with its own implementation. Modern C# gives you two tools, and it pays to choose based on what will change more:

- **Virtual methods or interfaces:** when new types are added often and operations are few.
- **Pattern matching over a closed hierarchy:** when types are stable and operations keep growing.

```csharp
public abstract record Payment(decimal Amount);
public sealed record CashPayment(decimal Amount) : Payment(Amount);
public sealed record CardPayment(decimal Amount, string Last4) : Payment(Amount);
public sealed record TransferPayment(decimal Amount, string Reference) : Payment(Amount);

public static string Describe(Payment payment) => payment switch
{
    CashPayment { Amount: > 10_000m } => "Cash: requires authorization",
    CashPayment                       => "Cash",
    CardPayment c                     => $"Card ending in {c.Last4}",
    TransferPayment t                 => $"Transfer {t.Reference}",
    _ => throw new ArgumentOutOfRangeException(nameof(payment))
};
```

The `switch` keeps the decision in one place instead of scattering `if (payment is ...)` throughout the code.

## Records: value equality and immutability

A `record` compares by value and is copied with `with`, which makes it ideal for DTOs, messages, and value objects:

```csharp
var original = new CardPayment(1_250m, "4417");
var adjusted = original with { Amount = 1_200m };

Console.WriteLine(original == adjusted);                        // False
Console.WriteLine(original == new CardPayment(1_250m, "4417")); // True
```

Two warnings:

- A `record` holding a `List<T>` isn't truly immutable: the list can still change.
- EF Core entities have identity and are tracked by reference; model them as classes, not records.

## Class, record, or struct?

| Type | Use it when | Example |
|---|---|---|
| `class` | It has identity and a lifecycle | `Prescription`, `Order` |
| `record` | It's a value or a message: two instances with the same data are equal | DTOs, events, `PrescriptionLine` |
| `record struct` | It's a small, heavily used value | Coordinates, date ranges |

## Common mistakes

- Public setters on every property: the class can't protect its rules.
- Inheritance just to reuse code; that's what composition is for.
- `protected` fields that expose internal state to every child class.
- Checking types with `is` in many places instead of polymorphism or a central `switch`.
- Static `Utils` classes that hold business rules far from the data they protect.
