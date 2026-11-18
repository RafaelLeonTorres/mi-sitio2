[ApiController]
[Route("api/orders")]
public class OrdersController(OrderService orders) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<OrderDto>> Create(
        CreateOrderRequest request)
    {
        var order = await orders.CreateAsync(
            request.CustomerId, request.Lines);
        return CreatedAtAction(
            nameof(GetById), new { id = order.Id }, OrderDto.From(order));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> GetById(int id) =>
        await orders.FindAsync(id) is { } order
            ? OrderDto.From(order)
            : NotFound();
}
