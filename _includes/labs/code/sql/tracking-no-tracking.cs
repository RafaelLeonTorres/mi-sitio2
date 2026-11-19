// The same SQL; the context keeps nothing.
var orders = await db.Orders
    .AsNoTracking()
    .Where(o => o.OrderDate >= from && o.OrderDate < to)
    .ToListAsync();
