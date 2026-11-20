using System.Collections.Immutable;
using Microsoft.CodeAnalysis;

namespace Challenges;

/// <summary>
/// Los ensamblados de referencia con los que se compila el código del visitante. Van incrustados en
/// este ensamblado (ver Challenges.Core.csproj) y se leen una sola vez.
/// </summary>
public static class References
{
    private const string Prefix = "refs/";
    private static ImmutableArray<MetadataReference>? all;

    public static ImmutableArray<MetadataReference> All => all ??= Load();

    /// <summary>Los nombres de los ensamblados, sin extensión, para la ayuda del editor.</summary>
    public static IEnumerable<string> Names =>
        typeof(References)
            .Assembly.GetManifestResourceNames()
            .Where(name => name.StartsWith(Prefix, StringComparison.Ordinal))
            .Select(name => Path.GetFileNameWithoutExtension(name[Prefix.Length..]))
            .Order(StringComparer.Ordinal);

    private static ImmutableArray<MetadataReference> Load()
    {
        var assembly = typeof(References).Assembly;
        var builder = ImmutableArray.CreateBuilder<MetadataReference>();
        foreach (var name in assembly.GetManifestResourceNames().Order(StringComparer.Ordinal))
        {
            if (!name.StartsWith(Prefix, StringComparison.Ordinal))
                continue;
            using var stream =
                assembly.GetManifestResourceStream(name)
                ?? throw new InvalidOperationException($"No se pudo leer {name}.");
            builder.Add(MetadataReference.CreateFromStream(stream, filePath: name[Prefix.Length..]));
        }
        if (builder.Count == 0)
            throw new InvalidOperationException("No hay ensamblados de referencia incrustados.");
        return builder.ToImmutable();
    }
}
