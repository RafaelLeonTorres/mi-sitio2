public sealed class OrderPlacedConsumer(
    IConnection connection, PaymentService payments) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var channel = await connection.CreateChannelAsync(
            cancellationToken: ct);
        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, delivery) =>
        {
            var placed = JsonSerializer
                .Deserialize<OrderPlaced>(delivery.Body.Span)!;

            // The same message can arrive twice: charge only once.
            await payments.ChargeOnceAsync(placed, ct);
            await channel.BasicAckAsync(delivery.DeliveryTag, false, ct);
        };

        // autoAck: false, so a crash before the ack redelivers it.
        await channel.BasicConsumeAsync(
            "payments.order-placed", autoAck: false, consumer, ct);
        await Task.Delay(Timeout.Infinite, ct);
    }
}
