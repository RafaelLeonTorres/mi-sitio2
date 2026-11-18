// Mapping by hand: every field is a deliberate choice, and the compiler
// complains if a property is renamed.
public static class ProductMapping
{
    public static ProductResponse ToResponse(this Product product) =>
        new(product.Id, product.Sku, product.Name, product.Price,
            product.Stock, product.CategoryId, product.Category.Name);

    public static Product ToEntity(this CreateProductRequest request) =>
        new()
        {
            Name = request.Name.Trim(),
            Sku = request.Sku,
            Price = request.Price,
            Stock = request.Stock,
            CategoryId = request.CategoryId,
        };

    public static void ApplyTo(
        this UpdateProductRequest request, Product product)
    {
        product.Name = request.Name.Trim();
        product.Sku = request.Sku;
        product.Price = request.Price;
        product.Stock = request.Stock;
        product.CategoryId = request.CategoryId;
    }
}
