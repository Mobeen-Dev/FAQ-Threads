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
};

async function getSettings(shopId) {
  let settings = await prisma.setting.findUnique({ where: { shopId } });
  if (!settings) {
    settings = await prisma.setting.create({ data: { shopId, ...DEFAULTS } });
  }
  return settings;
}

async function updateSettings(shopId, data) {
  const allowed = Object.keys(DEFAULTS);
  const updateData = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }

  return prisma.setting.upsert({
    where: { shopId },
    update: updateData,
    create: { shopId, ...DEFAULTS, ...updateData },
  });
}

// Determine initial status for a new question based on publishing settings
async function resolveQuestionStatus(shopId, contributorId) {
  const settings = await getSettings(shopId);

  if (settings.autoPublishQuestions) {
    // Check trusted customer override
    if (contributorId && settings.trustedCustomerAutoPublish) {
      const contributor = await prisma.storeContributor.findUnique({ where: { id: contributorId } });
      if (contributor?.trusted) return "published";
    }
    return "published";
  }

  // Trusted customer auto-publish even when general auto-publish is off
  if (contributorId && settings.trustedCustomerAutoPublish) {
    const contributor = await prisma.storeContributor.findUnique({ where: { id: contributorId } });
    if (contributor?.trusted) return "published";
  }

  return "pending";
}

// Determine initial status for a new answer based on publishing settings
async function resolveAnswerStatus(shopId, questionId, contributorId) {
  const settings = await getSettings(shopId);

  if (settings.autoPublishAnswers) {
    if (contributorId && settings.trustedCustomerAutoPublish) {
      const contributor = await prisma.storeContributor.findUnique({ where: { id: contributorId } });
      if (contributor?.trusted) return "published";
    }
    return "published";
  }

  if (contributorId && settings.trustedCustomerAutoPublish) {
    const contributor = await prisma.storeContributor.findUnique({ where: { id: contributorId } });
    if (contributor?.trusted) return "published";
  }

  // Auto-publish if existing answers are below threshold
  if (settings.autoPublishIfAnswersLessThan > 0) {
    const count = await prisma.answer.count({
      where: { questionId, status: "published" },
    });
    if (count < settings.autoPublishIfAnswersLessThan) return "published";
  }

  return "pending";
}

module.exports = {
  DEFAULTS,
  getSettings,
  updateSettings,
  resolveQuestionStatus,
  resolveAnswerStatus,
};
