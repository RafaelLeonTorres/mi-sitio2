// What a client can send. There's no Id, CostPrice, or RowVersion here,
// so a body that brings them changes nothing: they're ignored.
public sealed record CreateProductRequest(
    [Required, StringLength(100, MinimumLength = 3)] string Name,
    [Required, RegularExpression("^[A-Z]{3}-[0-9]{4}$")] string Sku,
    [Range(0.01, double.MaxValue)] decimal Price,
    [Range(0, int.MaxValue)] int Stock,
    [Range(1, int.MaxValue)] int CategoryId);
