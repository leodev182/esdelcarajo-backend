/*
  Warnings:

  - A unique constraint covering the columns `[categoryId,slug]` on the table `Subcategory` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Subcategory_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "Subcategory_categoryId_slug_key" ON "Subcategory"("categoryId", "slug");
