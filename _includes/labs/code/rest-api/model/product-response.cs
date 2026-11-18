// What the API returns: no cost, version, soft delete, or audit data.
public sealed record ProductResponse(
    int Id,
    string Sku,
    string Name,
    decimal Price,
    int Stock,
    int CategoryId,
    string CategoryName);

public sealed record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);
