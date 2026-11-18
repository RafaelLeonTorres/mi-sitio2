public sealed class GetOrderSummaryHandler(SqlConnection readDb)
{
    // No domain model and no rules: a query and a DTO.
    public Task<OrderSummary?> HandleAsync(
        GetOrderSummary query, CancellationToken ct) =>
        readDb.QuerySingleOrDefaultAsync<OrderSummary>(
            new CommandDefinition(
                """
                SELECT OrderId, ItemCount, Total, Status, PlacedAt
                FROM OrderSummaries
                WHERE OrderId = @OrderId
                """,
                new { query.OrderId },
                cancellationToken: ct));
}
