using System.Diagnostics;
using System.Reflection;
using Microsoft.CodeAnalysis;

namespace Challenges;

/// <summary>Corre un programa de consola libre, con instrucciones de nivel superior o un <c>Main</c>.</summary>
public static class Playground
{
    private const BindingFlags Members = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;

    /// <param name="onCode">Se llama justo antes del código del visitante: desde ahí corre el tiempo límite.</param>
    public static async Task<PlaygroundOutcome> Run(string code, Action onCode)
    {
        var compiled = CodeCompiler.Compile(code, kind: OutputKind.ConsoleApplication);
        if (compiled.Assembly?.EntryPoint is not { } entry)
        {
            return new PlaygroundOutcome
            {
                Compiled = false,
                CompileMs = compiled.Ms,
                Diagnostics = compiled.Diagnostics,
            };
        }

        // Con await, el compilador envuelve el Main asíncrono en uno que se bloquea esperándolo, y
        // en el navegador no se puede bloquear: se espera el asíncrono directamente.
        var main =
            entry
                .DeclaringType?.GetMethods(Members)
                .FirstOrDefault(method =>
                    method.Name is "<Main>$" or "Main" && typeof(Task).IsAssignableFrom(method.ReturnType)
                ) ?? entry;
        object?[] args = main.GetParameters().Length == 0 ? [] : [Array.Empty<string>()];

        var output = new StringWriter();
        var (previousOut, previousError) = (Console.Out, Console.Error);
        Console.SetOut(output);
        Console.SetError(output);
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
                compiled.Assembly
            );
        }
        finally
        {
            watch.Stop();
            Console.SetOut(previousOut);
            Console.SetError(previousError);
        }

        var text = output.ToString();
        return new PlaygroundOutcome
        {
            Compiled = true,
            CompileMs = compiled.Ms,
            Console = text.Length <= CaseRunner.MaxConsole ? text : string.Concat(text.AsSpan(0, CaseRunner.MaxConsole), "\n…"),
            Error = error,
            Ms = watch.Elapsed.TotalMilliseconds,
        };
    }
}
