namespace Challenges.Tests;

/// <summary>Guarda lo que reporta la ejecución del programa de un paso del curso.</summary>
public sealed class ProgramCollector : IProgramReport
{
    public ProgramCompile? Compilation { get; private set; }

    public List<RunOutcome> Runs { get; } = [];

    public List<int> Started { get; } = [];

    public void Compiled(ProgramCompile outcome) => Compilation = outcome;

    public void Code(int index) => Started.Add(index);

    public void Run(RunOutcome outcome) => Runs.Add(outcome);

    public static async Task<ProgramCollector> Execute(ProgramRequest request)
    {
        var collector = new ProgramCollector();
        await CourseRunner.Run(request, collector);
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
        lines.AddRange(
            compilation.Rules.Where(rule => !rule.Passed).Select(rule => $"regla {rule.Kind} {rule.Name ?? rule.Type}")
        );
        foreach (var item in Runs.Where(item => !item.Passed))
        {
            var detail = item.Error is { } error ? $" {error.Type}: {error.Message}" : "";
            lines.Add($"ejecución {item.Index + 1}: falló {string.Join(", ", item.Failed)}{detail}; salió «{item.Stdout}»");
        }
        return string.Join(Environment.NewLine, lines);
    }
}
