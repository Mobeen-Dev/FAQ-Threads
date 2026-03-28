-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "emailAlertModeration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailAlertNewAnswer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailAlertNewQuestion" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailAlertRecipients" TEXT,
ADD COLUMN     "emailAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailReportFrequency" TEXT NOT NULL DEFAULT 'weekly',
ADD COLUMN     "emailReportLastSent" TIMESTAMP(3),
ADD COLUMN     "emailReportRecipients" TEXT,
ADD COLUMN     "emailReportsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailUnsubscribedTypes" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "emailType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "messageId" TEXT,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "userId" TEXT,
    "shopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailQueue" (
    "id" TEXT NOT NULL,
    "emailType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateData" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "emailLogId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsedToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_shopId_emailType_idx" ON "EmailLog"("shopId", "emailType");

-- CreateIndex
CREATE INDEX "EmailLog_userId_emailType_idx" ON "EmailLog"("userId", "emailType");

-- CreateIndex
CREATE INDEX "EmailLog_recipient_idx" ON "EmailLog"("recipient");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailQueue_idempotencyKey_key" ON "EmailQueue"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailQueue_status_scheduledFor_idx" ON "EmailQueue"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "EmailQueue_priority_idx" ON "EmailQueue"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "UsedToken_tokenHash_key" ON "UsedToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UsedToken_expiresAt_idx" ON "UsedToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
