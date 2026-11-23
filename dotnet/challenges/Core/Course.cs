using System.Diagnostics;
using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Challenges;

/// <summary>
/// Una ejecución del programa de un paso del curso: lo que lee de la entrada y lo que se espera
/// que escriba. Sin ninguna expectativa, solo se comprueba que el programa termine sin error.
/// </summary>
public sealed record CourseRun
{
    /// <summary>Lo que lee <c>Console.ReadLine()</c>, una línea por lectura.</summary>
    public string Stdin { get; init; } = "";

    /// <summary>La salida exacta esperada; se ignoran los saltos de línea del final.</summary>
    public string? Stdout { get; init; }

    /// <summary>Textos que la salida debe contener.</summary>
    public IReadOnlyList<string> Contains { get; init; } = [];

    /// <summary>Una expresión regular que la salida debe cumplir.</summary>
    public string? Matches { get; init; }

    /// <summary>El tipo de excepción que debe lanzar el programa; sin él, no debe lanzar ninguna.</summary>
    public string? Throws { get; init; }
}

/// <summary>
/// Una revisión del código. <see cref="Kind"/> es <c>uses-syntax</c>, <c>avoids-syntax</c>,
/// <c>declares-variable</c>, <c>calls-method</c>, <c>uses-type</c> o <c>avoids-type</c>.
/// </summary>
public sealed record CourseRule(string Kind, string? Name = null, string? Type = null, int? Min = null);

/// <summary>Lo que manda la página para correr un paso del curso en modo programa.</summary>
public sealed record ProgramRequest
{
    public required string Code { get; init; }

    public IReadOnlyList<CourseRun> Runs { get; init; } = [];

    public IReadOnlyList<CourseRule> Rules { get; init; } = [];
}

/// <summary>Si se cumplió una revisión; <see cref="Min"/> se repite para que la terminal diga cuántas veces se pedía.</summary>
public sealed record CourseRuleOutcome(string Kind, string? Name, string? Type, bool Passed, int? Min = null);

/// <summary>Cómo terminó la compilación del programa, antes de correrlo.</summary>
public sealed record ProgramCompile
{
    public bool Compiled { get; init; }

    public double CompileMs { get; init; }

    public IReadOnlyList<CodeDiagnostic> Diagnostics { get; init; } = [];

    public IReadOnlyList<CourseRuleOutcome> Rules { get; init; } = [];
}

/// <summary>Lo que pasó en una ejecución del programa.</summary>
public sealed record RunOutcome
{
    public int Index { get; init; }

    public bool Passed { get; init; }

    /// <summary>Lo que el programa escribió con <c>Console</c>.</summary>
    public string Stdout { get; init; } = "";

    /// <summary>La salida exacta esperada, si el paso la define, para mostrar la diferencia.</summary>
    public string? Expected { get; init; }

    /// <summary>Qué revisiones no se cumplieron: <c>error</c>, <c>throws</c>, <c>stdout</c>, <c>contains</c> o <c>matches</c>.</summary>
    public IReadOnlyList<string> Failed { get; init; } = [];

    public RuntimeError? Error { get; init; }

    public double Ms { get; init; }
}

/// <summary>Lo que la página sabe de una ejecución mientras avanza.</summary>
public interface IProgramReport
{
    void Compiled(ProgramCompile outcome);

    /// <summary>Empieza el código del visitante en la ejecución <paramref name="index"/>.</summary>
    void Code(int index);

    void Run(RunOutcome outcome);
}

/// <summary>Las revisiones sobre el código de los pasos del curso, con el árbol de sintaxis de Roslyn.</summary>
public static class CourseRules
{
    public static CourseRuleOutcome Check(CourseRule rule, CSharpCompilation compilation, SyntaxTree code)
    {
        var passed = rule.Kind switch
        {
            "uses-syntax" => Count(code, rule.Name) >= (rule.Min ?? 1),
            "avoids-syntax" => Count(code, rule.Name) == 0,
            "declares-variable" => DeclaresVariable(compilation, code, rule.Name, rule.Type),
            "calls-method" => CountCalls(compilation, code, rule.Name) >= (rule.Min ?? 1),
            "uses-type" or "avoids-type" => CodeRules.Check(new CodeRule(rule.Kind, rule.Type ?? ""), compilation, code).Passed,
            _ => false,
        };
        return new CourseRuleOutcome(rule.Kind, rule.Name, rule.Type, passed, rule.Min);
    }

    /// <summary>
    /// Si el nombre es una clase de la sintaxis de Roslyn, cuántos nodos (<c>ForStatement</c>), palabras
    /// (<c>ConstKeyword</c>) o comentarios (<c>SingleLineCommentTrivia</c>) de esa clase hay.
    /// </summary>
    private static int Count(SyntaxTree code, string? name)
    {
        if (!Enum.TryParse<SyntaxKind>(name, out var kind))
            return 0;
        var root = code.GetRoot();
        return root.DescendantNodesAndTokens().Count(item => item.IsKind(kind))
            + root.DescendantTrivia().Count(trivia => trivia.IsKind(kind));
    }

    /// <summary>Si declara una variable con ese nombre y, si se pide, ese tipo escrito como en C# (<c>int</c>, <c>string</c>).</summary>
    private static bool DeclaresVariable(CSharpCompilation compilation, SyntaxTree code, string? name, string? type)
    {
        if (name is null)
            return false;
        var model = compilation.GetSemanticModel(code);
        foreach (var declarator in code.GetRoot().DescendantNodes().OfType<VariableDeclaratorSyntax>())
        {
            if (declarator.Identifier.ValueText != name)
                continue;
            if (type is null)
                return true;
            var actual = model.GetDeclaredSymbol(declarator) switch
            {
                ILocalSymbol local => local.Type,
                IFieldSymbol field => field.Type,
                _ => null,
            };
            if (actual is null)
                continue;
            // Con `var`, Roslyn infiere `string?` (con la anotación de nulos): `type: string` también lo acepta.
            var plain = actual.WithNullableAnnotation(NullableAnnotation.None);
            if (
                actual.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat) == type
                || plain.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat) == type
            )
                return true;
        }
        return false;
    }

    /// <summary>Cuántas llamadas hay a un método, por ejemplo <c>Console.WriteLine</c>.</summary>
    private static int CountCalls(CSharpCompilation compilation, SyntaxTree code, string? name)
    {
        if (name is null)
            return 0;
        var model = compilation.GetSemanticModel(code);
        return code.GetRoot()
            .DescendantNodes()
            .OfType<InvocationExpressionSyntax>()
            .Count(invocation =>
            {
                if (model.GetSymbolInfo(invocation).Symbol is not IMethodSymbol method)
                    return false;
                var full = $"{method.ContainingType.ToDisplayString()}.{method.Name}";
                return full == name || full.EndsWith("." + name, StringComparison.Ordinal);
            });
    }
}

/// <summary>
/// Corre el programa de consola de un paso del curso con una entrada simulada por ejecución y
/// revisa lo que escribió. Lo usan el motor del navegador y las pruebas de las lecciones.
/// </summary>
public static class CourseRunner
{
    private const BindingFlags Members = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;

    public static async Task Run(ProgramRequest request, IProgramReport report)
    {
        var compiled = CodeCompiler.Compile(request.Code, kind: OutputKind.ConsoleApplication);
        var rules = new List<CourseRuleOutcome>();
        if (compiled.Success)
            rules.AddRange(request.Rules.Select(rule => CourseRules.Check(rule, compiled.Compilation, compiled.Code)));
        report.Compiled(
            new ProgramCompile
            {
                Compiled = compiled.Success,
                CompileMs = compiled.Ms,
                Diagnostics = compiled.Diagnostics,
                Rules = rules,
            }
        );
        if (!compiled.Success)
            return;

        IReadOnlyList<CourseRun> runs = request.Runs.Count == 0 ? [new CourseRun()] : request.Runs;
        for (var index = 0; index < runs.Count; index++)
        {
            // Cada ejecución parte de un ensamblado nuevo: los campos estáticos no guardan lo de la anterior.
            var program = index == 0 ? compiled : CodeCompiler.Compile(request.Code, kind: OutputKind.ConsoleApplication);
            var current = index;
            report.Run(await Execute(current, runs[current], program, () => report.Code(current)));
        }
    }

    private static async Task<RunOutcome> Execute(int index, CourseRun run, CompiledCode program, Action onCode)
    {
        var entry = program.Assembly?.EntryPoint ?? throw new InvalidOperationException("El programa no tiene punto de entrada.");
        // Con await, el compilador envuelve el Main asíncrono en uno que se bloquea esperándolo, y en el
        // navegador no se puede bloquear: se espera el asíncrono directamente (igual que en el playground).
        var main =
            entry
                .DeclaringType?.GetMethods(Members)
                .FirstOrDefault(method =>
                    method.Name is "<Main>$" or "Main" && typeof(Task).IsAssignableFrom(method.ReturnType)
                ) ?? entry;
        object?[] args = main.GetParameters().Length == 0 ? [] : [Array.Empty<string>()];

        var output = new StringWriter();
        var (previousOut, previousError, previousIn) = (Console.Out, Console.Error, CurrentIn());
        Console.SetOut(output);
        Console.SetError(output);
        Console.SetIn(new StringReader(run.Stdin));
        RuntimeError? error = null;
        onCode();
        var watch = Stopwatch.StartNew();
        try
        {
            var result = main.Invoke(null, BindingFlags.DoNotWrapExceptions, binder: null, args, culture: null);
            if (result is Task task)
                await task.ConfigureAwait(false);
        }
        catch (Exception thrown)
        {
            error = Errors.Describe(
                thrown is TargetInvocationException { InnerException: { } inner } ? inner : thrown,
                program.Assembly
            );
        }
        finally
        {
            watch.Stop();
            Console.SetOut(previousOut);
            Console.SetError(previousError);
            Console.SetIn(previousIn ?? TextReader.Null);
        }

        var text = output.ToString();
        var failed = Evaluate(run, text, error);
        return new RunOutcome
        {
            Index = index,
            Passed = failed.Count == 0,
            Stdout = text.Length <= CaseRunner.MaxConsole ? text : string.Concat(text.AsSpan(0, CaseRunner.MaxConsole), "\n…"),
            Expected = run.Stdout,
            Failed = failed,
            Error = error,
            Ms = watch.Elapsed.TotalMilliseconds,
        };
    }

    /// <summary>
    /// La entrada que había antes. En el navegador (WebAssembly) no hay entrada estándar y leer
    /// <c>Console.In</c> lanza <see cref="PlatformNotSupportedException"/>: ahí no hay nada que restaurar.
    /// </summary>
    private static TextReader? CurrentIn()
    {
        try
        {
            return Console.In;
        }
        catch (PlatformNotSupportedException)
        {
            return null;
        }
    }

    private static List<string> Evaluate(CourseRun run, string text, RuntimeError? error)
    {
        var failed = new List<string>();
        if (run.Throws is null)
        {
            if (error is not null)
                failed.Add("error");
        }
        else if (error is null || error.Type != run.Throws)
        {
            failed.Add("throws");
        }
        if (run.Stdout is not null && Normalize(text) != Normalize(run.Stdout))
            failed.Add("stdout");
        if (run.Contains.Any(part => !text.Contains(part, StringComparison.Ordinal)))
            failed.Add("contains");
        if (run.Matches is not null && !Matches(text, run.Matches))
            failed.Add("matches");
        return failed;
    }

    /// <summary>Saltos de línea de Windows como de Unix, y sin saltos al final.</summary>
    private static string Normalize(string text) => text.Replace("\r\n", "\n").TrimEnd('\n');

    private static bool Matches(string text, string pattern)
    {
        try
        {
            return Regex.IsMatch(text, pattern, RegexOptions.Multiline, TimeSpan.FromSeconds(1));
        }
        catch (Exception error) when (error is ArgumentException or RegexMatchTimeoutException)
        {
            return false;
        }
    }
}
