/**
 * Email Scheduler
 * Handles scheduled report emails using node-cron.
 */

const cron = require("node-cron");
const emailConfig = require("../config/emailConfig");
const emailService = require("../services/emailService");
const prisma = require("../services/prismaClient");

const scheduledJobs = new Map();

/**
 * Generate report data for a shop
 * @param {string} shopId Shop ID
 * @param {string} frequency Report frequency (daily/weekly/monthly)
 * @returns {Promise<object>} Report data
 */
async function generateReportData(shopId, frequency) {
  const now = new Date();
  let periodStart;

  // Calculate period based on frequency
  switch (frequency) {
    case "daily":
      periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "weekly":
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "monthly":
      periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  // Get current totals
  const [totalQuestions, totalAnswers, totalContributors, published, pending] = await Promise.all([
    prisma.question.count({ where: { shopId } }),
    prisma.answer.count({ where: { shopId } }),
    prisma.storeContributor.count({ where: { shopId } }),
    prisma.question.count({ where: { shopId, status: "published" } }),
    prisma.question.count({ where: { shopId, status: "pending" } }).then(q =>
      prisma.answer.count({ where: { shopId, status: "pending" } }).then(a => q + a)
    ),
  ]);

  // Get period-specific stats
  const [newQuestions, newAnswers, periodPublished, newContributors] = await Promise.all([
    prisma.question.count({
      where: { shopId, createdAt: { gte: periodStart } },
    }),
    prisma.answer.count({
      where: { shopId, createdAt: { gte: periodStart } },
    }),
    prisma.question.count({
      where: { shopId, status: "published", publishedAt: { gte: periodStart } },
    }),
    prisma.storeContributor.findMany({
      where: { shopId, createdAt: { gte: periodStart } },
      select: { name: true, email: true },
      take: 10,
    }),
  ]);

  // Get previous period for comparison
  const prevPeriodStart = new Date(periodStart.getTime() - (now.getTime() - periodStart.getTime()));
  const [prevQuestions, prevAnswers] = await Promise.all([
    prisma.question.count({
      where: { shopId, createdAt: { gte: prevPeriodStart, lt: periodStart } },
    }),
    prisma.answer.count({
      where: { shopId, createdAt: { gte: prevPeriodStart, lt: periodStart } },
    }),
  ]);

  // Calculate changes
  const questionsChange = prevQuestions > 0 
    ? Math.round(((newQuestions - prevQuestions) / prevQuestions) * 100) 
    : (newQuestions > 0 ? 100 : 0);
  const answersChange = prevAnswers > 0 
    ? Math.round(((newAnswers - prevAnswers) / prevAnswers) * 100) 
    : (newAnswers > 0 ? 100 : 0);

  // Get top questions
  const topQuestions = await prisma.question.findMany({
    where: { shopId, status: "published" },
    select: {
      id: true,
      question: true,
      voteScore: true,
      _count: { select: { answers: true } },
    },
    orderBy: { voteScore: "desc" },
    take: 5,
  });

  return {
    periodStart: periodStart.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: "numeric",
    }),
    periodEnd: now.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: "numeric",
    }),
    stats: {
      totalQuestions,
      totalAnswers,
      totalContributors,
    },
    periodStats: {
      newQuestions,
      newAnswers,
      published: periodPublished,
      pending,
      questionsChange,
      answersChange,
    },
    topQuestions: topQuestions.map(q => ({
      question: q.question,
      voteScore: q.voteScore,
      answerCount: q._count.answers,
    })),
    newContributors,
  };
}

/**
 * Send reports for all shops with the given frequency
 * @param {string} frequency Report frequency (daily/weekly/monthly)
 */
async function sendReportsForFrequency(frequency) {
  console.log(`[EmailScheduler] Starting ${frequency} report generation`);

  try {
    // Find shops with this report frequency enabled
    const settings = await prisma.setting.findMany({
      where: {
        emailReportsEnabled: true,
        emailReportFrequency: frequency,
      },
      include: {
        shop: true,
      },
    });

    console.log(`[EmailScheduler] Found ${settings.length} shops for ${frequency} reports`);

    for (const setting of settings) {
      try {
        const reportData = await generateReportData(setting.shopId, frequency);
        const result = await emailService.sendReportEmail(
          setting.shop,
          reportData,
          frequency,
          setting
        );

        if (result.success) {
          console.log(`[EmailScheduler] Sent ${frequency} report to ${setting.shop.domain}`);
        } else if (result.skipped) {
          console.log(`[EmailScheduler] Skipped ${setting.shop.domain}: ${result.reason}`);
        } else {
          console.error(`[EmailScheduler] Failed for ${setting.shop.domain}:`, result.error);
        }
      } catch (error) {
        console.error(`[EmailScheduler] Error for shop ${setting.shopId}:`, error.message);
      }
    }

    console.log(`[EmailScheduler] Completed ${frequency} report generation`);
  } catch (error) {
    console.error(`[EmailScheduler] Failed to process ${frequency} reports:`, error.message);
  }
}

/**
 * Send moderation alerts to shops with pending items
 */
async function sendModerationAlerts() {
  console.log("[EmailScheduler] Checking for pending moderation items");

  try {
    // Find shops with moderation alerts enabled and pending items
    const shops = await prisma.shop.findMany({
      where: {
        settings: {
          emailAlertsEnabled: true,
          emailAlertModeration: true,
        },
      },
      include: {
        settings: true,
        _count: {
          select: {
            questions: { where: { status: "pending" } },
            answers: { where: { status: "pending" } },
          },
        },
      },
    });

    for (const shop of shops) {
      const pendingQuestions = shop._count.questions;
      const pendingAnswers = shop._count.answers;

      if (pendingQuestions === 0 && pendingAnswers === 0) {
        continue;
      }

      // Get recent pending items
      const recentItems = await prisma.$queryRaw`
        SELECT 'question' as type, id, question as preview, "createdAt"
        FROM "Question" 
        WHERE "shopId" = ${shop.id} AND status = 'pending'
        UNION ALL
        SELECT 'answer' as type, id, "answerText" as preview, "createdAt"
        FROM "Answer"
        WHERE "shopId" = ${shop.id} AND status = 'pending'
        ORDER BY "createdAt" DESC
        LIMIT 5
      `;

      await emailService.sendModerationAlert(
        shop,
        { pendingQuestions, pendingAnswers, recentItems },
        shop.settings
      );
    }
  } catch (error) {
    console.error("[EmailScheduler] Moderation alerts failed:", error.message);
  }
}

/**
 * Schedule a cron job
 * @param {string} name Job name
 * @param {string} schedule Cron expression
 * @param {Function} task Task function
 */
function scheduleJob(name, schedule, task) {
  if (!cron.validate(schedule)) {
    console.error(`[EmailScheduler] Invalid cron expression for ${name}: ${schedule}`);
    return;
  }

  const job = cron.schedule(schedule, task, {
    scheduled: true,
    timezone: emailConfig.reports.timezone,
  });

  scheduledJobs.set(name, job);
  console.log(`[EmailScheduler] Scheduled ${name}: ${schedule}`);
}

/**
 * Start the email scheduler
 */
function start() {
  if (!emailConfig.reports.enabled) {
    console.log("[EmailScheduler] Report emails disabled");
    return;
  }

  // Schedule daily reports
  scheduleJob("daily-reports", emailConfig.reports.dailyCron, () => {
    sendReportsForFrequency("daily");
  });

  // Schedule weekly reports
  scheduleJob("weekly-reports", emailConfig.reports.weeklyCron, () => {
    sendReportsForFrequency("weekly");
  });

  // Schedule monthly reports
  scheduleJob("monthly-reports", emailConfig.reports.monthlyCron, () => {
    sendReportsForFrequency("monthly");
  });

  // Schedule daily moderation digest (noon)
  scheduleJob("moderation-digest", "0 12 * * *", sendModerationAlerts);

  // Schedule daily token cleanup (3 AM)
  scheduleJob("token-cleanup", "0 3 * * *", emailService.cleanupExpiredTokens);

  console.log("[EmailScheduler] Scheduler started");
}

/**
 * Stop the email scheduler
 */
function stop() {
  for (const [name, job] of scheduledJobs) {
    job.stop();
    console.log(`[EmailScheduler] Stopped ${name}`);
  }
  scheduledJobs.clear();
  console.log("[EmailScheduler] Scheduler stopped");
}

/**
 * Get scheduler status
 */
function getStatus() {
  const jobs = [];
  for (const [name, job] of scheduledJobs) {
    jobs.push({ name, running: job.running });
  }
  return { running: scheduledJobs.size > 0, jobs };
}

/**
 * Manually trigger a report for testing
 * @param {string} shopId Shop ID
 * @param {string} frequency Report frequency
 */
async function triggerReport(shopId, frequency) {
  const settings = await prisma.setting.findUnique({
    where: { shopId },
    include: { shop: true },
  });

  if (!settings) {
    throw new Error("Shop settings not found");
  }

  const reportData = await generateReportData(shopId, frequency);
  return emailService.sendReportEmail(settings.shop, reportData, frequency, settings);
}

module.exports = {
  start,
  stop,
  getStatus,
  sendReportsForFrequency,
  sendModerationAlerts,
  generateReportData,
  triggerReport,
};
