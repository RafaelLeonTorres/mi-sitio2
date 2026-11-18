// Gives every request an id that goes into the response and, as a
// logging scope, into every line the request writes.
public sealed class CorrelationIdMiddleware(
    RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        // The same id that Problem Details shows in traceId.
        var id = Activity.Current?.TraceId.ToString()
            ?? context.TraceIdentifier;
        context.Response.Headers["X-Correlation-Id"] = id;

        using var scope = logger.BeginScope(
            new Dictionary<string, object> { ["CorrelationId"] = id });
        await next(context);
    }
}
