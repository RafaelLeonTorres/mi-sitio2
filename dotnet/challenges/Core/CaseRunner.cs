using System.Collections;
using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using System.Text.Json;

namespace Challenges;

/// <summary>Llama al método del reto con los argumentos de un caso y compara lo que devuelve.</summary>
public static class CaseRunner
{
    private const BindingFlags Members =
        BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance;

    /// <summary>Lo más que se guarda de lo que escribe el código con <c>Console</c>.</summary>
    public const int MaxConsole = 10_000;

    /// <summary>El método que se llama en los casos, o por qué no se encontró.</summary>
    public static (MethodInfo? Method, Problem? Problem) FindEntry(Assembly assembly, EntryPoint entry, int arity)
    {
        Type[] types;
        try
        {
            types = assembly.GetTypes();
        }
        catch (ReflectionTypeLoadException error)
        {
            types = [.. error.Types.OfType<Type>()];
        }
        var type =
            types.FirstOrDefault(candidate => candidate.FullName == entry.Type)
            ?? types.FirstOrDefault(candidate => candidate.Name == entry.Type && !candidate.IsNested)
            ?? types.FirstOrDefault(candidate => candidate.Name == entry.Type);
        if (type is null)
            return (null, Problem.Of("missing-type", ("type", entry.Type)));

        var methods = type.GetMethods(Members).Where(method => method.Name == entry.Method).ToList();
        if (methods.Count == 0)
            return (null, Problem.Of("missing-method", ("type", entry.Type), ("method", entry.Method)));
        var found = methods.FirstOrDefault(method => method.GetParameters().Length == arity);
        if (found is null)
        {
            var count = arity.ToString(CultureInfo.InvariantCulture);
            return (null, Problem.Of("wrong-arity", ("type", entry.Type), ("method", entry.Method), ("count", count)));
        }
        if (found.ContainsGenericParameters)
            return (null, Problem.Of("generic-method", ("method", entry.Method)));
        return (found, null);
    }

    public static async Task<CaseOutcome> Run(MethodInfo method, CaseInput input, string compare)
    {
        var parameters = method.GetParameters();
        var args = new object?[parameters.Length];
        for (var i = 0; i < parameters.Length; i++)
        {
            var parameter = parameters[i];
            var name = parameter.Name ?? "";
            if (parameter.ParameterType.IsByRef)
                return Failed(input, Problem.Of("by-ref", ("parameter", name)));
            if (i >= input.Args.Count)
                return Failed(input, Problem.Of("missing-argument", ("parameter", name)));
            try
            {
                args[i] = input.Args[i].Deserialize(parameter.ParameterType, Json.Values);
            }
            catch (Exception error) when (error is JsonException or NotSupportedException or InvalidOperationException)
            {
                var type = TypeNames.Show(parameter.ParameterType);
                return Failed(input, Problem.Of("bad-argument", ("parameter", name), ("type", type)));
            }
        }

        var output = new StringWriter();
        var (previousOut, previousError) = (Console.Out, Console.Error);
        Console.SetOut(output);
        Console.SetError(output);
        var watch = Stopwatch.StartNew();
        object? value = null;
        Exception? thrown = null;
        JsonElement? actual = null;
        Problem? problem = null;
        try
        {
            try
            {
                var target = method.IsStatic ? null : Activator.CreateInstance(method.DeclaringType!, nonPublic: true);
                value = method.Invoke(target, BindingFlags.DoNotWrapExceptions, binder: null, args, culture: null);
                value = await Unwrap(value);
                // Las consultas perezosas corren aquí, donde sus excepciones son del visitante.
                value = Materialize(value);
            }
            catch (TargetInvocationException error) when (error.InnerException is not null)
            {
                thrown = error.InnerException;
            }
            catch (Exception error)
            {
                thrown = error;
            }

            if (thrown is null && !ReturnsNothing(method))
            {
                try
                {
                    actual = JsonSerializer.SerializeToElement(value, value?.GetType() ?? typeof(object), Json.Values);
                }
                catch (Exception error) when (error is JsonException or NotSupportedException)
                {
                    var type = TypeNames.Show(value?.GetType() ?? typeof(object));
                    problem = Problem.Of("cannot-serialize", ("type", type));
                }
                catch (Exception error)
                {
                    thrown = error;
                }
            }
        }
        finally
        {
            watch.Stop();
            Console.SetOut(previousOut);
            Console.SetError(previousError);
        }

        bool passed;
        if (problem is not null)
            passed = false;
        else if (thrown is not null)
            passed = input.Throws is { } expected && Matches(thrown, expected);
        else
            passed =
                input.Throws is null
                && input.Expected.ValueKind != JsonValueKind.Undefined
                && JsonCompare.Equal(input.Expected, actual ?? Json.Null, compare);

        return new CaseOutcome
        {
            Index = input.Index,
            Passed = passed,
            Actual = thrown is null && problem is null ? actual : null,
            Error = thrown is null ? null : Errors.Describe(thrown, method.Module.Assembly),
            Console = Trim(output.ToString()),
            Ms = watch.Elapsed.TotalMilliseconds,
            Problem = problem,
        };
    }

    private static CaseOutcome Failed(CaseInput input, Problem problem) =>
        new()
        {
            Index = input.Index,
            Passed = false,
            Problem = problem,
        };

    /// <summary>Espera el <c>Task</c> o el <c>ValueTask</c> que devuelve un método asíncrono.</summary>
    private static async Task<object?> Unwrap(object? value)
    {
        if (value is Task task)
        {
            await task.ConfigureAwait(false);
            var type = task.GetType();
            while (type is not null && !(type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Task<>)))
                type = type.BaseType;
            return type?.GetProperty(nameof(Task<int>.Result))?.GetValue(task);
        }
        if (value is ValueTask valueTask)
        {
            await valueTask.ConfigureAwait(false);
            return null;
        }
        if (value?.GetType() is { IsGenericType: true } generic && generic.GetGenericTypeDefinition() == typeof(ValueTask<>))
        {
            var asTask = (Task)generic.GetMethod(nameof(ValueTask<int>.AsTask))!.Invoke(value, null)!;
            return await Unwrap(asTask).ConfigureAwait(false);
        }
        return value;
    }

    /// <summary>Recorre una secuencia que no es una colección, como el resultado de <c>Select</c>.</summary>
    private static object? Materialize(object? value)
    {
        if (value is null or string or ICollection || value is not IEnumerable sequence)
            return value;
        var items = new List<object?>();
        foreach (var item in sequence)
            items.Add(Materialize(item));
        return items;
    }

    private static bool ReturnsNothing(MethodInfo method) =>
        method.ReturnType == typeof(void) || method.ReturnType == typeof(Task) || method.ReturnType == typeof(ValueTask);

    /// <summary>Si la excepción es del tipo esperado o de uno que hereda de él.</summary>
    private static bool Matches(Exception error, string expected)
    {
        for (var type = error.GetType(); type is not null; type = type.BaseType)
        {
            if (type.Name == expected || type.FullName == expected)
                return true;
        }
        return false;
    }

    private static string Trim(string text) =>
        text.Length <= MaxConsole ? text : string.Concat(text.AsSpan(0, MaxConsole), "\n…");
}
