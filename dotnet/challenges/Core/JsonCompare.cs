using System.Text.Json;

namespace Challenges;

/// <summary>
/// Compara lo esperado con lo obtenido. Los números valen igual si representan el mismo valor
/// (<c>2.50</c> y <c>2.5</c>), con una tolerancia mínima para los <c>double</c>; los objetos se
/// comparan por nombre de propiedad, sin importar el orden.
/// </summary>
public static class JsonCompare
{
    public static bool Equal(JsonElement expected, JsonElement actual, string mode) =>
        mode == "unordered" ? SameItems(expected, actual) : Same(expected, actual);

    private static bool Same(JsonElement expected, JsonElement actual)
    {
        if (expected.ValueKind == JsonValueKind.Number && actual.ValueKind == JsonValueKind.Number)
            return SameNumber(expected, actual);
        if (expected.ValueKind != actual.ValueKind)
            return false;
        switch (expected.ValueKind)
        {
            case JsonValueKind.String:
                return expected.GetString() == actual.GetString();
            case JsonValueKind.Array:
                if (expected.GetArrayLength() != actual.GetArrayLength())
                    return false;
                return expected.EnumerateArray().Zip(actual.EnumerateArray()).All(pair => Same(pair.First, pair.Second));
            case JsonValueKind.Object:
                var left = Properties(expected);
                var right = Properties(actual);
                return left.Count == right.Count
                    && left.All(property => right.TryGetValue(property.Key, out var other) && Same(property.Value, other));
            default:
                // true, false y null: basta con que sean del mismo tipo.
                return true;
        }
    }

    /// <summary>Una lista en la que no importa el orden: los mismos elementos, con sus repeticiones.</summary>
    private static bool SameItems(JsonElement expected, JsonElement actual)
    {
        if (expected.ValueKind != JsonValueKind.Array || actual.ValueKind != JsonValueKind.Array)
            return Same(expected, actual);
        var pending = actual.EnumerateArray().ToList();
        if (pending.Count != expected.GetArrayLength())
            return false;
        foreach (var item in expected.EnumerateArray())
        {
            var match = pending.FindIndex(other => Same(item, other));
            if (match < 0)
                return false;
            pending.RemoveAt(match);
        }
        return true;
    }

    private static bool SameNumber(JsonElement expected, JsonElement actual)
    {
        if (expected.TryGetDecimal(out var left) && actual.TryGetDecimal(out var right) && left == right)
            return true;
        var (x, y) = (expected.GetDouble(), actual.GetDouble());
        return x == y || Math.Abs(x - y) <= 1e-9 * Math.Max(1, Math.Max(Math.Abs(x), Math.Abs(y)));
    }

    private static Dictionary<string, JsonElement> Properties(JsonElement element)
    {
        var properties = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var property in element.EnumerateObject())
            properties[property.Name] = property.Value;
        return properties;
    }
}
