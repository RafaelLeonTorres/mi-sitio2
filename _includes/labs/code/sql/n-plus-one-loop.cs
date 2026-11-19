// The latest orders, then each order's customer.
var orders = await db.Orders
    .OrderByDescending(o => o.OrderDate)
    .Take(count)
    .ToListAsync();

var rows = new List<OrderRow>();
foreach (var order in orders)
{
    // FindAsync looks in the context first: a customer
    // that isn't loaded yet costs one more query.
    var customer =
        await db.Customers.FindAsync(order.CustomerId);
    rows.Add(new(order.Id, customer!.Name, order.Total));
}

record OrderRow(int Id, string Customer, decimal Total);
