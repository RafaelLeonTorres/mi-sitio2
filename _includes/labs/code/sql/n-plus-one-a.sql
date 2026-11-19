DECLARE @p int = 100;
SELECT TOP(@p) [o].[Id], [o].[CustomerId], [o].[Notes],
    [o].[OrderDate], [o].[ShippingAddress],
    [o].[ShippingCity], [o].[Status], [o].[Total]
FROM [Orders] AS [o]
ORDER BY [o].[OrderDate] DESC
GO
DECLARE @p int = 4217;
SELECT TOP(1) [c].[Id], [c].[City], [c].[CreatedAt],
    [c].[Email], [c].[Name]
FROM [Customers] AS [c]
WHERE [c].[Id] = @p
