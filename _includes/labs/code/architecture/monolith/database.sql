-- What SaveChangesAsync sends (simplified): the stock that Catalog
-- reserved and the order that Orders created, in one transaction.
-- If anything fails, nothing is saved.
BEGIN TRANSACTION;

UPDATE Products SET Stock = @p0 WHERE Id = @p1;
UPDATE Products SET Stock = @p2 WHERE Id = @p3;

INSERT INTO Orders (CustomerId, Total)
OUTPUT INSERTED.Id
VALUES (@p4, @p5);

COMMIT;
