public static class RateLimiting
{
    // 10 requests every 10 seconds for each client address.
    private static readonly FixedWindowRateLimiterOptions PerClient = new()
    {
        PermitLimit = 10,
        Window = TimeSpan.FromSeconds(10),
    };

    public static void AddRateLimiting(
        this WebApplicationBuilder builder) =>
        builder.Services.AddRateLimiter(options =>
        {
            // Without this, a rejected request gets a 503.
            options.RejectionStatusCode = 429;
            options.GlobalLimiter =
                PartitionedRateLimiter.Create<HttpContext, string>(http =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        ClientOf(http), _ => PerClient));
            options.OnRejected = (context, _) =>
            {
                if (context.Lease.TryGetMetadata(
                        MetadataName.RetryAfter, out var wait))
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)wait.TotalSeconds).ToString();
                return ValueTask.CompletedTask;
            };
        });

    private static string ClientOf(HttpContext http) =>
        http.Connection.RemoteIpAddress?.ToString() ?? "";
}
