/**
 * Email Routes
 * API endpoints for email management, preferences, and testing.
 */

const express = require("express");
const router = express.Router();
const emailService = require("../services/emailService");
const emailQueueService = require("../services/emailQueueService");
const tokenService = require("../services/tokenService");
const emailScheduler = require("../jobs/emailScheduler");
const authMiddleware = require("../middleware/auth");
const prisma = require("../services/prismaClient");

/**
 * GET /api/email/status
 * Get email service status (protected)
 */
router.get("/status", authMiddleware, async (req, res) => {
  const [serviceStatus, queueStats, schedulerStatus] = await Promise.all([
    emailService.getStatus(),
    emailQueueService.getStats(),
    emailScheduler.getStatus(),
  ]);

  res.json({
    service: serviceStatus,
    queue: queueStats,
    scheduler: schedulerStatus,
  });
});

/**
 * GET /api/email/logs
 * Get email logs for the shop (protected)
 */
router.get("/logs", authMiddleware, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, emailType, status } = req.query;

    const where = {};
    if (req.shopId) where.shopId = req.shopId;
    if (req.userId) where.userId = req.userId;
    if (emailType) where.emailType = emailType;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: {
          id: true,
          emailType: true,
          recipient: true,
          subject: true,
          status: true,
          sentAt: true,
          createdAt: true,
          errorMessage: true,
        },
      }),
      prisma.emailLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/test
 * Send a test email (protected)
 */
router.post("/test", authMiddleware, async (req, res, next) => {
  try {
    const { templateName = "welcome" } = req.body;
    const user = req.user;

    // Only allow certain templates for testing
    const allowedTemplates = ["welcome", "verify-email", "password-reset"];
    if (!allowedTemplates.includes(templateName)) {
      return res.status(400).json({ error: `Invalid template. Allowed: ${allowedTemplates.join(", ")}` });
    }

    let result;
    switch (templateName) {
      case "welcome":
        result = await emailService.sendWelcomeEmail(user);
        break;
      case "verify-email":
        result = await emailService.sendVerificationEmail(user);
        break;
      case "password-reset":
        result = await emailService.sendPasswordResetEmail(user, {
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        });
        break;
    }

    if (result.success) {
      res.json({ success: true, message: `Test ${templateName} email sent to ${user.email}` });
    } else if (result.skipped) {
      res.json({ success: true, skipped: true, reason: result.reason });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/test-report
 * Trigger a test report email (protected)
 */
router.post("/test-report", authMiddleware, async (req, res, next) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ error: "No shop configured" });
    }

    const { frequency = "weekly" } = req.body;
    const validFrequencies = ["daily", "weekly", "monthly"];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({ error: `Invalid frequency. Allowed: ${validFrequencies.join(", ")}` });
    }

    const result = await emailScheduler.triggerReport(req.shopId, frequency);

    if (result.success) {
      res.json({ success: true, message: `Test ${frequency} report sent` });
    } else if (result.skipped) {
      res.json({ success: true, skipped: true, reason: result.reason });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/email/unsubscribe
 * Handle unsubscribe link (public)
 */
router.get("/unsubscribe", async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    const result = tokenService.verifyUnsubscribeToken(token);
    if (!result.valid) {
      return res.status(400).json({ error: result.error || "Invalid or expired token" });
    }

    const { shopId, email, emailType } = result;

    // Find and update settings
    const settings = await prisma.setting.findUnique({ where: { shopId } });
    if (!settings) {
      return res.status(404).json({ error: "Shop not found" });
    }

    // Update unsubscribed types
    let unsubscribedTypes = (settings.emailUnsubscribedTypes || "").split(",").filter(Boolean);
    if (!unsubscribedTypes.includes(emailType)) {
      unsubscribedTypes.push(emailType);
    }

    await prisma.setting.update({
      where: { shopId },
      data: {
        emailUnsubscribedTypes: unsubscribedTypes.join(","),
        // If unsubscribing from "all" or "reports", disable report emails
        ...(emailType === "all" || emailType === "reports"
          ? { emailReportsEnabled: false }
          : {}),
      },
    });

    // Return simple HTML page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                 display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .container { text-align: center; padding: 40px; }
          h1 { color: #10b981; }
          p { color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✓ Unsubscribed</h1>
          <p>You've been unsubscribed from ${emailType === "all" ? "all" : emailType} emails.</p>
          <p>You can update your preferences anytime from your account settings.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/resend-verification
 * Resend verification email (protected)
 */
router.post("/resend-verification", authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;

    if (user.emailVerified) {
      return res.json({ success: true, message: "Email already verified" });
    }

    const result = await emailService.sendVerificationEmail(user);

    if (result.success) {
      res.json({ success: true, message: "Verification email sent" });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/queue/retry
 * Retry failed emails (protected)
 */
router.post("/queue/retry", authMiddleware, async (req, res, next) => {
  try {
    const { emailType } = req.body;
    const count = await emailQueueService.retryFailed(emailType);
    res.json({ success: true, retriedCount: count });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/queue/process
 * Manually trigger queue processing (protected)
 */
router.post("/queue/process", authMiddleware, async (req, res, next) => {
  try {
    const { batchSize } = req.body;
    const result = await emailQueueService.processQueue(batchSize);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
