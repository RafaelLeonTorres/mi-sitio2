CREATE TABLE Orders (
    Id         INT IDENTITY PRIMARY KEY,
    CustomerId INT           NOT NULL REFERENCES Customers (Id),
    CreatedAt  DATETIME2     NOT NULL,
    Total      DECIMAL(12,2) NOT NULL
);

CREATE TABLE OrderLines (
    OrderId   INT           NOT NULL REFERENCES Orders (Id),
    ProductId INT           NOT NULL REFERENCES Products (Id),
    Quantity  INT           NOT NULL CHECK (Quantity > 0),
    UnitPrice DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (OrderId, ProductId)
);

CREATE INDEX IX_Orders_CustomerId ON Orders (CustomerId);
