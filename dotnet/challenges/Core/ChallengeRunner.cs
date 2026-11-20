using System.Reflection;

namespace Challenges;

/// <summary>A quién se le avisa cómo va una ejecución: la página en el navegador o una prueba.</summary>
public interface IRunReport
{
    void Compiled(CompileOutcome outcome);

    /// <summary>Empieza el código del visitante en el caso <paramref name="index"/>: desde aquí corre el tiempo límite.</summary>
    void Code(int index);

    void Case(CaseOutcome outcome);
}

public static class ChallengeRunner
{
    /// <summary>Compila el código, revisa sus reglas y corre los casos, uno tras otro.</summary>
    public static async Task Run(RunRequest request, IRunReport report)
    {
        var compiled = CodeCompiler.Compile(request.Code, request.Prelude, request.Harness);
        IReadOnlyList<RuleOutcome> rules = compiled.Success
            ? [.. request.Rules.Select(rule => CodeRules.Check(rule, compiled.Compilation, compiled.Code))]
            : [];

        var entries = new Dictionary<int, (MethodInfo? Method, Problem? Problem)>();
        (MethodInfo? Method, Problem? Problem) Entry(int arity)
        {
            if (!entries.TryGetValue(arity, out var entry))
                entries[arity] = entry = CaseRunner.FindEntry(compiled.Assembly!, request.Entry, arity);
            return entry;
        }

        (MethodInfo? Method, Problem? Problem) first =
            compiled.Success && request.Cases.Count > 0 ? Entry(request.Cases[0].Args.Count) : (null, null);
        report.Compiled(
            new CompileOutcome
            {
                Compiled = compiled.Success,
                CompileMs = compiled.Ms,
                Diagnostics = compiled.Diagnostics,
                Rules = rules,
                Entry = first.Problem,
            }
        );
        if (!compiled.Success || first.Problem is not null)
            return;

        foreach (var input in request.Cases)
        {
            var (method, problem) = Entry(input.Args.Count);
            if (method is null)
            {
                report.Case(new CaseOutcome { Index = input.Index, Problem = problem });
                continue;
            }
            report.Code(input.Index);
            report.Case(await CaseRunner.Run(method, input, request.Compare));
        }
    }
}
