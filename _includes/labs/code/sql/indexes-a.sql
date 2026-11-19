DECLARE @CustomerId int = 4217;
SELECT Id, OrderDate, Total
FROM Orders
WHERE CustomerId = @CustomerId;
