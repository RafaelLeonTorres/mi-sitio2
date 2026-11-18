products.MapGet("/{id:int}", GetProduct);

static async Task<Results<Ok<ProductResponse>, ProblemHttpResult>>
    GetProduct(int id, ProductService service, CancellationToken ct) =>
    await service.FindAsync(id, ct) is { } product
        ? TypedResults.Ok(product.ToResponse())
        : TypedResults.Problem(
            $"There's no product with id {id}.", statusCode: 404);

// In ProductService: the global query filter skips IsDeleted rows.
public Task<Product?> FindAsync(int id, CancellationToken ct) =>
    db.Products
        .Include(product => product.Category)
        .FirstOrDefaultAsync(product => product.Id == id, ct);
