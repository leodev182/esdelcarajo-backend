ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "handledByAdminId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_handledByAdminId_fkey" FOREIGN KEY ("handledByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Order_handledByAdminId_idx" ON "Order"("handledByAdminId");
