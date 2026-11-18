public class Product
{
    public int Id { get; set; }
    public required string Sku { get; set; }
    public required string Name { get; set; }
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    // What the product costs the store: internal, never in a response.
    public decimal CostPrice { get; set; }

    // Concurrency token: SQL Server changes it on every UPDATE.
    [Timestamp]
    public byte[] RowVersion { get; set; } = [];

    // Soft delete, hidden by a global query filter.
    public bool IsDeleted { get; set; }

    // Audit fields, filled in by a SaveChanges interceptor.
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = "";
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}
