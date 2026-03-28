#!/usr/bin/env node
/**
 * Email Test Script
 * Sends all email types to a specified email address for testing.
 * 
 * Usage:
 *   node scripts/test-emails.js your@email.com
 *   
 * Or with npm:
 *   npm run test:send-emails -- your@email.com
 */

require("dotenv").config();

const testEmail = process.argv[2];

if (!testEmail || !testEmail.includes("@")) {
  console.error("Usage: node scripts/test-emails.js <your-email@example.com>");
  process.exit(1);
}

console.log(`\n📧 Email Test Script`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Target email: ${testEmail}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

const ejs = require("ejs");
const path = require("path");
const fs = require("fs");
const emailProvider = require("../services/emailProvider");
const emailConfig = require("../config/emailConfig");
const tokenService = require("../services/tokenService");

const TEMPLATES_DIR = path.join(__dirname, "../templates/emails");

// Mock data for testing
const mockShopName = "Test Store";
const mockAppName = emailConfig.sender.name || "FAQ Manager";

const mockReportData = {
  totalQuestions: 150,
  newQuestions: 12,
  answeredQuestions: 145,
  pendingQuestions: 5,
  totalAnswers: 200,
  newAnswers: 8,
  answerRate: 97,
  topCategories: [
    { name: "Shipping", count: 45 },
    { name: "Returns", count: 32 },
    { name: "Products", count: 28 },
  ],
  recentQuestions: [
    { question: "How do I track my order?", status: "answered", createdAt: new Date() },
    { question: "What is your return policy?", status: "pending", createdAt: new Date() },
    { question: "Do you ship internationally?", status: "answered", createdAt: new Date() },
  ],
};

/**
 * Load and render a template directly (bypasses email service logging)
 */
async function renderTemplate(templateName, data) {
  const basePath = path.join(TEMPLATES_DIR, "base.ejs");
  const contentPath = path.join(TEMPLATES_DIR, `${templateName}.ejs`);
  
  const [baseTemplate, contentTemplate] = await Promise.all([
    fs.promises.readFile(basePath, "utf8"),
    fs.promises.readFile(contentPath, "utf8"),
  ]);

  // Common template data with all required variables
  const commonData = {
    appName: mockAppName,
    shopName: mockShopName,
    dashboardUrl: emailConfig.getDashboardUrl(),
    settingsUrl: emailConfig.getSettingsUrl(),
    year: new Date().getFullYear(),
    primaryColor: "#6366f1",
    hoverColor: "#4f46e5",
    recipientName: "Test User",
    unsubscribeUrl: "#",
  };

  // Render content first
  const content = ejs.render(contentTemplate, { ...commonData, ...data });
  
  // Render base with content
  return ejs.render(baseTemplate, { 
    ...commonData, 
    ...data,
    content, 
  });
}

/**
 * Send a test email directly via provider (bypasses service logging)
 * Uses the configured from address or verified domain sender
 */
async function sendTestEmailDirect(to, subject, templateName, templateData) {
  const html = await renderTemplate(templateName, { ...templateData, subject });
  
  // Use the configured EMAIL_FROM_ADDRESS from .env (should be on verified domain)
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || emailConfig.sender.address;
  
  return emailProvider.sendEmail({ 
    to, 
    subject, 
    html,
    from: fromAddress,
  });
}

async function sendTestEmail(name, sendFn) {
  process.stdout.write(`  Sending ${name}... `);
  try {
    const result = await sendFn();
    if (result.success) {
      console.log(`✅ Sent (ID: ${result.messageId || "N/A"})`);
      return true;
    } else {
      console.log(`❌ Failed: ${result.error || "Unknown error"}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  // Initialize email provider
  console.log("Initializing email provider...");
  const initialized = await emailProvider.initialize();
  
  const status = emailProvider.getStatus();
  console.log(`Provider: ${status.provider || "Not initialized"}`);
  console.log(`Ready: ${status.ready}`);
  console.log(`Preview Mode: ${status.previewMode}\n`);

  if (!initialized && !status.previewMode) {
    console.error("❌ Email provider not configured. Set RESEND_API_KEY or SMTP settings.");
    process.exit(1);
  }

  const results = { total: 0, success: 0, failed: 0 };

  // Generate test tokens
  const verifyToken = tokenService.createEmailVerifyToken("test-user", testEmail);
  const resetToken = tokenService.createPasswordResetToken("test-user", testEmail);
  const unsubscribeToken = tokenService.createUnsubscribeToken(testEmail, "all");

  // Date helpers for reports
  const now = new Date();
  const formatDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // 1. Welcome Email
  results.total++;
  if (await sendTestEmail("Welcome Email", () => 
    sendTestEmailDirect(testEmail, `Welcome to ${mockAppName}!`, "welcome", {
      userName: "Test User",
      email: testEmail,
      verifyEmailUrl: emailConfig.getVerifyEmailUrl(verifyToken),
      dashboardUrl: emailConfig.getDashboardUrl(),
    })
  )) results.success++;
  else results.failed++;

  // 2. Email Verification
  results.total++;
  if (await sendTestEmail("Email Verification", () => 
    sendTestEmailDirect(testEmail, "Verify your email address", "verify-email", {
      userName: "Test User",
      verifyEmailUrl: emailConfig.getVerifyEmailUrl(verifyToken),
      expiryHours: emailConfig.tokens.emailVerifyExpiryHours,
    })
  )) results.success++;
  else results.failed++;

  // 3. Password Reset
  results.total++;
  if (await sendTestEmail("Password Reset", () => 
    sendTestEmailDirect(testEmail, "Reset your password", "password-reset", {
      userName: "Test User",
      email: testEmail,
      resetUrl: emailConfig.getResetPasswordUrl(resetToken),
      expiryHours: emailConfig.tokens.passwordResetExpiryHours,
      ipAddress: "192.168.1.100",
      userAgent: "Test Browser",
    })
  )) results.success++;
  else results.failed++;

  // 4. Password Changed
  results.total++;
  if (await sendTestEmail("Password Changed", () => 
    sendTestEmailDirect(testEmail, "Your password has been changed", "password-changed", {
      userName: "Test User",
      email: testEmail,
      changedAt: new Date(),
      ipAddress: "192.168.1.100",
      dashboardUrl: emailConfig.getDashboardUrl(),
    })
  )) results.success++;
  else results.failed++;

  // 5. New Question Alert
  results.total++;
  if (await sendTestEmail("New Question Alert", () => 
    sendTestEmailDirect(testEmail, `[${mockShopName}] New FAQ Question`, "alert-new-question", {
      question: "How do I track my order?",
      productTitle: "Premium Widget",
      categoryName: "Shipping",
      customerName: "John Customer",
      customerEmail: "customer@example.com",
      source: "Storefront Widget",
      submittedAt: new Date(),
      questionUrl: emailConfig.getDashboardUrl(),
    })
  )) results.success++;
  else results.failed++;

  // 6. New Answer Alert
  results.total++;
  if (await sendTestEmail("New Answer Alert", () => 
    sendTestEmailDirect(testEmail, `[${mockShopName}] New Answer Submitted`, "alert-new-answer", {
      questionText: "How do I track my order?",
      answerText: "You can track your order using the tracking link in your confirmation email. Log into your account and navigate to Order History to see the current status and estimated delivery date.",
      contributorName: "Support Agent",
      contributorEmail: "support@example.com",
      isTrusted: true,
      submittedAt: new Date(),
      answerUrl: emailConfig.getDashboardUrl(),
    })
  )) results.success++;
  else results.failed++;

  // 7. Moderation Alert
  results.total++;
  if (await sendTestEmail("Moderation Alert", () => 
    sendTestEmailDirect(testEmail, `[${mockShopName}] Content Needs Review`, "alert-moderation", {
      pendingCount: 5,
      pendingQuestions: 3,
      pendingAnswers: 2,
      recentItems: [
        { type: "question", preview: "How do I track my order?", createdAt: new Date() },
        { type: "answer", preview: "Contact support for help with any issues.", createdAt: new Date() },
        { type: "question", preview: "What is your return policy?", createdAt: new Date() },
      ],
    })
  )) results.success++;
  else results.failed++;

  // 8. Daily Report
  results.total++;
  if (await sendTestEmail("Daily Report", () => 
    sendTestEmailDirect(testEmail, `[${mockShopName}] Daily FAQ Report`, "report", {
      reportTitle: "Daily FAQ Report",
      reportPeriod: "daily",
      periodStart: formatDate(new Date(now - 24*60*60*1000)),
      periodEnd: formatDate(now),
      stats: {
        totalQuestions: 150,
        totalAnswers: 200,
        totalContributors: 12,
      },
      periodStats: {
        newQuestions: 5,
        questionsChange: 25,
        newAnswers: 8,
        answersChange: 15,
        published: 6,
        pending: 2,
      },
      topQuestions: [
        { question: "How do I track my order?", voteScore: 45, answerCount: 3 },
        { question: "What is your return policy?", voteScore: 32, answerCount: 2 },
      ],
      newContributors: [],
    })
  )) results.success++;
  else results.failed++;

  // 9. Weekly Report
  results.total++;
  if (await sendTestEmail("Weekly Report", () => 
    sendTestEmailDirect(testEmail, `[${mockShopName}] Weekly FAQ Report`, "report", {
      reportTitle: "Weekly FAQ Report",
      reportPeriod: "weekly",
      periodStart: formatDate(new Date(now - 7*24*60*60*1000)),
      periodEnd: formatDate(now),
      stats: {
        totalQuestions: 150,
        totalAnswers: 200,
        totalContributors: 12,
      },
      periodStats: {
        newQuestions: 25,
        questionsChange: 12,
        newAnswers: 35,
        answersChange: 20,
        published: 28,
        pending: 5,
      },
      topQuestions: [
        { question: "How do I track my order?", voteScore: 45, answerCount: 3 },
        { question: "What is your return policy?", voteScore: 32, answerCount: 2 },
        { question: "Do you ship internationally?", voteScore: 28, answerCount: 1 },
      ],
      newContributors: [
        { name: "Alice Johnson", email: "alice@example.com" },
        { name: "Bob Smith", email: "bob@example.com" },
      ],
    })
  )) results.success++;
  else results.failed++;

  // 10. Monthly Report
  results.total++;
  if (await sendTestEmail("Monthly Report", () => 
    sendTestEmailDirect(testEmail, `[${mockShopName}] Monthly FAQ Report`, "report", {
      reportTitle: "Monthly FAQ Report",
      reportPeriod: "monthly",
      periodStart: formatDate(new Date(now - 30*24*60*60*1000)),
      periodEnd: formatDate(now),
      stats: {
        totalQuestions: 150,
        totalAnswers: 200,
        totalContributors: 12,
      },
      periodStats: {
        newQuestions: 85,
        questionsChange: 8,
        newAnswers: 120,
        answersChange: 15,
        published: 95,
        pending: 3,
      },
      topQuestions: [
        { question: "How do I track my order?", voteScore: 145, answerCount: 5 },
        { question: "What is your return policy?", voteScore: 98, answerCount: 3 },
        { question: "Do you ship internationally?", voteScore: 76, answerCount: 2 },
      ],
      newContributors: [
        { name: "Alice Johnson", email: "alice@example.com" },
        { name: "Bob Smith", email: "bob@example.com" },
        { name: "Carol Williams", email: "carol@example.com" },
        { name: "David Brown", email: "david@example.com" },
      ],
    })
  )) results.success++;
  else results.failed++;

  // Summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Results: ${results.success}/${results.total} emails sent successfully`);
  
  if (results.failed > 0) {
    console.log(`   ❌ ${results.failed} failed`);
  }

  if (status.previewMode) {
    console.log(`\n⚠️  Preview mode is ON - emails were logged but not actually sent.`);
    console.log(`   Set EMAIL_PREVIEW_MODE=false to send real emails.`);
  } else {
    console.log(`\n✅ Check your inbox at: ${testEmail}`);
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Close provider
  await emailProvider.close();
  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("Test script failed:", error);
  process.exit(1);
});
