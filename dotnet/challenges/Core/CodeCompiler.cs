using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Emit;
using Microsoft.CodeAnalysis.Text;

namespace Challenges;

/// <summary>Un programa compilado y cargado, o los errores que lo impidieron.</summary>
public sealed record CompiledCode(
    Assembly? Assembly,
    CSharpCompilation Compilation,
    SyntaxTree Code,
    IReadOnlyList<CodeDiagnostic> Diagnostics,
    double Ms
)
{
    public bool Success => Assembly is not null;
}

/// <summary>
/// Compila el código del visitante con Roslyn, en memoria, junto con lo que trae el reto. Cada parte
/// es su propio árbol de sintaxis, así que la línea de un error en el código del visitante es la
/// misma que ve en el editor.
/// </summary>
public static class CodeCompiler
{
    /// <summary>Los nombres de cada parte, que aparecen como <see cref="CodeDiagnostic.Source"/>.</summary>
    public const string CodeSource = "code";
    public const string PreludeSource = "prelude";
    public const string HarnessSource = "harness";

    /// <summary>Los mismos <c>using</c> implícitos de un proyecto de consola de .NET.</summary>
    private const string Usings = """
        global using System;
        global using System.Collections.Generic;
        global using System.IO;
        global using System.Linq;
        global using System.Text;
        global using System.Threading;
        global using System.Threading.Tasks;
        """;

    private const int MaxDiagnostics = 20;

    private static readonly CSharpParseOptions ParseOptions = new(LanguageVersion.Latest);

    private static int counter;

    public static CompiledCode Compile(
        string code,
        string? prelude = null,
        string? harness = null,
        OutputKind kind = OutputKind.DynamicallyLinkedLibrary
    )
    {
        var watch = Stopwatch.StartNew();
        var codeTree = Parse(code, CodeSource);
        var trees = new List<SyntaxTree> { Parse(Usings, "usings"), codeTree };
        if (!string.IsNullOrWhiteSpace(prelude))
            trees.Add(Parse(prelude, PreludeSource));
        if (!string.IsNullOrWhiteSpace(harness))
            trees.Add(Parse(harness, HarnessSource));

        var options = new CSharpCompilationOptions(
            kind,
            optimizationLevel: OptimizationLevel.Release,
            allowUnsafe: false,
            concurrentBuild: false,
            deterministic: true,
            nullableContextOptions: NullableContextOptions.Enable
        );
        // Cada compilación lleva su propio nombre: dos ensamblados con el mismo no se pueden cargar.
        var name = $"Visitante{Interlocked.Increment(ref counter)}";
        var compilation = CSharpCompilation.Create(name, trees, References.All, options);

        // En el navegador no hay hilos: al escribir el PDB, Roslyn calcula el checksum del código con
        // Task.Run y lo espera bloqueando, y ahí eso lanza PlatformNotSupportedException. Sin PDB no
        // hay línea en las excepciones, pero en el navegador .NET tampoco la da: se usa el método.
        var symbols = !OperatingSystem.IsBrowser();
        using var pe = new MemoryStream();
        using var pdb = new MemoryStream();
        var result = symbols
            ? compilation.Emit(pe, pdb, options: new EmitOptions(debugInformationFormat: DebugInformationFormat.PortablePdb))
            : compilation.Emit(pe);
        var diagnostics = result
            .Diagnostics.Where(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error)
            .OrderBy(diagnostic => Order(diagnostic.Location.SourceTree?.FilePath))
            .ThenBy(diagnostic => diagnostic.Location.SourceSpan.Start)
            .Take(MaxDiagnostics)
            .Select(Describe)
            .ToList();

        Assembly? assembly = null;
        if (result.Success)
            assembly = symbols ? Assembly.Load(pe.ToArray(), pdb.ToArray()) : Assembly.Load(pe.ToArray());
        watch.Stop();
        return new CompiledCode(assembly, compilation, codeTree, diagnostics, watch.Elapsed.TotalMilliseconds);
    }

    /// <summary>
    /// Compila un programa mínimo. Roslyn tarda en su primera compilación, sobre todo en el
    /// navegador; así la paga mientras el visitante lee el enunciado.
    /// </summary>
    public static double Warm()
    {
        var compiled = Compile(
            """
            public static class Calentar
            {
                public static int Suma(int[] numeros) => numeros.Where(n => n > 0).Sum();
            }
            """
        );
        return compiled.Ms;
    }

    /// <summary>Con su codificación: sin ella, Roslyn no puede escribir el PDB.</summary>
    private static SyntaxTree Parse(string text, string path) =>
        CSharpSyntaxTree.ParseText(SourceText.From(text, Encoding.UTF8), ParseOptions, path);

    /// <summary>Primero los errores del visitante, después los del reto.</summary>
    private static int Order(string? source) =>
        source switch
        {
            CodeSource => 0,
            PreludeSource => 1,
            HarnessSource => 2,
            _ => 3,
        };

    private static CodeDiagnostic Describe(Diagnostic diagnostic)
    {
        var span = diagnostic.Location.GetLineSpan();
        var source = diagnostic.Location.SourceTree?.FilePath ?? "";
        return new CodeDiagnostic(
            diagnostic.Id,
            diagnostic.GetMessage(CultureInfo.InvariantCulture),
            source,
            span.StartLinePosition.Line + 1,
            span.StartLinePosition.Character + 1,
            span.EndLinePosition.Line + 1,
            span.EndLinePosition.Character + 1
        );
    }
}
