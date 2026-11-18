products.MapDelete("/{id:int}", DeleteProduct)
    .RequireAuthorization("Admin");

static async Task<Results<NoContent, ProblemHttpResult>> DeleteProduct(
    int id, ProductService service, CancellationToken ct)
{
    var product = await service.FindAsync(id, ct);
    if (product is null)
        return TypedResults.Problem(
            $"There's no product with id {id}.", statusCode: 404);

    // Soft delete: the row stays, and the global query filter hides it.
    product.IsDeleted = true;
    await service.SaveAsync(ct);
    return TypedResults.NoContent();
}
