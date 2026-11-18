products.MapPost("/", CreateProduct).RequireAuthorization("Catalog");

static async Task<Results<Created<ProductResponse>, ValidationProblem,
    ProblemHttpResult>> CreateProduct(
        CreateProductRequest request,
        ProductService service,
        CancellationToken ct)
{
    // The attributes already ran; these two checks need the database.
    if (!await service.CategoryExistsAsync(request.CategoryId, ct))
        return TypedResults.ValidationProblem(
            new Dictionary<string, string[]>
            {
                ["categoryId"] = ["There's no category with that id."],
            });
    if (await service.SkuExistsAsync(request.Sku, null, ct))
        return TypedResults.Problem(
            $"A product with SKU {request.Sku} already exists.",
            statusCode: StatusCodes.Status409Conflict);

    var product = await service.CreateAsync(request.ToEntity(), ct);
    return TypedResults.Created(
        $"/api/products/{product.Id}", product.ToResponse());
}
