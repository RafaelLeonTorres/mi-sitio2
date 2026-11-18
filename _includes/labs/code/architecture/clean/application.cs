public interface IProductRepository
{
    Task<IReadOnlyList<Product>> GetByIdsAsync(
        IEnumerable<int> ids, CancellationToken ct);
}

public sealed class PlaceOrder(
    IProductRepository products,
    IOrderRepository orders,
    IUnitOfWork unitOfWork)
{
    public async Task<Result<OrderDto>> HandleAsync(
        PlaceOrderCommand command, CancellationToken ct)
    {
        var ids = command.Lines.Select(line => line.ProductId);
        var stock = await products.GetByIdsAsync(ids, ct);
        var order = Order.Create(command.CustomerId, command.Lines, stock);
        if (order.IsFailure) return Result<OrderDto>.Failure(order.Errors);

        orders.Add(order.Value);
        await unitOfWork.SaveChangesAsync(ct);
        return Result<OrderDto>.Success(OrderDto.From(order.Value));
    }
}
