// One query with a JOIN for the three columns the page
// shows. Nothing is tracked: OrderRow isn't an entity.
var rows = await db.Orders
    .OrderByDescending(o => o.OrderDate)
    .Select(o => new OrderRow(
        o.Id, o.Customer.Name, o.Total))
    .Take(count)
    .ToListAsync();
