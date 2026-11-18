public class OrderService(
    OrderRepository orders, ProductRepository products)
{
    public async Task<Order> CreateAsync(
        int customerId, IReadOnlyList<LineRequest> lines)
    {
        var ids = lines.Select(line => line.ProductId);
        var stock = await products.GetByIdsAsync(ids);
        var order = new Order
        {
            CustomerId = customerId,
            CreatedAt = DateTime.UtcNow,
        };

        foreach (var line in lines)
        {
            var product = stock.Single(p => p.Id == line.ProductId);
            if (product.Stock < line.Quantity)
                throw new BusinessException(
                    $"Not enough stock for {product.Name}.");

            product.Stock -= line.Quantity;
            order.Lines.Add(new OrderLine
            {
                ProductId = product.Id,
                Quantity = line.Quantity,
                UnitPrice = product.Price,
            });
        }

        order.Total = order.Lines.Sum(
            line => line.Quantity * line.UnitPrice);
        await orders.AddAsync(order);
        return order;
    }
}
