products.MapGet("/", async (
    ProductService service,
    CancellationToken ct,
    [Range(1, int.MaxValue)] int page = 1,
    [Range(1, 50)] int pageSize = 10,
    string? search = null) =>
    TypedResults.Ok(await service.ListAsync(page, pageSize, search, ct)));

// In ProductService. A global query filter already hides deleted rows,
// and the column's _CI_AI collation ignores case and accents.
public async Task<PagedResponse<ProductResponse>> ListAsync(
    int page, int pageSize, string? search, CancellationToken ct)
{
    var query = db.Products.AsNoTracking();
    if (!string.IsNullOrWhiteSpace(search))
        query = query.Where(product =>
            product.Name.Contains(search) || product.Sku.Contains(search));

    var total = await query.CountAsync(ct);
    var items = await query
        .OrderBy(product => product.Id)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .Select(product => new ProductResponse(
            product.Id, product.Sku, product.Name, product.Price,
            product.Stock, product.CategoryId, product.Category.Name))
        .ToListAsync(ct);
    var pages = (total + pageSize - 1) / pageSize;
    return new(items, page, pageSize, total, pages);
}
