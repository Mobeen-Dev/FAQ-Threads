/**
 * Email Service
 * Main interface for sending emails throughout the application.
 * Handles template rendering, logging, and provider abstraction.
 */

const ejs = require("ejs");
const path = require("path");
const fs = require("fs");
const emailConfig = require("../config/emailConfig");
const emailProvider = require("./emailProvider");
const tokenService = require("./tokenService");
const prisma = require("./prismaClient");

// Template cache
const templateCache = new Map();
const TEMPLATES_DIR = path.join(__dirname, "../templates/emails");

// Email types
const EMAIL_TYPES = {
  WELCOME: "welcome",
  VERIFY_EMAIL: "verify_email",
  PASSWORD_RESET: "password_reset",
  PASSWORD_CHANGED: "password_changed",
  ALERT_NEW_QUESTION: "alert_new_question",
  ALERT_NEW_ANSWER: "alert_new_answer",
  ALERT_MODERATION: "alert_moderation",
  REPORT_DAILY: "report_daily",
  REPORT_WEEKLY: "report_weekly",
  REPORT_MONTHLY: "report_monthly",
};

/**
 * Load and cache a template
 * @param {string} templateName Template name (without extension)
 * @returns {Promise<string>} Template content
 */
async function loadTemplate(templateName) {
  if (templateCache.has(templateName) && emailConfig.isProduction) {
    return templateCache.get(templateName);
  }

  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.ejs`);

  try {
    const content = await fs.promises.readFile(templatePath, "utf8");
    templateCache.set(templateName, content);
    return content;
  } catch (error) {
    console.error(`[EmailService] Template not found: ${templateName}`, error.message);
    throw new Error(`Email template not found: ${templateName}`);
  }
}

/**
 * Render a template with data
 * @param {string} templateName Template name
 * @param {object} data Template data
 * @returns {Promise<string>} Rendered HTML
 */
async function renderTemplate(templateName, data) {
  const [baseTemplate, contentTemplate] = await Promise.all([
    loadTemplate("base"),
    loadTemplate(templateName),
  ]);

  // Render content first
  const content = ejs.render(contentTemplate, {
    ...data,
    appName: emailConfig.sender.name,
    dashboardUrl: emailConfig.getDashboardUrl(),
    settingsUrl: emailConfig.getSettingsUrl(),
  });

  // Render base with content (provide defaults for optional fields)
  return ejs.render(baseTemplate, {
    shopName: null,
    unsubscribeUrl: null,
    ...data,
    content,
    subject: data.subject || "Notification",
    appName: emailConfig.sender.name,
    primaryColor: data.primaryColor || "#6366f1",
    hoverColor: data.hoverColor || "#4f46e5",
  });
}

/**
 * Create an email log entry
 * @param {object} params Log parameters
 * @returns {Promise<object>} Created log entry
 */
async function createEmailLog(params) {
  try {
    return await prisma.emailLog.create({
      data: {
        emailType: params.emailType,
        recipient: params.recipient,
        subject: params.subject,
        status: params.status || "pending",
        userId: params.userId || null,
        shopId: params.shopId || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (error) {
    console.error("[EmailService] Failed to create email log:", error.message);
    return null;
  }
}

/**
 * Update an email log entry
 * @param {string} logId Log entry ID
 * @param {object} data Update data
 */
async function updateEmailLog(logId, data) {
  if (!logId) return;

  try {
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[EmailService] Failed to update email log:", error.message);
  }
}

/**
 * Send an email with logging
 * @param {object} options Email options
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendEmail(options) {
  const {
    to,
    subject,
    templateName,
    templateData,
    emailType,
    userId,
    shopId,
    metadata,
  } = options;

  // Create log entry
  const log = await createEmailLog({
    emailType: emailType || templateName,
    recipient: to,
    subject,
    userId,
    shopId,
    metadata,
  });

  try {
    // Render template
    const html = await renderTemplate(templateName, {
      ...templateData,
      subject,
    });

    // Send email
    const result = await emailProvider.sendEmail({
      to,
      subject,
      html,
    });

    // Update log
    if (log) {
      await updateEmailLog(log.id, {
        status: result.success ? "sent" : "failed",
        messageId: result.messageId,
        errorMessage: result.error,
        sentAt: result.success ? new Date() : null,
        attempts: 1,
        lastAttemptAt: new Date(),
      });
    }

    return result;
  } catch (error) {
    // Update log with error
    if (log) {
      await updateEmailLog(log.id, {
        status: "failed",
        errorMessage: error.message,
        attempts: 1,
        lastAttemptAt: new Date(),
      });
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

// ─── Email Sending Functions ────────────────────────────────────

/**
 * Send welcome email to new user
 * @param {object} user User object with id, email, name
 * @param {object} [options] Additional options
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendWelcomeEmail(user, options = {}) {
  if (!emailConfig.features.sendWelcomeEmail) {
    return { success: true, skipped: true, reason: "Welcome emails disabled" };
  }

  const verifyToken = emailConfig.features.requireEmailVerification
    ? tokenService.createEmailVerifyToken(user.id, user.email)
    : null;

  return sendEmail({
    to: user.email,
    subject: `Welcome to ${emailConfig.sender.name}!`,
    templateName: "welcome",
    templateData: {
      userName: user.name,
      email: user.email,
      verifyEmailUrl: verifyToken ? emailConfig.getVerifyEmailUrl(verifyToken) : null,
      dashboardUrl: emailConfig.getDashboardUrl(),
    },
    emailType: EMAIL_TYPES.WELCOME,
    userId: user.id,
    metadata: { requiresVerification: !!verifyToken },
  });
}

/**
 * Send email verification email
 * @param {object} user User object with id, email, name
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendVerificationEmail(user) {
  const token = tokenService.createEmailVerifyToken(user.id, user.email);

  return sendEmail({
    to: user.email,
    subject: "Verify your email address",
    templateName: "verify-email",
    templateData: {
      userName: user.name,
      verifyEmailUrl: emailConfig.getVerifyEmailUrl(token),
      expiryHours: emailConfig.tokens.emailVerifyExpiryHours,
    },
    emailType: EMAIL_TYPES.VERIFY_EMAIL,
    userId: user.id,
  });
}

/**
 * Send password reset email
 * @param {object} user User object with id, email, name
 * @param {object} [context] Request context (IP, user agent)
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendPasswordResetEmail(user, context = {}) {
  const token = tokenService.createPasswordResetToken(user.id, user.email);

  return sendEmail({
    to: user.email,
    subject: "Reset your password",
    templateName: "password-reset",
    templateData: {
      userName: user.name,
      email: user.email,
      resetUrl: emailConfig.getResetPasswordUrl(token),
      expiryHours: emailConfig.tokens.passwordResetExpiryHours,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
    emailType: EMAIL_TYPES.PASSWORD_RESET,
    userId: user.id,
    metadata: {
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
}

/**
 * Send password changed confirmation email
 * @param {object} user User object with id, email, name
 * @param {object} [context] Request context (IP, user agent)
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendPasswordChangedEmail(user, context = {}) {
  return sendEmail({
    to: user.email,
    subject: "Your password has been changed",
    templateName: "password-changed",
    templateData: {
      userName: user.name,
      email: user.email,
      changedAt: new Date(),
      ipAddress: context.ipAddress,
      dashboardUrl: emailConfig.getDashboardUrl(),
    },
    emailType: EMAIL_TYPES.PASSWORD_CHANGED,
    userId: user.id,
  });
}

/**
 * Send alert for new question submitted
 * @param {object} shop Shop object
 * @param {object} question Question object
 * @param {object} settings Shop settings
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendNewQuestionAlert(shop, question, settings) {
  if (!settings.emailAlertsEnabled || !settings.emailAlertNewQuestion) {
    return { success: true, skipped: true, reason: "Question alerts disabled" };
  }

  const recipients = getAlertRecipients(settings);
  if (recipients.length === 0) {
    return { success: true, skipped: true, reason: "No alert recipients configured" };
  }

  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `New question submitted: "${truncate(question.question, 50)}"`,
        templateName: "alert-new-question",
        templateData: {
          shopName: shop.name || shop.domain,
          question: question.question,
          productTitle: question.productTitle,
          categoryName: question.category?.name,
          customerName: question.customerName,
          customerEmail: question.customerEmail,
          source: question.source,
          submittedAt: question.createdAt,
          questionUrl: `${emailConfig.getDashboardUrl()}/questions/${question.id}`,
          dashboardUrl: emailConfig.getDashboardUrl(),
          settingsUrl: emailConfig.getSettingsUrl(),
          primaryColor: settings.primaryColor,
        },
        emailType: EMAIL_TYPES.ALERT_NEW_QUESTION,
        shopId: shop.id,
        metadata: { questionId: question.id },
      })
    )
  );

  return {
    success: results.every((r) => r.success),
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
}

/**
 * Send alert for new answer submitted
 * @param {object} shop Shop object
 * @param {object} answer Answer object with question
 * @param {object} settings Shop settings
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendNewAnswerAlert(shop, answer, settings) {
  if (!settings.emailAlertsEnabled || !settings.emailAlertNewAnswer) {
    return { success: true, skipped: true, reason: "Answer alerts disabled" };
  }

  const recipients = getAlertRecipients(settings);
  if (recipients.length === 0) {
    return { success: true, skipped: true, reason: "No alert recipients configured" };
  }

  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `New answer submitted for: "${truncate(answer.question?.question || "Question", 50)}"`,
        templateName: "alert-new-answer",
        templateData: {
          shopName: shop.name || shop.domain,
          questionText: answer.question?.question,
          answerText: answer.answerText,
          contributorName: answer.contributor?.name,
          contributorEmail: answer.contributor?.email,
          isTrusted: answer.contributor?.trusted,
          submittedAt: answer.createdAt,
          answerUrl: `${emailConfig.getDashboardUrl()}/questions/${answer.questionId}`,
          dashboardUrl: emailConfig.getDashboardUrl(),
          settingsUrl: emailConfig.getSettingsUrl(),
          primaryColor: settings.primaryColor,
        },
        emailType: EMAIL_TYPES.ALERT_NEW_ANSWER,
        shopId: shop.id,
        metadata: { answerId: answer.id, questionId: answer.questionId },
      })
    )
  );

  return {
    success: results.every((r) => r.success),
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
}

/**
 * Send moderation alert (pending items need attention)
 * @param {object} shop Shop object
 * @param {object} stats Pending item stats
 * @param {object} settings Shop settings
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendModerationAlert(shop, stats, settings) {
  if (!settings.emailAlertsEnabled || !settings.emailAlertModeration) {
    return { success: true, skipped: true, reason: "Moderation alerts disabled" };
  }

  const recipients = getAlertRecipients(settings);
  if (recipients.length === 0) {
    return { success: true, skipped: true, reason: "No alert recipients configured" };
  }

  const totalPending = (stats.pendingQuestions || 0) + (stats.pendingAnswers || 0);
  if (totalPending === 0) {
    return { success: true, skipped: true, reason: "No pending items" };
  }

  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `${totalPending} item${totalPending > 1 ? "s" : ""} pending moderation`,
        templateName: "alert-moderation",
        templateData: {
          shopName: shop.name || shop.domain,
          pendingCount: totalPending,
          pendingQuestions: stats.pendingQuestions || 0,
          pendingAnswers: stats.pendingAnswers || 0,
          recentItems: stats.recentItems || [],
          dashboardUrl: emailConfig.getDashboardUrl(),
          settingsUrl: emailConfig.getSettingsUrl(),
          primaryColor: settings.primaryColor,
        },
        emailType: EMAIL_TYPES.ALERT_MODERATION,
        shopId: shop.id,
        metadata: { pendingQuestions: stats.pendingQuestions, pendingAnswers: stats.pendingAnswers },
      })
    )
  );

  return {
    success: results.every((r) => r.success),
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
}

/**
 * Send report email (daily/weekly/monthly)
 * @param {object} shop Shop object
 * @param {object} reportData Report data
 * @param {string} frequency Report frequency (daily/weekly/monthly)
 * @param {object} settings Shop settings
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendReportEmail(shop, reportData, frequency, settings) {
  if (!settings.emailReportsEnabled) {
    return { success: true, skipped: true, reason: "Report emails disabled" };
  }

  const recipients = getReportRecipients(settings);
  if (recipients.length === 0) {
    return { success: true, skipped: true, reason: "No report recipients configured" };
  }

  const emailType = {
    daily: EMAIL_TYPES.REPORT_DAILY,
    weekly: EMAIL_TYPES.REPORT_WEEKLY,
    monthly: EMAIL_TYPES.REPORT_MONTHLY,
  }[frequency] || EMAIL_TYPES.REPORT_WEEKLY;

  const reportTitle = {
    daily: "Daily FAQ Report",
    weekly: "Weekly FAQ Report",
    monthly: "Monthly FAQ Report",
  }[frequency] || "FAQ Report";

  const unsubscribeToken = tokenService.createUnsubscribeToken(shop.id, recipients[0], "reports");

  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `${reportTitle} - ${shop.name || shop.domain}`,
        templateName: "report",
        templateData: {
          shopName: shop.name || shop.domain,
          reportTitle,
          reportPeriod: frequency,
          periodStart: reportData.periodStart,
          periodEnd: reportData.periodEnd,
          stats: reportData.stats,
          periodStats: reportData.periodStats,
          topQuestions: reportData.topQuestions,
          newContributors: reportData.newContributors,
          dashboardUrl: emailConfig.getDashboardUrl(),
          settingsUrl: emailConfig.getSettingsUrl(),
          unsubscribeUrl: emailConfig.getUnsubscribeUrl(unsubscribeToken),
          primaryColor: settings.primaryColor,
        },
        emailType,
        shopId: shop.id,
        metadata: { frequency, periodStart: reportData.periodStart, periodEnd: reportData.periodEnd },
      })
    )
  );

  // Update last sent timestamp
  try {
    await prisma.setting.update({
      where: { shopId: shop.id },
      data: { emailReportLastSent: new Date() },
    });
  } catch (error) {
    console.error("[EmailService] Failed to update report timestamp:", error.message);
  }

  return {
    success: results.every((r) => r.success),
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
}

// ─── Helper Functions ───────────────────────────────────────────

/**
 * Get alert email recipients from settings
 * @param {object} settings Shop settings
 * @returns {string[]} Array of email addresses
 */
function getAlertRecipients(settings) {
  const recipients = settings.emailAlertRecipients || settings.notifyEmail || "";
  return recipients
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && isValidEmail(e));
}

/**
 * Get report email recipients from settings
 * @param {object} settings Shop settings
 * @returns {string[]} Array of email addresses
 */
function getReportRecipients(settings) {
  const recipients = settings.emailReportRecipients || settings.notifyEmail || "";
  return recipients
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && isValidEmail(e));
}

/**
 * Validate email format
 * @param {string} email Email address
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Truncate string to max length
 * @param {string} str String to truncate
 * @param {number} maxLength Max length
 * @returns {string}
 */
function truncate(str, maxLength) {
  if (!str) return "";
  return str.length > maxLength ? str.substring(0, maxLength) + "..." : str;
}

/**
 * Check if a token has been used (prevent reuse)
 * @param {string} token Token to check
 * @returns {Promise<boolean>}
 */
async function isTokenUsed(token) {
  const hash = tokenService.hashToken(token);
  const used = await prisma.usedToken.findUnique({
    where: { tokenHash: hash },
  });
  return !!used;
}

/**
 * Mark a token as used
 * @param {string} token Token to mark
 * @param {string} type Token type
 * @param {Date} expiresAt When to auto-cleanup
 */
async function markTokenUsed(token, type, expiresAt) {
  const hash = tokenService.hashToken(token);
  try {
    await prisma.usedToken.create({
      data: {
        tokenHash: hash,
        tokenType: type,
        expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    // Ignore duplicate key errors
    if (error.code !== "P2002") {
      console.error("[EmailService] Failed to mark token used:", error.message);
    }
  }
}

/**
 * Clean up expired used tokens
 */
async function cleanupExpiredTokens() {
  try {
    const result = await prisma.usedToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    if (result.count > 0) {
      console.log(`[EmailService] Cleaned up ${result.count} expired tokens`);
    }
  } catch (error) {
    console.error("[EmailService] Token cleanup failed:", error.message);
  }
}

/**
 * Initialize the email service
 */
async function initialize() {
  const initialized = await emailProvider.initialize();
  if (initialized) {
    console.log("[EmailService] Email service initialized");
  } else {
    console.warn("[EmailService] Email service not available - check SMTP configuration");
  }
  return initialized;
}

/**
 * Get service status
 */
function getStatus() {
  return {
    ...emailProvider.getStatus(),
    templatesDir: TEMPLATES_DIR,
    templatesCached: templateCache.size,
  };
}

module.exports = {
  EMAIL_TYPES,
  initialize,
  getStatus,
  sendEmail,
  renderTemplate,
  // Auth emails
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  // Alert emails
  sendNewQuestionAlert,
  sendNewAnswerAlert,
  sendModerationAlert,
  // Report emails
  sendReportEmail,
  // Token management
  isTokenUsed,
  markTokenUsed,
  cleanupExpiredTokens,
  // Helpers
  isValidEmail,
  getAlertRecipients,
  getReportRecipients,
};
