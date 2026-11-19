// Tracking is EF Core's default: the context keeps each
// Order with a copy of its original values.
var orders = await db.Orders
    .Where(o => o.OrderDate >= from && o.OrderDate < to)
    .ToListAsync();
