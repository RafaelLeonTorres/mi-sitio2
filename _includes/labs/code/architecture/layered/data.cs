public class OrderRepository(StoreDbContext db)
{
    public async Task AddAsync(Order order)
    {
        db.Orders.Add(order);
        await db.SaveChangesAsync();
    }

    public Task<Order?> FindAsync(int id) =>
        db.Orders
            .AsNoTracking()
            .Include(order => order.Lines)
            .SingleOrDefaultAsync(order => order.Id == id);
}
