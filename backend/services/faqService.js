const prisma = require("./prismaClient");
const settingsService = require("./settingsService");

// ---------- Validation Helpers ----------

const MAX_QUESTION_LENGTH = 5000;
const MAX_ANSWER_LENGTH = 20000;
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const VALID_STATUSES = ["pending", "draft", "published", "rejected", "suspended"];

function validateString(value, maxLen, fieldName) {
  if (value && typeof value !== "string") {
    throw Object.assign(new Error(`${fieldName} must be a string`), { status: 400 });
  }
  if (value && value.length > maxLen) {
    throw Object.assign(new Error(`${fieldName} exceeds maximum length of ${maxLen}`), { status: 400 });
  }
  return value;
}

function validateStatus(status) {
  if (status && !VALID_STATUSES.includes(status)) {
    throw Object.assign(new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`), { status: 400 });
  }
  return status;
}

function sanitizeInput(data, rules) {
  const sanitized = {};
  for (const [key, { maxLen, required, type, validator }] of Object.entries(rules)) {
    const value = data[key];
    if (required && (value === undefined || value === null || value === "")) {
      throw Object.assign(new Error(`${key} is required`), { status: 400 });
    }
    if (value !== undefined && value !== null) {
      if (type === "string") {
        validateString(value, maxLen, key);
        sanitized[key] = String(value).trim();
      } else if (type === "status") {
        validateStatus(value);
        sanitized[key] = value;
      } else if (validator) {
        sanitized[key] = validator(value, key);
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
}

// ---------- Categories ----------

async function getCategories(shopId) {
  return prisma.category.findMany({
    where: { shopId },
    include: { _count: { select: { questions: true } } },
    orderBy: { sortOrder: "asc" },
  });
}

async function createCategory(shopId, data) {
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return prisma.category.create({
    data: { name: data.name, description: data.description || null, slug, shopId },
  });
}

// ---------- Questions ----------

async function getQuestions(shopId, filters = {}) {
  const { categoryId, status, search, page = 1, limit = 20, sortBy = "newest", fromDate, toDate } = filters;
  await settingsService.applyTimeBasedPublishing(shopId);

  const where = { shopId };
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { question: { contains: search, mode: "insensitive" } },
      { answer: { contains: search, mode: "insensitive" } },
    ];
  }

  // Date range filtering
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  // Sorting: newest, oldest, popular, or default (sortOrder)
  let orderBy;
  switch (sortBy) {
    case "oldest":
      orderBy = { createdAt: "asc" };
      break;
    case "popular":
      orderBy = { voteScore: "desc" };
      break;
    case "newest":
      orderBy = { createdAt: "desc" };
      break;
    default:
      orderBy = { sortOrder: "asc" };
  }

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            firstImageUrl: true,
            frontendUrl: true,
            handle: true,
          },
        },
        category: true,
        contributor: { select: { id: true, name: true, email: true, trusted: true } },
        _count: { select: { answers: true, votes: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.question.count({ where }),
  ]);

  return {
    questions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getQuestion(shopId, id) {
  await settingsService.applyTimeBasedPublishing(shopId);
  return prisma.question.findFirst({
    where: { id, shopId },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          firstImageUrl: true,
          frontendUrl: true,
          handle: true,
        },
      },
      category: true,
      contributor: { select: { id: true, name: true, email: true, trusted: true } },
      answers: {
        include: {
          contributor: { select: { id: true, name: true, email: true, trusted: true } },
        },
        orderBy: { voteScore: "desc" },
      },
      _count: { select: { answers: true, votes: true } },
    },
  });
}

async function createQuestion(shopId, data) {
  // Validate and sanitize input
  const validated = sanitizeInput(data, {
    question: { type: "string", maxLen: MAX_QUESTION_LENGTH, required: true },
    answer: { type: "string", maxLen: MAX_ANSWER_LENGTH },
    status: { type: "status" },
    customerName: { type: "string", maxLen: MAX_NAME_LENGTH },
    customerEmail: { type: "string", maxLen: MAX_EMAIL_LENGTH },
    customerPhone: { type: "string", maxLen: 50 },
  });

  const publishedAt = (validated.status === "published") ? new Date() : null;
  return prisma.question.create({
    data: {
      question: validated.question,
      answer: validated.answer || "",
      categoryId: data.categoryId || null,
      status: validated.status || "pending",
      source: data.source || "dashboard",
      customerName: validated.customerName || null,
      customerEmail: validated.customerEmail || null,
      customerPhone: validated.customerPhone || null,
      customerId: data.customerId || null,
      contributorId: data.contributorId || null,
      publishedAt,
      shopId,
    },
    include: { category: true, product: true },
  });
}

async function updateQuestion(shopId, id, data) {
  const existing = await prisma.question.findFirst({ where: { id, shopId } });
  if (!existing) throw Object.assign(new Error("Question not found"), { status: 404 });

  // Validate input
  const validated = sanitizeInput(data, {
    question: { type: "string", maxLen: MAX_QUESTION_LENGTH },
    answer: { type: "string", maxLen: MAX_ANSWER_LENGTH },
    status: { type: "status" },
  });

  const updateData = {};
  if (validated.question !== undefined) updateData.question = validated.question;
  if (validated.answer !== undefined) updateData.answer = validated.answer;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (validated.status !== undefined) {
    updateData.status = validated.status;
    if (validated.status === "published" && !existing.publishedAt) updateData.publishedAt = new Date();
  }
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  return prisma.question.update({
    where: { id },
    data: updateData,
    include: { category: true, product: true },
  });
}

async function deleteQuestion(shopId, id) {
  return prisma.question.deleteMany({ where: { id, shopId } });
}

// ---------- Answers ----------

async function getAnswers(shopId, questionId, filters = {}) {
  const { status, search, sortBy = "newest", fromDate, toDate } = filters;
  await settingsService.applyTimeBasedPublishing(shopId);

  const where = { shopId };
  if (questionId) where.questionId = questionId;
  if (status) where.status = status;
  if (search) {
    where.answerText = { contains: search, mode: "insensitive" };
  }

  // Date range filtering
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  // Sorting
  let orderBy;
  switch (sortBy) {
    case "oldest":
      orderBy = [{ createdAt: "asc" }];
      break;
    case "popular":
      orderBy = [{ voteScore: "desc" }, { createdAt: "desc" }];
      break;
    case "newest":
    default:
      orderBy = [{ createdAt: "desc" }];
  }

  return prisma.answer.findMany({
    where,
    include: {
      contributor: { select: { id: true, name: true, email: true, trusted: true } },
      question: {
        select: {
          id: true,
          question: true,
          status: true,
          productTitle: true,
          productHandle: true,
          product: {
            select: {
              title: true,
              firstImageUrl: true,
              frontendUrl: true,
              handle: true,
            },
          },
        },
      },
      _count: { select: { votes: true } },
    },
    orderBy,
  });
}

async function createAnswer(shopId, questionId, data) {
  const q = await prisma.question.findFirst({ where: { id: questionId, shopId } });
  if (!q) throw Object.assign(new Error("Question not found"), { status: 404 });

  // Validate input
  const validated = sanitizeInput(data, {
    answerText: { type: "string", maxLen: MAX_ANSWER_LENGTH, required: true },
    status: { type: "status" },
  });

  const publishedAt = (validated.status === "published") ? new Date() : null;

  return prisma.answer.create({
    data: {
      answerText: validated.answerText,
      status: validated.status || "pending",
      source: data.source || "dashboard",
      contributorId: data.contributorId || null,
      questionId,
      shopId,
      publishedAt,
    },
    include: {
      contributor: { select: { id: true, name: true, email: true, trusted: true } },
    },
  });
}

async function updateAnswer(shopId, answerId, data) {
  const existing = await prisma.answer.findFirst({ where: { id: answerId, shopId } });
  if (!existing) throw new Error("Answer not found");

  const updateData = {};
  if (data.answerText !== undefined) updateData.answerText = data.answerText;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "published" && !existing.publishedAt) updateData.publishedAt = new Date();
  }

  return prisma.answer.update({ where: { id: answerId }, data: updateData });
}

async function deleteAnswer(shopId, answerId) {
  return prisma.answer.deleteMany({ where: { id: answerId, shopId } });
}

// ---------- Moderation ----------

async function moderateQuestion(shopId, id, action) {
  const statusMap = { approve: "published", reject: "rejected", suspend: "suspended", draft: "draft" };
  const status = statusMap[action] || "pending";
  const existing = await prisma.question.findFirst({ where: { id, shopId } });
  if (!existing) throw new Error("Question not found");

  const updateData = { status };
  if (status === "published" && !existing.publishedAt) updateData.publishedAt = new Date();

  return prisma.question.update({
    where: { id },
    data: updateData,
    include: { category: true, product: true },
  });
}

async function moderateAnswer(shopId, answerId, action) {
  const statusMap = { approve: "published", reject: "rejected", suspend: "suspended" };
  const status = statusMap[action] || "pending";
  const existing = await prisma.answer.findFirst({ where: { id: answerId, shopId } });
  if (!existing) throw new Error("Answer not found");

  const updateData = { status };
  if (status === "published" && !existing.publishedAt) updateData.publishedAt = new Date();

  return prisma.answer.update({ where: { id: answerId }, data: updateData });
}

// ---------- Analytics ----------

async function getAnalytics(shopId, filters = {}) {
  const { fromDate, toDate } = filters;
  await settingsService.applyTimeBasedPublishing(shopId);

  // Build date filter for queries
  const dateFilter = {};
  if (fromDate || toDate) {
    dateFilter.createdAt = {};
    if (fromDate) dateFilter.createdAt.gte = new Date(fromDate);
    if (toDate) dateFilter.createdAt.lte = new Date(toDate);
  }

  const [
    totalQuestions, published, pending, suspended, categories,
    totalAnswers, publishedAnswers, totalContributors, trustedContributors,
  ] = await Promise.all([
    prisma.question.count({ where: { shopId, ...dateFilter } }),
    prisma.question.count({ where: { shopId, status: "published", ...dateFilter } }),
    prisma.question.count({ where: { shopId, status: "pending", ...dateFilter } }),
    prisma.question.count({ where: { shopId, status: "suspended", ...dateFilter } }),
    prisma.category.count({ where: { shopId } }), // Categories don't get date-filtered
    prisma.answer.count({ where: { shopId, ...dateFilter } }),
    prisma.answer.count({ where: { shopId, status: "published", ...dateFilter } }),
    prisma.storeContributor.count({ where: { shopId, ...dateFilter } }),
    prisma.storeContributor.count({ where: { shopId, trusted: true, ...dateFilter } }),
  ]);

  return {
    totalQuestions, published, pending, suspended, categories,
    totalAnswers, publishedAnswers, totalContributors, trustedContributors,
  };
}

module.exports = {
  getCategories,
  createCategory,
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getAnswers,
  createAnswer,
  updateAnswer,
  deleteAnswer,
  moderateQuestion,
  moderateAnswer,
  getAnalytics,
};
