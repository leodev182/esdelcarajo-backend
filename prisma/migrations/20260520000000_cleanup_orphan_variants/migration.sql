-- Elimina variantes inactivas que no tienen órdenes asociadas
-- Estas quedaron como soft-delete bloqueando el SKU sin razón real
DELETE FROM "ProductVariant"
WHERE "isActive" = false
  AND id NOT IN (
    SELECT DISTINCT "variantId" FROM "OrderItem"
  );
