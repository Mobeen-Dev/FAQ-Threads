/**
 * Email Queue Service
 * Handles background email sending with retry logic and deduplication.
 */

const emailConfig = require("../config/emailConfig");

// Lazy load to avoid circular dependency issues
let prisma = null;
let emailService = null;

function getPrisma() {
  if (!prisma) {
    prisma = require("./prismaClient");
  }
  return prisma;
}

function getEmailService() {
  if (!emailService) {
    emailService = require("./emailService");
  }
  return emailService;
}

let isProcessing = false;
let processInterval = null;

/**
 * Add an email to the queue
 * @param {object} params Queue parameters
 * @returns {Promise<object>} Queue entry
 */
async function enqueue(params) {
  const {
    emailType,
    recipient,
    subject,
    templateData,
    priority = 0,
    scheduledFor,
    idempotencyKey,
  } = params;

  const db = getPrisma();

  // Check for duplicate if idempotency key provided
  if (idempotencyKey) {
    const existing = await db.emailQueue.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { queued: false, duplicate: true, existing };
    }
  }

  try {
    const entry = await db.emailQueue.create({
      data: {
        emailType,
        recipient,
        subject,
        templateData: JSON.stringify(templateData),
        priority,
        scheduledFor: scheduledFor || new Date(),
        maxAttempts: emailConfig.queue.retryAttempts,
        idempotencyKey,
      },
    });

    return { queued: true, entry };
  } catch (error) {
    // Handle duplicate idempotency key
    if (error.code === "P2002") {
      return { queued: false, duplicate: true };
    }
    throw error;
  }
}

/**
 * Process pending emails from the queue
 * @param {number} [batchSize] Number of emails to process
 * @returns {Promise<object>} Processing results
 */
async function processQueue(batchSize) {
  if (isProcessing) {
    return { skipped: true, reason: "Already processing" };
  }

  isProcessing = true;
  const db = getPrisma();
  const size = batchSize || emailConfig.queue.batchSize;
  const results = { processed: 0, success: 0, failed: 0, retried: 0 };

  try {
    // Get pending emails ordered by priority and scheduled time
    const pending = await db.emailQueue.findMany({
      where: {
        status: "pending",
        scheduledFor: { lte: new Date() },
      },
      orderBy: [
        { priority: "desc" },
        { scheduledFor: "asc" },
      ],
      take: size,
    });

    for (const item of pending) {
      results.processed++;

      // Mark as processing
      await db.emailQueue.update({
        where: { id: item.id },
        data: { status: "processing" },
      });

      try {
        const templateData = JSON.parse(item.templateData);
        const result = await getEmailService().sendEmail({
          to: item.recipient,
          subject: item.subject,
          templateName: item.emailType,
          templateData,
          emailType: item.emailType,
        });

        if (result.success) {
          await db.emailQueue.update({
            where: { id: item.id },
            data: {
              status: "completed",
              processedAt: new Date(),
              emailLogId: result.logId,
            },
          });
          results.success++;
        } else {
          await handleFailure(item, result.error);
          results.failed++;
        }
      } catch (error) {
        await handleFailure(item, error.message);
        results.failed++;
      }
    }

    return results;
  } finally {
    isProcessing = false;
  }
}

/**
 * Handle email send failure
 * @param {object} item Queue item
 * @param {string} error Error message
 */
async function handleFailure(item, error) {
  const db = getPrisma();
  const attempts = item.attempts + 1;

  if (attempts >= item.maxAttempts) {
    // Max retries reached - mark as failed
    await db.emailQueue.update({
      where: { id: item.id },
      data: {
        status: "failed",
        attempts,
        lastError: error,
        processedAt: new Date(),
      },
    });
  } else {
    // Schedule retry with exponential backoff
    const backoffMs = emailConfig.queue.retryDelayMs * Math.pow(2, attempts - 1);
    const nextAttempt = new Date(Date.now() + backoffMs);

    await db.emailQueue.update({
      where: { id: item.id },
      data: {
        status: "pending",
        attempts,
        lastError: error,
        scheduledFor: nextAttempt,
      },
    });
  }
}

/**
 * Start the queue processor
 */
function startProcessor() {
  if (processInterval) {
    return;
  }

  if (!emailConfig.queue.enabled) {
    console.log("[EmailQueue] Queue processing disabled");
    return;
  }

  console.log("[EmailQueue] Starting queue processor");
  processInterval = setInterval(async () => {
    try {
      const results = await processQueue();
      if (results.processed > 0) {
        console.log("[EmailQueue] Processed:", results);
      }
    } catch (error) {
      console.error("[EmailQueue] Processing error:", error.message);
    }
  }, emailConfig.queue.processIntervalMs);
}

/**
 * Stop the queue processor
 */
function stopProcessor() {
  if (processInterval) {
    clearInterval(processInterval);
    processInterval = null;
    console.log("[EmailQueue] Queue processor stopped");
  }
}

/**
 * Get queue statistics
 * @returns {Promise<object>} Queue stats
 */
async function getStats() {
  const db = getPrisma();
  const [pending, processing, completed, failed] = await Promise.all([
    db.emailQueue.count({ where: { status: "pending" } }),
    db.emailQueue.count({ where: { status: "processing" } }),
    db.emailQueue.count({ where: { status: "completed" } }),
    db.emailQueue.count({ where: { status: "failed" } }),
  ]);

  return { pending, processing, completed, failed };
}

/**
 * Clean up old completed/failed queue entries
 * @param {number} [daysOld] Entries older than this many days (default: 7)
 */
async function cleanup(daysOld = 7) {
  const db = getPrisma();
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  try {
    const result = await db.emailQueue.deleteMany({
      where: {
        status: { in: ["completed", "failed"] },
        processedAt: { lt: cutoff },
      },
    });

    if (result.count > 0) {
      console.log(`[EmailQueue] Cleaned up ${result.count} old entries`);
    }

    return result.count;
  } catch (error) {
    console.error("[EmailQueue] Cleanup failed:", error.message);
    return 0;
  }
}

/**
 * Retry failed emails
 * @param {string} [emailType] Filter by email type
 * @returns {Promise<number>} Number of items reset for retry
 */
async function retryFailed(emailType) {
  const db = getPrisma();
  const where = { status: "failed" };
  if (emailType) {
    where.emailType = emailType;
  }

  try {
    const result = await db.emailQueue.updateMany({
      where,
      data: {
        status: "pending",
        attempts: 0,
        scheduledFor: new Date(),
      },
    });

    return result.count;
  } catch (error) {
    console.error("[EmailQueue] Retry failed:", error.message);
    return 0;
  }
}

module.exports = {
  enqueue,
  processQueue,
  startProcessor,
  stopProcessor,
  getStats,
  cleanup,
  retryFailed,
};
