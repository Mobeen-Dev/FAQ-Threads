const prisma = require("./prismaClient");
const settingsService = require("./settingsService");

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
  const { categoryId, status, search, page = 1, limit = 20, sort = "sortOrder" } = filters;
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

  const orderBy = sort === "votes" ? { voteScore: "desc" } : { sortOrder: "asc" };

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
  const publishedAt = (data.status === "published") ? new Date() : null;
  return prisma.question.create({
    data: {
      question: data.question,
      answer: data.answer || "",
      categoryId: data.categoryId || null,
      status: data.status || "pending",
      source: data.source || "dashboard",
      customerName: data.customerName || null,
      customerEmail: data.customerEmail || null,
      customerPhone: data.customerPhone || null,
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
  if (!existing) throw new Error("Question not found");

  const updateData = {};
  if (data.question !== undefined) updateData.question = data.question;
  if (data.answer !== undefined) updateData.answer = data.answer;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "published" && !existing.publishedAt) updateData.publishedAt = new Date();
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
  await settingsService.applyTimeBasedPublishing(shopId);

  const where = { shopId };
  if (questionId) where.questionId = questionId;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.answerText = { contains: filters.search, mode: "insensitive" };
  }

  return prisma.answer.findMany({
    where,
    include: {
      contributor: { select: { id: true, name: true, email: true, trusted: true } },
      question: { select: { id: true, question: true, status: true } },
      _count: { select: { votes: true } },
    },
    orderBy: [{ createdAt: "desc" }, { voteScore: "desc" }],
  });
}

async function createAnswer(shopId, questionId, data) {
  const q = await prisma.question.findFirst({ where: { id: questionId, shopId } });
  if (!q) throw new Error("Question not found");

  const publishedAt = (data.status === "published") ? new Date() : null;

  return prisma.answer.create({
    data: {
      answerText: data.answerText,
      status: data.status || "pending",
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

async function getAnalytics(shopId) {
  await settingsService.applyTimeBasedPublishing(shopId);
  const [
    totalQuestions, published, pending, suspended, categories,
    totalAnswers, publishedAnswers, totalContributors, trustedContributors,
  ] = await Promise.all([
    prisma.question.count({ where: { shopId } }),
    prisma.question.count({ where: { shopId, status: "published" } }),
    prisma.question.count({ where: { shopId, status: "pending" } }),
    prisma.question.count({ where: { shopId, status: "suspended" } }),
    prisma.category.count({ where: { shopId } }),
    prisma.answer.count({ where: { shopId } }),
    prisma.answer.count({ where: { shopId, status: "published" } }),
    prisma.storeContributor.count({ where: { shopId } }),
    prisma.storeContributor.count({ where: { shopId, trusted: true } }),
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
