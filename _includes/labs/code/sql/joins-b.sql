SELECT c.Id, c.Name
FROM Customers AS c
JOIN Orders AS o ON o.CustomerId = c.Id
WHERE o.OrderDate >= '20261001'
  AND o.OrderDate <  '20261101';
