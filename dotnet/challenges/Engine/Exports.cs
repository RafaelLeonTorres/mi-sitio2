using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using System.Text.Json;

namespace Challenges.Engine;

/// <summary>
/// Lo que llama el worker de JavaScript. Las respuestas van por <see cref="Report"/> mientras
/// avanza la ejecución, para que la página sepa cuándo empieza el código del visitante y pueda
/// terminar el worker si se pasa del tiempo límite.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class Exports
{
    /// <summary>Avisa al worker: <c>compiled</c>, <c>code</c> o <c>case</c>, con su contenido en JSON.</summary>
    [JSImport("report", "challenges")]
    internal static partial void Report(string kind, int index, string payload);

    /// <summary>Paga el arranque de Roslyn antes de que el visitante pulse Ejecutar; devuelve los milisegundos.</summary>
    [JSExport]
    public static double Warm() => CodeCompiler.Warm();

    /// <summary>Corre los casos de un reto. La petición es un <see cref="RunRequest"/> en JSON.</summary>
    [JSExport]
    public static async Task RunCases(string request)
    {
        var parsed =
            JsonSerializer.Deserialize<RunRequest>(request, Json.Protocol)
            ?? throw new ArgumentException("La petición llegó vacía.", nameof(request));
        await ChallengeRunner.Run(parsed, new BrowserReport());
    }

    /// <summary>Corre el código del playground y devuelve un <see cref="PlaygroundOutcome"/> en JSON.</summary>
    [JSExport]
    public static async Task<string> RunPlayground(string code)
    {
        var outcome = await Playground.Run(code, () => Report("code", -1, ""));
        return JsonSerializer.Serialize(outcome, Json.Protocol);
    }

    private sealed class BrowserReport : IRunReport
    {
        public void Compiled(CompileOutcome outcome) =>
            Report("compiled", -1, JsonSerializer.Serialize(outcome, Json.Protocol));

        public void Code(int index) => Report("code", index, "");

        public void Case(CaseOutcome outcome) =>
            Report("case", outcome.Index, JsonSerializer.Serialize(outcome, Json.Protocol));
    }
}
