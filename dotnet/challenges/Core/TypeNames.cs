namespace Challenges;

/// <summary>El nombre de un tipo como se escribe en C#: <c>List&lt;int&gt;</c>, no <c>List`1</c>.</summary>
public static class TypeNames
{
    private static readonly Dictionary<Type, string> Keywords = new()
    {
        [typeof(bool)] = "bool",
        [typeof(byte)] = "byte",
        [typeof(char)] = "char",
        [typeof(decimal)] = "decimal",
        [typeof(double)] = "double",
        [typeof(float)] = "float",
        [typeof(int)] = "int",
        [typeof(long)] = "long",
        [typeof(object)] = "object",
        [typeof(short)] = "short",
        [typeof(string)] = "string",
        [typeof(uint)] = "uint",
        [typeof(ulong)] = "ulong",
        [typeof(void)] = "void",
    };

    public static string Show(Type type)
    {
        if (Keywords.TryGetValue(type, out var keyword))
            return keyword;
        if (type.IsArray)
            return $"{Show(type.GetElementType()!)}[{new string(',', type.GetArrayRank() - 1)}]";
        if (Nullable.GetUnderlyingType(type) is { } underlying)
            return $"{Show(underlying)}?";
        if (!type.IsGenericType)
            return type.Name;
        var name = type.Name[..type.Name.IndexOf('`', StringComparison.Ordinal)];
        return $"{name}<{string.Join(", ", type.GetGenericArguments().Select(Show))}>";
    }
}
