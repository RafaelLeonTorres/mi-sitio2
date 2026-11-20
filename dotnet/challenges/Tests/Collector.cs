namespace Challenges.Tests;

/// <summary>Guarda lo que reporta una ejecución, en lugar de mandárselo a la página.</summary>
public sealed class Collector : IRunReport
{
    public CompileOutcome? Compilation { get; private set; }

    public List<CaseOutcome> Cases { get; } = [];

    public List<int> Started { get; } = [];

    public void Compiled(CompileOutcome outcome) => Compilation = outcome;

    public void Code(int index) => Started.Add(index);

    public void Case(CaseOutcome outcome) => Cases.Add(outcome);

    public static async Task<Collector> Run(RunRequest request)
    {
        var collector = new Collector();
        await ChallengeRunner.Run(request, collector);
        return collector;
    }

    /// <summary>Por qué no pasó, para el mensaje de la prueba.</summary>
    public string Describe()
    {
        var compilation = Compilation;
        if (compilation is null)
            return "sin compilación";
        var lines = new List<string>();
        lines.AddRange(compilation.Diagnostics.Select(d => $"{d.Source}:{d.Line}:{d.Column} {d.Id} {d.Message}"));
        lines.AddRange(compilation.Rules.Where(rule => !rule.Passed).Select(rule => $"regla {rule.Kind} {rule.Type}"));
        if (compilation.Entry is { } entry)
            lines.Add($"entrada: {entry.Key} {string.Join(", ", entry.Values.Select(pair => $"{pair.Key}={pair.Value}"))}");
        foreach (var item in Cases.Where(item => !item.Passed))
        {
            var detail =
                item.Error is { } error ? $"{error.Type}: {error.Message} (línea {error.Line})"
                : item.Problem is { } problem ? problem.Key
                : $"obtuvo {item.Actual?.GetRawText() ?? "nada"}";
            lines.Add($"caso {item.Index + 1}: {detail}");
        }
        return string.Join(Environment.NewLine, lines);
    }
}
