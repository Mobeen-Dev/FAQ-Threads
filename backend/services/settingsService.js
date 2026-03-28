const prisma = require("./prismaClient");

const DEFAULTS = {
  widgetEnabled: true,
  widgetPosition: "bottom-right",
  primaryColor: "#6366f1",
  allowSubmission: true,
  notifyEmail: null,
  autoPublishQuestions: false,
  manualPublishQuestions: true,
  publishQuestionsAfterTimeEnabled: false,
  publishQuestionsAfterMinutes: 0,
  publishQuestionsAfterHours: 24,
  autoPublishAnswers: false,
  manualPublishAnswers: true,
  publishAnswersAfterTimeEnabled: false,
  publishAnswersAfterMinutes: 0,
  publishAnswersAfterHours: 24,
  autoPublishIfAnswersLessThan: 0,
  autoModeration: false,
  trustedCustomerAutoPublish: false,
  // Email notification settings
  emailAlertsEnabled: true,
  emailAlertNewQuestion: true,
  emailAlertNewAnswer: true,
  emailAlertModeration: true,
  emailAlertRecipients: null,
  emailReportsEnabled: false,
  emailReportFrequency: "weekly",
  emailReportRecipients: null,
  emailReportLastSent: null,
  emailUnsubscribedTypes: null,
};

// List of all allowed settings keys for update validation
const ALLOWED_KEYS = Object.keys(DEFAULTS);

function normalizeQuestionPublishingModes(values) {
  const mode = values.autoPublishQuestions
    ? "auto"
    : values.publishQuestionsAfterTimeEnabled
      ? "time"
      : "manual";

  return {
    autoPublishQuestions: mode === "auto",
    publishQuestionsAfterTimeEnabled: mode === "time",
    manualPublishQuestions: mode === "manual",
  };
}

function normalizeAnswerPublishingModes(values) {
  const mode = values.autoPublishAnswers
    ? "auto"
    : values.publishAnswersAfterTimeEnabled
      ? "time"
      : "manual";

  return {
    autoPublishAnswers: mode === "auto",
    publishAnswersAfterTimeEnabled: mode === "time",
    manualPublishAnswers: mode === "manual",
  };
}

async function isTrustedContributor(contributorId) {
  if (!contributorId) return false;
  const contributor = await prisma.storeContributor.findUnique({ where: { id: contributorId } });
  return !!contributor?.trusted;
}

function getDelayMs(hours, minutes) {
  const safeHours = Math.max(0, Number(hours) || 0);
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  return (safeHours * 60 + safeMinutes) * 60 * 1000;
}

async function getSettings(shopId) {
  let settings = await prisma.setting.findUnique({ where: { shopId } });
  if (!settings) {
    settings = await prisma.setting.create({ data: { shopId, ...DEFAULTS } });
  }
  return settings;
}

async function updateSettings(shopId, data) {
  const current = await getSettings(shopId);
  const updateData = {};
  for (const key of ALLOWED_KEYS) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }

  const merged = { ...DEFAULTS, ...current, ...updateData };
  const normalized = {
    ...updateData,
    ...normalizeQuestionPublishingModes(merged),
    ...normalizeAnswerPublishingModes(merged),
  };

  return prisma.setting.upsert({
    where: { shopId },
    update: normalized,
    create: { shopId, ...DEFAULTS, ...normalized },
  });
}

// Determine initial status for a new question based on publishing settings
async function resolveQuestionStatus(shopId, contributorId) {
  const settings = await getSettings(shopId);

  if (settings.trustedCustomerAutoPublish && await isTrustedContributor(contributorId)) {
    return "published";
  }

  if (settings.autoPublishQuestions) return "published";

  return "pending";
}

// Determine initial status for a new answer based on publishing settings
async function resolveAnswerStatus(shopId, questionId, contributorId) {
  const settings = await getSettings(shopId);

  if (settings.trustedCustomerAutoPublish && await isTrustedContributor(contributorId)) {
    return "published";
  }

  if (settings.autoPublishAnswers) return "published";

  return "pending";
}

// Opportunistic scheduler: publish pending entries once they pass configured time threshold.
async function applyTimeBasedPublishing(shopId) {
  const settings = await getSettings(shopId);
  const now = new Date();

  if (settings.publishQuestionsAfterTimeEnabled) {
    const delayMs = getDelayMs(settings.publishQuestionsAfterHours, settings.publishQuestionsAfterMinutes);
    const cutoff = new Date(now.getTime() - delayMs);
    await prisma.question.updateMany({
      where: { shopId, status: "pending", createdAt: { lte: cutoff } },
      data: { status: "published", publishedAt: now },
    });
  }

  if (settings.publishAnswersAfterTimeEnabled) {
    const delayMs = getDelayMs(settings.publishAnswersAfterHours, settings.publishAnswersAfterMinutes);
    const cutoff = new Date(now.getTime() - delayMs);
    await prisma.answer.updateMany({
      where: { shopId, status: "pending", createdAt: { lte: cutoff } },
      data: { status: "published", publishedAt: now },
    });
  }
}

module.exports = {
  DEFAULTS,
  getSettings,
  updateSettings,
  resolveQuestionStatus,
  resolveAnswerStatus,
  applyTimeBasedPublishing,
};
