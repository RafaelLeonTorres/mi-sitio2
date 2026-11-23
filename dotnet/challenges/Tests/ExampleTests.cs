using Xunit;

namespace Challenges.Tests;

/// <summary>
/// Los ejemplos del texto de cada lección: un bloque <c>```csharp</c> seguido de su salida en un bloque
/// <c>```text</c> (y, si lee, de su entrada en un bloque <c>```input</c>) compila y escribe justo eso.
/// Así un ejemplo del texto nunca queda roto ni miente sobre lo que imprime.
/// </summary>
public sealed class ExampleTests
{
    public static TheoryData<string, string> Lessons()
    {
        var data = new TheoryData<string, string>();
        foreach (var (module, lesson) in CourseData.Lessons())
            data.Add(module, lesson);
        return data;
    }

    [Theory]
    [MemberData(nameof(Lessons))]
    public async Task Los_ejemplos_del_texto_imprimen_lo_que_muestran(string module, string lesson)
    {
        foreach (var example in CourseData.Examples(module, lesson))
        {
            var request = new ProgramRequest
            {
                Code = example.Code,
                Runs = [new CourseRun { Stdin = example.Stdin, Stdout = example.Output }],
            };
            var run = await ProgramCollector.Execute(request);
            var where = $"{module}/{lesson}/{example.Step} ({example.Language})";
            Assert.True(run.Compilation!.Compiled, $"{where}: el ejemplo no compila.{Environment.NewLine}{run.Describe()}");
            Assert.True(
                Assert.Single(run.Runs).Passed,
                $"{where}: el ejemplo no imprime lo que muestra el texto.{Environment.NewLine}{run.Describe()}"
            );
        }
    }

    /// <summary>
    /// Que no pase en vacío: todo bloque <c>```text</c> o <c>```input</c> del texto es parte de un ejemplo
    /// que la prueba encontró, así que uno mal puesto (sin su <c>```csharp</c> justo antes) no se queda
    /// sin revisar.
    /// </summary>
    [Theory]
    [MemberData(nameof(Lessons))]
    public void Cada_bloque_de_salida_y_de_entrada_pertenece_a_un_ejemplo(string module, string lesson)
    {
        var examples = CourseData.Examples(module, lesson);
        foreach (var language in new[] { "es", "en" })
        {
            var (output, input) = CourseData.FenceCounts(module, lesson, language);
            var found = examples.Where(item => item.Language == language).ToList();
            Assert.True(
                output == found.Count,
                $"{module}/{lesson} ({language}): hay {output} bloques de salida y {found.Count} ejemplos; todo bloque de salida va justo después de un bloque de código."
            );
            Assert.True(
                input == found.Count(item => item.Stdin != ""),
                $"{module}/{lesson} ({language}): hay {input} bloques de entrada y {found.Count(item => item.Stdin != "")} ejemplos con entrada."
            );
        }
    }

    /// <summary>La salida de un ejemplo está en inglés en los dos idiomas: no cambia con la prosa.</summary>
    [Theory]
    [MemberData(nameof(Lessons))]
    public void Los_dos_idiomas_traen_los_mismos_ejemplos(string module, string lesson)
    {
        var examples = CourseData.Examples(module, lesson);
        string[] Outputs(string language) =>
            [.. examples.Where(item => item.Language == language).Select(item => $"{item.Step}: {item.Stdin}|{item.Output}")];
        Assert.Equal(Outputs("es"), Outputs("en"));
    }
}
