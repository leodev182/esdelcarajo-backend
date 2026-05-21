-- Reactiva variantes que quedaron isActive=false por la antigua lógica automática
-- (stock=0 ponía isActive=false aunque el producto debería seguir visible como "próximamente")
-- Los que no tenían órdenes ya fueron eliminados en la migración anterior.
-- Los que quedan tienen órdenes y deben mostrarse como agotados/próximamente.
UPDATE "ProductVariant"
SET "isActive" = true
WHERE "isActive" = false;
