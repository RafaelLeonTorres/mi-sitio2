// The same setup in every service, so a trace has no gaps.
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("orders"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddSource("RabbitMQ.Client.*")
        .AddOtlpExporter())
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddRuntimeInstrumentation()
        .AddOtlpExporter());
