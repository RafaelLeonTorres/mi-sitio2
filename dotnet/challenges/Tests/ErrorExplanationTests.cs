using System.Text.Json.Nodes;
using Xunit;

namespace Challenges.Tests;

/// <summary>
/// Cada error que explica <c>_data/course/errors.yml</c> se produce de verdad con un programa
/// pequeño: así la clave es el código que da Roslyn y la excepción que lanza el programa, no una
/// que alguien recordó mal. Un error nuevo en errors.yml necesita su programa aquí.
/// </summary>
public sealed class ErrorExplanationTests
{
    /// <summary>Errores del compilador: el código y un programa que lo produce.</summary>
    private static readonly Dictionary<string, string> CompilerErrors = new()
    {
        ["CS0019"] = "bool wrong = 5 + true;",
        ["CS0020"] = "Console.WriteLine(5 / 0);",
        ["CS0029"] = """int quantity = "text";""",
        ["CS0103"] = "Console.WriteLine(unknown);",
        ["CS0128"] = "int age = 1;\nint age = 2;",
        ["CS0131"] = "const int DaysInWeek = 7;\nDaysInWeek = 8;",
        ["CS0133"] = """const int Number = int.Parse("5");""",
        ["CS0145"] = "const int MaxItems;",
        ["CS0163"] = "switch (1)\n{\n    case 1:\n        Console.WriteLine(\"a\");\n    case 2:\n        break;\n}",
        ["CS0165"] = "int total;\nConsole.WriteLine(total);",
        ["CS0246"] = "Lisst<int> items = new();",
        ["CS0266"] = "int price = 19.99;",
        ["CS0664"] = "decimal price = 19.99;",
        ["CS0841"] = "Console.WriteLine(total);\nint total = 1;",
        ["CS1002"] = """Console.WriteLine("Hello")""",
        ["CS1003"] = "int[] numbers = { 1 2 };",
        ["CS1009"] = """Console.WriteLine("\d");""",
        ["CS1010"] = """Console.WriteLine("Hello);""",
        ["CS1012"] = "char letter = 'ab';",
        ["CS1026"] = """Console.WriteLine("Hello";""",
        ["CS1035"] = "/* never closed\nConsole.WriteLine(1);",
        ["CS1061"] = "string name = \"Ana\";\nConsole.WriteLine(name.Lenght);",
        ["CS1503"] = """Console.WriteLine(Math.Sqrt("16"));""",
        ["CS1513"] = "if (true)\n{\n    Console.WriteLine(1);",
        ["CS1525"] = "int total = ;",
        ["CS1579"] = "foreach (var x in 5)\n{\n}",
        ["CS1656"] = "int[] numbers = { 1 };\nforeach (int n in numbers)\n{\n    n = 2;\n}",
        ["CS5001"] = "// only a comment",
        ["CS8803"] = "class Store { }\nConsole.WriteLine(1);",
    };

    /// <summary>
    /// Excepciones de ejecución: el nombre del tipo y un programa que la lanza. Falta
    /// <c>PlatformNotSupportedException</c>: solo la lanza el navegador (<c>Console.ReadKey</c>).
    /// </summary>
    private static readonly Dictionary<string, string> RuntimeErrors = new()
    {
        ["ArgumentOutOfRangeException"] = "var items = new List<int>();\nConsole.WriteLine(items[0]);",
        ["DivideByZeroException"] = "int zero = 0;\nConsole.WriteLine(5 / zero);",
        ["FormatException"] = """Console.WriteLine(int.Parse("abc"));""",
        ["IndexOutOfRangeException"] = "var numbers = new int[2];\nConsole.WriteLine(numbers[5]);",
        ["InvalidCastException"] = "object text = \"x\";\nConsole.WriteLine((int)text);",
        ["InvalidOperationException"] = "Console.WriteLine(new List<int>().First());",
        ["KeyNotFoundException"] = "var prices = new Dictionary<string, int>();\nConsole.WriteLine(prices[\"a\"]);",
        ["NullReferenceException"] = "string? text = null;\nConsole.WriteLine(text.Length);",
        ["OverflowException"] = """Console.WriteLine(int.Parse("99999999999"));""",
    };

    private static readonly string[] BrowserOnly = ["PlatformNotSupportedException"];

    public static TheoryData<string> CompilerCodes() => [.. CompilerErrors.Keys];

    public static TheoryData<string> RuntimeTypes() => [.. RuntimeErrors.Keys];

    [Theory]
    [MemberData(nameof(CompilerCodes))]
    public async Task Cada_error_del_compilador_explicado_se_produce_con_su_programa(string code)
    {
        var run = await ProgramCollector.Execute(new ProgramRequest { Code = CompilerErrors[code] });
        var compilation = run.Compilation!;
        Assert.False(compilation.Compiled, $"{code}: el programa compila.");
        Assert.Contains(compilation.Diagnostics, error => error.Id == code);
    }

    [Theory]
    [MemberData(nameof(RuntimeTypes))]
    public async Task Cada_excepcion_explicada_se_produce_con_su_programa(string type)
    {
        var run = await ProgramCollector.Execute(new ProgramRequest { Code = RuntimeErrors[type] });
        Assert.True(run.Compilation!.Compiled, run.Describe());
        var outcome = Assert.Single(run.Runs);
        Assert.Equal(type, outcome.Error?.Type);
    }

    [Fact]
    public void Todo_lo_que_explica_errors_yml_tiene_su_programa()
    {
        var explained = ((JsonObject)ChallengeData.Load(Path.Combine(ChallengeData.Root, "_data", "course", "errors.yml"))).Select(pair => pair.Key);
        var known = CompilerErrors.Keys.Concat(RuntimeErrors.Keys).Concat(BrowserOnly);
        Assert.Empty(explained.Except(known));
        // Y al revés: no se prueba un error que ya no se explica.
        Assert.Empty(CompilerErrors.Keys.Concat(RuntimeErrors.Keys).Except(explained));
    }
}
