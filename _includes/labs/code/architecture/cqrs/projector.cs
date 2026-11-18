// Called for each OrderPlaced that reaches its queue. The insert is
// idempotent: if RabbitMQ delivers the event twice, nothing changes.
public sealed class OrderSummaryProjector(SqlConnection readDb)
{
    public Task ProjectAsync(OrderPlaced placed) =>
        readDb.ExecuteAsync(
            """
            INSERT INTO OrderSummaries
                (OrderId, CustomerId, ItemCount, Total, Status)
            SELECT @OrderId, @CustomerId, @ItemCount, @Total, 'Received'
            WHERE NOT EXISTS (
                SELECT 1 FROM OrderSummaries WHERE OrderId = @OrderId);
            """,
            placed);
}
