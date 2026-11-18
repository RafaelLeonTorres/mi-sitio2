var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();
app.MapPost("/api/orders", Create);
app.Run();

static async Task<Results<Created<OrderDto>, ValidationProblem>> Create(
    PlaceOrderRequest request, PlaceOrder placeOrder, CancellationToken ct)
{
    var result = await placeOrder.HandleAsync(request.ToCommand(), ct);
    if (result.IsFailure)
        return TypedResults.ValidationProblem(result.Errors);

    var order = result.Value;
    return TypedResults.Created($"/api/orders/{order.Id}", order);
}
