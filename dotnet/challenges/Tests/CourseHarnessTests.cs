using Xunit;

namespace Challenges.Tests;

/// <summary>Cómo corre y revisa el arnés los programas de los pasos del curso.</summary>
public sealed class CourseHarnessTests
{
    private static Task<ProgramCollector> Run(
        string code,
        IReadOnlyList<CourseRun>? runs = null,
        IReadOnlyList<CourseRule>? rules = null
    ) => ProgramCollector.Execute(new ProgramRequest { Code = code, Runs = runs ?? [], Rules = rules ?? [] });

    /// <summary>La única regla de una ejecución y si se cumplió.</summary>
    private static async Task<bool> Passes(string code, CourseRule rule) =>
        Assert.Single((await Run(code, rules: [rule])).Compilation!.Rules).Passed;

    private static string Unix(string text) => text.ReplaceLineEndings("\n");

    [Fact]
    public async Task Sin_ejecuciones_corre_una_vez_y_solo_pide_que_termine_sin_error()
    {
        var run = await Run("""Console.WriteLine("hola");""");
        var item = Assert.Single(run.Runs);
        Assert.True(item.Passed);
        Assert.Equal("hola\n", Unix(item.Stdout));
        Assert.Equal(new[] { 0 }, run.Started);

        var failing = await Run("""throw new InvalidOperationException("boom");""");
        var failed = Assert.Single(failing.Runs);
        Assert.False(failed.Passed);
        Assert.Equal(new[] { "error" }, failed.Failed);
        Assert.Equal("InvalidOperationException", failed.Error?.Type);
        Assert.Equal("boom", failed.Error?.Message);
    }

    [Fact]
    public async Task La_salida_exacta_ignora_los_saltos_del_final_y_el_estilo_de_linea()
    {
        const string code = """
            Console.WriteLine("a");
            Console.WriteLine("b");
            """;
        var same = await Run(code, [new CourseRun { Stdout = "a\r\nb\n\n" }]);
        Assert.True(Assert.Single(same.Runs).Passed);

        var different = await Run(code, [new CourseRun { Stdout = "a\nc" }]);
        var item = Assert.Single(different.Runs);
        Assert.False(item.Passed);
        Assert.Equal(new[] { "stdout" }, item.Failed);
        Assert.Equal("a\nc", item.Expected);
        Assert.Equal("a\nb\n", Unix(item.Stdout));
    }

    [Fact]
    public async Task Los_espacios_y_las_mayusculas_de_la_salida_si_cuentan()
    {
        var run = await Run("""Console.WriteLine("Hello, World!");""", [new CourseRun { Stdout = "hello, world!" }]);
        Assert.Equal(new[] { "stdout" }, Assert.Single(run.Runs).Failed);
    }

    [Fact]
    public async Task La_entrada_simulada_se_lee_por_lineas_y_al_final_da_null()
    {
        const string code = """
            var a = Console.ReadLine();
            var b = Console.ReadLine();
            var c = Console.ReadLine();
            Console.WriteLine(a + "|" + b + "|" + (c is null ? "null" : c));
            """;
        var run = await Run(code, [new CourseRun { Stdin = "uno\ndos\n", Stdout = "uno|dos|null" }]);
        Assert.True(Assert.Single(run.Runs).Passed, run.Describe());
    }

    [Fact]
    public async Task Cada_ejecucion_tiene_su_propia_entrada()
    {
        const string code = """
            Console.WriteLine("Hola, " + Console.ReadLine());
            """;
        var run = await Run(
            code,
            [
                new CourseRun { Stdin = "Ana\n", Stdout = "Hola, Ana" },
                new CourseRun { Stdin = "Luis\n", Stdout = "Hola, Luis" },
            ]
        );
        Assert.All(run.Runs, item => Assert.True(item.Passed, run.Describe()));
        Assert.Equal(new[] { 0, 1 }, run.Started);
    }

    [Fact]
    public async Task Cada_ejecucion_parte_de_un_programa_nuevo()
    {
        const string code = """
            Contador.Valor++;
            Console.WriteLine(Contador.Valor);
            class Contador { public static int Valor; }
            """;
        var run = await Run(code, [new CourseRun { Stdout = "1" }, new CourseRun { Stdout = "1" }]);
        Assert.All(run.Runs, item => Assert.True(item.Passed, run.Describe()));
    }

    [Fact]
    public async Task Un_programa_con_await_se_espera_sin_bloquear()
    {
        const string code = """
            await Task.Delay(10);
            Console.WriteLine("listo");
            """;
        var run = await Run(code, [new CourseRun { Stdout = "listo" }]);
        Assert.True(Assert.Single(run.Runs).Passed, run.Describe());
    }

    [Fact]
    public async Task Lo_que_va_al_error_estandar_tambien_sale_en_la_terminal()
    {
        var run = await Run("""Console.Error.WriteLine("mal");""");
        Assert.Equal("mal\n", Unix(Assert.Single(run.Runs).Stdout));
    }

    [Fact]
    public async Task Despues_de_correr_se_restaura_la_consola()
    {
        var (output, error, input) = (Console.Out, Console.Error, Console.In);
        await Run("""Console.WriteLine(Console.ReadLine());""", [new CourseRun { Stdin = "x\n" }]);
        Assert.Same(output, Console.Out);
        Assert.Same(error, Console.Error);
        Assert.Same(input, Console.In);
    }

    [Fact]
    public async Task La_salida_muy_larga_se_recorta()
    {
        var run = await Run("""Console.Write(new string('x', 20_000));""");
        var item = Assert.Single(run.Runs);
        Assert.EndsWith("\n…", item.Stdout);
        Assert.Equal(CaseRunner.MaxConsole + 2, item.Stdout.Length);
    }

    [Fact]
    public async Task Contains_y_matches_revisan_la_salida()
    {
        const string code = """Console.Write("hola mundo 42");""";
        var ok = await Run(code, [new CourseRun { Contains = ["hola", "42"], Matches = @"mundo \d+$" }]);
        Assert.True(Assert.Single(ok.Runs).Passed);

        var missing = await Run(code, [new CourseRun { Contains = ["hola", "adiós"] }]);
        Assert.Equal(new[] { "contains" }, Assert.Single(missing.Runs).Failed);

        var shape = await Run(code, [new CourseRun { Matches = @"^\d+$" }]);
        Assert.Equal(new[] { "matches" }, Assert.Single(shape.Runs).Failed);

        // Una expresión regular mal escrita no lanza: la ejecución simplemente no pasa.
        var invalid = await Run(code, [new CourseRun { Matches = "(" }]);
        Assert.Equal(new[] { "matches" }, Assert.Single(invalid.Runs).Failed);
    }

    [Fact]
    public async Task Throws_pide_el_tipo_de_la_excepcion()
    {
        const string code = """throw new InvalidOperationException("x");""";
        var expected = await Run(code, [new CourseRun { Throws = "InvalidOperationException" }]);
        Assert.True(Assert.Single(expected.Runs).Passed);

        var other = await Run(code, [new CourseRun { Throws = "ArgumentException" }]);
        Assert.Equal(new[] { "throws" }, Assert.Single(other.Runs).Failed);

        var none = await Run("""Console.WriteLine("ok");""", [new CourseRun { Throws = "ArgumentException" }]);
        Assert.Equal(new[] { "throws" }, Assert.Single(none.Runs).Failed);
    }

    [Fact]
    public async Task Un_error_de_compilacion_no_corre_nada_y_trae_la_linea()
    {
        var run = await Run(
            """Console.WriteLine("hola")""",
            [new CourseRun { Stdout = "hola" }],
            [new CourseRule("calls-method", "Console.WriteLine")]
        );
        var compilation = run.Compilation!;
        Assert.False(compilation.Compiled);
        Assert.Contains(
            compilation.Diagnostics,
            error => error is { Id: "CS1002", Source: CodeCompiler.CodeSource, Line: 1 }
        );
        Assert.Empty(compilation.Rules);
        Assert.Empty(run.Runs);
        Assert.Empty(run.Started);
    }

    [Fact]
    public async Task Un_programa_sin_instrucciones_no_compila()
    {
        var run = await Run("// Escribe tu código aquí");
        Assert.False(run.Compilation!.Compiled);
        Assert.Contains(run.Compilation.Diagnostics, error => error.Id == "CS5001");
    }

    [Fact]
    public async Task Calls_method_cuenta_las_llamadas_y_distingue_Write_de_WriteLine()
    {
        const string three = """
            Console.WriteLine(1);
            Console.WriteLine(2);
            Console.WriteLine(3);
            """;
        Assert.True(await Passes(three, new("calls-method", "Console.WriteLine")));
        Assert.True(await Passes(three, new("calls-method", "Console.WriteLine", Min: 3)));
        Assert.False(await Passes(three, new("calls-method", "Console.WriteLine", Min: 4)));
        Assert.False(await Passes(three, new("calls-method", "Console.Write")));
        Assert.False(await Passes(three, new("calls-method", null)));
    }

    [Fact]
    public async Task Las_reglas_de_sintaxis_buscan_nodos_de_Roslyn()
    {
        const string loop = "for (var i = 0; i < 3; i++) Console.WriteLine(i);";
        Assert.True(await Passes(loop, new("uses-syntax", "ForStatement")));
        Assert.False(await Passes(loop, new("uses-syntax", "ForStatement", Min: 2)));
        Assert.False(await Passes(loop, new("uses-syntax", "WhileStatement")));
        Assert.False(await Passes(loop, new("avoids-syntax", "ForStatement")));
        Assert.True(await Passes(loop, new("avoids-syntax", "WhileStatement")));
    }

    [Fact]
    public async Task Declares_variable_revisa_el_nombre_y_el_tipo()
    {
        Assert.True(await Passes("int edad = 5;", new("declares-variable", "edad", "int")));
        Assert.True(await Passes("var edad = 5;", new("declares-variable", "edad", "int")));
        Assert.True(await Passes("var edad = 5;", new("declares-variable", "edad")));
        Assert.False(await Passes("""string edad = "x";""", new("declares-variable", "edad", "int")));
        Assert.False(await Passes("int otro = 5;", new("declares-variable", "edad")));
        Assert.False(await Passes("int edad = 5;", new("declares-variable", null)));
    }

    [Fact]
    public async Task Declares_variable_acepta_string_con_var_aunque_Roslyn_infiera_string_con_signo()
    {
        // Con `var`, el tipo inferido es `string?`; pedir `string` debe aceptarlo.
        Assert.True(await Passes("""var city = "Lima";""", new("declares-variable", "city", "string")));
        Assert.True(await Passes("""string city = "Lima";""", new("declares-variable", "city", "string")));
        // Quien necesite el tipo con signo lo pide con signo, y solo lo acepta una variable que lo admite.
        Assert.True(await Passes("string? city = null;", new("declares-variable", "city", "string?")));
        Assert.False(await Passes("""string city = "Lima";""", new("declares-variable", "city", "string?")));
        Assert.False(await Passes("""var city = "Lima";""", new("declares-variable", "city", "int")));
    }

    [Fact]
    public async Task Las_reglas_de_tipo_usan_el_nombre_de_metadatos()
    {
        const string list = "var lista = new List<int>();";
        Assert.True(await Passes(list, new("uses-type", Type: "System.Collections.Generic.List`1")));
        Assert.False(await Passes(list, new("avoids-type", Type: "System.Collections.Generic.List`1")));
        Assert.True(await Passes("Console.WriteLine(1);", new("avoids-type", Type: "System.Collections.Generic.List`1")));
    }

    [Fact]
    public async Task Una_regla_de_un_tipo_desconocido_nunca_se_cumple()
    {
        Assert.False(await Passes("Console.WriteLine(1);", new("loquesea", "x")));
    }

    [Fact]
    public async Task Las_reglas_de_sintaxis_tambien_cuentan_palabras_y_comentarios()
    {
        const string code = """
            // one
            /* two */
            const int Max = 3;
            Console.WriteLine(Max);
            """;
        Assert.True(await Passes(code, new("uses-syntax", "ConstKeyword")));
        Assert.True(await Passes(code, new("uses-syntax", "SingleLineCommentTrivia")));
        Assert.True(await Passes(code, new("uses-syntax", "MultiLineCommentTrivia")));
        Assert.False(await Passes(code, new("uses-syntax", "SingleLineCommentTrivia", Min: 2)));
        Assert.False(await Passes(code, new("avoids-syntax", "ConstKeyword")));

        const string plain = "Console.WriteLine(1);";
        Assert.False(await Passes(plain, new("uses-syntax", "ConstKeyword")));
        Assert.True(await Passes(plain, new("avoids-syntax", "ConstKeyword")));
        Assert.True(await Passes(plain, new("avoids-syntax", "SingleLineCommentTrivia")));
    }

    [Fact]
    public async Task Varios_nombres_separados_por_barra_son_alternativas_que_se_suman()
    {
        const string prefix = "int i = 0;\n++i;\nConsole.WriteLine(i);";
        const string postfix = "int i = 0;\ni++;\nConsole.WriteLine(i);";
        const string both = "int i = 0;\ni++;\n++i;\nConsole.WriteLine(i);";
        const string alternatives = "PostIncrementExpression|PreIncrementExpression";
        // Cualquiera de las dos formas cuenta, y se suman para el mínimo.
        Assert.True(await Passes(prefix, new("uses-syntax", alternatives)));
        Assert.True(await Passes(postfix, new("uses-syntax", alternatives)));
        Assert.False(await Passes(postfix, new("uses-syntax", alternatives, Min: 2)));
        Assert.True(await Passes(both, new("uses-syntax", alternatives, Min: 2)));
        // Una sola de las dos no ve la otra.
        Assert.False(await Passes(prefix, new("uses-syntax", "PostIncrementExpression")));
        // avoids-syntax pide que no esté ninguna.
        Assert.False(await Passes(prefix, new("avoids-syntax", alternatives)));
        Assert.True(await Passes("Console.WriteLine(1);", new("avoids-syntax", alternatives)));
        // Los espacios alrededor de la barra no importan, y un nombre que no existe no cuenta.
        Assert.True(await Passes(postfix, new("uses-syntax", "NoExiste | PostIncrementExpression")));
    }

    [Fact]
    public async Task Un_comentario_dentro_de_un_texto_no_cuenta_como_comentario()
    {
        // Las dos diagonales están dentro de una cadena: no son un comentario.
        Assert.False(await Passes("""Console.WriteLine("// no es un comentario");""", new("uses-syntax", "SingleLineCommentTrivia")));
    }

    [Fact]
    public async Task Los_numeros_salen_con_punto_decimal_como_en_el_navegador()
    {
        // Los proyectos usan InvariantGlobalization (Directory.Build.props), igual que el navegador.
        var run = await Run("Console.WriteLine(1234.5);");
        Assert.Equal("1234.5\n", Unix(Assert.Single(run.Runs).Stdout));
    }

    [Fact]
    public async Task Las_reglas_se_reportan_en_el_orden_pedido_con_su_nombre_y_su_minimo()
    {
        var run = await Run(
            "Console.WriteLine(1);",
            rules: [new("calls-method", "Console.WriteLine", Min: 3), new("avoids-syntax", "ForStatement")]
        );
        Assert.Equal(
            new (string, string?, int?, bool)[]
            {
                ("calls-method", "Console.WriteLine", 3, false),
                ("avoids-syntax", "ForStatement", null, true),
            },
            run.Compilation!.Rules.Select(rule => (rule.Kind, rule.Name, rule.Min, rule.Passed)).ToArray()
        );
    }
}
