---
title: "POO en C# moderno: encapsulación real, composición y pattern matching"
description: "Los cuatro pilares de la programación orientada a objetos aplicados a código de producción: clases que protegen sus reglas, composición en lugar de herencias profundas, records y pattern matching en C# 12."
lang: es
locale: es_MX
ref: poo-csharp-moderno
date: 2024-07-23 18:10:00 -0600
permalink: /blog/poo-csharp-moderno/
tags: [C#, POO, Diseño]
redirect_from:
  - /post3.html
---

Encapsulación, abstracción, herencia y polimorfismo son el punto de partida. En código de producción importa otra cosa: que las clases protejan sus reglas y que un cambio de negocio toque pocos archivos. Este post revisa cada pilar con ejemplos de C# 12 y .NET 8.

## Encapsulación: proteger reglas, no esconder campos

Encapsular no es poner `get; set;` a todo. Esta clase compila, pero cualquiera puede dejarla en un estado inválido:

```csharp
public class Receta
{
    public string Folio { get; set; } = "";
    public DateOnly Vigencia { get; set; }
    public List<LineaReceta> Lineas { get; set; } = new();
}
```

Nada impide una vigencia anterior a la emisión, un medicamento repetido o reemplazar la lista completa desde fuera. La versión encapsulada valida al construirse y solo permite cambios que respetan las reglas:

```csharp
public sealed class Receta
{
    private readonly List<LineaReceta> _lineas = [];

    public Receta(string folio, DateOnly fechaEmision, int diasVigencia)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(folio);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(diasVigencia);

        Folio = folio;
        FechaEmision = fechaEmision;
        Vigencia = fechaEmision.AddDays(diasVigencia);
    }

    public string Folio { get; }
    public DateOnly FechaEmision { get; }
    public DateOnly Vigencia { get; }
    public IReadOnlyList<LineaReceta> Lineas => _lineas;

    public bool EstaVigente(DateOnly hoy) => hoy <= Vigencia;

    public void AgregarMedicamento(string clave, int piezas)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(piezas);

        if (_lineas.Any(l => l.Clave == clave))
            throw new InvalidOperationException($"El medicamento {clave} ya está en la receta.");

        _lineas.Add(new LineaReceta(clave, piezas));
    }
}

public sealed record LineaReceta(string Clave, int Piezas);
```

La regla "no se repite un medicamento" vive en un solo lugar. Si mañana cambia, cambias un método, no cada pantalla que agrega medicamentos.

## Abstracción: depender de lo que algo hace

Abstraer es exponer lo esencial y ocultar el cómo. Un caso clásico es la fecha actual: si el código llama a `DateTime.Now`, no puedes probar qué pasa el día que vence una receta. Desde .NET 8 existe `TimeProvider`, una abstracción del reloj lista para inyectar:

```csharp
public sealed class ServicioDispensacion(TimeProvider reloj)
{
    public bool PuedeDispensar(Receta receta)
    {
        var hoy = DateOnly.FromDateTime(reloj.GetLocalNow().DateTime);
        return receta.EstaVigente(hoy);
    }
}
```

En producción registras `TimeProvider.System`; en las pruebas usas `FakeTimeProvider` (paquete `Microsoft.Extensions.TimeProvider.Testing`) y fijas la fecha que necesites.

## Herencia y composición

La herencia sirve para relaciones "es un" con reglas compartidas, pero las jerarquías profundas se vuelven frágiles: un cambio en la clase base rompe a todas las hijas. Cuando lo que varía es un comportamiento, la composición suele ser mejor. Por ejemplo, reglas de precio que se combinan:

```csharp
public interface IReglaPrecio
{
    decimal Aplicar(decimal precio);
}

public sealed class DescuentoPorcentaje(decimal porcentaje) : IReglaPrecio
{
    public decimal Aplicar(decimal precio) => precio * (1 - porcentaje / 100m);
}

public sealed class PrecioMinimo(decimal minimo) : IReglaPrecio
{
    public decimal Aplicar(decimal precio) => Math.Max(precio, minimo);
}

public sealed class CalculadoraPrecio(IEnumerable<IReglaPrecio> reglas)
{
    public decimal Calcular(decimal precioBase) =>
        reglas.Aggregate(precioBase, (precio, regla) => regla.Aplicar(precio));
}
```

Una regla nueva es una clase nueva; no hay que heredar de nada ni tocar las existentes. Usa herencia cuando de verdad compartes reglas e identidad (y marca como `sealed` lo que no está diseñado para heredarse).

## Polimorfismo y pattern matching

Polimorfismo es tratar objetos distintos a través de una misma interfaz y que cada uno responda con su propia implementación. En C# moderno tienes dos herramientas, y conviene elegir según qué va a cambiar más:

- **Métodos virtuales o interfaces:** cuando se agregan tipos nuevos con frecuencia y las operaciones son pocas.
- **Pattern matching sobre una jerarquía cerrada:** cuando los tipos son estables y lo que crece son las operaciones.

```csharp
public abstract record Pago(decimal Monto);
public sealed record PagoEfectivo(decimal Monto) : Pago(Monto);
public sealed record PagoTarjeta(decimal Monto, string Ultimos4) : Pago(Monto);
public sealed record PagoTransferencia(decimal Monto, string Referencia) : Pago(Monto);

public static string Describir(Pago pago) => pago switch
{
    PagoEfectivo { Monto: > 10_000m } => "Efectivo: requiere autorización",
    PagoEfectivo                      => "Efectivo",
    PagoTarjeta t                     => $"Tarjeta terminación {t.Ultimos4}",
    PagoTransferencia t               => $"Transferencia {t.Referencia}",
    _ => throw new ArgumentOutOfRangeException(nameof(pago))
};
```

El `switch` concentra la decisión en un solo lugar en vez de repartir `if (pago is ...)` por todo el código.

## Records: igualdad por valor e inmutabilidad

Un `record` compara por valor y se copia con `with`, lo que lo hace ideal para DTOs, mensajes y objetos de valor:

```csharp
var original = new PagoTarjeta(1_250m, "4417");
var ajustado = original with { Monto = 1_200m };

Console.WriteLine(original == ajustado);                        // False
Console.WriteLine(original == new PagoTarjeta(1_250m, "4417")); // True
```

Dos advertencias:

- Un `record` con una `List<T>` adentro no es inmutable de verdad: la lista se puede modificar.
- Las entidades de EF Core tienen identidad y se rastrean por referencia; modélalas como clases, no como records.

## ¿Clase, record o struct?

| Tipo | Úsalo cuando | Ejemplo |
|---|---|---|
| `class` | Tiene identidad y ciclo de vida | `Receta`, `Pedido` |
| `record` | Es un valor o un mensaje: dos instancias con los mismos datos son iguales | DTOs, eventos, `LineaReceta` |
| `record struct` | Es un valor pequeño y muy usado | Coordenadas, rangos de fechas |

## Errores comunes

- Setters públicos en todas las propiedades: la clase no puede proteger sus reglas.
- Herencia solo para reutilizar código; para eso está la composición.
- Campos `protected` que exponen el estado interno a todas las clases hijas.
- Preguntar el tipo con `is` en muchos lugares en vez de usar polimorfismo o un `switch` centralizado.
- Clases estáticas tipo `Utils` que concentran reglas de negocio lejos de los datos que protegen.
