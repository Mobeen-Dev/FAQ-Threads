-- AlterTable
ALTER TABLE "Setting"
ADD COLUMN "mcpTokenHash" TEXT,
ADD COLUMN "mcpTokenCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_mcpTokenHash_key" ON "Setting"("mcpTokenHash");
