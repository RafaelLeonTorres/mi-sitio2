// One query: every Order comes with its Customer, all the
// columns of both tables, tracked by the context.
var orders = await db.Orders
    .Include(o => o.Customer)
    .OrderByDescending(o => o.OrderDate)
    .Take(count)
    .ToListAsync();

var rows = orders.Select(o =>
    new OrderRow(o.Id, o.Customer.Name, o.Total)).ToList();
