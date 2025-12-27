/*
  Warnings:

  - You are about to drop the column `variantId` on the `ProductImage` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductImage" DROP CONSTRAINT "ProductImage_variantId_fkey";

-- DropIndex
DROP INDEX "ProductImage_variantId_idx";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "longDescription" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" DROP COLUMN "variantId";

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "features" TEXT,
ADD COLUMN     "shortDescription" TEXT;

-- CreateTable
CREATE TABLE "ProductImageVariant" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,

    CONSTRAINT "ProductImageVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImageVariant_imageId_idx" ON "ProductImageVariant"("imageId");

-- CreateIndex
CREATE INDEX "ProductImageVariant_variantId_idx" ON "ProductImageVariant"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImageVariant_imageId_variantId_key" ON "ProductImageVariant"("imageId", "variantId");

-- AddForeignKey
ALTER TABLE "ProductImageVariant" ADD CONSTRAINT "ProductImageVariant_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImageVariant" ADD CONSTRAINT "ProductImageVariant_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
