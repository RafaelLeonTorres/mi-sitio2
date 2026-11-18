// PUT replaces the whole product, so it takes every field again.
public sealed record UpdateProductRequest(
    [Required, StringLength(100, MinimumLength = 3)] string Name,
    [Required, RegularExpression("^[A-Z]{3}-[0-9]{4}$")] string Sku,
    [Range(0.01, double.MaxValue)] decimal Price,
    [Range(0, int.MaxValue)] int Stock,
    [Range(1, int.MaxValue)] int CategoryId);
