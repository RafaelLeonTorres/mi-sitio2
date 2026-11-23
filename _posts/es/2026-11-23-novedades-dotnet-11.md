---
title: "Novedades de .NET 11 y C# 15 con ejemplos: uniones, jerarquías cerradas y runtime async"
description: "Lo nuevo de .NET 11, la versión más reciente: uniones y jerarquías cerradas en C# 15, runtime async, Zstandard, FullJoin en LINQ, validación asíncrona y qué revisar antes de migrar. Los ejemplos se compilaron con el SDK 11."
lang: es
locale: es_MX
ref: novedades-dotnet-11
date: 2026-11-23 08:20:00 -0600
permalink: /blog/novedades-dotnet-11/
tags: [".NET 11", "C# 15", Novedades]
---

.NET 11 salió el 10 de noviembre de 2026 junto con C# 15. Es una versión de soporte estándar (STS): recibe parches hasta el 14 de noviembre de 2028, la misma fecha en que termina el soporte de .NET 10, que es LTS. Este post recorre lo que cambia al escribir código. Los ejemplos se compilaron y se ejecutaron con el SDK 11.0.100, salvo los de EF Core 11, OpenAPI y la plantilla de MCP, que vienen de la documentación oficial.

| Versión | Tipo | Fin de soporte |
|---|---|---|
| .NET 9 | STS | 10 de noviembre de 2026 (ya terminó) |
| .NET 10 | LTS | 14 de noviembre de 2028 |
| .NET 11 | STS | 14 de noviembre de 2028 |

Las fechas vienen de la [política de soporte de .NET](https://dotnet.microsoft.com/platform/support/policy/dotnet-core).

## C# 15

C# 15 es el lenguaje predeterminado de los proyectos que apuntan a `net11.0` con el SDK 11, así que no hay que tocar `LangVersion`. Solo la seguridad de memoria, que no vemos aquí, sigue en vista previa.

### Uniones (`union`)

Una unión es un valor que puede ser de uno de varios tipos que no tienen nada en común: ni clase base ni interfaz. Hasta ahora tenías que inventar una jerarquía, devolver `object` o usar una biblioteca de terceros. En C# 15 se declara con `union`:

```csharp
public record PagoAprobado(string Autorizacion);
public record PagoRechazado(string Motivo);
public record PagoPendiente(TimeSpan Espera);

public union ResultadoPago(PagoAprobado, PagoRechazado, PagoPendiente);

public static class Pagos
{
    public static ResultadoPago Cobrar(decimal monto) => monto switch
    {
        <= 0 => new PagoRechazado("Monto inválido"),
        > 10_000 => new PagoPendiente(TimeSpan.FromSeconds(30)),
        _ => new PagoAprobado("A-1234"),
    };

    public static string Describir(ResultadoPago resultado) => resultado switch
    {
        PagoAprobado a => $"Aprobado ({a.Autorizacion})",
        PagoRechazado r => $"Rechazado: {r.Motivo}",
        PagoPendiente p => $"Pendiente: reintenta en {p.Espera.TotalSeconds} s",
    };
}
```

```csharp
Console.WriteLine(Pagos.Describir(Pagos.Cobrar(250)));
Console.WriteLine(Pagos.Describir(Pagos.Cobrar(-5)));
Console.WriteLine(Pagos.Describir(Pagos.Cobrar(25_000)));
```

```text
Aprobado (A-1234)
Rechazado: Monto inválido
Pendiente: reintenta en 30 s
```

Cada tipo se convierte de forma implícita a la unión (por eso `Cobrar` devuelve un `PagoRechazado` o un `PagoPendiente` sin conversiones explícitas) y el `switch` es exhaustivo: si quitas un caso, el compilador avisa con CS8509 y te dice qué patrón falta.

ASP.NET Core 11 y `System.Text.Json` entienden las uniones. Un endpoint que devuelve `ResultadoPago` responde con el JSON del caso, sin ningún campo extra:

```csharp
app.MapGet("/pago/{monto:decimal}", (decimal monto) => Pagos.Cobrar(monto));
```

```text
GET /pago/250    -> 200 {"autorizacion":"A-1234"}
GET /pago/-5     -> 200 {"motivo":"Monto inválido"}
GET /pago/25000  -> 200 {"espera":"00:00:30"}
```

Como no hay un campo que identifique el caso, si dos casos producen la misma forma JSON conviene desambiguarlos con un clasificador `[JsonUnion]`. Según la documentación, las uniones tampoco se admiten en los enlaces que no son el cuerpo de la petición (ruta, query, encabezados y formularios).

### Jerarquías cerradas (`closed`)

`closed` fija los hijos directos de una clase: solo se puede derivar dentro del mismo ensamblado, así que el compilador conoce todos los casos y el `switch` no necesita `default`:

```csharp
public closed record class EstadoPedido;
public record class Creado : EstadoPedido;
public record class Enviado(string Guia) : EstadoPedido;
public record class Entregado(DateOnly Fecha) : EstadoPedido;

public static class Pedidos
{
    public static string Describir(EstadoPedido estado) => estado switch
    {
        Creado => "Esperando envío",
        Enviado(var guia) => $"En camino, guía {guia}",
        Entregado(var fecha) => $"Entregado el {fecha:dd/MM/yyyy}",
    };
}
```

```csharp
Console.WriteLine(Pedidos.Describir(new Creado()));
Console.WriteLine(Pedidos.Describir(new Enviado("MX-998")));
Console.WriteLine(Pedidos.Describir(new Entregado(new DateOnly(2026, 11, 20))));
```

```text
Esperando envío
En camino, guía MX-998
Entregado el 20/11/2026
```

Una clase `closed` es abstracta de forma implícita y no se puede combinar con `sealed` ni con `static`. La regla no es transitiva: un hijo que no sea `closed` todavía se puede heredar desde otros ensamblados. Si omites un hijo en el `switch`, el compilador avisa con CS8509.

**¿Unión o jerarquía cerrada?** La unión junta tipos que ya existen y no se relacionan (uno de ellos puede venir de otro paquete). La jerarquía cerrada modela una familia propia, con datos y comportamiento compartidos.

### Argumentos en expresiones de colección: `with(...)`

Un elemento `with(...)` al principio de la expresión de colección pasa argumentos al constructor o al método de fábrica de la colección: capacidad, comparador y demás. Antes tenías que abandonar la sintaxis corta `[...]` para configurarlos.

```csharp
string[] valores = ["uno", "dos", "tres"];

List<string> nombres = [with(capacity: valores.Length * 2), .. valores];
HashSet<string> conjunto = [with(StringComparer.OrdinalIgnoreCase), "Hola", "HOLA", "hola"];

Console.WriteLine($"{nombres.Count} elementos, capacidad {nombres.Capacity}");
Console.WriteLine(conjunto.Count);
```

```text
3 elementos, capacidad 6
1
```

### Indexadores de extensión

C# 14 trajo los bloques `extension` para propiedades y métodos; C# 15 les suma los indexadores. Como un indexador siempre es de instancia, el bloque debe nombrar el receptor (aquí, `usuario`):

```csharp
using System.Security.Claims;

public static class ClaimsExtensiones
{
    extension(ClaimsPrincipal usuario)
    {
        public string? this[string tipo] => usuario.FindFirst(tipo)?.Value;
    }
}
```

```csharp
var usuario = new ClaimsPrincipal(new ClaimsIdentity([new Claim("email", "ana@example.com")], "prueba"));
Console.WriteLine(usuario["email"]);
Console.WriteLine(usuario["telefono"] is null);
```

```text
ana@example.com
True
```

### `break` y `continue` con etiqueta

Ahora `break` y `continue` pueden nombrar el ciclo al que se refieren. Reemplazan la bandera booleana o el `goto` que antes necesitabas para salir de ciclos anidados:

```csharp
public enum Estado { Libre, Ocupada, Bloqueada }

public static class Salas
{
    public static (int Piso, int Sala)? PrimeraLibre(Estado[,] salas)
    {
        (int Piso, int Sala)? libre = null;

        pisos:
        for (var piso = 0; piso < salas.GetLength(0); piso++)
        {
            for (var sala = 0; sala < salas.GetLength(1); sala++)
            {
                if (salas[piso, sala] == Estado.Bloqueada)
                    continue pisos; // un piso con una sala bloqueada se descarta completo

                if (salas[piso, sala] == Estado.Libre)
                {
                    libre = (piso, sala);
                    break pisos;
                }
            }
        }

        return libre;
    }
}
```

```csharp
var salas = new Estado[,]
{
    { Estado.Ocupada, Estado.Bloqueada, Estado.Libre },
    { Estado.Ocupada, Estado.Libre,     Estado.Libre },
    { Estado.Libre,   Estado.Libre,     Estado.Libre },
};
var primera = Salas.PrimeraLibre(salas);
Console.WriteLine($"piso {primera!.Value.Piso}, sala {primera.Value.Sala}");
```

```text
piso 1, sala 1
```

El primer piso tiene una sala libre al final, pero también una bloqueada, así que `continue pisos` lo descarta completo y salta al siguiente; `break pisos` sale de los dos ciclos en cuanto encuentra una sala libre.

C# 15 también permite declarar miembros estáticos no virtuales en interfaces aunque el runtime de destino no soporte implementaciones predeterminadas, y trae una vista previa de seguridad de memoria que requiere `LangVersion` en `preview`.

## Runtime

### Runtime async

Hasta ahora, cada método `async` generaba una máquina de estados escrita por el compilador. .NET 11 incorpora runtime async: es el propio runtime el que administra la suspensión y la reanudación. Las bibliotecas del runtime ya se compilan así. En tu proyecto se activa con una propiedad (en `net11.0` no hace falta `EnablePreviewFeatures`):

```xml
<PropertyGroup>
  <Features>runtime-async=on</Features>
</PropertyGroup>
```

El efecto más visible está en las pilas de llamadas en vivo, las que ven el depurador, los profilers y `new StackTrace()`. Con este código:

```csharp
using System.Diagnostics;

await ExternaAsync();

static async Task ExternaAsync() => await IntermediaAsync();

static async Task IntermediaAsync() => await InternaAsync();

static async Task InternaAsync()
{
    var marcos = new StackTrace().GetFrames();
    Console.WriteLine($"{marcos.Length} marcos en la pila:");

    foreach (var marco in marcos)
    {
        var metodo = marco.GetMethod();
        Console.WriteLine($"   {metodo?.DeclaringType?.Name}.{metodo?.Name}");
    }

    await Task.CompletedTask;
}
```

Esto es lo que imprime sin `runtime-async`:

```text
13 marcos en la pila:
   <<<Main>$>g__InternaAsync|0_2>d.MoveNext
   AsyncMethodBuilderCore.Start
   Program.<<Main>$>g__InternaAsync|0_2
   <<<Main>$>g__IntermediaAsync|0_1>d.MoveNext
   AsyncMethodBuilderCore.Start
   Program.<<Main>$>g__IntermediaAsync|0_1
   <<<Main>$>g__ExternaAsync|0_0>d.MoveNext
   AsyncMethodBuilderCore.Start
   Program.<<Main>$>g__ExternaAsync|0_0
   <<Main>$>d__0.MoveNext
   AsyncMethodBuilderCore.Start
   Program.<Main>$
   Program.<Main>
```

Y esto con `runtime-async=on`:

```text
5 marcos en la pila:
   Program.<<Main>$>g__InternaAsync|0_2
   Program.<<Main>$>g__IntermediaAsync|0_1
   Program.<<Main>$>g__ExternaAsync|0_0
   Program.<Main>$
   Program.<Main>
```

Trece marcos contra cinco: ahora se ve la cadena real de llamadas. Las excepciones (`catch (Exception ex)`) ya se veían igual con o sin runtime async; la mejora está en lo que observas mientras el programa corre. La documentación menciona además que las continuaciones ya no capturan ni restauran `ExecutionContext` cuando no hay nada que restaurar, lo que reduce la sobrecarga en las rutas asíncronas de alto volumen. Runtime async se enciende por proyecto: pruébalo con tus pruebas de carga antes de llevarlo a producción.

### Requisitos mínimos de hardware

Sube el piso de CPU. .NET 11 exige x86-64-v2 en x86 y x64 (por ejemplo, `POPCNT` y `SSE4.2`) y, en Windows sobre Arm64, la extensión `LSE`. Según la documentación, los últimos procesadores que no cumplen se retiraron del soporte de los fabricantes alrededor de 2013, pero si tienes máquinas virtuales o equipos muy viejos, verifícalos antes de migrar: en una CPU que no cumpla, .NET 11 no arranca y avisa que a la CPU le faltan conjuntos de instrucciones básicos.

## Bibliotecas

### Zstandard integrado

`ZstandardStream` y `ZstandardEncoder` viven en `System.IO.Compression`, junto a `GZipStream` y `BrotliStream`:

```csharp
using System.IO.Compression;

public static class Compresion
{
    public static byte[] Comprimir(byte[] datos)
    {
        using var salida = new MemoryStream();

        using (var zstd = new ZstandardStream(salida, CompressionMode.Compress, leaveOpen: true))
            zstd.Write(datos);

        return salida.ToArray();
    }

    public static byte[] Descomprimir(byte[] comprimido)
    {
        using var entrada = new MemoryStream(comprimido);
        using var zstd = new ZstandardStream(entrada, CompressionMode.Decompress);
        using var salida = new MemoryStream();

        zstd.CopyTo(salida);
        return salida.ToArray();
    }
}
```

```csharp
var json = Encoding.UTF8.GetBytes(string.Concat(Enumerable.Repeat("{\"folio\":123,\"estado\":\"ok\"}", 2000)));
var comprimido = Compresion.Comprimir(json);
var restaurado = Compresion.Descomprimir(comprimido);
Console.WriteLine($"{json.Length} bytes -> {comprimido.Length} bytes, idéntico: {restaurado.AsSpan().SequenceEqual(json)}");
```

```text
54000 bytes -> 44 bytes, idéntico: True
```

El JSON de la prueba es repetitivo a propósito, así que esos 44 bytes no dicen nada sobre tus datos reales: mide con tus propias cargas. Para mensajes pequeños y parecidos entre sí, `ZstandardDictionary` permite entrenar un diccionario y mejorar la compresión.

### LINQ: `LeftJoin`, `RightJoin` y `FullJoin`

Las uniones externas llegan a LINQ y devuelven tuplas, así que se combinan bien con patrones. Existen en `Enumerable`, `Queryable` y `AsyncEnumerable`, y EF Core 11 sabe traducir `FullJoin`. Un caso típico es conciliar dos listas: lo que reporta el banco contra lo que registró el sistema.

```csharp
public record Movimiento(string Referencia, decimal Monto);

public static class Conciliacion
{
    public static IEnumerable<string> Comparar(IEnumerable<Movimiento> banco, IEnumerable<Movimiento> sistema)
    {
        foreach (var (enBanco, enSistema) in banco.FullJoin(sistema, b => b.Referencia, s => s.Referencia))
        {
            yield return (enBanco, enSistema) switch
            {
                (null, { } s) => $"{s.Referencia}: falta en el banco",
                ({ } b, null) => $"{b.Referencia}: falta en el sistema",
                ({ } b, { } s) when b.Monto != s.Monto => $"{b.Referencia}: banco {b.Monto} vs sistema {s.Monto}",
                ({ } b, _) => $"{b.Referencia}: conciliado",
                _ => throw new InvalidOperationException("FullJoin no devuelve pares vacíos."),
            };
        }
    }
}
```

```csharp
var banco = new List<Movimiento> { new("A1", 500m), new("A2", 120m), new("A4", 75m) };
var sistema = new List<Movimiento> { new("A1", 500m), new("A2", 100m), new("A3", 40m) };
var resultado = Conciliacion.Comparar(banco, sistema).ToList();
foreach (var linea in resultado) Console.WriteLine(linea);
```

```text
A1: conciliado
A2: banco 120 vs sistema 100
A4: falta en el sistema
A3: falta en el banco
```

### Validación asíncrona con DataAnnotations

Un atributo de validación que necesitaba consultar la base de datos o llamar a otra API solo podía bloquear un hilo. Ahora `System.ComponentModel.DataAnnotations` tiene `AsyncValidationAttribute`, `IAsyncValidatableObject` y los métodos `Validator.ValidateObjectAsync` y `TryValidateObjectAsync`. En ASP.NET Core 11, las Minimal APIs los ejecutan solas si registras `AddValidation()`:

```csharp
using System.ComponentModel.DataAnnotations;

public sealed class CorreoDisponibleAttribute : AsyncValidationAttribute
{
    // La versión síncrona no se usa: este atributo solo valida de forma asíncrona.
    protected override ValidationResult? IsValid(object? value, ValidationContext context) =>
        throw new InvalidOperationException("Valida este atributo con IsValidAsync.");

    protected override async Task<ValidationResult?> IsValidAsync(
        object? value, ValidationContext context, CancellationToken cancellationToken)
    {
        var usuarios = context.GetRequiredService<IUsuarios>();

        if (value is string correo && await usuarios.ExisteCorreoAsync(correo, cancellationToken))
            return new ValidationResult("Ese correo ya está registrado.");

        return ValidationResult.Success;
    }
}

public class NuevoUsuario
{
    [Required, EmailAddress, CorreoDisponible]
    public string Correo { get; set; } = "";
}
```

```csharp
builder.Services.AddSingleton<IUsuarios, UsuariosEnMemoria>();
builder.Services.AddValidation();

var app = builder.Build();

app.MapPost("/usuarios", (NuevoUsuario usuario) => Results.Ok(new { usuario.Correo }));
```

`IUsuarios` es una interfaz de tu aplicación con `ExisteCorreoAsync`; en la prueba, una implementación en memoria que tarda 10 milisegundos para simular la consulta. Estas son las respuestas:

```text
POST /usuarios {"correo":"ana@example.com"}    -> 400 {"title":"One or more validation errors occurred.","status":400,"errors":{"Correo":["Ese correo ya está registrado."]}}
POST /usuarios {"correo":"nuevo@example.com"}  -> 200 {"correo":"nuevo@example.com"}
POST /usuarios {"correo":"no-es-correo"}       -> 400 {"title":"One or more validation errors occurred.","status":400,"errors":{"Correo":["The Correo field is not a valid e-mail address."]}}
```

El mensaje del correo con formato inválido viene en inglés porque es el predeterminado de `[EmailAddress]`; define `ErrorMessage` en el atributo para personalizarlo.

## ASP.NET Core 11, en breve

- **`[ShortCircuit]`.** Ejecuta el endpoint justo después del enrutamiento y se salta el resto del middleware, útil para un health check o un `robots.txt`. También funciona en controladores:

  ```csharp
  app.MapGet("/salud", [ShortCircuit] () => "Healthy");
  ```

  La prueba respondió `200 Healthy`.
- **OpenAPI 3.2 por defecto.** Los documentos generados ahora apuntan a esa versión. Si una herramienta tuya todavía no la soporta, fija la anterior (ejemplo de la documentación):

  ```csharp
  builder.Services.AddOpenApi(options =>
  {
      options.OpenApiVersion = Microsoft.OpenApi.OpenApiSpecVersion.OpenApi3_1;
  });
  ```
- **Límite de peticiones.** El `FixedWindowRateLimiter` ahora informa un `RetryAfter` que corresponde al siguiente límite de la ventana. Si ya lo copias al encabezado `Retry-After` en `OnRejected`, los intervalos salen correctos sin cambiar código.
- **Servidor MCP.** La plantilla ya viene en el SDK: `dotnet new mcpserver -o MyMcpServer`.

## SDK y EF Core 11

**Aplicaciones basadas en archivo con `#:include`.** Las aplicaciones de un solo archivo (`dotnet run app.cs`) ya pueden repartirse en varios. El archivo de entrada debe empezar con `#!/usr/bin/env dotnet`; si no, el analizador avisa con CA2266:

```csharp
#!/usr/bin/env dotnet
#:include "helpers.cs"

Console.WriteLine(Helpers.Saludar("Ana"));
```

```csharp
static class Helpers
{
    public static string Saludar(string nombre) => $"Hola, {nombre}";
}
```

Con los dos archivos en la misma carpeta, `dotnet run app.cs` imprime `Hola, Ana`. Y `dotnet run -e CLAVE=VALOR` pasa variables de entorno al programa sin editar perfiles de inicio.

**EF Core 11** (según su documentación):

- `dotnet ef database update InitialCreate --add` crea y aplica una migración en un solo paso, compilándola con Roslyn en el momento. Sirve en contenedores y en .NET Aspire, donde no se puede recompilar.
- `MaxByAsync` y `MinByAsync` se traducen a SQL: `await context.Blogs.MaxByAsync(b => b.Posts.Count())`.
- Para SQL Server, índices JSON y búsqueda vectorial (esta última, experimental). Los detalles del lado de la base de datos están en el [post de SQL Server 2025]({{ '/blog/novedades-sql-server-2025/' | relative_url }}).

## ¿Conviene migrar?

1. **Si sigues en .NET 9**, ya no tiene soporte desde el 10 de noviembre de 2026: pasa a .NET 10 (LTS) o a .NET 11.
2. **Si estás en .NET 10**, los dos terminan el mismo día, el 14 de noviembre de 2028. Migrar a 11 es por las novedades (uniones, `FullJoin`, runtime async), no por más tiempo de soporte; considera si puedes absorber una actualización por año.
3. **Revisa el hardware** donde corre tu aplicación contra el nuevo piso de CPU.
4. **Cambia `TargetFramework` a `net11.0`**, compila, corre tus pruebas y lee la lista de cambios importantes de .NET 11.
5. **Confirma que tus paquetes de terceros ya publican versión para .NET 11**, por ejemplo los proveedores de EF Core que no son de Microsoft.
6. **Activa `runtime-async` aparte** y compara el rendimiento antes de dejarlo.

## Resumen

| Novedad | Para qué sirve | Qué necesita |
|---|---|---|
| Uniones | Un valor que es uno de varios tipos sin relación | `net11.0` (C# 15) |
| Jerarquías cerradas | `switch` exhaustivo sobre una familia propia | C# 15 |
| `with(...)` | Capacidad o comparador dentro de `[...]` | C# 15 |
| Indexadores de extensión | `usuario["email"]` sobre un tipo ajeno | C# 15 |
| `break` y `continue` con etiqueta | Salir de ciclos anidados sin banderas | C# 15 |
| Runtime async | Pilas de llamadas más claras, menos máquinas de estado | `<Features>runtime-async=on</Features>` |
| Zstandard | Compresión integrada | `System.IO.Compression` |
| `FullJoin` | Conciliar dos listas | .NET 11 |
| Validación asíncrona | Reglas con I/O sin bloquear hilos | `AddValidation()` en Minimal APIs |
