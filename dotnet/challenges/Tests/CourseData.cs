using System.Text.Json.Nodes;

namespace Challenges.Tests;

/// <summary>
/// Lee las lecciones del curso de <c>_data/course/</c>, los mismos archivos que usa el sitio, y arma la
/// petición que la página le manda al motor para cada ejercicio.
/// </summary>
public static partial class CourseData
{
    private static string Folder => Path.Combine(ChallengeData.Root, "_data", "course");

    /// <summary>Las lecciones del temario, en orden: el id del módulo y el de la lección.</summary>
    public static IReadOnlyList<(string Module, string Lesson)> Lessons()
    {
        var catalog = ChallengeData.Load(Path.Combine(Folder, "catalog.yml"));
        return
        [
            .. catalog["csharp"]!["modules"]!
                .AsArray()
                .SelectMany(module =>
                    module!["lessons"]!.AsArray().Select(lesson => (module["id"]!.GetValue<string>(), lesson!.GetValue<string>()))
                ),
        ];
    }

    /// <summary>Todos los pasos de las lecciones, con su tipo: <c>read</c>, <c>exercise</c> o <c>choice</c>.</summary>
    public static IReadOnlyList<(string Module, string Lesson, string Step, string Kind)> Steps() =>
        [
            .. Lessons()
                .SelectMany(item =>
                    Lesson(item.Module, item.Lesson)["shared"]!["steps"]!
                        .AsArray()
                        .Select(step => (item.Module, item.Lesson, step!["id"]!.GetValue<string>(), step["kind"]!.GetValue<string>()))
                ),
        ];

    public static JsonNode Lesson(string module, string lesson) =>
        ChallengeData.Load(Path.Combine(Folder, "csharp", module, $"{lesson}.yml"));

    public static JsonNode Step(string module, string lesson, string id) =>
        Lesson(module, lesson)["shared"]!["steps"]!.AsArray().Single(step => step!["id"]!.GetValue<string>() == id)!;

    /// <summary>
    /// El código inicial de un ejercicio, en cada forma en que lo ve el alumno: el compartido
    /// (<c>shared</c>) y el propio de cada idioma, si el idioma lo reemplaza.
    /// </summary>
    public static IReadOnlyList<(string Source, string Code)> Starters(string module, string lesson, string id)
    {
        var data = Lesson(module, lesson);
        var shared = data["shared"]!["steps"]!.AsArray().Single(step => step!["id"]!.GetValue<string>() == id)!;
        var starters = new List<(string, string)> { ("shared", shared["starter"]!.GetValue<string>()) };
        foreach (var language in new[] { "es", "en" })
        {
            if (data[language]?["steps"]?[id]?["starter"] is { } own)
                starters.Add((language, own.GetValue<string>()));
        }
        return starters;
    }

    /// <summary>Los errores que explica errors.yml: códigos del compilador y nombres de excepciones.</summary>
    public static IReadOnlySet<string> ExplainedErrors() =>
        ((JsonObject)ChallengeData.Load(Path.Combine(Folder, "csharp", "errors.yml"))).Select(pair => pair.Key).ToHashSet();

    /// <summary>Un ejemplo del texto: el programa, la entrada que se le da (si trae) y lo que debe imprimir.</summary>
    public sealed record Example(string Step, string Language, string Code, string Stdin, string Output);

    /// <summary>
    /// Los ejemplos del texto de una lección, en cada idioma. Un bloque <c>```csharp</c> seguido de su
    /// salida en un bloque <c>```text</c> es un programa que se corre y debe imprimir eso; entre los dos
    /// puede ir la entrada, en un bloque <c>```input</c>. Un bloque <c>```csharp</c> sin salida es solo
    /// un fragmento y no se corre.
    /// </summary>
    public static IReadOnlyList<Example> Examples(string module, string lesson)
    {
        var data = Lesson(module, lesson);
        var examples = new List<Example>();
        foreach (var language in new[] { "es", "en" })
        {
            if (data[language]?["steps"] is not JsonObject steps)
                continue;
            foreach (var (step, texts) in steps)
            {
                foreach (var text in Strings(texts))
                {
                    foreach (System.Text.RegularExpressions.Match match in ExampleBlocks().Matches(text))
                    {
                        examples.Add(
                            new Example(step, language, match.Groups["code"].Value, match.Groups["input"].Value, match.Groups["output"].Value)
                        );
                    }
                }
            }
        }
        return examples;
    }

    /// <summary>
    /// Cuántos bloques de salida (<c>```text</c>) y de entrada (<c>```input</c>) trae el texto de una
    /// lección en un idioma. Cada uno debe ser parte de un ejemplo que <see cref="Examples"/> encuentre.
    /// </summary>
    public static (int Output, int Input) FenceCounts(string module, string lesson, string language)
    {
        var all = string.Concat(Strings(Lesson(module, lesson)[language]?["steps"]).Select(text => text + "\n"));
        return (
            System.Text.RegularExpressions.Regex.Count(all, "^```text", System.Text.RegularExpressions.RegexOptions.Multiline),
            System.Text.RegularExpressions.Regex.Count(all, "^```input", System.Text.RegularExpressions.RegexOptions.Multiline)
        );
    }

    // Dentro de un bloque no puede haber ``` (el punto "templado"): así un bloque sin salida no se
    // junta con el siguiente.
    [System.Text.RegularExpressions.GeneratedRegex(
        @"```csharp\r?\n(?<code>(?:(?!```).)*)```[ \t]*\r?\n\s*(?:```input\r?\n(?<input>(?:(?!```).)*)```[ \t]*\r?\n\s*)?```text\r?\n(?<output>(?:(?!```).)*)```",
        System.Text.RegularExpressions.RegexOptions.Singleline
    )]
    private static partial System.Text.RegularExpressions.Regex ExampleBlocks();

    /// <summary>Todos los textos de un nodo, para buscar ejemplos en cualquiera de sus campos.</summary>
    private static IEnumerable<string> Strings(JsonNode? node) =>
        node switch
        {
            JsonValue value when value.TryGetValue<string>(out var text) => [text],
            JsonObject obj => obj.SelectMany(pair => Strings(pair.Value)),
            JsonArray array => array.SelectMany(Strings),
            _ => [],
        };

    /// <summary>La petición para correr <paramref name="code"/> con las ejecuciones y las reglas del paso.</summary>
    public static ProgramRequest Request(JsonNode step, string code) =>
        new()
        {
            Code = code,
            Runs = [.. (step["runs"]?.AsArray() ?? []).Select(run => Run(run!.AsObject()))],
            Rules = [.. (step["rules"]?.AsArray() ?? []).Select(rule => Rule(rule!.AsObject()))],
        };

    private static CourseRun Run(JsonObject run) =>
        new()
        {
            Stdin = run["stdin"]?.GetValue<string>() ?? "",
            Stdout = run["stdout"]?.GetValue<string>(),
            Contains = [.. (run["contains"]?.AsArray() ?? []).Select(part => part!.GetValue<string>())],
            Matches = run["matches"]?.GetValue<string>(),
            Throws = run["throws"]?.GetValue<string>(),
        };

    private static CourseRule Rule(JsonObject rule) =>
        new(
            rule["kind"]!.GetValue<string>(),
            rule["name"]?.GetValue<string>(),
            rule["type"]?.GetValue<string>(),
            // YAML lo lee como número entero largo.
            rule["min"] is { } min ? (int)min.GetValue<long>() : null
        );
}
