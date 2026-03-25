/*
  Warnings:

  - A unique constraint covering the columns `[webhookKey]` on the table `Shop` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "productHandle" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "productTitle" TEXT;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "webhookKey" TEXT;

-- CreateIndex
CREATE INDEX "Question_shopId_productId_status_idx" ON "Question"("shopId", "productId", "status");

-- CreateIndex
CREATE INDEX "Question_shopId_productHandle_status_idx" ON "Question"("shopId", "productHandle", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_webhookKey_key" ON "Shop"("webhookKey");
