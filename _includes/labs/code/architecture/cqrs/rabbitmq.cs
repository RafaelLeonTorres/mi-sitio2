// One exchange for order events, and one queue per subscriber.
await channel.ExchangeDeclareAsync(
    "orders", ExchangeType.Topic, durable: true);

var deadLetters = new Dictionary<string, object?>
{
    // A message that keeps failing goes here instead of looping.
    ["x-dead-letter-exchange"] = "orders.dead-letter",
};
await channel.QueueDeclareAsync("read-model.orders", durable: true,
    exclusive: false, autoDelete: false, arguments: deadLetters);

// The projector gets every order event: order.placed,
// order.cancelled and whatever comes next.
await channel.QueueBindAsync(
    "read-model.orders", "orders", routingKey: "order.*");
