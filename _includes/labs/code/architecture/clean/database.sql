-- What EF Core sends when it saves the order, in the same transaction
-- as the INSERTs. If another order changed the product first,
-- RowVersion no longer matches, no row is updated, and EF Core throws
-- DbUpdateConcurrencyException.
UPDATE [Products]
SET [Stock] = @p0
OUTPUT INSERTED.[RowVersion]
WHERE [Id] = @p1 AND [RowVersion] = @p2;
