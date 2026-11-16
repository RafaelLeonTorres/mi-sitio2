---
title: "SOLID en la práctica: refactorizando un servicio de reportes en .NET"
description: "Un servicio con cuatro razones para cambiar, refactorizado paso a paso con los cinco principios SOLID, inyección de dependencias y pruebas con xUnit y Moq. Incluye un ejemplo correcto del principio de Liskov."
lang: es
locale: es_MX
ref: solid-en-la-practica
date: 2026-11-16 10:30:00 -0600
permalink: /blog/solid-en-la-practica/
tags: [SOLID, C#, Arquitectura]
redirect_from:
  - /Post4.html
---

SOLID no es una lista de reglas para tener más interfaces. Es una forma de bajar el costo del cambio: que agregar un formato de reporte o cambiar la base de datos toque una clase y no veinte. En lugar de cinco ejemplos aislados, en este post refactorizo un mismo servicio paso a paso.

## El punto de partida

Un servicio que genera el reporte de inventario de una farmacia. Funciona, pero hace de todo:

```csharp
public class ServicioReportes
{
    public byte[] GenerarReporteInventario(int farmaciaId, string formato)
    {
        using var conexion = new SqlConnection("Server=...;Database=Farmacia;...");
        var filas = conexion.Query<FilaInventario>(
            "SELECT Clave, Descripcion, Existencia FROM Inventario WHERE FarmaciaId = @farmaciaId",
            new { farmaciaId }).ToList();

        byte[] contenido;
        if (formato == "excel")
        {
            contenido = []; // 80 líneas armando el Excel…
        }
        else if (formato == "pdf")
        {
            contenido = []; // 120 líneas armando el PDF…
        }
        else
        {
            throw new ArgumentException("Formato no soportado.", nameof(formato));
        }

        File.AppendAllText("bitacora.txt", $"{DateTime.Now}: reporte {formato}{Environment.NewLine}");
        return contenido;
    }
}
```

Este método tiene al menos cuatro razones para cambiar: la consulta, el formato de Excel, el formato de PDF y la bitácora. Agregar CSV obliga a editarlo, y no se puede probar sin una base de datos real ni sin escribir en disco.

## S: responsabilidad única

Cada clase debe tener una sola razón para cambiar. Separamos lo que varía por motivos distintos:

```csharp
public sealed record FilaInventario(string Clave, string Descripcion, int Existencia);

public enum FormatoReporte { Excel, Pdf, Csv }

public interface IRepositorioInventario
{
    Task<IReadOnlyList<FilaInventario>> ObtenerAsync(int farmaciaId, CancellationToken ct);
}

public interface IGeneradorReporte
{
    FormatoReporte Formato { get; }
    byte[] Generar(IReadOnlyList<FilaInventario> filas);
}

public interface IBitacora
{
    Task RegistrarAsync(string mensaje, CancellationToken ct);
}
```

El acceso a datos, cada formato y la bitácora quedan en clases distintas. Si cambia el diseño del PDF, solo cambia el generador de PDF.

## O: abierto a extensión, cerrado a modificación

El servicio ya no decide con `if` qué formato construir: recibe todos los generadores registrados y elige por su propiedad `Formato`.

```csharp
public sealed class ServicioReportes(
    IRepositorioInventario inventario,
    IEnumerable<IGeneradorReporte> generadores,
    IBitacora bitacora)
{
    private readonly Dictionary<FormatoReporte, IGeneradorReporte> _generadores =
        generadores.ToDictionary(g => g.Formato);

    public async Task<byte[]> GenerarAsync(int farmaciaId, FormatoReporte formato, CancellationToken ct)
    {
        if (!_generadores.TryGetValue(formato, out var generador))
            throw new NotSupportedException($"No hay un generador para el formato {formato}.");

        var filas = await inventario.ObtenerAsync(farmaciaId, ct);
        var contenido = generador.Generar(filas);

        await bitacora.RegistrarAsync($"Reporte de inventario {formato} de la farmacia {farmaciaId}", ct);
        return contenido;
    }
}
```

Agregar CSV es una clase nueva y una línea de registro; el servicio no se toca:

```csharp
public sealed class GeneradorCsv : IGeneradorReporte
{
    public FormatoReporte Formato => FormatoReporte.Csv;

    public byte[] Generar(IReadOnlyList<FilaInventario> filas)
    {
        var csv = new StringBuilder();
        csv.AppendLine("Clave,Descripcion,Existencia");

        foreach (var fila in filas)
            csv.AppendLine($"{fila.Clave},{Escapar(fila.Descripcion)},{fila.Existencia}");

        return Encoding.UTF8.GetBytes(csv.ToString());
    }

    private static string Escapar(string valor) => $"\"{valor.Replace("\"", "\"\"")}\"";
}
```

```csharp
builder.Services.AddScoped<IRepositorioInventario, RepositorioInventario>();
builder.Services.AddScoped<IBitacora, BitacoraBd>();
builder.Services.AddSingleton<IGeneradorReporte, GeneradorExcel>();
builder.Services.AddSingleton<IGeneradorReporte, GeneradorPdf>();
builder.Services.AddSingleton<IGeneradorReporte, GeneradorCsv>(); // formato nuevo: una línea
builder.Services.AddScoped<ServicioReportes>();
```

## L: sustitución de Liskov

Un tipo derivado debe poder usarse donde se espera el tipo base sin que el programa se comporte de forma incorrecta. Lo importante es el **comportamiento**, no la firma: una clase puede implementar todos los métodos de una interfaz y aun así violar el principio.

> En la versión anterior de este post usé el ejemplo del pingüino que hereda `Volar()` y lo deja vacío. Ese código no ilustra el principio: lo viola. Aquí va un ejemplo más realista y su corrección.

Un catálogo de solo lectura que implementa un repositorio genérico:

```csharp
public interface IRepositorio<T>
{
    Task<T?> ObtenerAsync(int id, CancellationToken ct);
    Task GuardarAsync(T entidad, CancellationToken ct);
}

// Viola LSP: quien recibe un IRepositorio<T> espera poder guardar.
public sealed class RepositorioCatalogoSat(CatalogoDbContext db) : IRepositorio<ClaveProductoSat>
{
    public Task<ClaveProductoSat?> ObtenerAsync(int id, CancellationToken ct) =>
        db.ClavesProducto.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);

    public Task GuardarAsync(ClaveProductoSat entidad, CancellationToken ct) =>
        throw new NotSupportedException("El catálogo del SAT es de solo lectura.");
}
```

El compilador no se queja, pero cualquier código que reciba un `IRepositorio<ClaveProductoSat>` y llame a `GuardarAsync` falla en producción. La corrección es no prometer lo que no se puede cumplir:

```csharp
public interface ILectura<T>
{
    Task<T?> ObtenerAsync(int id, CancellationToken ct);
}

public interface IRepositorio<T> : ILectura<T>
{
    Task GuardarAsync(T entidad, CancellationToken ct);
}

public sealed class RepositorioCatalogoSat(CatalogoDbContext db) : ILectura<ClaveProductoSat>
{
    public Task<ClaveProductoSat?> ObtenerAsync(int id, CancellationToken ct) =>
        db.ClavesProducto.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);
}
```

Señales de que una clase rompe Liskov:

- Lanza `NotSupportedException` o `NotImplementedException` en un método heredado.
- Exige más de lo que pide el contrato (por ejemplo, rechaza valores que la interfaz acepta).
- Garantiza menos de lo que promete el contrato (por ejemplo, regresa `null` donde la base nunca lo hace).

## I: segregación de interfaces

Ningún cliente debería depender de métodos que no usa. La corrección anterior ya lo aplica: quien solo lee depende de `ILectura<T>`. Del mismo modo, `ServicioReportes` depende de `IRepositorioInventario`, que expone solo la consulta que necesita, y no de un repositorio con cuarenta métodos.

Una buena práctica es que la interfaz la defina quien la consume: el servicio dice qué necesita y la infraestructura se adapta.

## D: inversión de dependencias

Los módulos de alto nivel no dependen de los de bajo nivel; ambos dependen de abstracciones. `ServicioReportes` no sabe si los datos vienen de SQL Server o de una API, ni si la bitácora es una tabla o un archivo. Por eso se puede probar en milisegundos, sin base de datos:

```csharp
public class ServicioReportesTests
{
    [Fact]
    public async Task GenerarAsync_UsaElGeneradorDelFormatoSolicitado()
    {
        var filas = new List<FilaInventario> { new("010.000.0104.00", "Paracetamol 500 mg", 120) };

        var inventario = new Mock<IRepositorioInventario>();
        inventario.Setup(r => r.ObtenerAsync(7, It.IsAny<CancellationToken>())).ReturnsAsync(filas);

        var csv = new Mock<IGeneradorReporte>();
        csv.SetupGet(g => g.Formato).Returns(FormatoReporte.Csv);
        csv.Setup(g => g.Generar(filas)).Returns(new byte[] { 1, 2, 3 });

        var servicio = new ServicioReportes(inventario.Object, new[] { csv.Object }, Mock.Of<IBitacora>());

        var contenido = await servicio.GenerarAsync(7, FormatoReporte.Csv, CancellationToken.None);

        Assert.Equal(new byte[] { 1, 2, 3 }, contenido);
        csv.Verify(g => g.Generar(filas), Times.Once);
    }
}
```

## Cuándo no aplicar SOLID al pie de la letra

- Una interfaz por cada clase, sin una segunda implementación ni una prueba que la necesite, solo agrega ruido.
- Abstrae cuando aparece el segundo caso o cuando el punto de variación es evidente, no "por si acaso".
- En un script o un servicio pequeño, la simplicidad gana. SOLID es una herramienta, no un fin.

## Checklist

- ¿Cuántas razones para cambiar tiene esta clase? Si son más de una, sepáralas.
- ¿Agregar un caso nuevo me obliga a editar un `if` o un `switch` existente?
- ¿Algún método heredado lanza `NotSupportedException`?
- ¿Mis interfaces tienen métodos que sus clientes no usan?
- ¿Puedo probar la lógica de negocio sin base de datos, red ni disco?
