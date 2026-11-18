public sealed class Order
{
    private readonly List<OrderLine> lines = [];

    private Order(int customerId) => CustomerId = customerId;

    public int Id { get; private set; }
    public int CustomerId { get; }
    public IReadOnlyList<OrderLine> Lines => lines;
    public decimal Total => lines.Sum(line => line.Subtotal);

    public static Result<Order> Create(
        int customerId,
        IEnumerable<OrderItem> items,
        IReadOnlyList<Product> products)
    {
        var order = new Order(customerId);
        var byId = products.ToDictionary(product => product.Id);
        foreach (var item in items)
        {
            if (!byId.TryGetValue(item.ProductId, out var product))
                return Result<Order>.Failure(
                    "lines", $"Product {item.ProductId} doesn't exist.");
            if (!product.TryReserve(item.Quantity))
                return Result<Order>.Failure(
                    "lines", $"Not enough stock for {product.Name}.");

            order.lines.Add(
                new OrderLine(product.Id, item.Quantity, product.Price));
        }

        return order.lines.Count > 0
            ? Result<Order>.Success(order)
            : Result<Order>.Failure("lines", "The order has no products.");
    }
}
