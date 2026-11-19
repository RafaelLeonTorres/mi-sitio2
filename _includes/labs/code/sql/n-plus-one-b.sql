DECLARE @p int = 100;
SELECT TOP(@p) [o].[Id], [c].[Name], [o].[Total]
FROM [Orders] AS [o]
INNER JOIN [Customers] AS [c] ON [o].[CustomerId] = [c].[Id]
ORDER BY [o].[OrderDate] DESC
