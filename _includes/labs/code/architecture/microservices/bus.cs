public sealed class RabbitMqPublisher(IConnection connection)
    : IEventPublisher
{
    public async Task PublishAsync<T>(T message, CancellationToken ct)
    {
        // With confirmations on, publishing waits until RabbitMQ
        // has stored the message.
        await using var channel = await connection.CreateChannelAsync(
            new CreateChannelOptions(
                publisherConfirmationsEnabled: true,
                publisherConfirmationTrackingEnabled: true),
            ct);

        var body = JsonSerializer.SerializeToUtf8Bytes(message);
        var properties = new BasicProperties { Persistent = true };

        // A topic exchange: each subscriber binds its own queue.
        await channel.BasicPublishAsync("orders", "order.placed",
            mandatory: true, properties, body, ct);
    }
}
