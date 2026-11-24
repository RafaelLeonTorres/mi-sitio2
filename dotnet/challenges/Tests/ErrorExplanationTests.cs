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
        ["CS0021"] = "var set = new HashSet<int>();\nConsole.WriteLine(set[0]);",
        ["CS0029"] = """int quantity = "text";""",
        ["CS0103"] = "Console.WriteLine(unknown);",
        ["CS0115"] = "Console.WriteLine(1);\nclass A { }\nclass B : A\n{\n    public override void M() { }\n}",
        ["CS0117"] = "Counter.Total = 1;\nclass Counter\n{\n}",
        ["CS0120"] = "Greeter.Hello();\nclass Greeter\n{\n    public string Name = \"x\";\n\n    public static void Hello()\n    {\n        Console.WriteLine(Name);\n    }\n}",
        ["CS0122"] = "Secret secret = new Secret();\nConsole.WriteLine(secret.value);\nclass Secret\n{\n    private int value;\n}",
        ["CS0128"] = "int age = 1;\nint age = 2;",
        ["CS0131"] = "const int DaysInWeek = 7;\nDaysInWeek = 8;",
        ["CS0133"] = """const int Number = int.Parse("5");""",
        ["CS0144"] = "Base item = new Base();\nabstract class Base { }",
        ["CS0160"] = "try\n{\n    Console.WriteLine(1);\n}\ncatch (Exception)\n{\n}\ncatch (FormatException)\n{\n}",
        ["CS0145"] = "const int MaxItems;",
        ["CS0161"] = "Console.WriteLine(One());\nstatic int One()\n{\n}",
        ["CS0163"] = "switch (1)\n{\n    case 1:\n        Console.WriteLine(\"a\");\n    case 2:\n        break;\n}",
        ["CS0165"] = "int total;\nConsole.WriteLine(total);",
        ["CS0177"] = "Fill(out int y);\nstatic void Fill(out int x)\n{\n}",
        ["CS0200"] = "Box box = new Box { Size = 1 };\nclass Box\n{\n    public int Size { get; }\n}",
        ["CS0201"] = "Greet;\nstatic void Greet()\n{\n}",
        ["CS0246"] = "Lisst<int> items = new();",
        ["CS0266"] = "int price = 19.99;",
        ["CS0272"] = "Account account = new Account();\naccount.Balance = 5;\nclass Account\n{\n    public int Balance { get; private set; }\n}",
        ["CS0506"] = "Console.WriteLine(1);\nclass A\n{\n    public void M() { }\n}\nclass B : A\n{\n    public override void M() { }\n}",
        ["CS0507"] = "Console.WriteLine(1);\nclass A\n{\n    public virtual void M() { }\n}\nclass B : A\n{\n    override void M() { }\n}",
        ["CS0534"] = "Console.WriteLine(1);\nabstract class A\n{\n    public abstract void M();\n}\nclass B : A { }",
        ["CS0535"] = "Console.WriteLine(1);\ninterface I\n{\n    void M();\n}\nclass C : I { }",
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
        ["CS1501"] = "Show(1, 2);\nstatic void Show(int n)\n{\n}",
        ["CS1503"] = """Console.WriteLine(Math.Sqrt("16"));""",
        ["CS1513"] = "if (true)\n{\n    Console.WriteLine(1);",
        ["CS1524"] = "try\n{\n    Console.WriteLine(1);\n}",
        ["CS1525"] = "int total = ;",
        ["CS1579"] = "foreach (var x in 5)\n{\n}",
        ["CS1620"] = "int n = 1;\nIncrease(n);\nstatic void Increase(ref int x)\n{\n    x++;\n}",
        ["CS1656"] = "int[] numbers = { 1 };\nforeach (int n in numbers)\n{\n    n = 2;\n}",
        ["CS1674"] = "using (Plain plain = new Plain())\n{\n}\nclass Plain\n{\n}",
        ["CS1729"] = "Pair pair = new Pair(1, 2);\nclass Pair\n{\n}",
        ["CS1737"] = "Show(1, 2);\nstatic void Show(int a = 1, int b)\n{\n}",
        ["CS5001"] = "// only a comment",
        ["CS7036"] = "Show();\nstatic void Show(int n)\n{\n}",
        ["CS8421"] = "int factor = 2;\nConsole.WriteLine(Twice(3));\nstatic int Twice(int n)\n{\n    return n * factor;\n}",
        ["CS8803"] = "class Store { }\nConsole.WriteLine(1);",
        ["CS8852"] = "Ticket ticket = new Ticket { Number = 1 };\nticket.Number = 2;\nclass Ticket\n{\n    public int Number { get; init; }\n}",
    };

    /// <summary>
    /// Excepciones de ejecución: el nombre del tipo y un programa que la lanza. Falta
    /// <c>PlatformNotSupportedException</c>: solo la lanza el navegador (<c>Console.ReadKey</c>).
    /// </summary>
    private static readonly Dictionary<string, string> RuntimeErrors = new()
    {
        ["ArgumentException"] = "throw new ArgumentException(\"bad\");",
        ["ArgumentNullException"] = "string? text = null;\nArgumentNullException.ThrowIfNull(text);",
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
