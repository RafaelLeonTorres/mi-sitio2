using System.Text.Json.Nodes;

namespace Challenges.Tests;

/// <summary>
/// Lee las lecciones del curso de <c>_data/course/</c>, los mismos archivos que usa el sitio, y arma la
/// petición que la página le manda al motor para cada ejercicio.
/// </summary>
public static class CourseData
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
