# Email Integration Module Documentation

This document describes the email integration module for the FAQ Manager application, including setup, configuration, usage, and extension guidelines.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup](#setup)
4. [Configuration](#configuration)
5. [Email Types](#email-types)
6. [Usage Examples](#usage-examples)
7. [Templates](#templates)
8. [Queue System](#queue-system)
9. [Scheduled Reports](#scheduled-reports)
10. [Security](#security)
11. [Deliverability Best Practices](#deliverability-best-practices)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)
14. [Extension Guide](#extension-guide)

---

## Overview

The email module provides a complete, production-ready email integration for the FAQ Manager application. It supports:

- **Transactional emails**: Welcome, verification, password reset
- **Alert emails**: New questions, new answers, moderation needed
- **Report emails**: Daily, weekly, monthly analytics reports
- **Background processing**: Queue-based sending with retry logic
- **Per-shop configuration**: Each shop controls their notification preferences

### Supported Providers

| Provider | Recommended | Features |
|----------|-------------|----------|
| **Resend** | ✅ Yes | Modern API, excellent deliverability, batch sending, analytics |
| **SMTP** | Fallback | Works with SendGrid, Mailgun, AWS SES, any SMTP service |

The system automatically selects the best available provider:
1. If `RESEND_API_KEY` is set → Use Resend
2. If `SMTP_HOST` is set → Use SMTP/Nodemailer
3. If `EMAIL_PREVIEW_MODE=true` → Log emails without sending

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│  (Routes, Services, Webhooks, Scheduler)                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     emailService.js                              │
│  - Main interface for all email operations                      │
│  - Template rendering with EJS                                   │
│  - Token generation/verification                                 │
│  - Email logging                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│   emailQueueService.js  │   │    emailProvider.js     │
│  - Background queue     │──▶│  - Provider selection   │
│  - Retry logic          │   │  - Unified interface    │
│  - Deduplication        │   └───────────┬─────────────┘
└─────────────────────────┘               │
                            ┌─────────────┴─────────────┐
                            ▼                           ▼
                 ┌─────────────────────┐   ┌─────────────────────┐
                 │  resendProvider.js  │   │  SMTP (Nodemailer)  │
                 │  - Resend API       │   │  - Generic SMTP     │
                 │  - Batch sending    │   │  - Connection pool  │
                 │  - Tags & tracking  │   └─────────────────────┘
                 └─────────────────────┘
```

### File Structure

```
backend/
├── config/
│   └── emailConfig.js        # Configuration & URL generators
├── services/
│   ├── emailService.js       # Main email service interface
│   ├── emailProvider.js      # Provider selection/routing
│   ├── resendProvider.js     # Resend API integration
│   ├── emailQueueService.js  # Background queue service
│   └── tokenService.js       # Secure token generation
├── jobs/
│   └── emailScheduler.js     # Report scheduling
├── routes/
│   └── email.js              # Email management API
└── templates/
    └── emails/
        ├── base.ejs              # Base layout template
        ├── welcome.ejs           # Welcome email
        ├── verify-email.ejs      # Email verification
        ├── password-reset.ejs    # Password reset
        ├── password-changed.ejs  # Password change confirmation
        ├── alert-new-question.ejs
        ├── alert-new-answer.ejs
        ├── alert-moderation.ejs
        └── report.ejs            # Analytics report
```

---

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install resend nodemailer ejs node-cron
```

### 2. Configure Environment Variables

#### Option 1: Resend (Recommended)

Get your API key from [resend.com/api-keys](https://resend.com/api-keys):

```env
# Resend Configuration
RESEND_API_KEY=re_your_api_key_here

# Sender Configuration (must be verified in Resend)
EMAIL_FROM_NAME=FAQ Manager
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_REPLY_TO=support@yourdomain.com

# Security
EMAIL_TOKEN_SECRET=your-secure-secret-at-least-32-characters
```

#### Option 2: SMTP (Fallback)

```env
# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

# Sender Configuration
EMAIL_FROM_NAME=FAQ Manager
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_REPLY_TO=support@yourdomain.com

# Security
EMAIL_TOKEN_SECRET=your-secure-secret-at-least-32-characters
```

### 3. Run Database Migration

```bash
cd backend
npx prisma migrate dev --name add-email-models
```

This creates the following tables:
- `EmailLog` - Audit trail for sent emails
- `EmailQueue` - Background job queue
- `UsedToken` - Prevents token reuse

### 4. Verify Setup

Start the server and check the logs for:
```
✅ Email provider initialized
✅ Using Resend provider   # or "Using SMTP provider"
✅ Email queue processor started
✅ Email scheduler started
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | Recommended | - | Resend API key (preferred provider) |
| `SMTP_HOST` | Fallback | - | SMTP server hostname |
| `SMTP_PORT` | No | 587 | SMTP server port |
| `SMTP_SECURE` | No | false | Use TLS (true for port 465) |
| `SMTP_USER` | With SMTP | - | SMTP authentication username |
| `SMTP_PASS` | With SMTP | - | SMTP authentication password |
| `EMAIL_FROM_NAME` | No | FAQ Manager | Sender display name |
| `EMAIL_FROM_ADDRESS` | Yes | - | Sender email address |
| `EMAIL_REPLY_TO` | No | - | Reply-to address |
| `EMAIL_TOKEN_SECRET` | Yes | - | Secret for signing tokens (min 32 chars) |
| `PASSWORD_RESET_EXPIRY_HOURS` | No | 1 | Password reset token lifetime |
| `EMAIL_VERIFY_EXPIRY_HOURS` | No | 24 | Email verification token lifetime |
| `EMAIL_QUEUE_ENABLED` | No | true | Enable background queue |
| `EMAIL_RETRY_ATTEMPTS` | No | 3 | Max retry attempts |
| `EMAIL_RETRY_DELAY_MS` | No | 60000 | Base retry delay (ms) |
| `ENABLE_REPORT_EMAILS` | No | true | Enable scheduled reports |
| `SEND_WELCOME_EMAIL` | No | true | Send welcome on signup |
| `REQUIRE_EMAIL_VERIFICATION` | No | false | Require email verification |
| `EMAIL_PREVIEW_MODE` | No | false | Log emails instead of sending |

### Per-Shop Settings

Each shop can configure email preferences via the Settings model:

```javascript
{
  // Alert settings
  emailAlertsEnabled: true,
  emailAlertNewQuestion: true,
  emailAlertNewAnswer: true,
  emailAlertModeration: true,
  emailAlertRecipients: "admin@shop.com, manager@shop.com",
  
  // Report settings
  emailReportsEnabled: true,
  emailReportFrequency: "weekly",  // "daily", "weekly", "monthly"
  emailReportRecipients: "reports@shop.com",
  
  // Unsubscribed types (JSON array)
  emailUnsubscribedTypes: []
}
```

---

## Email Types

### Transactional Emails

| Type | Function | Trigger |
|------|----------|---------|
| `WELCOME` | `sendWelcomeEmail(user, shop)` | User signup |
| `VERIFY_EMAIL` | `sendEmailVerificationEmail(user, shop)` | After signup |
| `PASSWORD_RESET` | `sendPasswordResetEmail(user)` | Forgot password |
| `PASSWORD_CHANGED` | `sendPasswordChangedEmail(user)` | Password change |

### Alert Emails

| Type | Function | Trigger |
|------|----------|---------|
| `ALERT_NEW_QUESTION` | `sendNewQuestionAlert(shop, question, settings)` | Question submitted |
| `ALERT_NEW_ANSWER` | `sendNewAnswerAlert(shop, answer, settings)` | Answer submitted |
| `ALERT_MODERATION` | `sendModerationAlert(shop, content, settings)` | Content needs review |

### Report Emails

| Type | Function | Trigger |
|------|----------|---------|
| `REPORT_DAILY` | `sendReportEmail(shop, report, 'daily')` | Daily at 8 AM |
| `REPORT_WEEKLY` | `sendReportEmail(shop, report, 'weekly')` | Monday at 8 AM |
| `REPORT_MONTHLY` | `sendReportEmail(shop, report, 'monthly')` | 1st of month at 8 AM |

---

## Usage Examples

### Sending a Welcome Email

```javascript
const emailService = require('../services/emailService');

// In signup route
const user = await createUser(userData);
const shop = await getShop(shopId);

await emailService.sendWelcomeEmail(user, shop);
```

### Sending a Password Reset Email

```javascript
const emailService = require('../services/emailService');

// In forgot-password route
const user = await findUserByEmail(email);
if (user) {
  await emailService.sendPasswordResetEmail(user);
}
```

### Sending an Alert Email

```javascript
const emailService = require('../services/emailService');
const settingsService = require('../services/settingsService');

// In webhook route
const settings = await settingsService.getSettings(shop.id);
await emailService.sendNewQuestionAlert(shop, question, settings);
```

### Using Resend Tags for Tracking

When using Resend, emails are automatically tagged with:
- `email_type` - The type of email (welcome, password_reset, etc.)
- `app` - "faq-manager"

You can add custom tags:
```javascript
await emailProvider.sendEmail({
  to: 'user@example.com',
  subject: 'Custom Email',
  html: htmlContent,
  tags: [
    { name: 'campaign', value: 'q4-promotion' },
    { name: 'user_tier', value: 'premium' }
  ]
});
```

### Batch Sending (Resend Only)

Send up to 100 emails in a single API call:
```javascript
const emailProvider = require('../services/emailProvider');

const result = await emailProvider.sendBatch([
  { to: 'user1@example.com', subject: 'Hello 1', html: html1 },
  { to: 'user2@example.com', subject: 'Hello 2', html: html2 },
  // ... up to 100 emails
]);
```

---

## Templates

### Template Variables

All templates have access to these common variables:

```javascript
{
  appName: 'FAQ Manager',
  frontendUrl: 'https://your-app.com',
  currentYear: 2024,
  unsubscribeUrl: 'https://...'  // If applicable
}
```

### Creating a New Template

1. Create a new `.ejs` file in `backend/templates/emails/`
2. Use the base template:

```ejs
<%- include('base', {
  title: 'Email Title',
  preheader: 'Preview text for email clients',
  showUnsubscribe: false,
  content: `
    <h1 style="...">Hello <%= userName %></h1>
    <p>Your email content here...</p>
  `
}) %>
```

### Responsive Design

Templates use inline CSS and table-based layouts for email client compatibility:

- Max width: 600px
- Mobile breakpoint: 480px
- Uses `@media (max-width: 480px)` for mobile styles
- Safe fonts: Arial, Helvetica, sans-serif
- Button padding works in Outlook

---

## Queue System

### How It Works

1. **Enqueue**: Email is added to `EmailQueue` table with `pending` status
2. **Process**: Background processor picks up pending emails every 10 seconds
3. **Send**: Email is sent via active provider (Resend or SMTP)
4. **Retry**: On failure, email is retried with exponential backoff
5. **Log**: Success/failure logged to `EmailLog` table

### Retry Logic

- Max attempts: 3 (configurable)
- Backoff: Base delay × 2^(attempts-1)
- Example: 60s → 120s → 240s

### Idempotency

Prevent duplicate sends using idempotency keys:

```javascript
await emailQueueService.enqueue(
  // ... other params
  idempotencyKey: `password-reset-${userId}-${Date.now().toString().slice(0, -4)}`
);
```

### Queue Management API

```bash
# Get queue status
GET /api/email/queue/status

# Retry failed emails
POST /api/email/queue/retry-failed

# Clear old completed emails
POST /api/email/queue/cleanup
```

---

## Scheduled Reports

### Schedule Configuration

Reports are scheduled using cron expressions:

```env
REPORT_CRON_DAILY=0 8 * * *      # Daily at 8:00 AM
REPORT_CRON_WEEKLY=0 8 * * 1     # Monday at 8:00 AM
REPORT_CRON_MONTHLY=0 8 1 * *    # 1st of month at 8:00 AM
```

### Report Data

The scheduler generates reports with:

- Total questions/answers count
- New questions/answers in period
- Answered vs pending questions
- Top categories by question count
- Recent questions with status
- Answer rate percentage

---

## Security

### Token Security

- **Algorithm**: HMAC-SHA256 with secret key
- **Format**: `base64url({data}).{signature}`
- **Contents**: type, payload, exp, iat, jti (unique ID)
- **Expiry**: 1 hour (reset), 24 hours (verify), 1 year (unsubscribe)

### Token Reuse Prevention

Used tokens are stored as SHA-256 hashes in the `UsedToken` table. Each token can only be used once.

### What We Never Log

- Full token values
- Passwords
- Complete email body content
- Sensitive customer data

---

## Deliverability Best Practices

### Resend Domain Setup

1. Add your domain in [Resend Dashboard](https://resend.com/domains)
2. Add the DNS records Resend provides:
   - SPF record
   - DKIM records
   - DMARC record (optional but recommended)
3. Verify your domain

### SMTP DNS Configuration

If using SMTP, configure these DNS records for your sending domain:

#### SPF (Sender Policy Framework)
```
v=spf1 include:_spf.your-smtp-provider.com ~all
```

#### DKIM (DomainKeys Identified Mail)
Your SMTP provider will give you a DKIM key to add as a TXT record.

#### DMARC
```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com
```

### Best Practices Applied

1. **Consistent sender identity**: Same from address for all emails
2. **HTML + plain text**: Both versions included automatically
3. **Mobile-friendly**: Responsive templates
4. **Clear subject lines**: Descriptive, not spammy
5. **Unsubscribe links**: For non-critical emails
6. **Proper headers**: Reply-To, List-Unsubscribe
7. **Rate limiting**: Queue prevents burst sending

---

## Testing

### Run Email Tests

```bash
cd backend
npm run test:email
```

### Test in Preview Mode

Set `EMAIL_PREVIEW_MODE=true` to log emails instead of sending:

```env
EMAIL_PREVIEW_MODE=true
```

### Send Test Email

```bash
# Via API (requires auth)
POST /api/email/test
{
  "to": "test@example.com",
  "type": "welcome"
}
```

### Check Provider Status

```javascript
const emailProvider = require('./services/emailProvider');
console.log(emailProvider.getStatus());
// {
//   ready: true,
//   provider: 'resend',  // or 'smtp' or 'preview'
//   previewMode: false,
//   resendConfigured: true,
//   smtpConfigured: false
// }
```

---

## Troubleshooting

### Common Issues

#### "Email provider not configured"
1. Check `RESEND_API_KEY` or SMTP settings are in `.env`
2. Restart the server after changing env vars
3. Check `emailProvider.getStatus()` for details

#### "Resend: domain not verified"
1. Go to [Resend Domains](https://resend.com/domains)
2. Complete DNS verification
3. Use verified domain in `EMAIL_FROM_ADDRESS`

#### "Emails not being sent"
1. Check `EMAIL_QUEUE_ENABLED=true`
2. Check server logs for queue processor errors
3. Query `EmailQueue` for stuck emails:
   ```sql
   SELECT * FROM "EmailQueue" WHERE status = 'pending' ORDER BY "createdAt";
   ```

#### "Token invalid or expired"
- Check `EMAIL_TOKEN_SECRET` matches between token creation and verification
- Verify token hasn't expired (check `exp` claim)
- Check `UsedToken` table for token reuse

### Debug Logging

Enable detailed logging:

```env
EMAIL_LOG_LEVEL=debug
```

### Check Email Status

```bash
# Get recent logs
GET /api/email/logs?limit=20

# Get provider status
GET /api/email/status
```

---

## Extension Guide

### Adding a New Email Type

1. **Add constant** in `emailService.js`:
   ```javascript
   const EMAIL_TYPES = {
     // ... existing types
     MY_NEW_TYPE: 'my_new_type',
   };
   ```

2. **Create template** `templates/emails/my-new-type.ejs`

3. **Add send function** in `emailService.js`:
   ```javascript
   async function sendMyNewTypeEmail(user, data) {
     const html = await renderTemplate('my-new-type', {
       userName: user.name,
       ...data,
     });
     
     return sendEmail({
       to: user.email,
       subject: 'My New Email Subject',
       html,
       emailType: EMAIL_TYPES.MY_NEW_TYPE,
       userId: user.id,
     });
   }
   ```

4. **Export and use**

### Switching Providers

The system automatically selects providers based on configuration:

```javascript
// Force SMTP even if Resend is configured
// Unset RESEND_API_KEY or leave it empty

// Force preview mode (no sending)
// Set EMAIL_PREVIEW_MODE=true
```

---

## API Reference

### Email Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/email/status` | Email service status |
| GET | `/api/email/logs` | Recent email logs |
| POST | `/api/email/test` | Send test email |
| GET | `/api/email/unsubscribe` | Handle unsubscribe link |
| POST | `/api/email/unsubscribe` | Process unsubscribe |
| GET | `/api/email/queue/status` | Queue statistics |
| POST | `/api/email/queue/retry-failed` | Retry failed emails |
| POST | `/api/email/queue/cleanup` | Clean old queue items |

### Auth Routes (Email-Related)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/verify-email` | Verify email with token |
| POST | `/api/auth/change-password` | Change password (authenticated) |

---

## Changelog

### v1.1.0 (Resend Integration)
- Added Resend as primary email provider
- Automatic provider selection (Resend → SMTP → Preview)
- Batch email support (up to 100 emails/request)
- Email tagging for analytics
- Updated documentation

### v1.0.0 (Initial Release)
- Complete email service implementation
- Support for transactional, alert, and report emails
- Database-backed queue with retry logic
- Secure token system for verification links
- Responsive HTML templates
- Per-shop configuration
- Scheduled report system
- Comprehensive logging

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs for error details
3. Check the `EmailLog` and `EmailQueue` tables
4. Contact the development team
