using Microsoft.CodeAnalysis.CSharp;
using Xunit;

namespace Challenges.Tests;

/// <summary>
/// Cada ejercicio del curso contra el mismo núcleo que usa el motor del navegador: la solución pasa
/// todas sus ejecuciones y sus reglas, y el código inicial no las pasa, porque si pasara el
/// ejercicio no pediría nada. A diferencia de los retos, el código inicial puede no compilar: el
/// ejercicio de arreglar un error empieza así a propósito.
/// </summary>
public sealed class CourseSolutionTests
{
    private static readonly string[] SyntaxRules = ["uses-syntax", "avoids-syntax"];
    private static readonly string[] NameRules = ["uses-syntax", "avoids-syntax", "declares-variable", "calls-method"];
    private static readonly string[] TypeRules = ["uses-type", "avoids-type"];

    public static TheoryData<string, string, string> Exercises()
    {
        var data = new TheoryData<string, string, string>();
        foreach (var (module, lesson, step, kind) in CourseData.Steps())
        {
            if (kind == "exercise")
                data.Add(module, lesson, step);
        }
        return data;
    }

    [Theory]
    [MemberData(nameof(Exercises))]
    public async Task La_solucion_pasa_sus_ejecuciones_y_sus_reglas(string module, string lesson, string id)
    {
        var step = CourseData.Step(module, lesson, id);
        var request = CourseData.Request(step, step["solution"]!.GetValue<string>());
        var run = await ProgramCollector.Execute(request);
        var compilation = run.Compilation!;
        Assert.True(compilation.Compiled, run.Describe());
        Assert.Equal(request.Rules.Count, compilation.Rules.Count);
        Assert.All(compilation.Rules, rule => Assert.True(rule.Passed, run.Describe()));
        Assert.Equal(Math.Max(1, request.Runs.Count), run.Runs.Count);
        Assert.All(run.Runs, item => Assert.True(item.Passed, run.Describe()));
    }

    /// <summary>Cada ejercicio con cada código inicial que ve el alumno (el compartido y el de cada idioma).</summary>
    public static TheoryData<string, string, string, string> Starters()
    {
        var data = new TheoryData<string, string, string, string>();
        foreach (var (module, lesson, step, kind) in CourseData.Steps())
        {
            if (kind != "exercise")
                continue;
            foreach (var (source, _) in CourseData.Starters(module, lesson, step))
                data.Add(module, lesson, step, source);
        }
        return data;
    }

    [Theory]
    [MemberData(nameof(Starters))]
    public async Task El_codigo_inicial_no_resuelve_el_ejercicio(string module, string lesson, string id, string source)
    {
        var step = CourseData.Step(module, lesson, id);
        var starter = CourseData.Starters(module, lesson, id).Single(item => item.Source == source).Code;
        var request = CourseData.Request(step, starter);
        var run = await ProgramCollector.Execute(request);
        var compilation = run.Compilation!;
        var everything =
            compilation.Compiled
            && compilation.Rules.All(rule => rule.Passed)
            && run.Runs.Count == Math.Max(1, request.Runs.Count)
            && run.Runs.All(item => item.Passed);
        Assert.False(everything, $"{module}/{lesson}/{id} ({source}): el código inicial ya resuelve el ejercicio.");
    }

    /// <summary>
    /// Un nombre mal escrito en una regla no da error: <c>uses-syntax</c> nunca se cumpliría y
    /// <c>avoids-syntax</c> se cumpliría siempre. Por eso se revisa que cada regla esté completa y
    /// que los nombres de sintaxis existan en Roslyn.
    /// </summary>
    [Fact]
    public void Las_reglas_estan_completas_y_usan_nombres_de_Roslyn()
    {
        var syntaxKinds = Enum.GetNames<SyntaxKind>();
        foreach (var (module, lesson, id, kind) in CourseData.Steps())
        {
            if (kind != "exercise")
                continue;
            foreach (var rule in CourseData.Request(CourseData.Step(module, lesson, id), "").Rules)
            {
                var where = $"{module}/{lesson}/{id}: regla {rule.Kind}";
                if (SyntaxRules.Contains(rule.Kind))
                    Assert.True(rule.Name is not null && syntaxKinds.Contains(rule.Name), $"{where}: «{rule.Name}» no es un SyntaxKind de Roslyn.");
                else if (NameRules.Contains(rule.Kind))
                    Assert.False(string.IsNullOrWhiteSpace(rule.Name), $"{where}: falta name.");
                else if (TypeRules.Contains(rule.Kind))
                    Assert.False(string.IsNullOrWhiteSpace(rule.Type), $"{where}: falta type.");
                else
                    Assert.Fail($"{where}: tipo de regla desconocido.");
            }
        }
    }

    /// <summary>
    /// YAML lee <c>stdout: 5</c> como número y no como texto; el motor recibiría otra cosa. Las
    /// salidas esperadas tienen que ir entre comillas.
    /// </summary>
    [Fact]
    public void Las_ejecuciones_esperan_texto()
    {
        foreach (var (module, lesson, id, kind) in CourseData.Steps())
        {
            if (kind != "exercise")
                continue;
            // Request lanza si algún valor no es texto.
            var ex = Record.Exception(() => CourseData.Request(CourseData.Step(module, lesson, id), ""));
            Assert.True(ex is null, $"{module}/{lesson}/{id}: {ex?.Message}");
        }
    }
}
