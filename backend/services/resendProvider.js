/**
 * Resend Email Provider
 * Handles email sending via Resend API.
 * https://resend.com/docs
 */

const { Resend } = require("resend");
const emailConfig = require("../config/emailConfig");

let resendClient = null;
let isInitialized = false;

/**
 * Initialize the Resend client
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initialize() {
  if (resendClient && isInitialized) {
    return true;
  }

  // In preview mode, use a mock client
  if (emailConfig.previewMode) {
    console.log("[ResendProvider] Running in preview mode - emails will be logged but not sent");
    resendClient = {
      emails: {
        send: async (options) => {
          console.log("[ResendProvider] Preview email:", {
            to: options.to,
            subject: options.subject,
            from: options.from,
          });
          return { data: { id: `preview-${Date.now()}` }, error: null };
        },
      },
    };
    isInitialized = true;
    return true;
  }

  // Check if Resend is configured
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[ResendProvider] RESEND_API_KEY not configured - email sending disabled");
    return false;
  }

  try {
    resendClient = new Resend(apiKey);
    isInitialized = true;
    console.log("[ResendProvider] Resend client initialized");
    return true;
  } catch (error) {
    console.error("[ResendProvider] Failed to initialize:", error.message);
    resendClient = null;
    isInitialized = false;
    return false;
  }
}

/**
 * Send an email via Resend
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
 * @param {object[]} [options.tags] Tracking tags
 * @param {string} [options.scheduledAt] Schedule send time (ISO 8601)
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendEmail(options) {
  // Ensure client is initialized
  if (!resendClient || !isInitialized) {
    const initialized = await initialize();
    if (!initialized) {
      return {
        success: false,
        error: "Resend provider not configured",
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

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  for (const email of recipients) {
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: `Invalid email address: ${email}`,
      };
    }
  }

  try {
    // Build Resend email payload
    const emailPayload = {
      from: options.from || emailConfig.getFromAddress(),
      to: recipients,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    };

    // Add optional fields
    if (options.replyTo) {
      emailPayload.reply_to = Array.isArray(options.replyTo)
        ? options.replyTo
        : [options.replyTo];
    } else if (emailConfig.sender.replyTo) {
      emailPayload.reply_to = [emailConfig.sender.replyTo];
    }

    if (options.cc) {
      emailPayload.cc = Array.isArray(options.cc) ? options.cc : [options.cc];
    }

    if (options.bcc) {
      emailPayload.bcc = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
    }

    // Add attachments (Resend format)
    if (options.attachments && options.attachments.length > 0) {
      emailPayload.attachments = options.attachments.map((att) => ({
        filename: att.filename,
        content: att.content, // Base64 or Buffer
        content_type: att.contentType,
      }));
    }

    // Add tags for tracking
    if (options.tags && options.tags.length > 0) {
      emailPayload.tags = options.tags;
    } else if (options.emailType) {
      // Auto-tag by email type
      emailPayload.tags = [
        { name: "email_type", value: options.emailType },
        { name: "app", value: "faq-manager" },
      ];
    }

    // Schedule send
    if (options.scheduledAt) {
      emailPayload.scheduled_at = options.scheduledAt;
    }

    // Send via Resend
    const { data, error } = await resendClient.emails.send(emailPayload);

    if (error) {
      console.error("[ResendProvider] Send failed:", {
        to: options.to,
        subject: options.subject,
        error: error.message,
        name: error.name,
      });

      return {
        success: false,
        error: error.message,
        code: error.name,
        retryable: isRetryableError(error),
      };
    }

    // Log success (without sensitive data)
    if (emailConfig.logLevel === "debug") {
      console.log("[ResendProvider] Email sent:", {
        to: options.to,
        subject: options.subject,
        messageId: data.id,
      });
    }

    return {
      success: true,
      messageId: data.id,
      provider: "resend",
    };
  } catch (error) {
    console.error("[ResendProvider] Send failed:", {
      to: options.to,
      subject: options.subject,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
      retryable: isRetryableError(error),
    };
  }
}

/**
 * Send batch emails (up to 100)
 * @param {object[]} emails Array of email options
 * @returns {Promise<{ success: boolean, results: object[] }>}
 */
async function sendBatch(emails) {
  if (!resendClient || !isInitialized) {
    const initialized = await initialize();
    if (!initialized) {
      return {
        success: false,
        error: "Resend provider not configured",
      };
    }
  }

  if (!emails || emails.length === 0) {
    return { success: true, results: [] };
  }

  if (emails.length > 100) {
    return {
      success: false,
      error: "Batch size exceeds maximum of 100 emails",
    };
  }

  try {
    const batchPayload = emails.map((email) => ({
      from: email.from || emailConfig.getFromAddress(),
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text || stripHtml(email.html),
      reply_to: email.replyTo
        ? Array.isArray(email.replyTo)
          ? email.replyTo
          : [email.replyTo]
        : undefined,
      tags: email.tags || [
        { name: "email_type", value: email.emailType || "batch" },
        { name: "app", value: "faq-manager" },
      ],
    }));

    const { data, error } = await resendClient.batch.send(batchPayload);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      results: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if an error is retryable
 * @param {Error} error The error to check
 * @returns {boolean}
 */
function isRetryableError(error) {
  const retryableNames = [
    "rate_limit_exceeded",
    "internal_server_error",
    "service_unavailable",
  ];

  if (error.name && retryableNames.includes(error.name.toLowerCase())) {
    return true;
  }

  // Network errors
  if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
    return true;
  }

  // HTTP status codes (5xx are retryable)
  if (error.statusCode && error.statusCode >= 500) {
    return true;
  }

  // Rate limiting (429)
  if (error.statusCode === 429) {
    return true;
  }

  return false;
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
 * Close the client (no-op for Resend, but maintains interface)
 */
async function close() {
  resendClient = null;
  isInitialized = false;
}

/**
 * Check if the provider is ready
 * @returns {boolean}
 */
function isReady() {
  return isInitialized && resendClient !== null;
}

/**
 * Get provider status
 * @returns {object}
 */
function getStatus() {
  const apiKey = process.env.RESEND_API_KEY;
  return {
    ready: isReady(),
    configured: !!apiKey,
    previewMode: emailConfig.previewMode,
    provider: "resend",
  };
}

module.exports = {
  initialize,
  sendEmail,
  sendBatch,
  close,
  isReady,
  getStatus,
  stripHtml,
};
