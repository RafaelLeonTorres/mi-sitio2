-- Events wait here until the publisher sends them to RabbitMQ.
-- They're written in the same transaction as the order itself.
CREATE TABLE OutboxMessages (
    Id          UNIQUEIDENTIFIER PRIMARY KEY,
    Type        NVARCHAR(200)    NOT NULL,
    Payload     NVARCHAR(MAX)    NOT NULL,
    OccurredAt  DATETIME2        NOT NULL,
    PublishedAt DATETIME2        NULL
);

-- The publisher only looks for what hasn't gone out yet.
CREATE INDEX IX_OutboxMessages_Pending
    ON OutboxMessages (OccurredAt)
    WHERE PublishedAt IS NULL;
