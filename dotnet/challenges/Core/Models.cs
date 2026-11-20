using System.Text.Json;

namespace Challenges;

/// <summary>Lo que manda la página para correr un reto: el código del visitante y los casos.</summary>
public sealed record RunRequest
{
    /// <summary>El código del visitante.</summary>
    public required string Code { get; init; }

    /// <summary>Los tipos que da el reto, como un record de empleado; se compilan junto al código.</summary>
    public string? Prelude { get; init; }

    /// <summary>El código que revisa el reto: llama al del visitante y devuelve algo que comparar.</summary>
    public string? Harness { get; init; }

    /// <summary>El método que se llama en cada caso.</summary>
    public required EntryPoint Entry { get; init; }

    /// <summary>Cómo se compara el resultado: <c>exact</c> o <c>unordered</c> (una lista sin orden).</summary>
    public string Compare { get; init; } = "exact";

    public IReadOnlyList<CodeRule> Rules { get; init; } = [];

    public IReadOnlyList<CaseInput> Cases { get; init; } = [];
}

/// <summary>El tipo y el método que se llaman; el tipo puede ser del visitante o del código que revisa.</summary>
public sealed record EntryPoint(string Type, string Method);

/// <summary>
/// Una revisión del código que el resultado no alcanza a ver, como que un Singleton use
/// <c>Lazy&lt;T&gt;</c>. <see cref="Kind"/> es <c>uses-type</c>, <c>avoids-type</c> o
/// <c>private-constructor</c>; <see cref="Type"/>, el nombre de metadatos del tipo de .NET
/// (<c>System.Lazy`1</c>) o el nombre de un tipo del visitante.
/// </summary>
public sealed record CodeRule(string Kind, string Type);

public sealed record CaseInput
{
    public int Index { get; init; }

    /// <summary>Los argumentos en JSON; se convierten a los tipos de los parámetros.</summary>
    public IReadOnlyList<JsonElement> Args { get; init; } = [];

    /// <summary>El resultado esperado; <c>Undefined</c> si el caso espera una excepción.</summary>
    public JsonElement Expected { get; init; }

    /// <summary>El tipo de excepción que debe lanzar el método, si el caso espera una.</summary>
    public string? Throws { get; init; }
}

/// <summary>Cómo terminó la compilación, antes de correr los casos.</summary>
public sealed record CompileOutcome
{
    public bool Compiled { get; init; }

    public double CompileMs { get; init; }

    public IReadOnlyList<CodeDiagnostic> Diagnostics { get; init; } = [];

    public IReadOnlyList<RuleOutcome> Rules { get; init; } = [];

    /// <summary>Lo que impide correr los casos aunque compiló, como que falte el método.</summary>
    public Problem? Entry { get; init; }
}

/// <summary>
/// Un error del compilador. <see cref="Source"/> dice dónde está: <c>code</c> (el código del
/// visitante, con la línea que ve en el editor), <c>prelude</c>, <c>harness</c> o vacío.
/// </summary>
public sealed record CodeDiagnostic(
    string Id,
    string Message,
    string Source,
    int Line,
    int Column,
    int EndLine,
    int EndColumn
);

public sealed record RuleOutcome(string Kind, string Type, bool Passed);

/// <summary>Un problema que no es del compilador ni del código: una clave para su texto y sus datos.</summary>
public sealed record Problem(string Key, IReadOnlyDictionary<string, string> Values)
{
    public static Problem Of(string key, params (string Name, string Value)[] values) =>
        new(key, values.ToDictionary(value => value.Name, value => value.Value));
}

public sealed record CaseOutcome
{
    public int Index { get; init; }

    public bool Passed { get; init; }

    /// <summary>Lo que devolvió el código, en JSON; falta si lanzó una excepción.</summary>
    public JsonElement? Actual { get; init; }

    public RuntimeError? Error { get; init; }

    /// <summary>Lo que el código escribió con <c>Console</c>.</summary>
    public string Console { get; init; } = "";

    public double Ms { get; init; }

    /// <summary>Lo que impidió correr el caso, como un argumento que no cabe en el parámetro.</summary>
    public Problem? Problem { get; init; }
}

/// <summary>
/// Una excepción del código del visitante: su tipo, su mensaje, el método donde ocurrió
/// (<c>Solution.SecondLargest</c>) y la línea, si se conoce (fuera del navegador).
/// </summary>
public sealed record RuntimeError(string Type, string Message, int? Line, string? Member);

/// <summary>Lo que pasó en el playground: la compilación, lo que escribió y si terminó con error.</summary>
public sealed record PlaygroundOutcome
{
    public bool Compiled { get; init; }

    public double CompileMs { get; init; }

    public IReadOnlyList<CodeDiagnostic> Diagnostics { get; init; } = [];

    public string Console { get; init; } = "";

    public RuntimeError? Error { get; init; }

    public double Ms { get; init; }
}
