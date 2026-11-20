using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace Challenges.Tests;

/// <summary>
/// Cada reto de C# contra el mismo núcleo que usa el motor del navegador: la solución de referencia
/// pasa todos sus casos y sus reglas, y el código inicial compila (el visitante empieza viendo casos,
/// no errores) pero no pasa, porque si pasara el reto no pediría nada.
/// </summary>
public sealed class SolutionTests
{
    public static TheoryData<string> Ids()
    {
        var data = new TheoryData<string>();
        foreach (var id in ChallengeData.CsharpIds())
            data.Add(id);
        return data;
    }

    [Theory]
    [MemberData(nameof(Ids))]
    public async Task La_solucion_pasa_todos_los_casos(string id)
    {
        var run = await Collector.Run(ChallengeData.Request(id, ChallengeData.Code(id, "solution")));
        var compilation = run.Compilation!;
        Assert.True(compilation.Compiled, run.Describe());
        Assert.Null(compilation.Entry);
        Assert.All(compilation.Rules, rule => Assert.True(rule.Passed, run.Describe()));
        Assert.NotEmpty(run.Cases);
        Assert.All(run.Cases, item => Assert.True(item.Passed, run.Describe()));
    }

    [Theory]
    [MemberData(nameof(Ids))]
    public async Task El_codigo_inicial_compila_y_no_pasa(string id)
    {
        var run = await Collector.Run(ChallengeData.Request(id, ChallengeData.Code(id, "starter")));
        var compilation = run.Compilation!;
        Assert.True(compilation.Compiled, run.Describe());
        Assert.Null(compilation.Entry);
        var everything = run.Cases.All(item => item.Passed) && compilation.Rules.All(rule => rule.Passed);
        Assert.False(everything, $"{id}: el código inicial ya resuelve el reto.");
    }
}
