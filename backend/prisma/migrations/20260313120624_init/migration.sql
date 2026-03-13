/*
  Warnings:

  - You are about to drop the column `email` on the `Shop` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,domain]` on the table `Shop` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Shop` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Shop_domain_key";

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "contributorId" TEXT,
ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'dashboard',
ADD COLUMN     "voteScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "autoPublishAnswers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoPublishIfAnswersLessThan" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "autoPublishQuestions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manualPublishAnswers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "manualPublishQuestions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publishAnswersAfterHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "publishAnswersAfterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publishAnswersAfterTimeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishQuestionsAfterHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "publishQuestionsAfterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publishQuestionsAfterTimeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trustedCustomerAutoPublish" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Shop" DROP COLUMN "email",
ADD COLUMN     "apiKey" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "voteScore" INTEGER NOT NULL DEFAULT 0,
    "contributorId" TEXT,
    "questionId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'dashboard',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "voteValue" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "questionId" TEXT,
    "answerId" TEXT,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreContributor" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreContributor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Answer_questionId_status_idx" ON "Answer"("questionId", "status");

-- CreateIndex
CREATE INDEX "Answer_shopId_idx" ON "Answer"("shopId");

-- CreateIndex
CREATE INDEX "Vote_shopId_idx" ON "Vote"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_contributorId_entityType_questionId_key" ON "Vote"("contributorId", "entityType", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_contributorId_entityType_answerId_key" ON "Vote"("contributorId", "entityType", "answerId");

-- CreateIndex
CREATE INDEX "StoreContributor_shopId_status_idx" ON "StoreContributor"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StoreContributor_shopId_email_key" ON "StoreContributor"("shopId", "email");

-- CreateIndex
CREATE INDEX "Question_shopId_voteScore_idx" ON "Question"("shopId", "voteScore");

-- CreateIndex
CREATE INDEX "Question_customerEmail_idx" ON "Question"("customerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_userId_domain_key" ON "Shop"("userId", "domain");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "StoreContributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "StoreContributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "StoreContributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreContributor" ADD CONSTRAINT "StoreContributor_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
