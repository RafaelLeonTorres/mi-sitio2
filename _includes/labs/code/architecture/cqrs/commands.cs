public sealed class PlaceOrderHandler(WriteDbContext db)
{
    public async Task<Guid> HandleAsync(
        PlaceOrder command, CancellationToken ct)
    {
        var products = await db.Products
            .Where(product => command.ProductIds.Contains(product.Id))
            .ToListAsync(ct);
        var order = Order.Create(command, products); // reserves stock

        db.Orders.Add(order);
        db.Outbox.Add(OutboxMessage.From(new OrderPlaced(
            order.Id, order.CustomerId, order.Lines.Count, order.Total)));

        // One transaction: the order and its event, or neither.
        await db.SaveChangesAsync(ct);
        return order.Id;
    }
}
