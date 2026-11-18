internal sealed class PlaceOrderHandler(
    StoreDbContext db, ICatalog catalog)
{
    public async Task<Order> HandleAsync(
        PlaceOrder command, CancellationToken ct)
    {
        // A method call to another module: no network, no serialization.
        var reserved = await catalog.ReserveAsync(command.Lines, ct)
            ?? throw new OutOfStockException();

        var order = Order.Create(command.CustomerId, reserved);
        db.Orders.Add(order);

        // The order and the stock change are saved in one transaction.
        await db.SaveChangesAsync(ct);
        return order;
    }
}
