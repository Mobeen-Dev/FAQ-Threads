const prisma = require("./prismaClient");

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
  const { categoryId, status, search, page = 1, limit = 20 } = filters;

  const where = { shopId };
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { question: { contains: search, mode: "insensitive" } },
      { answer: { contains: search, mode: "insensitive" } },
    ];
  }

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: { category: true },
      orderBy: { sortOrder: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.question.count({ where }),
  ]);

  return {
    questions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getQuestion(shopId, id) {
  return prisma.question.findFirst({
    where: { id, shopId },
    include: { category: true },
  });
}

async function createQuestion(shopId, data) {
  return prisma.question.create({
    data: {
      question: data.question,
      answer: data.answer,
      categoryId: data.categoryId || null,
      status: data.status || "pending",
      source: data.source || "dashboard",
      customerName: data.customerName || null,
      customerEmail: data.customerEmail || null,
      customerPhone: data.customerPhone || null,
      customerId: data.customerId || null,
      shopId,
    },
  });
}

async function updateQuestion(shopId, id, data) {
  const existing = await prisma.question.findFirst({ where: { id, shopId } });
  if (!existing) throw new Error("Question not found");

  const updateData = {};
  if (data.question !== undefined) updateData.question = data.question;
  if (data.answer !== undefined) updateData.answer = data.answer;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  return prisma.question.update({
    where: { id },
    data: updateData,
    include: { category: true },
  });
}

async function deleteQuestion(shopId, id) {
  return prisma.question.deleteMany({
    where: { id, shopId },
  });
}

// ---------- Moderation ----------

async function moderateQuestion(shopId, id, action) {
  const status = action === "approve" ? "published" : "rejected";
  const existing = await prisma.question.findFirst({ where: { id, shopId } });
  if (!existing) throw new Error("Question not found");
  return prisma.question.update({
    where: { id },
    data: { status },
    include: { category: true },
  });
}

// ---------- Analytics ----------

async function getAnalytics(shopId) {
  const [totalQuestions, published, pending, categories] = await Promise.all([
    prisma.question.count({ where: { shopId } }),
    prisma.question.count({ where: { shopId, status: "published" } }),
    prisma.question.count({ where: { shopId, status: "pending" } }),
    prisma.category.count({ where: { shopId } }),
  ]);

  return { totalQuestions, published, pending, categories };
}

module.exports = {
  getCategories,
  createCategory,
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  moderateQuestion,
  getAnalytics,
};
