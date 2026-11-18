// Commands and queries take separate paths from the very first line.
app.MapPost("/api/orders", async (
    PlaceOrder command, PlaceOrderHandler handler, CancellationToken ct) =>
{
    var id = await handler.HandleAsync(command, ct);
    return TypedResults.Created($"/api/orders/{id}", new { id });
});

app.MapGet("/api/orders/{id:guid}", async (
    Guid id, GetOrderSummaryHandler handler, CancellationToken ct) =>
    await handler.HandleAsync(new GetOrderSummary(id), ct) is { } order
        ? Results.Ok(order)
        : Results.NotFound());
