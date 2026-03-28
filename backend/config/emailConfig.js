/**
 * Email Configuration
 * Centralizes all email-related configuration with validation and defaults.
 */

const isProduction = process.env.NODE_ENV === "production";

// Validate required environment variables in production
function validateConfig() {
  const errors = [];

  if (isProduction) {
    if (!process.env.SMTP_HOST) errors.push("SMTP_HOST is required");
    if (!process.env.SMTP_USER) errors.push("SMTP_USER is required");
    if (!process.env.SMTP_PASS) errors.push("SMTP_PASS is required");
    if (!process.env.EMAIL_FROM_ADDRESS) errors.push("EMAIL_FROM_ADDRESS is required");
    if (!process.env.EMAIL_TOKEN_SECRET) errors.push("EMAIL_TOKEN_SECRET is required");
    
    if (process.env.EMAIL_TOKEN_SECRET && process.env.EMAIL_TOKEN_SECRET.length < 32) {
      errors.push("EMAIL_TOKEN_SECRET must be at least 32 characters");
    }
  }

  return errors;
}

const config = {
  // SMTP Configuration
  smtp: {
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
    // Connection pool settings
    pool: true,
    maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS || "5", 10),
    maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES || "100", 10),
    // Timeouts
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  },

  // Sender Configuration
  sender: {
    name: process.env.EMAIL_FROM_NAME || "FAQ Manager",
    address: process.env.EMAIL_FROM_ADDRESS || "noreply@localhost",
    replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM_ADDRESS || "noreply@localhost",
  },

  // Token Configuration
  tokens: {
    secret: process.env.EMAIL_TOKEN_SECRET || (isProduction ? null : "dev-token-secret-change-in-production-32chars"),
    passwordResetExpiryHours: parseInt(process.env.PASSWORD_RESET_EXPIRY_HOURS || "1", 10),
    emailVerifyExpiryHours: parseInt(process.env.EMAIL_VERIFY_EXPIRY_HOURS || "24", 10),
    unsubscribeExpiryDays: parseInt(process.env.UNSUBSCRIBE_EXPIRY_DAYS || "365", 10),
  },

  // Queue Configuration
  queue: {
    enabled: process.env.EMAIL_QUEUE_ENABLED !== "false",
    retryAttempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS || "3", 10),
    retryDelayMs: parseInt(process.env.EMAIL_RETRY_DELAY_MS || "60000", 10),
    batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || "10", 10),
    processIntervalMs: parseInt(process.env.EMAIL_PROCESS_INTERVAL_MS || "10000", 10),
  },

  // Report Scheduling
  reports: {
    enabled: process.env.ENABLE_REPORT_EMAILS !== "false",
    dailyCron: process.env.REPORT_CRON_DAILY || "0 8 * * *",      // 8 AM daily
    weeklyCron: process.env.REPORT_CRON_WEEKLY || "0 8 * * 1",    // 8 AM Monday
    monthlyCron: process.env.REPORT_CRON_MONTHLY || "0 8 1 * *",  // 8 AM 1st of month
    timezone: process.env.REPORT_TIMEZONE || "UTC",
  },

  // URLs for email links
  urls: {
    frontend: process.env.FRONTEND_URL || "http://localhost:3004",
    backend: process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:4004",
  },

  // Feature flags
  features: {
    sendWelcomeEmail: process.env.SEND_WELCOME_EMAIL !== "false",
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
    enableUnsubscribe: process.env.ENABLE_UNSUBSCRIBE !== "false",
  },

  // Development/Testing
  isDevelopment: !isProduction,
  isProduction,
  
  // In development, optionally preview emails instead of sending
  previewMode: process.env.EMAIL_PREVIEW_MODE === "true",
  
  // Log level for email service
  logLevel: process.env.EMAIL_LOG_LEVEL || (isProduction ? "info" : "debug"),
};

// Generate formatted "from" address
config.getFromAddress = function () {
  return `"${this.sender.name}" <${this.sender.address}>`;
};

// Get link URLs
config.getResetPasswordUrl = function (token) {
  return `${this.urls.frontend}/reset-password?token=${encodeURIComponent(token)}`;
};

config.getVerifyEmailUrl = function (token) {
  return `${this.urls.frontend}/verify-email?token=${encodeURIComponent(token)}`;
};

config.getUnsubscribeUrl = function (token) {
  return `${this.urls.backend}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
};

config.getDashboardUrl = function () {
  return `${this.urls.frontend}/dashboard`;
};

config.getSettingsUrl = function () {
  return `${this.urls.frontend}/settings`;
};

// Validate configuration
config.validate = function () {
  return validateConfig();
};

// Check if email sending is possible
config.isEmailEnabled = function () {
  if (this.previewMode) return true;
  if (!this.smtp.host || !this.smtp.auth.user) return false;
  return true;
};

module.exports = config;
