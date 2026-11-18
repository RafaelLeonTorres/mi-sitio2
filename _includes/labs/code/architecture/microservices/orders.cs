public sealed class PlaceOrderHandler(
    CatalogClient catalog, OrdersDbContext db, IEventPublisher events)
{
    public async Task<Order> HandleAsync(
        PlaceOrder command, CancellationToken ct)
    {
        // A network call: it can be slow or fail, unlike a method call.
        var prices = await catalog.GetPricesAsync(command.ProductIds, ct);

        var order = Order.Create(command, prices);
        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);

        // Payments learns about the order through an event, not a call.
        var placed = new OrderPlaced(order.Id, order.Total);
        await events.PublishAsync(placed, ct);
        return order;
    }
}
