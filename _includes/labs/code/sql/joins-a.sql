SELECT c.Id, c.Name
FROM Customers AS c
WHERE c.Id IN (SELECT o.CustomerId
               FROM Orders AS o
               WHERE o.OrderDate >= '20261001'
                 AND o.OrderDate <  '20261101');
