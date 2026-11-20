using System.Text.Json;
using Xunit;

namespace Challenges.Tests;

/// <summary>Cómo reporta el arnés lo que pasa con el código del visitante.</summary>
public sealed class HarnessTests
{
    private static RunRequest Request(string code, string method, params CaseInput[] cases) =>
        new()
        {
            Code = code,
            Entry = new EntryPoint("Solution", method),
            Cases = cases,
        };

    private static CaseInput Case(int index, string expected, params string[] args) =>
        new()
        {
            Index = index,
            Args = [.. args.Select(Json.Parse)],
            Expected = Json.Parse(expected),
        };

    [Fact]
    public async Task Un_error_de_compilacion_trae_la_linea_del_editor()
    {
        var run = await Collector.Run(
            Request(
                """
                public static class Solution
                {
                    public static int Doble(int n) => n * 2
                }
                """,
                "Doble",
                Case(0, "4", "2")
            )
        );
        var compilation = run.Compilation!;
        Assert.False(compilation.Compiled);
        Assert.Contains(
            compilation.Diagnostics,
            error => error is { Id: "CS1002", Source: CodeCompiler.CodeSource, Line: 3 }
        );
        Assert.Empty(run.Cases);
    }

    [Fact]
    public async Task Compara_el_resultado_y_avisa_cuando_empieza_cada_caso()
    {
        var run = await Collector.Run(
            Request(
                "public static class Solution { public static int[] Pares(int[] n) => n.Where(x => x % 2 == 0).ToArray(); }",
                "Pares",
                Case(0, "[2, 4]", "[1, 2, 3, 4]"),
                Case(1, "[6]", "[5, 7]")
            )
        );
        Assert.Equal(new[] { 0, 1 }, run.Started);
        Assert.True(run.Cases[0].Passed);
        Assert.False(run.Cases[1].Passed);
        Assert.Equal("[]", run.Cases[1].Actual?.GetRawText());
    }

    [Fact]
    public async Task Una_excepcion_trae_su_tipo_y_su_linea()
    {
        var run = await Collector.Run(
            Request(
                """
                public static class Solution
                {
                    public static int Primero(int[] numeros)
                    {
                        return numeros.First(n => n > 100);
                    }
                }
                """,
                "Primero",
                Case(0, "0", "[1, 2]")
            )
        );
        var item = Assert.Single(run.Cases);
        Assert.False(item.Passed);
        Assert.Equal("InvalidOperationException", item.Error?.Type);
        Assert.Equal("Solution.Primero", item.Error?.Member);
        Assert.Equal(5, item.Error?.Line);
    }

    [Fact]
    public async Task Un_caso_puede_esperar_una_excepcion()
    {
        var request = Request(
            "public static class Solution { public static int Raiz(int n) => n < 0 ? throw new ArgumentOutOfRangeException(nameof(n)) : (int)Math.Sqrt(n); }",
            "Raiz"
        ) with
        {
            Cases = [new CaseInput { Index = 0, Args = [Json.Parse("-4")], Throws = "ArgumentException" }],
        };
        var run = await Collector.Run(request);
        Assert.True(Assert.Single(run.Cases).Passed);
    }

    [Fact]
    public async Task Espera_los_metodos_asincronos_y_guarda_la_consola()
    {
        var run = await Collector.Run(
            Request(
                """
                public static class Solution
                {
                    public static async Task<int> Suma(int a, int b)
                    {
                        await Task.Yield();
                        Console.WriteLine($"{a} + {b}");
                        return a + b;
                    }
                }
                """,
                "Suma",
                Case(0, "5", "2", "3")
            )
        );
        var item = Assert.Single(run.Cases);
        Assert.True(item.Passed, run.Describe());
        Assert.Equal("2 + 3" + Environment.NewLine, item.Console);
    }

    [Fact]
    public async Task Una_excepcion_en_un_metodo_asincrono_reporta_ese_metodo()
    {
        var run = await Collector.Run(
            Request(
                """
                public static class Solution
                {
                    public static async Task<int> Mitad(int n)
                    {
                        await Task.Yield();
                        return n % 2 == 0 ? n / 2 : throw new ArgumentException("Debe ser par.", nameof(n));
                    }
                }
                """,
                "Mitad",
                Case(0, "0", "3")
            )
        );
        var item = Assert.Single(run.Cases);
        Assert.Equal("ArgumentException", item.Error?.Type);
        Assert.Equal("Solution.Mitad", item.Error?.Member);
    }

    [Fact]
    public async Task Sin_orden_compara_los_elementos_con_sus_repeticiones()
    {
        var code = "public static class Solution { public static List<string> Lista(string[] s) => Enumerable.Reverse(s).ToList(); }";
        var request = Request(code, "Lista", Case(0, """["a", "b", "b"]""", """["b", "a", "b"]""")) with
        {
            Compare = "unordered",
        };
        Assert.True(Assert.Single((await Collector.Run(request)).Cases).Passed);
        var wrong = request with { Cases = [Case(0, """["a", "a", "b"]""", """["b", "a", "b"]""")] };
        Assert.False(Assert.Single((await Collector.Run(wrong)).Cases).Passed);
    }

    [Fact]
    public async Task Los_numeros_valen_igual_con_otra_escritura()
    {
        var code = "public static class Solution { public static decimal Total(decimal[] p) => p.Sum(); }";
        var run = await Collector.Run(Request(code, "Total", Case(0, "2.5", "[1.25, 1.25]")));
        Assert.True(Assert.Single(run.Cases).Passed, run.Describe());
    }

    [Fact]
    public async Task Avisa_si_falta_el_metodo()
    {
        var run = await Collector.Run(
            Request("public static class Solution { public static int Otro() => 1; }", "Doble", Case(0, "2", "1"))
        );
        Assert.Equal("missing-method", run.Compilation!.Entry?.Key);
        Assert.Empty(run.Cases);
    }

    [Fact]
    public async Task Revisa_las_reglas_del_codigo()
    {
        const string singleton = """
            public sealed class Configuracion
            {
                private static readonly Lazy<Configuracion> instancia = new(() => new Configuracion());
                private Configuracion() { }
                public static Configuracion Instancia => instancia.Value;
            }
            public static class Solution { public static bool Misma() => ReferenceEquals(Configuracion.Instancia, Configuracion.Instancia); }
            """;
        var request = Request(singleton, "Misma", Case(0, "true")) with
        {
            Rules =
            [
                new CodeRule("uses-type", "System.Lazy`1"),
                new CodeRule("private-constructor", "Configuracion"),
                new CodeRule("avoids-type", "System.Linq.Enumerable"),
            ],
        };
        var run = await Collector.Run(request);
        Assert.All(run.Compilation!.Rules, rule => Assert.True(rule.Passed, rule.Kind));

        var linq = request with
        {
            Code = singleton.Replace("ReferenceEquals(Configuracion.Instancia, Configuracion.Instancia)", "new[] { 1 }.Any()"),
        };
        var rules = (await Collector.Run(linq)).Compilation!.Rules;
        Assert.False(rules.Single(rule => rule.Kind == "avoids-type").Passed);
    }

    [Fact]
    public async Task El_playground_corre_instrucciones_de_nivel_superior_con_await()
    {
        var started = false;
        var outcome = await Playground.Run(
            """
            await Task.Delay(1);
            Console.WriteLine("Hola desde C#");
            """,
            () => started = true
        );
        Assert.True(outcome.Compiled);
        Assert.True(started);
        Assert.Null(outcome.Error);
        Assert.Equal("Hola desde C#" + Environment.NewLine, outcome.Console);
    }

    [Fact]
    public void Los_resultados_se_escriben_en_camel_case_para_la_pagina()
    {
        var json = JsonSerializer.Serialize(new CaseOutcome { Index = 2, Passed = true, Actual = Json.Parse("[1]") }, Json.Protocol);
        Assert.Equal("""{"index":2,"passed":true,"actual":[1],"console":"","ms":0}""", json);
    }
}
