products.MapPut("/{id:int}", UpdateProduct)
    .RequireAuthorization("Catalog");

static async Task<Results<NoContent, ProblemHttpResult>> UpdateProduct(
    int id,
    UpdateProductRequest request,
    ProductService service,
    CancellationToken ct)
{
    var product = await service.FindAsync(id, ct);
    if (product is null)
        return TypedResults.Problem(
            $"There's no product with id {id}.", statusCode: 404);
    if (await service.SkuExistsAsync(request.Sku, id, ct))
        return TypedResults.Problem(
            $"A product with SKU {request.Sku} already exists.",
            statusCode: StatusCodes.Status409Conflict);

    // PUT replaces the product: every field comes from the request.
    request.ApplyTo(product);
    await service.SaveAsync(ct);
    return TypedResults.NoContent();
}
