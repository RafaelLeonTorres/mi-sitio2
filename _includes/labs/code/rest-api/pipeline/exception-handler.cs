// Turns any unhandled exception into a 500 with Problem Details. The
// client gets nothing about what failed; the log keeps the details.
public sealed class GlobalExceptionHandler(IProblemDetailsService problems)
    : IExceptionHandler
{
    public ValueTask<bool> TryHandleAsync(
        HttpContext context, Exception exception, CancellationToken ct)
    {
        // The middleware already logged it, with the stack trace.
        context.Response.StatusCode = 500;
        return problems.TryWriteAsync(new()
        {
            HttpContext = context,
            Exception = exception,
        });
    }
}
