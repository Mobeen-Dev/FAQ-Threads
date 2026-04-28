-- AlterTable
ALTER TABLE "Setting"
ADD COLUMN "mcpClientKeyHash" TEXT,
ADD COLUMN "mcpClientKeyCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_mcpClientKeyHash_key" ON "Setting"("mcpClientKeyHash");
