/**
 * Email Provider
 * Unified email provider that supports multiple backends:
 * - Resend (default, recommended)
 * - SMTP via Nodemailer (fallback)
 * 
 * Provider selection:
 * 1. If RESEND_API_KEY is set, use Resend
 * 2. If SMTP_HOST is set, use Nodemailer
 * 3. If EMAIL_PREVIEW_MODE=true, use mock provider
 */

const nodemailer = require("nodemailer");
const emailConfig = require("../config/emailConfig");

// Provider modules
let resendProvider = null;
let activeProvider = null;
let providerType = null;

// Nodemailer transporter (for SMTP fallback)
let smtpTransporter = null;
let isSmtpVerified = false;

/**
 * Initialize the appropriate email provider
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initialize() {
  if (activeProvider && providerType) {
    return true;
  }

  // In preview mode, use mock provider
  if (emailConfig.previewMode) {
    console.log("[EmailProvider] Running in preview mode - emails will be logged but not sent");
    activeProvider = createMockProvider();
    providerType = "preview";
    return true;
  }

  // Try Resend first (preferred)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      resendProvider = require("./resendProvider");
      const initialized = await resendProvider.initialize();
      if (initialized) {
        activeProvider = resendProvider;
        providerType = "resend";
        console.log("[EmailProvider] Using Resend provider");
        return true;
      }
    } catch (error) {
      console.warn("[EmailProvider] Failed to initialize Resend:", error.message);
    }
  }

  // Fallback to SMTP
  if (emailConfig.smtp.host && emailConfig.smtp.auth.user) {
    try {
      const initialized = await initializeSmtp();
      if (initialized) {
        providerType = "smtp";
        console.log("[EmailProvider] Using SMTP provider");
        return true;
      }
    } catch (error) {
      console.warn("[EmailProvider] Failed to initialize SMTP:", error.message);
    }
  }

  console.warn("[EmailProvider] No email provider configured - email sending disabled");
  return false;
}

/**
 * Create a mock provider for preview mode
 */
function createMockProvider() {
  return {
    sendEmail: async (options) => {
      console.log("[EmailProvider] Preview email:", {
        to: options.to,
        subject: options.subject,
        text: options.text?.substring(0, 200) + "...",
      });
      return { success: true, messageId: `preview-${Date.now()}`, preview: true };
    },
    sendBatch: async (emails) => {
      console.log(`[EmailProvider] Preview batch: ${emails.length} emails`);
      return {
        success: true,
        results: emails.map((e, i) => ({ id: `preview-batch-${i}` })),
      };
    },
  };
}

/**
 * Initialize SMTP transporter
 */
async function initializeSmtp() {
  if (smtpTransporter && isSmtpVerified) {
    activeProvider = { sendEmail: sendEmailSmtp };
    return true;
  }

  try {
    smtpTransporter = nodemailer.createTransport({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: {
        user: emailConfig.smtp.auth.user,
        pass: emailConfig.smtp.auth.pass,
      },
      pool: emailConfig.smtp.pool,
      maxConnections: emailConfig.smtp.maxConnections,
      maxMessages: emailConfig.smtp.maxMessages,
      connectionTimeout: emailConfig.smtp.connectionTimeout,
      greetingTimeout: emailConfig.smtp.greetingTimeout,
      socketTimeout: emailConfig.smtp.socketTimeout,
      tls: {
        rejectUnauthorized: emailConfig.isProduction,
      },
    });

    if (!emailConfig.isProduction) {
      await smtpTransporter.verify();
      console.log("[EmailProvider] SMTP connection verified");
    }

    isSmtpVerified = true;
    activeProvider = { sendEmail: sendEmailSmtp };
    return true;
  } catch (error) {
    console.error("[EmailProvider] SMTP initialization failed:", error.message);
    smtpTransporter = null;
    isSmtpVerified = false;
    return false;
  }
}

/**
 * Send email via SMTP
 */
async function sendEmailSmtp(options) {
  if (!smtpTransporter || !isSmtpVerified) {
    return { success: false, error: "SMTP not initialized" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  for (const email of recipients) {
    if (!emailRegex.test(email)) {
      return { success: false, error: `Invalid email address: ${email}` };
    }
  }

  try {
    const mailOptions = {
      from: options.from || emailConfig.getFromAddress(),
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      replyTo: options.replyTo || emailConfig.sender.replyTo,
      headers: {
        "X-Mailer": "FAQ Manager",
        "X-Priority": options.priority || "3",
        ...options.headers,
      },
    };

    if (options.attachments && options.attachments.length > 0) {
      mailOptions.attachments = options.attachments;
    }

    const result = await smtpTransporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      response: result.response,
      provider: "smtp",
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      retryable: isRetryableSmtpError(error),
    };
  }
}

function isRetryableSmtpError(error) {
  const retryableCodes = ["ECONNECTION", "ECONNREFUSED", "ETIMEDOUT", "ESOCKET"];
  if (retryableCodes.includes(error.code)) return true;
  if (error.responseCode && error.responseCode >= 400 && error.responseCode < 500) return true;
  return false;
}

/**
 * Send an email using the active provider
 * @param {object} options Email options
 * @param {string|string[]} options.to Recipient email address(es)
 * @param {string} options.subject Email subject
 * @param {string} options.html HTML content
 * @param {string} [options.text] Plain text content
 * @param {string} [options.from] Custom from address
 * @param {string|string[]} [options.replyTo] Reply-to address(es)
 * @param {string|string[]} [options.cc] CC recipients
 * @param {string|string[]} [options.bcc] BCC recipients
 * @param {object[]} [options.attachments] File attachments
 * @param {object[]} [options.tags] Tracking tags (Resend only)
 * @param {string} [options.emailType] Email type for tagging
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendEmail(options) {
  // Ensure provider is initialized
  if (!activeProvider) {
    const initialized = await initialize();
    if (!initialized) {
      return {
        success: false,
        error: "Email provider not configured",
      };
    }
  }

  // Validate required fields
  if (!options.to || !options.subject) {
    return {
      success: false,
      error: "Missing required fields: to, subject",
    };
  }

  // Use the active provider's sendEmail method
  const result = await activeProvider.sendEmail(options);
  
  // Add provider info to result
  if (result.success && !result.provider) {
    result.provider = providerType;
  }

  return result;
}

/**
 * Send batch emails (Resend only, falls back to sequential for SMTP)
 * @param {object[]} emails Array of email options
 * @returns {Promise<{ success: boolean, results: object[] }>}
 */
async function sendBatch(emails) {
  if (!activeProvider) {
    const initialized = await initialize();
    if (!initialized) {
      return { success: false, error: "Email provider not configured" };
    }
  }

  // If using Resend, use native batch
  if (providerType === "resend" && resendProvider?.sendBatch) {
    return resendProvider.sendBatch(emails);
  }

  // Fallback: send emails sequentially
  const results = [];
  for (const email of emails) {
    const result = await sendEmail(email);
    results.push(result);
  }

  return {
    success: results.every((r) => r.success),
    results,
  };
}

/**
 * Strip HTML tags for plain text fallback
 * @param {string} html HTML content
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (!html) return "";

  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * Close provider connections
 */
async function close() {
  if (smtpTransporter && smtpTransporter.close) {
    smtpTransporter.close();
  }
  if (resendProvider && resendProvider.close) {
    await resendProvider.close();
  }
  smtpTransporter = null;
  isSmtpVerified = false;
  activeProvider = null;
  providerType = null;
}

/**
 * Check if the provider is ready
 * @returns {boolean}
 */
function isReady() {
  return activeProvider !== null && providerType !== null;
}

/**
 * Get provider status
 * @returns {object}
 */
function getStatus() {
  const resendConfigured = !!process.env.RESEND_API_KEY;
  const smtpConfigured = !!emailConfig.smtp.host && !!emailConfig.smtp.auth.user;

  return {
    ready: isReady(),
    provider: providerType,
    previewMode: emailConfig.previewMode,
    resendConfigured,
    smtpConfigured,
    // Provider-specific status
    ...(providerType === "resend" && resendProvider
      ? { resendStatus: resendProvider.getStatus() }
      : {}),
  };
}

/**
 * Get the active provider type
 * @returns {string|null}
 */
function getProviderType() {
  return providerType;
}

module.exports = {
  initialize,
  sendEmail,
  sendBatch,
  close,
  isReady,
  getStatus,
  getProviderType,
  stripHtml,
};
