---
title: "Colecciones en C#: cómo elegir según el costo y la concurrencia"
description: "Qué cuesta cada operación en List, Dictionary, HashSet, colas y colecciones concurrentes, cuándo usar Channel o FrozenDictionary, y un caso real de N+1 resuelto con un diccionario."
lang: es
locale: es_MX
ref: colecciones-csharp
date: 2026-11-16 10:20:00 -0600
permalink: /blog/colecciones-csharp/
tags: [C#, .NET, Rendimiento]
redirect_from:
  - /Post2.html
---

La colección correcta se elige por las operaciones que más vas a hacer, no por costumbre. `List<T>` es una excelente opción por defecto, pero buscar dentro de ella en un ciclo puede convertir un proceso de segundos en uno de minutos. Este post resume qué cuesta cada operación y en qué casos conviene otra estructura.

## Lo que cuesta cada operación

| Colección | Buscar | Agregar | Eliminar | Úsala para |
|---|---|---|---|---|
| `List<T>` | O(n) por valor, O(1) por índice | O(1) amortizado al final | O(n) | Secuencias que recorres completas |
| `Dictionary<TKey, TValue>` | O(1) promedio por clave | O(1) promedio | O(1) promedio | Búsquedas por clave |
| `HashSet<T>` | O(1) promedio | O(1) promedio | O(1) promedio | Pertenencia y duplicados |
| `SortedDictionary<TKey, TValue>` | O(log n) | O(log n) | O(log n) | Claves siempre ordenadas |
| `Queue<T>` / `Stack<T>` | — | O(1) | O(1) | Procesar en orden FIFO / LIFO |
| `PriorityQueue<TElement, TPriority>` | O(1) el de mayor prioridad | O(log n) | O(log n) | Procesar por prioridad |

El "O(1) promedio" de los diccionarios depende de un buen `GetHashCode`. Con claves de texto, define siempre el comparador (`StringComparer.Ordinal` u `OrdinalIgnoreCase`) en lugar de confiar en el predeterminado.

## Caso real: un N+1 que se resuelve con un diccionario

Un reporte recorre miles de movimientos de inventario y, para cada uno, consulta su existencia en la base de datos. Funciona en desarrollo con 50 registros y tarda minutos en producción.

```csharp
// Antes: una consulta por cada movimiento (N+1)
foreach (var movimiento in movimientos)
{
    var existencia = await db.Existencias
        .FirstOrDefaultAsync(e => e.Id == movimiento.ExistenciaId, ct);

    filas.Add(new FilaReporte(movimiento, existencia));
}
```

La solución es cargar de una vez lo que se necesita y buscar en memoria:

```csharp
// Después: una sola consulta y búsquedas O(1) en memoria
var ids = movimientos.Select(m => m.ExistenciaId).Distinct().ToList();

var existencias = await db.Existencias
    .AsNoTracking()
    .Where(e => ids.Contains(e.Id))
    .ToDictionaryAsync(e => e.Id, ct);

foreach (var movimiento in movimientos)
{
    existencias.TryGetValue(movimiento.ExistenciaId, out var existencia);
    filas.Add(new FilaReporte(movimiento, existencia));
}
```

EF Core traduce `ids.Contains(...)` a una sola consulta parametrizada (según la versión, con `OPENJSON` o con una lista de parámetros). Aun así, si la lista llega a decenas de miles de ids, procésala por lotes para no generar consultas gigantes.

## HashSet: pertenencia y duplicados

Al validar una carga masiva, detectar claves repetidas con `List.Contains` es O(n²). `HashSet<T>.Add` devuelve `false` si el elemento ya existía, así que resuelve la validación en una sola pasada:

```csharp
var claves = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

foreach (var fila in filasExcel)
{
    if (!claves.Add(fila.Clave))
        errores.Add($"Fila {fila.Numero}: la clave {fila.Clave} está repetida.");
}
```

## Colas, pilas y prioridades

`Queue<T>` procesa en orden de llegada y `Stack<T>` en orden inverso (útil para deshacer o para recorridos en profundidad). Cuando el orden depende de una prioridad, usa `PriorityQueue<TElement, TPriority>`: atiende primero el valor de prioridad más bajo.

```csharp
var pendientes = new PriorityQueue<string, int>();
pendientes.Enqueue("Reporte mensual", 3);
pendientes.Enqueue("Receta urgente", 1);
pendientes.Enqueue("Respaldo nocturno", 5);

while (pendientes.TryDequeue(out var tarea, out var prioridad))
    Console.WriteLine($"{prioridad}: {tarea}"); // 1, 3, 5
```

## Concurrencia: primero la herramienta, luego la colección

**`ConcurrentDictionary`** sirve para cachés compartidas entre hilos. Ojo: la función de `GetOrAdd` puede ejecutarse más de una vez si dos hilos piden la misma clave al mismo tiempo. Si crear el valor es costoso, envuélvelo en `Lazy<T>`:

```csharp
private readonly ConcurrentDictionary<string, Lazy<Task<Tarifa>>> _tarifas = new();

public Task<Tarifa> ObtenerTarifaAsync(string clave) =>
    _tarifas.GetOrAdd(clave, k => new Lazy<Task<Tarifa>>(() => CargarTarifaAsync(k))).Value;
```

Si la tarea falla, el `Lazy` con la excepción se queda en la caché; quítalo con `TryRemove` para permitir un nuevo intento.

**`Channel<T>`** es la opción moderna para productor-consumidor. Con capacidad limitada, el productor espera cuando el consumidor se atrasa, en lugar de llenar la memoria:

```csharp
var canal = Channel.CreateBounded<Pedido>(new BoundedChannelOptions(100)
{
    FullMode = BoundedChannelFullMode.Wait
});

// Productor
await canal.Writer.WriteAsync(pedido, ct);

// Consumidor
await foreach (var siguiente in canal.Reader.ReadAllAsync(ct))
{
    await procesador.ProcesarAsync(siguiente, ct);
}
```

Y una advertencia: si la contención es baja, un `Dictionary` normal protegido con `lock` suele ser más simple y más rápido. Las colecciones concurrentes no se usan "por si acaso".

## Colecciones inmutables y congeladas

Para catálogos que se construyen una vez y se leen millones de veces, `FrozenDictionary` y `FrozenSet` (desde .NET 8) optimizan la lectura a cambio de una creación más lenta:

```csharp
private static readonly FrozenDictionary<string, string> Entidades =
    new Dictionary<string, string>
    {
        ["GT"] = "Guanajuato",
        ["JC"] = "Jalisco",
        ["DF"] = "Ciudad de México",
    }.ToFrozenDictionary(StringComparer.OrdinalIgnoreCase);
```

Para compartir un estado que no debe cambiar entre componentes, `ImmutableArray<T>` e `ImmutableDictionary<TKey, TValue>` garantizan que nadie lo modifique por accidente.

## Exponer colecciones sin perder el control

- Devuelve `IReadOnlyList<T>` o `IReadOnlyCollection<T>` en lugar de `List<T>`: el que llama puede leer, pero no agregar ni borrar.
- Si conoces el tamaño final, reserva la capacidad: `new List<FilaReporte>(movimientos.Count)` evita realocaciones.
- No materialices con `ToList()` una consulta completa para filtrar después en memoria; filtra en la consulta.

## Errores comunes

- `List.Contains` o `Any` dentro de un ciclo: O(n²) sin que se note en desarrollo.
- Modificar una colección mientras la recorres con `foreach` (`InvalidOperationException`).
- Diccionarios con claves de texto sin comparador explícito.
- Usar `ConcurrentDictionary` donde no hay concurrencia real.

## Resumen

| Si necesitas… | Usa |
|---|---|
| Recorrer en orden y acceder por índice | `List<T>` |
| Buscar por clave | `Dictionary<TKey, TValue>` |
| Saber si algo ya existe | `HashSet<T>` |
| Procesar por prioridad | `PriorityQueue<TElement, TPriority>` |
| Productor y consumidor entre hilos | `Channel<T>` |
| Caché compartida entre hilos | `ConcurrentDictionary` (con `Lazy<T>` si crear el valor es costoso) |
| Catálogo de solo lectura muy consultado | `FrozenDictionary<TKey, TValue>` |
