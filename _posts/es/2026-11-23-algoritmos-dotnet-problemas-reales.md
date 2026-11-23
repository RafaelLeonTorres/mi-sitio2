---
title: "Algoritmos en .NET con problemas reales: del caché LRU al orden de dependencias"
description: "Seis algoritmos que aparecen en sistemas de verdad, con su código en C#: fusionar intervalos, caché LRU, ruta de menor costo con PriorityQueue, textos parecidos con Levenshtein, límite de peticiones y orden topológico."
lang: es
locale: es_MX
ref: algoritmos-dotnet-problemas-reales
date: 2026-11-23 08:10:00 -0600
permalink: /blog/algoritmos-dotnet-problemas-reales/
tags: [Algoritmos, C#, .NET]
---

Los algoritmos no son solo para entrevistas. Estos seis aparecen en sistemas de verdad: reservaciones que se empalman, consultas costosas que se repiten, rutas de entrega, nombres escritos de dos maneras, APIs que hay que proteger y pasos que dependen unos de otros. De cada uno verás el problema, la idea, el código en C# y lo que cuesta.

Todo el código se compiló y se ejecutó con .NET 8 y con .NET 11, fijando C# 12 como versión del lenguaje, y los resultados que ves son los que imprimió. Antes de escribir cualquiera de ellos, revisa la tabla del final: varios ya existen en la plataforma o en la base de datos.

## 1. Fusionar intervalos: reservaciones, citas y ventanas de mantenimiento

**El problema.** Tienes las reservaciones de un quirófano, una sala o un técnico y necesitas saber en qué bloques continuos está ocupado, o si una reservación nueva choca con las existentes.

**La idea.** Ordena por inicio y recorre una sola vez: si el siguiente intervalo empieza antes de que termine el bloque actual, el bloque crece; si no, empieza uno nuevo.

```csharp
public readonly record struct Intervalo(DateTime Inicio, DateTime Fin);

public static class Intervalos
{
    // Dos intervalos se empalman si cada uno empieza antes de que el otro termine.
    public static bool SeEmpalman(Intervalo a, Intervalo b) =>
        a.Inicio < b.Fin && b.Inicio < a.Fin;

    public static List<Intervalo> Fusionar(IEnumerable<Intervalo> intervalos)
    {
        var resultado = new List<Intervalo>();

        foreach (var actual in intervalos.OrderBy(i => i.Inicio))
        {
            if (resultado.Count > 0 && actual.Inicio <= resultado[^1].Fin)
            {
                // Se junta con el bloque anterior: solo lo extiende si termina después.
                var ultimo = resultado[^1];
                if (actual.Fin > ultimo.Fin)
                    resultado[^1] = ultimo with { Fin = actual.Fin };
            }
            else
            {
                resultado.Add(actual);
            }
        }

        return resultado;
    }
}
```

Con cuatro reservaciones del mismo día:

```csharp
var dia = new DateTime(2026, 11, 23);
var reservaciones = new[]
{
    new Intervalo(dia.AddHours(9),  dia.AddHours(11)),
    new Intervalo(dia.AddHours(10), dia.AddHours(12)),
    new Intervalo(dia.AddHours(15), dia.AddHours(16)),
    new Intervalo(dia.AddHours(12), dia.AddHours(13)),
};

var bloques = Intervalos.Fusionar(reservaciones);
foreach (var bloque in bloques)
    Console.WriteLine($"{bloque.Inicio:HH:mm}-{bloque.Fin:HH:mm}");
```

```text
09:00-13:00
15:00-16:00
```

**Lo que cuesta.** O(n log n) por el ordenamiento y O(n) de memoria; el recorrido es lineal.

**Detalles que importan:**

- La prueba `a.Inicio < b.Fin && b.Inicio < a.Fin` es la que necesitas en todas partes, también en SQL: `WHERE Inicio < @fin AND Fin > @inicio`.
- Con `<=`, dos reservaciones pegadas (una termina a las 12:00 y otra empieza a las 12:00) se juntan en un solo bloque, como la de 12:00 a 13:00 del ejemplo. Si quieres mantenerlas separadas, usa `<`.
- Impedir que se guarden reservaciones empalmadas no se resuelve validando en memoria: dos peticiones simultáneas pasan la validación al mismo tiempo. Esa regla le toca a la base de datos; en [PostgreSQL ya existe una restricción para eso]({{ '/blog/postgresql-vs-sql-server-hoy/' | relative_url }}).

## 2. Caché LRU: memoria acotada para consultas costosas

**El problema.** Un catálogo (tipos de cambio, tarifas, permisos) que consultas miles de veces. Quieres conservar los más usados sin que la memoria crezca sin límite.

**La idea.** Un diccionario para encontrar cada elemento en O(1) y una lista enlazada para saber cuál se usó hace más tiempo. Cada lectura mueve el elemento al frente; cuando la caché se llena, se expulsa el último.

```csharp
public sealed class CacheLru<TClave, TValor> where TClave : notnull
{
    private readonly int _capacidad;
    private readonly Dictionary<TClave, LinkedListNode<(TClave Clave, TValor Valor)>> _nodos;
    private readonly LinkedList<(TClave Clave, TValor Valor)> _recientes = new();
    private readonly object _candado = new();

    public CacheLru(int capacidad)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(capacidad);
        _capacidad = capacidad;
        _nodos = new(capacidad);
    }

    public bool TryGet(TClave clave, out TValor valor)
    {
        lock (_candado)
        {
            if (_nodos.TryGetValue(clave, out var nodo))
            {
                // Leer también es "usar": pasa al frente de la lista.
                _recientes.Remove(nodo);
                _recientes.AddFirst(nodo);
                valor = nodo.Value.Valor;
                return true;
            }
        }

        valor = default!;
        return false;
    }

    public void Set(TClave clave, TValor valor)
    {
        lock (_candado)
        {
            if (_nodos.TryGetValue(clave, out var existente))
            {
                existente.Value = (clave, valor);
                _recientes.Remove(existente);
                _recientes.AddFirst(existente);
                return;
            }

            if (_nodos.Count == _capacidad)
            {
                // El último de la lista es el que se usó hace más tiempo.
                var menosReciente = _recientes.Last!;
                _recientes.RemoveLast();
                _nodos.Remove(menosReciente.Value.Clave);
            }

            _nodos[clave] = _recientes.AddFirst((clave, valor));
        }
    }
}
```

```csharp
var cache = new CacheLru<string, string>(capacidad: 2);
cache.Set("MXN", "Peso mexicano");
cache.Set("USD", "Dólar");
cache.TryGet("MXN", out _);   // MXN pasa a ser la más reciente
cache.Set("EUR", "Euro");     // expulsa a USD

Console.WriteLine(cache.TryGet("USD", out _));
Console.WriteLine(cache.TryGet("MXN", out var nombre) + " " + nombre);
```

```text
False
True Peso mexicano
```

**Lo que cuesta.** O(1) al leer y al escribir. Un solo `lock` protege las dos estructuras: incluso leer cambia el orden, así que un candado de solo lectura no sirve.

**Antes de escribirlo.** `IMemoryCache` con `SizeLimit` ya limita la memoria y, al llegar al tope, expulsa las entradas por prioridad y por uso reciente; además trae expiración. Escribe un LRU propio cuando necesites exactamente esa política o no quieras la dependencia.

## 3. Ruta de menor costo: Dijkstra con `PriorityQueue`

**El problema.** Llevar insumos de un almacén a un hospital pasando por sucursales; cada tramo cuesta minutos. ¿Cuál es el camino más barato?

**La idea.** Expande siempre el nodo con menor costo acumulado conocido. `PriorityQueue<TElement, TPriority>` (desde .NET 6) lo entrega en O(log n). No permite bajar la prioridad de un elemento que ya está en la cola, así que se encola de nuevo con el costo mejor y las entradas viejas se descartan cuando salen.

```csharp
public static class Rutas
{
    public static (int Costo, List<string> Camino)? MenorCosto(
        IReadOnlyDictionary<string, List<(string Destino, int Costo)>> grafo,
        string origen,
        string destino)
    {
        var costo = new Dictionary<string, int> { [origen] = 0 };
        var previo = new Dictionary<string, string>();
        var pendientes = new PriorityQueue<string, int>();
        pendientes.Enqueue(origen, 0);

        while (pendientes.TryDequeue(out var actual, out var costoActual))
        {
            // PriorityQueue no puede "bajar" la prioridad de un elemento: se encolan
            // duplicados y las entradas viejas se descartan aquí.
            if (costoActual > costo[actual])
                continue;

            if (actual == destino)
                return (costoActual, Reconstruir(previo, origen, destino));

            if (!grafo.TryGetValue(actual, out var vecinos))
                continue;

            foreach (var (siguiente, peso) in vecinos)
            {
                var nuevoCosto = costoActual + peso;

                if (!costo.TryGetValue(siguiente, out var conocido) || nuevoCosto < conocido)
                {
                    costo[siguiente] = nuevoCosto;
                    previo[siguiente] = actual;
                    pendientes.Enqueue(siguiente, nuevoCosto);
                }
            }
        }

        return null; // no hay camino
    }

    private static List<string> Reconstruir(Dictionary<string, string> previo, string origen, string destino)
    {
        var camino = new List<string> { destino };

        while (camino[^1] != origen)
            camino.Add(previo[camino[^1]]);

        camino.Reverse();
        return camino;
    }
}
```

```csharp
var grafo = new Dictionary<string, List<(string Destino, int Costo)>>
{
    ["Almacén"] = [("Centro", 25), ("Norte", 40)],
    ["Centro"] = [("Norte", 10), ("Sur", 30), ("Hospital", 60)],
    ["Norte"] = [("Hospital", 35)],
    ["Sur"] = [("Hospital", 20)],
};

var ruta = Rutas.MenorCosto(grafo, "Almacén", "Hospital");
Console.WriteLine($"{ruta!.Value.Costo} min: {string.Join(" → ", ruta.Value.Camino)}");
```

```text
70 min: Almacén → Centro → Norte → Hospital
```

Ir directo por el Norte cuesta 75 minutos y pasar por el Sur también; el camino de 70 solo aparece si pasas por el Centro y luego por el Norte.

**Lo que cuesta.** Del orden de O((V + E) log V), con V nodos y E tramos. Solo admite costos no negativos: con costos negativos necesitas Bellman-Ford. Si conoces una estimación de la distancia al destino, A* llega más rápido.

## 4. Textos parecidos: distancia de Levenshtein

**El problema.** "José Hernández López", "Jose Hernandez Lopez" y "JOSE HERNANDES LOPEZ" son la misma persona escrita de tres maneras. Para detectar duplicados, o para ofrecer un "¿quisiste decir…?", necesitas medir qué tan parecidos son dos textos.

**La idea.** La distancia de Levenshtein cuenta las inserciones, borrados y sustituciones mínimas para convertir un texto en otro. Se calcula con programación dinámica: la celda `[i, j]` es el costo de convertir los primeros `i` caracteres de uno en los primeros `j` del otro, y solo depende de la fila anterior, así que basta con dos filas.

```csharp
using System.Globalization;
using System.Text;

public static class Texto
{
    // "José Hernández" y "JOSE HERNANDEZ" deben compararse como iguales.
    public static string Normalizar(string texto)
    {
        var descompuesto = texto.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(descompuesto.Length);

        foreach (var c in descompuesto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(char.ToUpperInvariant(c));
        }

        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    // Cuántas inserciones, borrados o sustituciones separan un texto de otro.
    public static int DistanciaLevenshtein(ReadOnlySpan<char> a, ReadOnlySpan<char> b)
    {
        if (a.Length < b.Length)
        {
            // b debe ser la más corta: las filas miden b.Length + 1.
            var temporal = a;
            a = b;
            b = temporal;
        }

        if (b.Length == 0)
            return a.Length;

        Span<int> anterior = b.Length < 128 ? stackalloc int[b.Length + 1] : new int[b.Length + 1];
        Span<int> actual = b.Length < 128 ? stackalloc int[b.Length + 1] : new int[b.Length + 1];

        for (var j = 0; j <= b.Length; j++)
            anterior[j] = j;

        for (var i = 1; i <= a.Length; i++)
        {
            actual[0] = i;

            for (var j = 1; j <= b.Length; j++)
            {
                var sustitucion = anterior[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1);
                var borrado = anterior[j] + 1;
                var insercion = actual[j - 1] + 1;
                actual[j] = Math.Min(sustitucion, Math.Min(borrado, insercion));
            }

            var intercambio = anterior;
            anterior = actual;
            actual = intercambio;
        }

        return anterior[b.Length];
    }

    // 1.0 = iguales, 0.0 = nada en común.
    public static double Similitud(string a, string b)
    {
        var x = Normalizar(a);
        var y = Normalizar(b);
        var largo = Math.Max(x.Length, y.Length);

        return largo == 0 ? 1.0 : 1.0 - (double)DistanciaLevenshtein(x, y) / largo;
    }
}
```

```csharp
Console.WriteLine(Texto.DistanciaLevenshtein("kitten", "sitting"));
Console.WriteLine(Texto.Normalizar("José Hernández López"));
Console.WriteLine(Texto.DistanciaLevenshtein(Texto.Normalizar("José Hernández López"), Texto.Normalizar("Jose Hernandes Lopez")));
Console.WriteLine(Texto.Similitud("José Hernández López", "Jose Hernandes Lopez").ToString("F2"));
Console.WriteLine(Texto.Similitud("José Hernández López", "María Torres Gómez").ToString("F2"));
```

```text
3
JOSE HERNANDEZ LOPEZ
1
0.95
0.30
```

Normalizar quita los acentos y las mayúsculas antes de comparar; sin ese paso, "é" contra "e" cuenta como una diferencia. Un umbral de 0.85 o 0.90 suele separar bien las variantes de un mismo nombre de las personas distintas, pero ajústalo con tus propios datos.

**Lo que cuesta.** O(n · m) en tiempo y O(min(n, m)) en memoria. El problema de verdad aparece al comparar todos contra todos: con N registros son N² comparaciones. Compara solo dentro de grupos que ya se parecen (la misma letra inicial, la misma fecha de nacimiento) y deja el resto fuera.

**Antes de escribirlo.** Si los datos están en una base, déjala trabajar: SQL Server 2025 trae [`EDIT_DISTANCE`]({{ '/blog/novedades-sql-server-2025/' | relative_url }}) y PostgreSQL tiene `levenshtein()` en la extensión `fuzzystrmatch`.

## 5. Límite de peticiones: cubeta de tokens

**El problema.** Una API, propia o ajena, solo tolera cierto número de peticiones por segundo, con ráfagas cortas. Quieres rechazar o retrasar el exceso sin perder el control.

**La idea.** Una cubeta con capacidad C se rellena a R tokens por segundo y cada petición gasta uno; si no quedan, se rechaza. No hace falta un temporizador: al llegar una petición se calcula cuántos tokens se acumularon desde la anterior. Recibir un `TimeProvider` (.NET 8) permite probarlo sin esperar.

```csharp
public sealed class CubetaDeTokens
{
    private readonly double _capacidad;
    private readonly double _tokensPorSegundo;
    private readonly TimeProvider _reloj;
    private readonly object _candado = new();
    private double _tokens;
    private long _ultimaRecarga;

    public CubetaDeTokens(int capacidad, double tokensPorSegundo, TimeProvider? reloj = null)
    {
        _capacidad = capacidad;
        _tokensPorSegundo = tokensPorSegundo;
        _reloj = reloj ?? TimeProvider.System;
        _tokens = capacidad; // empieza llena: permite una ráfaga inicial
        _ultimaRecarga = _reloj.GetTimestamp();
    }

    public bool TryConsumir(int cantidad = 1)
    {
        lock (_candado)
        {
            // Los tokens no se generan en segundo plano: se calculan al llegar cada petición.
            var ahora = _reloj.GetTimestamp();
            var segundos = _reloj.GetElapsedTime(_ultimaRecarga, ahora).TotalSeconds;
            _tokens = Math.Min(_capacidad, _tokens + segundos * _tokensPorSegundo);
            _ultimaRecarga = ahora;

            if (_tokens < cantidad)
                return false;

            _tokens -= cantidad;
            return true;
        }
    }
}
```

Para la prueba, un reloj que solo avanza cuando se le pide:

```csharp
// Reloj que solo avanza cuando se le pide (para probar sin esperar).
sealed class RelojManual : TimeProvider
{
    private long _marcas;
    public override long TimestampFrequency => 1000;
    public override long GetTimestamp() => _marcas;
    public void Avanzar(TimeSpan tiempo) => _marcas += (long)(tiempo.TotalSeconds * TimestampFrequency);
}
```

```csharp
var reloj = new RelojManual();
var cubeta = new CubetaDeTokens(capacidad: 5, tokensPorSegundo: 1, reloj);

var primeras = Enumerable.Range(0, 6).Select(_ => cubeta.TryConsumir()).ToArray();
Console.WriteLine(string.Join(" ", primeras));

reloj.Avanzar(TimeSpan.FromSeconds(2));
var despues = Enumerable.Range(0, 3).Select(_ => cubeta.TryConsumir()).ToArray();
Console.WriteLine(string.Join(" ", despues));
```

```text
True True True True True False
True True False
```

La cubeta empieza llena, así que aguanta una ráfaga de cinco; la sexta petición se rechaza. Dos segundos después hay dos tokens nuevos: pasan dos y la tercera se rechaza.

**Lo que cuesta.** O(1) por petición y un `lock`.

**Antes de escribirlo.** Para proteger tu propia API usa el middleware de ASP.NET Core (`AddRateLimiter`) con `TokenBucketRateLimiter`, de `System.Threading.RateLimiting`. La versión de arriba sirve cuando eres el cliente, por ejemplo al llamar a un servicio externo con su propio límite, o para entender cómo funciona. Con varias instancias del servicio, la cubeta tiene que vivir en un almacén compartido (como Redis) o en la puerta de entrada: si no, cada instancia tendría la suya y el límite real se multiplicaría.

## 6. Orden de dependencias: ordenamiento topológico

**El problema.** Un despliegue tiene cinco pasos: compilar, respaldar, migrar la base, desplegar la API y correr pruebas de humo. Cada uno necesita que otros terminen antes. ¿En qué orden se ejecutan? ¿Y qué pasa si dos pasos se esperan mutuamente?

**La idea.** Algoritmo de Kahn: cuenta cuántos requisitos le faltan a cada tarea y ejecuta las que no tienen ninguno. Cada vez que una termina, resta uno a las que la esperaban; las que llegan a cero quedan listas. Si al final sobran tareas pero ninguna está lista, hay un ciclo.

```csharp
public static class Dependencias
{
    // dependencias["Desplegar"] = ["Compilar", "Migrar"] significa que Desplegar
    // necesita que Compilar y Migrar terminen antes.
    public static List<string> Ordenar(IReadOnlyDictionary<string, string[]> dependencias)
    {
        var faltantes = new Dictionary<string, int>();                // tarea -> requisitos sin cumplir
        var dependientes = new Dictionary<string, List<string>>();    // requisito -> tareas que lo esperan

        foreach (var (tarea, requisitos) in dependencias)
        {
            faltantes.TryAdd(tarea, 0);

            foreach (var requisito in requisitos)
            {
                faltantes.TryAdd(requisito, 0);
                faltantes[tarea]++;

                if (!dependientes.TryGetValue(requisito, out var lista))
                    dependientes[requisito] = lista = new List<string>();

                lista.Add(tarea);
            }
        }

        // Las tareas sin requisitos pueden empezar ya (se ordenan por nombre para que el resultado sea estable).
        var listas = new Queue<string>(faltantes.Where(f => f.Value == 0).Select(f => f.Key).Order());
        var orden = new List<string>(faltantes.Count);

        while (listas.TryDequeue(out var tarea))
        {
            orden.Add(tarea);

            if (!dependientes.TryGetValue(tarea, out var siguientes))
                continue;

            foreach (var siguiente in siguientes)
            {
                if (--faltantes[siguiente] == 0)
                    listas.Enqueue(siguiente);
            }
        }

        // Si quedaron tareas sin ordenar, se esperan unas a otras: hay un ciclo.
        if (orden.Count != faltantes.Count)
        {
            var enCiclo = faltantes.Where(f => f.Value > 0).Select(f => f.Key).Order();
            throw new InvalidOperationException($"Dependencia circular entre: {string.Join(", ", enCiclo)}");
        }

        return orden;
    }
}
```

```csharp
var pasos = new Dictionary<string, string[]>
{
    ["Migrar base"] = ["Respaldar"],
    ["Desplegar API"] = ["Migrar base", "Compilar"],
    ["Pruebas de humo"] = ["Desplegar API"],
    ["Compilar"] = [],
};

var orden = Dependencias.Ordenar(pasos);
Console.WriteLine(string.Join(" → ", orden));
```

```text
Compilar → Respaldar → Migrar base → Desplegar API → Pruebas de humo
```

Y con un ciclo:

```csharp
Dependencias.Ordenar(new Dictionary<string, string[]> { ["A"] = ["B"], ["B"] = ["A"], ["C"] = [] });
```

```text
InvalidOperationException: Dependencia circular entre: A, B
```

**Lo que cuesta.** O(V + E). Compilar y Respaldar quedaron listas al mismo tiempo porque no dependen entre sí; si ejecutas por "niveles" en lugar de una por una, esas tareas pueden correr en paralelo. El mismo algoritmo sirve para ordenar migraciones, la inicialización de servicios o la carga de tablas con llaves foráneas.

## Cómo elegir

| Problema | Algoritmo | Costo | Antes de escribirlo, revisa |
|---|---|---|---|
| Reservaciones que se empalman | Ordenar y recorrer | O(n log n) | La restricción en la base de datos |
| Lecturas repetidas | Caché LRU | O(1) | `IMemoryCache` con `SizeLimit` |
| Ruta más barata | Dijkstra | O((V + E) log V) | Una biblioteca de grafos si el problema crece |
| Nombres parecidos | Levenshtein | O(n · m) | `EDIT_DISTANCE` (SQL Server 2025), `fuzzystrmatch` (PostgreSQL) |
| Límite de peticiones | Cubeta de tokens | O(1) | `System.Threading.RateLimiting` |
| Orden de pasos o migraciones | Orden topológico (Kahn) | O(V + E) | Nada en la plataforma |

Si quieres practicar este tipo de ejercicios, en el [Laboratorio]({{ '/laboratorio/retos/' | relative_url }}) hay retos de C# con casos de prueba que corren en el navegador.
