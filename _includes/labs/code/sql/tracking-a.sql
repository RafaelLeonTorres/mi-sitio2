DECLARE @from datetime2(0) = '2026-10-01T00:00:00';
DECLARE @to datetime2(0) = '2026-11-01T00:00:00';
SELECT [o].[Id], [o].[CustomerId], [o].[Notes],
    [o].[OrderDate], [o].[ShippingAddress],
    [o].[ShippingCity], [o].[Status], [o].[Total]
FROM [Orders] AS [o]
WHERE [o].[OrderDate] >= @from AND [o].[OrderDate] < @to
