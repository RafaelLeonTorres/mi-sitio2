// Only the columns the page shows, and nothing to track.
var orders = await db.Orders
    .Where(o => o.OrderDate >= from && o.OrderDate < to)
    .Select(o => new OrderSummary(
        o.Id, o.OrderDate, o.Total))
    .ToListAsync();

record OrderSummary(
    int Id, DateTime OrderDate, decimal Total);
