// The only part of Catalog that other modules can see.
public interface ICatalog
{
    // Reserves stock, or returns null if there isn't enough.
    Task<IReadOnlyList<ReservedLine>?> ReserveAsync(
        IReadOnlyList<LineRequest> lines, CancellationToken ct);
}

internal sealed class Catalog(StoreDbContext db) : ICatalog
{
    public async Task<IReadOnlyList<ReservedLine>?> ReserveAsync(
        IReadOnlyList<LineRequest> lines, CancellationToken ct)
    {
        var ids = lines.Select(line => line.ProductId).ToList();
        var products = await db.Products
            .Where(product => ids.Contains(product.Id))
            .ToDictionaryAsync(product => product.Id, ct);

        var reserved = new List<ReservedLine>();
        foreach (var line in lines)
        {
            if (!products.TryGetValue(line.ProductId, out var product)
                || !product.TryReserve(line.Quantity))
                return null;
            reserved.Add(new(product.Id, line.Quantity, product.Price));
        }

        // Nothing is saved here: Orders saves everything in one go.
        return reserved;
    }
}
