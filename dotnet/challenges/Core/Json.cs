using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace Challenges;

public static class Json
{
    /// <summary>Para los mensajes con la página: nombres en camelCase y sin las propiedades nulas.</summary>
    public static readonly JsonSerializerOptions Protocol = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        TypeInfoResolver = new DefaultJsonTypeInfoResolver(),
    };

    /// <summary>
    /// Para los valores del visitante: los argumentos de cada caso y lo que devuelve su código. Los
    /// nombres quedan como en C# (PascalCase) y las enumeraciones se escriben con su nombre.
    /// </summary>
    public static readonly JsonSerializerOptions Values = new()
    {
        TypeInfoResolver = new DefaultJsonTypeInfoResolver(),
        IncludeFields = true,
        PropertyNameCaseInsensitive = true,
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
        MaxDepth = 64,
        Converters = { new JsonStringEnumConverter() },
    };

    /// <summary>Un <c>null</c> de JSON, para el caso que espera que el método devuelva null.</summary>
    public static JsonElement Null { get; } = Parse("null");

    /// <summary>Un valor de JSON que no depende de un documento abierto.</summary>
    public static JsonElement Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
