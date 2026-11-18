public sealed class OutboxPublisher(
    IConnection rabbit, OutboxStore outbox) : BackgroundService
{
    private static readonly BasicProperties Durable =
        new() { Persistent = true };

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // With confirmations on, each publish waits for RabbitMQ.
        await using var channel = await rabbit.CreateChannelAsync(
            new CreateChannelOptions(
                publisherConfirmationsEnabled: true,
                publisherConfirmationTrackingEnabled: true),
            ct);

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync(ct))
        {
            foreach (var message in await outbox.PendingAsync(100, ct))
            {
                await channel.BasicPublishAsync("orders", message.Type,
                    mandatory: true, Durable, message.Body, ct);

                // Marked only after RabbitMQ confirms: at least once.
                await outbox.MarkPublishedAsync(message.Id, ct);
            }
        }
    }
}
