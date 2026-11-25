using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

// El pedido (JSON) trae la conexión, la intercalación de la base temporal y las corridas; cada corrida
// es una lista de lotes (el script ya partido por GO). La respuesta trae, por corrida y por lote, los
// resultados y los mensajes en el orden en que llegaron.
//
//   dotnet run --project dotnet/sqlserver/Runner -- --in pedido.json --out respuesta.json
//
// Cada corrida crea su propia base (course_capture_<8 letras>), corre sus lotes y la borra. Nunca toca
// otra base: solo se borra una que este programa creó en esa misma corrida.

var arguments = ParseArguments(args);
var request = JsonSerializer.Deserialize<Request>(File.ReadAllText(arguments["--in"]), Json.Options)
    ?? throw new InvalidOperationException("El pedido está vacío.");
var response = Runner.Execute(request);
File.WriteAllText(arguments["--out"], JsonSerializer.Serialize(response, Json.Options), new UTF8Encoding(false));
return 0;

static Dictionary<string, string> ParseArguments(string[] args)
{
    var found = new Dictionary<string, string>();
    // Según la versión del SDK, `dotnet run` pasa o no el `--` que separa sus opciones de las del programa.
    for (var i = 0; i + 1 < args.Length; i++)
        if (args[i] == "--in" || args[i] == "--out") found[args[i]] = args[++i];
    foreach (var key in new[] { "--in", "--out" })
        if (!found.ContainsKey(key)) throw new ArgumentException($"Falta {key}.");
    return found;
}

static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };
}

record Request(string Connection, string Collation, List<Run> Runs);

record Run(string Id, List<string> Batches);

record Message(int Number, int Level, int State, int Line, string Text);

record ResultSet(List<string> Columns, List<List<object?>> Rows);

record BatchOutput(List<ResultSet> Results, List<Message> Messages);

record RunOutput(string Id, List<BatchOutput> Batches);

record Response(string Server, string Collation, List<RunOutput> Runs);

static partial class Runner
{
    /// <summary>El nombre con el que los mensajes hablan de la base: la real lleva un sufijo al azar.</summary>
    const string CanonicalDatabase = "CourseDb";

    const int MaxRows = 5000;

    [GeneratedRegex("^[A-Za-z0-9_.]+$")]
    private static partial Regex Collations();

    public static Response Execute(Request request)
    {
        if (!Collations().IsMatch(request.Collation))
            throw new ArgumentException($"Intercalación no válida: {request.Collation}");
        var outputs = new List<RunOutput>();
        var server = "";
        foreach (var run in request.Runs)
        {
            var name = $"course_capture_{Guid.NewGuid():N}"[..24];
            Admin(request.Connection, $"CREATE DATABASE [{name}] COLLATE {request.Collation}");
            try
            {
                var builder = new SqlConnectionStringBuilder(request.Connection) { InitialCatalog = name };
                using var connection = new SqlConnection(builder.ConnectionString)
                {
                    // Los errores llegan como mensajes y el lote sigue, como en SSMS.
                    FireInfoMessageEventOnUserErrors = true,
                };
                var messages = new List<Message>();
                connection.InfoMessage += (_, e) =>
                {
                    foreach (SqlError error in e.Errors)
                        messages.Add(new Message(error.Number, error.Class, error.State, error.LineNumber,
                            error.Message.Replace(name, CanonicalDatabase)));
                };
                connection.Open();
                if (server == "") server = Scalar(connection, "SELECT CONVERT(varchar(40), SERVERPROPERTY('ProductVersion'))");
                var batches = new List<BatchOutput>();
                foreach (var batch in run.Batches)
                {
                    messages.Clear();
                    var results = new List<ResultSet>();
                    try
                    {
                        using var command = new SqlCommand(batch, connection) { CommandTimeout = 30 };
                        using var reader = command.ExecuteReader();
                        do
                        {
                            if (reader.FieldCount > 0) results.Add(ReadResult(reader));
                        } while (reader.NextResult());
                    }
                    catch (SqlException exception)
                    {
                        // Un error que corta el lote y llega como excepción en lugar de mensaje.
                        foreach (SqlError error in exception.Errors)
                            messages.Add(new Message(error.Number, error.Class, error.State, error.LineNumber,
                                error.Message.Replace(name, CanonicalDatabase)));
                    }
                    batches.Add(new BatchOutput(results, [.. messages]));
                }
                outputs.Add(new RunOutput(run.Id, batches));
            }
            finally
            {
                SqlConnection.ClearAllPools();
                Admin(request.Connection,
                    $"ALTER DATABASE [{name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{name}];");
            }
        }
        return new Response(server, request.Collation, outputs);
    }

    static void Admin(string connectionString, string sql)
    {
        var builder = new SqlConnectionStringBuilder(connectionString) { InitialCatalog = "master" };
        using var connection = new SqlConnection(builder.ConnectionString);
        connection.Open();
        using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        command.ExecuteNonQuery();
    }

    static string Scalar(SqlConnection connection, string sql)
    {
        using var command = new SqlCommand(sql, connection);
        return Convert.ToString(command.ExecuteScalar(), CultureInfo.InvariantCulture) ?? "";
    }

    static ResultSet ReadResult(SqlDataReader reader)
    {
        var columns = Enumerable.Range(0, reader.FieldCount).Select(reader.GetName).ToList();
        var scales = reader.GetColumnSchema().Select(column => column.NumericScale).ToList();
        var rows = new List<List<object?>>();
        while (reader.Read() && rows.Count < MaxRows)
            rows.Add(Enumerable.Range(0, reader.FieldCount).Select(i => Cell(reader, i, scales[i])).ToList());
        return new ResultSet(columns, rows);
    }

    /// <summary>Un valor como lo escribe SSMS en una celda: números como números y lo demás como texto.</summary>
    static object? Cell(SqlDataReader reader, int i, int? scale)
    {
        if (reader.IsDBNull(i)) return null;
        var invariant = CultureInfo.InvariantCulture;
        switch (reader.GetDataTypeName(i))
        {
            case "bit": return reader.GetBoolean(i) ? 1 : 0;
            case "tinyint": return (int)reader.GetByte(i);
            case "smallint": return (int)reader.GetInt16(i);
            case "int": return reader.GetInt32(i);
            case "bigint": return reader.GetInt64(i);
            // El decimal conserva su escala (189.00) si se escribe como texto.
            case "decimal" or "numeric": return reader.GetDecimal(i).ToString(invariant);
            case "money" or "smallmoney": return reader.GetDecimal(i).ToString("0.0000", invariant);
            case "float": return reader.GetDouble(i);
            case "real": return double.Parse(reader.GetFloat(i).ToString("R", invariant), invariant);
            case "date": return reader.GetDateTime(i).ToString("yyyy-MM-dd", invariant);
            case "smalldatetime": return reader.GetDateTime(i).ToString("yyyy-MM-dd HH:mm:ss", invariant);
            case "datetime": return reader.GetDateTime(i).ToString("yyyy-MM-dd HH:mm:ss.fff", invariant);
            case "datetime2": return Fraction(reader.GetDateTime(i), scale ?? 7, invariant);
            case "time": return Fraction(DateTime.MinValue + reader.GetTimeSpan(i), scale ?? 7, invariant, timeOnly: true);
            case "datetimeoffset":
                var stamp = reader.GetDateTimeOffset(i);
                return Fraction(stamp.DateTime, scale ?? 7, invariant) + " " + stamp.ToString("zzz", invariant);
            case "uniqueidentifier": return reader.GetGuid(i).ToString().ToUpperInvariant();
            case "binary" or "varbinary" or "image" or "timestamp" or "rowversion":
                return "0x" + Convert.ToHexString((byte[])reader.GetValue(i));
            default: return Convert.ToString(reader.GetValue(i), invariant);
        }
    }

    /// <summary>La fecha y hora con tantos decimales de segundo como la escala de la columna.</summary>
    static string Fraction(DateTime value, int scale, CultureInfo invariant, bool timeOnly = false)
    {
        var text = value.ToString(timeOnly ? "HH:mm:ss" : "yyyy-MM-dd HH:mm:ss", invariant);
        if (scale <= 0) return text;
        var ticks = (value.Ticks % TimeSpan.TicksPerSecond).ToString("D7", invariant);
        return text + "." + ticks[..Math.Min(scale, 7)];
    }
}
