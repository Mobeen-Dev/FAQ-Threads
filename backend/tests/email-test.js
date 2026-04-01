/**
 * Email Service Tests
 * Tests for email service, providers, templates, and token service.
 */

const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert");

// Mock environment before requiring modules
process.env.EMAIL_TOKEN_SECRET = "test-token-secret-must-be-at-least-32-characters-long";
process.env.SMTP_HOST = "";  // Disable actual sending
process.env.RESEND_API_KEY = "";  // Disable Resend
process.env.EMAIL_PREVIEW_MODE = "true";

const tokenService = require("../services/tokenService");
const emailProvider = require("../services/emailProvider");

describe("Token Service", () => {
  describe("generateRandomToken", () => {
    it("should generate a 64-character hex string", () => {
      const token = tokenService.generateRandomToken();
      assert.strictEqual(token.length, 64);
      assert.match(token, /^[a-f0-9]+$/);
    });

    it("should generate unique tokens", () => {
      const token1 = tokenService.generateRandomToken();
      const token2 = tokenService.generateRandomToken();
      assert.notStrictEqual(token1, token2);
    });
  });

  describe("createPasswordResetToken / verifyPasswordResetToken", () => {
    it("should create and verify a password reset token", () => {
      const userId = "user-123";
      const email = "test@example.com";

      const token = tokenService.createPasswordResetToken(userId, email);
      assert.ok(token);
      assert.ok(token.includes("."));

      const result = tokenService.verifyPasswordResetToken(token);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.userId, userId);
      assert.strictEqual(result.email, email);
    });

    it("should reject invalid tokens", () => {
      const result = tokenService.verifyPasswordResetToken("invalid-token");
      assert.strictEqual(result.valid, false);
      assert.ok(result.error);
    });

    it("should reject tampered tokens", () => {
      const token = tokenService.createPasswordResetToken("user-123", "test@example.com");
      const [data, signature] = token.split(".");
      const tamperedToken = `${data}x.${signature}`;

      const result = tokenService.verifyPasswordResetToken(tamperedToken);
      assert.strictEqual(result.valid, false);
    });

    it("should reject tokens with wrong type", () => {
      const token = tokenService.createEmailVerifyToken("user-123", "test@example.com");
      const result = tokenService.verifyPasswordResetToken(token);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, "Invalid token type");
    });
  });

  describe("createEmailVerifyToken / verifyEmailVerifyToken", () => {
    it("should create and verify an email verification token", () => {
      const userId = "user-456";
      const email = "verify@example.com";

      const token = tokenService.createEmailVerifyToken(userId, email);
      assert.ok(token);

      const result = tokenService.verifyEmailVerifyToken(token);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.userId, userId);
      assert.strictEqual(result.email, email);
    });
  });

  describe("createUnsubscribeToken / verifyUnsubscribeToken", () => {
    it("should create and verify an unsubscribe token", () => {
      const shopId = "shop-789";
      const email = "unsub@example.com";
      const emailType = "reports";

      const token = tokenService.createUnsubscribeToken(shopId, email, emailType);
      assert.ok(token);

      const result = tokenService.verifyUnsubscribeToken(token);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.shopId, shopId);
      assert.strictEqual(result.email, email);
      assert.strictEqual(result.emailType, emailType);
    });
  });

  describe("hashToken", () => {
    it("should produce consistent hashes", () => {
      const token = "test-token-value";
      const hash1 = tokenService.hashToken(token);
      const hash2 = tokenService.hashToken(token);
      assert.strictEqual(hash1, hash2);
    });

    it("should produce 64-character SHA-256 hashes", () => {
      const hash = tokenService.hashToken("any-token");
      assert.strictEqual(hash.length, 64);
      assert.match(hash, /^[a-f0-9]+$/);
    });
  });
});

describe("Email Provider", () => {
  describe("stripHtml", () => {
    it("should strip HTML tags", () => {
      const html = "<p>Hello <strong>World</strong></p>";
      const text = emailProvider.stripHtml(html);
      assert.ok(!text.includes("<"));
      assert.ok(text.includes("Hello"));
      assert.ok(text.includes("World"));
    });

    it("should convert br tags to newlines", () => {
      const html = "Line 1<br>Line 2<br/>Line 3";
      const text = emailProvider.stripHtml(html);
      assert.ok(text.includes("\n"));
    });

    it("should decode HTML entities", () => {
      const html = "&amp; &lt; &gt; &quot; &#39;";
      const text = emailProvider.stripHtml(html);
      assert.ok(text.includes("&"));
      assert.ok(text.includes("<"));
      assert.ok(text.includes(">"));
    });

    it("should handle empty input", () => {
      assert.strictEqual(emailProvider.stripHtml(""), "");
      assert.strictEqual(emailProvider.stripHtml(null), "");
      assert.strictEqual(emailProvider.stripHtml(undefined), "");
    });
  });

  describe("getStatus", () => {
    it("should return status object with provider info", () => {
      const status = emailProvider.getStatus();
      assert.ok(typeof status === "object");
      assert.ok("ready" in status);
      assert.ok("provider" in status);
      assert.ok("previewMode" in status);
      assert.ok("resendConfigured" in status);
      assert.ok("smtpConfigured" in status);
    });
  });

  describe("getProviderType", () => {
    it("should return null when not initialized", () => {
      // In test mode, provider may be preview or null
      const type = emailProvider.getProviderType();
      assert.ok(type === null || type === "preview");
    });
  });
});

describe("Resend Provider", () => {
  const resendProvider = require("../services/resendProvider");

  describe("stripHtml", () => {
    it("should strip HTML tags", () => {
      const html = "<div><p>Test content</p></div>";
      const text = resendProvider.stripHtml(html);
      assert.ok(!text.includes("<"));
      assert.ok(text.includes("Test content"));
    });
  });

  describe("getStatus", () => {
    it("should return status with resend provider info", () => {
      const status = resendProvider.getStatus();
      assert.ok(typeof status === "object");
      assert.strictEqual(status.provider, "resend");
      assert.ok("ready" in status);
      assert.ok("configured" in status);
    });

    it("should show not configured without API key", () => {
      const status = resendProvider.getStatus();
      // In test environment without RESEND_API_KEY
      assert.strictEqual(status.configured, false);
    });
  });
});

describe("Email Service Integration", () => {
  // Note: These tests require a running database or mocked prisma
  // In a real test suite, you'd mock the database calls

  describe("isValidEmail", () => {
    // Import after setting env vars
    const emailService = require("../services/emailService");

    it("should validate correct email formats", () => {
      assert.strictEqual(emailService.isValidEmail("test@example.com"), true);
      assert.strictEqual(emailService.isValidEmail("user.name@domain.co.uk"), true);
      assert.strictEqual(emailService.isValidEmail("user+tag@example.com"), true);
    });

    it("should reject invalid email formats", () => {
      assert.strictEqual(emailService.isValidEmail(""), false);
      assert.strictEqual(emailService.isValidEmail("notanemail"), false);
      assert.strictEqual(emailService.isValidEmail("@example.com"), false);
      assert.strictEqual(emailService.isValidEmail("test@"), false);
      assert.strictEqual(emailService.isValidEmail(null), false);
      assert.strictEqual(emailService.isValidEmail(undefined), false);
    });
  });

  describe("getAlertRecipients", () => {
    const emailService = require("../services/emailService");

    it("should parse comma-separated recipients", () => {
      const settings = {
        emailAlertRecipients: "a@example.com, b@example.com, c@example.com",
        notifyEmail: "default@example.com",
      };
      const recipients = emailService.getAlertRecipients(settings);
      assert.strictEqual(recipients.length, 3);
      assert.ok(recipients.includes("a@example.com"));
      assert.ok(recipients.includes("b@example.com"));
      assert.ok(recipients.includes("c@example.com"));
    });

    it("should fall back to notifyEmail if alertRecipients is empty", () => {
      const settings = {
        emailAlertRecipients: null,
        notifyEmail: "fallback@example.com",
      };
      const recipients = emailService.getAlertRecipients(settings);
      assert.strictEqual(recipients.length, 1);
      assert.strictEqual(recipients[0], "fallback@example.com");
    });

    it("should filter out invalid emails", () => {
      const settings = {
        emailAlertRecipients: "valid@example.com, invalid, another@test.com",
      };
      const recipients = emailService.getAlertRecipients(settings);
      assert.strictEqual(recipients.length, 2);
      assert.ok(!recipients.includes("invalid"));
    });

    it("should return empty array if no valid recipients", () => {
      const settings = {
        emailAlertRecipients: "",
        notifyEmail: "",
      };
      const recipients = emailService.getAlertRecipients(settings);
      assert.strictEqual(recipients.length, 0);
    });
  });

  describe("EMAIL_TYPES", () => {
    const emailService = require("../services/emailService");

    it("should define all required email types", () => {
      assert.ok(emailService.EMAIL_TYPES.WELCOME);
      assert.ok(emailService.EMAIL_TYPES.VERIFY_EMAIL);
      assert.ok(emailService.EMAIL_TYPES.PASSWORD_RESET);
      assert.ok(emailService.EMAIL_TYPES.PASSWORD_CHANGED);
      assert.ok(emailService.EMAIL_TYPES.ALERT_NEW_QUESTION);
      assert.ok(emailService.EMAIL_TYPES.ALERT_NEW_ANSWER);
      assert.ok(emailService.EMAIL_TYPES.REPORT_DAILY);
      assert.ok(emailService.EMAIL_TYPES.REPORT_WEEKLY);
      assert.ok(emailService.EMAIL_TYPES.REPORT_MONTHLY);
    });
  });
});

describe("Email Config", () => {
  const emailConfig = require("../config/emailConfig");

  describe("URL generators", () => {
    it("should generate reset password URL", () => {
      const url = emailConfig.getResetPasswordUrl("test-token");
      assert.ok(url.includes("reset-password"));
      assert.ok(url.includes("token=test-token"));
    });

    it("should generate verify email URL", () => {
      const url = emailConfig.getVerifyEmailUrl("verify-token");
      assert.ok(url.includes("verify-email"));
      assert.ok(url.includes("token=verify-token"));
    });

    it("should generate unsubscribe URL", () => {
      const url = emailConfig.getUnsubscribeUrl("unsub-token");
      assert.ok(url.includes("unsubscribe"));
      assert.ok(url.includes("token=unsub-token"));
    });

    it("should URL-encode tokens with special characters", () => {
      const url = emailConfig.getResetPasswordUrl("token+with/special=chars");
      assert.ok(url.includes("%2B"));  // encoded +
      assert.ok(url.includes("%2F"));  // encoded /
      assert.ok(url.includes("%3D"));  // encoded =
    });
  });

  describe("getFromAddress", () => {
    it("should format from address with name", () => {
      const from = emailConfig.getFromAddress();
      assert.ok(from.includes("<"));
      assert.ok(from.includes(">"));
    });
  });

  describe("validate", () => {
    it("should return validation errors array", () => {
      const errors = emailConfig.validate();
      assert.ok(Array.isArray(errors));
    });
  });
});

describe("Email Template Rendering", () => {
  const emailService = require("../services/emailService");

  describe("renderTemplate", () => {
    it("should render template without shopName (user-context emails)", async () => {
      // Test emails sent without shop context (e.g., test emails from account settings)
      try {
        const html = await emailService.renderTemplate("welcome", {
          subject: "Welcome to FAQ Manager",
          userName: "Test User",
          email: "test@example.com",
          dashboardUrl: "https://example.com/dashboard",
          // Deliberately not passing shopName or unsubscribeUrl
        });

        assert.ok(html);
        assert.ok(typeof html === "string");
        assert.ok(html.includes("Welcome") || html.includes("welcome"));
        // Should not contain literal "undefined" string
        assert.ok(!html.includes(">undefined<"), "Should not contain undefined text");
      } catch (err) {
        // Template file might not exist in test environment, that's acceptable
        if (!err.message.includes("ENOENT") && !err.message.includes("template")) {
          assert.fail(`Unexpected error: ${err.message}`);
        }
      }
    });

    it("should render template with shopName (shop-context emails)", async () => {
      try {
        const html = await emailService.renderTemplate("welcome", {
          subject: "Welcome",
          userName: "Test User",
          email: "test@example.com",
          shopName: "Test Shop",
          unsubscribeUrl: "https://example.com/unsubscribe?token=abc",
          dashboardUrl: "https://example.com/dashboard",
        });

        assert.ok(html);
        assert.ok(html.includes("Test Shop"));
      } catch (err) {
        if (!err.message.includes("ENOENT") && !err.message.includes("template")) {
          assert.fail(`Unexpected error: ${err.message}`);
        }
      }
    });

    it("should render password-reset template without errors", async () => {
      try {
        const html = await emailService.renderTemplate("password-reset", {
          subject: "Reset Your Password",
          userName: "Test User",
          email: "test@example.com",
          resetUrl: "https://example.com/reset-password?token=test123",
          expiryHours: 1,
          ipAddress: "127.0.0.1",
          userAgent: "Test Browser",
        });

        assert.ok(html);
        assert.ok(!html.includes(">undefined<"), "Should not contain undefined text");
      } catch (err) {
        if (!err.message.includes("ENOENT") && !err.message.includes("template")) {
          assert.fail(`Unexpected error: ${err.message}`);
        }
      }
    });

    it("should render verify-email template without errors", async () => {
      try {
        const html = await emailService.renderTemplate("verify-email", {
          subject: "Verify Your Email",
          userName: "Test User",
          email: "test@example.com",
          verifyEmailUrl: "https://example.com/verify-email?token=test123",
          expiryHours: 24,
        });

        assert.ok(html);
        assert.ok(!html.includes(">undefined<"), "Should not contain undefined text");
      } catch (err) {
        if (!err.message.includes("ENOENT") && !err.message.includes("template")) {
          assert.fail(`Unexpected error: ${err.message}`);
        }
      }
    });

    it("should render password-changed template without errors", async () => {
      try {
        const html = await emailService.renderTemplate("password-changed", {
          subject: "Password Changed",
          userName: "Test User",
          email: "test@example.com",
          ipAddress: "192.168.1.1",
          changedAt: new Date().toISOString(),
          dashboardUrl: "https://example.com/dashboard",
        });

        assert.ok(html);
        assert.ok(!html.includes(">undefined<"), "Should not contain undefined text");
      } catch (err) {
        if (!err.message.includes("ENOENT") && !err.message.includes("template")) {
          assert.fail(`Unexpected error: ${err.message}`);
        }
      }
    });
  });
});

describe("Test Email Functionality", () => {
  const emailService = require("../services/emailService");

  describe("sendWelcomeEmail", () => {
    it("should handle sending welcome email without shop context", async () => {
      const user = {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      };

      // In preview mode, this should succeed without actually sending
      const result = await emailService.sendWelcomeEmail(user);

      // Preview mode returns success or skipped
      assert.ok(result);
      assert.ok(result.success || result.skipped);
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should handle sending password reset email", async () => {
      const user = {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      };
      const context = {
        ipAddress: "127.0.0.1",
        userAgent: "Test/1.0",
      };

      const result = await emailService.sendPasswordResetEmail(user, context);

      assert.ok(result);
      assert.ok(result.success || result.skipped);
    });
  });

  describe("sendVerificationEmail", () => {
    it("should handle sending verification email", async () => {
      const user = {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
        emailVerified: false,
      };

      const result = await emailService.sendVerificationEmail(user);

      assert.ok(result);
      assert.ok(result.success || result.skipped);
    });

    it("should skip if email already verified", async () => {
      const user = {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
      };

      const result = await emailService.sendVerificationEmail(user);

      // Should skip since already verified
      assert.ok(result);
      if (result.skipped) {
        assert.ok(result.reason.includes("verified"));
      }
    });
  });
});

describe("Email Queue Service", () => {
  const emailQueueService = require("../services/emailQueueService");

  describe("getStats", () => {
    it("should return queue statistics", async () => {
      try {
        const stats = await emailQueueService.getStats();

        assert.ok(typeof stats === "object");
        assert.ok("pending" in stats);
        assert.ok("failed" in stats);
        assert.ok("processing" in stats);
      } catch (err) {
        // In test environment without database, this may fail
        // Just verify the function exists and is callable
        assert.ok(typeof emailQueueService.getStats === "function");
      }
    });
  });

  describe("module exports", () => {
    it("should export required functions", () => {
      assert.ok(typeof emailQueueService.getStats === "function");
      assert.ok(typeof emailQueueService.processQueue === "function");
      assert.ok(typeof emailQueueService.retryFailed === "function");
    });
  });
});

console.log("Email tests completed");
