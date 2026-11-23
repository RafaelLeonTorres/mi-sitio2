using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using YamlDotNet.Core;
using YamlDotNet.RepresentationModel;

namespace Challenges.Tests;

/// <summary>
/// Lee los retos de C# de <c>_data/labs/challenges/</c>, los mismos archivos que usa el sitio, y arma
/// la petición que la página le manda al motor.
/// </summary>
public static partial class ChallengeData
{
    public static string Root { get; } = FindRoot();

    private static string Folder => Path.Combine(Root, "_data", "labs", "challenges");

    /// <summary>Los ids de los retos de C#, en orden.</summary>
    public static IReadOnlyList<string> CsharpIds() =>
        [
            .. Directory
                .GetFiles(Folder, "*.yml")
                .Where(path => Load(path)["shared"]?["language"]?.GetValue<string>() == "csharp")
                .Select(path => Path.GetFileNameWithoutExtension(path))
                .Order(StringComparer.Ordinal),
        ];

    public static JsonNode Challenge(string id) => Load(Path.Combine(Folder, $"{id}.yml"));

    /// <summary>La petición para correr <paramref name="code"/> contra todos los casos del reto.</summary>
    public static RunRequest Request(string id, string code)
    {
        var shared = Challenge(id)["shared"] ?? throw new InvalidDataException($"{id}: falta shared.");
        var entry = shared["entry"] ?? throw new InvalidDataException($"{id}: falta entry.");
        return new RunRequest
        {
            Code = code,
            Prelude = shared["prelude"]?.GetValue<string>(),
            Harness = shared["harness"]?.GetValue<string>(),
            Entry = new EntryPoint(entry["type"]!.GetValue<string>(), entry["method"]!.GetValue<string>()),
            Compare = shared["compare"]?.GetValue<string>() ?? "exact",
            Rules =
            [
                .. (shared["rules"]?.AsArray() ?? new JsonArray())
                    .Select(rule => new CodeRule(rule!["kind"]!.GetValue<string>(), rule["type"]!.GetValue<string>())),
            ],
            Cases = [.. (shared["cases"]?.AsArray() ?? new JsonArray()).Select((item, index) => Case(item!.AsObject(), index))],
        };
    }

    public static string Code(string id, string field) =>
        Challenge(id)["shared"]?[field]?.GetValue<string>() ?? throw new InvalidDataException($"{id}: falta {field}.");

    private static CaseInput Case(JsonObject item, int index) =>
        new()
        {
            Index = index,
            Args = [.. (item["args"]?.AsArray() ?? new JsonArray()).Select(Element)],
            Expected = item.ContainsKey("expected") ? Element(item["expected"]) : default,
            Throws = item["throws"]?.GetValue<string>(),
        };

    private static JsonElement Element(JsonNode? node) => node is null ? Json.Null : Json.Parse(node.ToJsonString());

    private static string FindRoot()
    {
        for (var folder = new DirectoryInfo(AppContext.BaseDirectory); folder is not null; folder = folder.Parent)
        {
            if (Directory.Exists(Path.Combine(folder.FullName, "_data", "labs", "challenges")))
                return folder.FullName;
        }
        throw new DirectoryNotFoundException("No encontré _data/labs/challenges en ninguna carpeta superior.");
    }

    /// <summary>Un archivo YAML como JSON; también lo usa <see cref="CourseData"/>.</summary>
    internal static JsonNode Load(string path)
    {
        var stream = new YamlStream();
        using (var reader = File.OpenText(path))
            stream.Load(reader);
        return Convert(stream.Documents[0].RootNode) ?? throw new InvalidDataException($"{path} está vacío.");
    }

    /// <summary>
    /// YAML a JSON con el esquema básico de YAML 1.2, el mismo que usa el paquete yaml de las pruebas
    /// del sitio: sin comillas, <c>7</c> es un número y <c>true</c> un booleano; con comillas, texto.
    /// </summary>
    private static JsonNode? Convert(YamlNode node) =>
        node switch
        {
            YamlMappingNode map => new JsonObject(
                map.Children.Select(pair => KeyValuePair.Create(((YamlScalarNode)pair.Key).Value ?? "", Convert(pair.Value)))
            ),
            YamlSequenceNode sequence => new JsonArray(sequence.Children.Select(Convert).ToArray()),
            YamlScalarNode scalar => Scalar(scalar),
            _ => null,
        };

    private static JsonNode? Scalar(YamlScalarNode scalar)
    {
        var text = scalar.Value ?? "";
        if (scalar.Style != ScalarStyle.Plain)
            return JsonValue.Create(text);
        if (text is "" or "~" or "null" or "Null" or "NULL")
            return null;
        if (text is "true" or "True" or "TRUE")
            return JsonValue.Create(true);
        if (text is "false" or "False" or "FALSE")
            return JsonValue.Create(false);
        if (Integer().IsMatch(text) && long.TryParse(text, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var whole))
            return JsonValue.Create(whole);
        if (Float().IsMatch(text) && double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var number))
            return JsonValue.Create(number);
        return JsonValue.Create(text);
    }

    [GeneratedRegex(@"^[-+]?[0-9]+$")]
    private static partial Regex Integer();

    [GeneratedRegex(@"^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$")]
    private static partial Regex Float();
}
