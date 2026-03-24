-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "first_image_url" TEXT,
    "frontend_url" TEXT NOT NULL,
    "external_product_id" TEXT,
    "handle" TEXT,
    "source_url" TEXT,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "product_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopId_frontend_url_key" ON "Product"("shopId", "frontend_url");

-- CreateIndex
CREATE INDEX "Product_shopId_handle_idx" ON "Product"("shopId", "handle");

-- CreateIndex
CREATE INDEX "Product_shopId_external_product_id_idx" ON "Product"("shopId", "external_product_id");

-- CreateIndex
CREATE INDEX "Question_product_id_idx" ON "Question"("product_id");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
