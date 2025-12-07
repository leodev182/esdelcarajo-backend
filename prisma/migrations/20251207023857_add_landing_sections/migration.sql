-- CreateEnum
CREATE TYPE "SectionType" AS ENUM ('CAROUSEL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TextPosition" AS ENUM ('LEFT', 'CENTER', 'RIGHT', 'TOP', 'BOTTOM');

-- CreateTable
CREATE TABLE "LandingSection" (
    "id" TEXT NOT NULL,
    "type" "SectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "textPosition" "TextPosition" NOT NULL DEFAULT 'CENTER',
    "bgColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionImage" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SectionImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingSection_type_idx" ON "LandingSection"("type");

-- CreateIndex
CREATE INDEX "LandingSection_isActive_idx" ON "LandingSection"("isActive");

-- CreateIndex
CREATE INDEX "LandingSection_order_idx" ON "LandingSection"("order");

-- CreateIndex
CREATE INDEX "SectionImage_sectionId_idx" ON "SectionImage"("sectionId");

-- CreateIndex
CREATE INDEX "SectionImage_order_idx" ON "SectionImage"("order");

-- AddForeignKey
ALTER TABLE "SectionImage" ADD CONSTRAINT "SectionImage_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LandingSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
