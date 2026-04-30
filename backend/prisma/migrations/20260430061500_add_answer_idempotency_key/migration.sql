-- AlterTable
ALTER TABLE "Answer" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Answer_shopId_idempotencyKey_key" ON "Answer"("shopId", "idempotencyKey");
