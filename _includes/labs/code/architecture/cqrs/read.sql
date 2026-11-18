-- One row per order, already shaped for the "My orders" screen.
CREATE TABLE OrderSummaries (
    OrderId    UNIQUEIDENTIFIER PRIMARY KEY,
    CustomerId INT              NOT NULL,
    ItemCount  INT              NOT NULL,
    Total      DECIMAL(12,2)    NOT NULL,
    Status     NVARCHAR(20)     NOT NULL,
    PlacedAt   DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);

-- "My orders" reads one index, newest first, with no JOINs.
CREATE INDEX IX_OrderSummaries_Customer
    ON OrderSummaries (CustomerId, PlacedAt DESC)
    INCLUDE (ItemCount, Total, Status);
