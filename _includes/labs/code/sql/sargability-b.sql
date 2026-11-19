SELECT Id, OrderDate, Total
FROM Orders
WHERE OrderDate >= '20260101'
  AND OrderDate <  '20270101';
