DECLARE @LastDate datetime2(0) = '2025-06-19 20:23:53';
DECLARE @LastId int = 800021;
SELECT TOP (20) Id, OrderDate, Total
FROM Orders
WHERE OrderDate < @LastDate
   OR (OrderDate = @LastDate AND Id < @LastId)
ORDER BY OrderDate DESC, Id DESC;
