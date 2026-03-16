const express = require("express");
const router = express.Router();
const prisma = require("../services/prismaClient");
const contributorService = require("../services/contributorService");
const settingsService = require("../services/settingsService");

async function findShopByWebhookIdentifier(identifier) {
  return prisma.shop.findFirst({
    where: {
      OR: [{ webhookKey: identifier }, { userId: identifier }],
    },
  });
}

/**
 * POST /api/webhooks/:identifier/faq
 * Receive a new FAQ question from a storefront.
 */
router.post("/:identifier/faq", async (req, res) => {
  try {
    const { identifier } = req.params;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (!payload.question && !payload.title) {
      return res.status(400).json({ error: "Field 'question' is required" });
    }

    const shop = await findShopByWebhookIdentifier(identifier);
    if (!shop) return res.status(404).json({ error: "No shop found for this webhook URL" });

    const customer = payload.customer || {};
    const customerEmail = customer.email || payload.customerEmail || null;

    // Find or create contributor
    let contributor = null;
    if (customerEmail) {
      contributor = await contributorService.findOrCreateContributor(shop.id, {
        email: customerEmail,
        name: customer.name || payload.customerName || null,
        phone: customer.phone || payload.customerPhone || null,
        id: customer.id || payload.customerId || null,
      });
      if (contributor?.status === "suspended") {
        return res.status(403).json({ error: "This account has been suspended from submitting questions" });
      }
    }

    // Determine status via publishing rules
    const status = await settingsService.resolveQuestionStatus(shop.id, contributor?.id);

    const question = await prisma.question.create({
      data: {
        question: payload.question || payload.title,
        answer: payload.answer || "",
        status,
        source: "webhook",
        productId: payload.productId ? String(payload.productId) : null,
        productHandle: payload.productHandle ? String(payload.productHandle) : null,
        productTitle: payload.productTitle ? String(payload.productTitle) : null,
        customerName: customer.name || payload.customerName || null,
        customerEmail,
        customerPhone: customer.phone || payload.customerPhone || null,
        customerId: customer.id || payload.customerId || null,
        contributorId: contributor?.id || null,
        publishedAt: status === "published" ? new Date() : null,
        shopId: shop.id,
      },
    });

    res.status(201).json({
      success: true,
      questionId: question.id,
      status: question.status,
      message: status === "published" ? "Question published" : "Question received and queued for review",
    });
  } catch (error) {
    console.error("Webhook POST error:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

/**
 * POST /api/webhooks/:identifier/answer
 * Submit an answer from the storefront.
 */
router.post("/:identifier/answer", async (req, res) => {
  try {
    const { identifier } = req.params;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (!payload.questionId || !payload.answerText) {
      return res.status(400).json({ error: "questionId and answerText are required" });
    }

    const shop = await findShopByWebhookIdentifier(identifier);
    if (!shop) return res.status(404).json({ error: "No shop found for this webhook URL" });

    const question = await prisma.question.findFirst({ where: { id: payload.questionId, shopId: shop.id } });
    if (!question) return res.status(404).json({ error: "Question not found" });

    const customer = payload.customer || {};
    const customerEmail = customer.email || payload.customerEmail || null;

    let contributor = null;
    if (customerEmail) {
      contributor = await contributorService.findOrCreateContributor(shop.id, {
        email: customerEmail,
        name: customer.name || payload.customerName || null,
        phone: customer.phone || payload.customerPhone || null,
        id: customer.id || payload.customerId || null,
      });
      if (contributor?.status === "suspended") {
        return res.status(403).json({ error: "This account has been suspended" });
      }
    }

    const status = await settingsService.resolveAnswerStatus(shop.id, payload.questionId, contributor?.id);

    const answer = await prisma.answer.create({
      data: {
        answerText: payload.answerText,
        status,
        source: "webhook",
        contributorId: contributor?.id || null,
        questionId: payload.questionId,
        shopId: shop.id,
        publishedAt: status === "published" ? new Date() : null,
      },
    });

    res.status(201).json({
      success: true,
      answerId: answer.id,
      status: answer.status,
      message: status === "published" ? "Answer published" : "Answer received and queued for review",
    });
  } catch (error) {
    console.error("Webhook answer POST error:", error);
    res.status(500).json({ error: "Failed to process answer" });
  }
});

/**
 * POST /api/webhooks/:identifier/vote
 * Cast a vote from the storefront.
 */
router.post("/:identifier/vote", async (req, res) => {
  try {
    const { identifier } = req.params;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { entityType, entityId, voteValue, customer } = payload;

    if (!entityType || !entityId || voteValue === undefined || !customer?.email) {
      return res.status(400).json({ error: "entityType, entityId, voteValue, and customer.email are required" });
    }

    const shop = await findShopByWebhookIdentifier(identifier);
    if (!shop) return res.status(404).json({ error: "No shop found for this webhook URL" });

    const contributor = await contributorService.findOrCreateContributor(shop.id, customer);
    if (contributor?.status === "suspended") {
      return res.status(403).json({ error: "This account has been suspended" });
    }

    const voteService = require("../services/voteService");
    const result = await voteService.castVote(shop.id, contributor.id, entityType, entityId, voteValue);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Webhook vote error:", error);
    res.status(500).json({ error: "Failed to process vote" });
  }
});

/**
 * PUT /api/webhooks/:identifier/faq
 * Update an existing FAQ question.
 */
router.put("/:identifier/faq", async (req, res) => {
  try {
    const { identifier } = req.params;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (!payload.id) return res.status(400).json({ error: "Question 'id' is required for updates" });

    const shop = await findShopByWebhookIdentifier(identifier);
    if (!shop) return res.status(404).json({ error: "No shop found for this webhook URL" });

    const existing = await prisma.question.findFirst({ where: { id: payload.id, shopId: shop.id } });
    if (!existing) return res.status(404).json({ error: "Question not found" });

    const customer = payload.customer || {};
    const updateData = {};
    if (payload.question) updateData.question = payload.question;
    if (payload.answer !== undefined) updateData.answer = payload.answer;
    if (payload.status) updateData.status = payload.status;
    if (payload.productId !== undefined) updateData.productId = payload.productId ? String(payload.productId) : null;
    if (payload.productHandle !== undefined) updateData.productHandle = payload.productHandle ? String(payload.productHandle) : null;
    if (payload.productTitle !== undefined) updateData.productTitle = payload.productTitle ? String(payload.productTitle) : null;
    if (customer.name || payload.customerName) updateData.customerName = customer.name || payload.customerName;
    if (customer.email || payload.customerEmail) updateData.customerEmail = customer.email || payload.customerEmail;
    if (customer.phone || payload.customerPhone) updateData.customerPhone = customer.phone || payload.customerPhone;
    if (customer.id || payload.customerId) updateData.customerId = customer.id || payload.customerId;

    const updated = await prisma.question.update({
      where: { id: payload.id },
      data: updateData,
      include: { category: true },
    });

    res.json({ success: true, question: updated });
  } catch (error) {
    console.error("Webhook PUT error:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

/**
 * GET /api/webhooks/:identifier/faq
 * Public endpoint: returns published FAQs sorted by vote score, with answers.
 */
router.get("/:identifier/faq", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { categorySlug, search, sort = "votes", productId, productHandle } = req.query;

    const shop = await findShopByWebhookIdentifier(identifier);
    if (!shop) return res.status(404).json({ error: "No shop found for this webhook URL" });
    await settingsService.applyTimeBasedPublishing(shop.id);

    const where = { shopId: shop.id, status: "published" };

    // Product-scoped filtering for storefront pages.
    // If productId is provided, it takes priority over productHandle.
    if (productId) {
      where.productId = String(productId);
    } else if (productHandle) {
      where.productHandle = String(productHandle);
    }

    if (categorySlug) {
      const category = await prisma.category.findFirst({ where: { shopId: shop.id, slug: categorySlug } });
      if (category) where.categoryId = category.id;
    }

    if (search) {
      where.OR = [
        { question: { contains: search, mode: "insensitive" } },
        { answer: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy = sort === "newest" ? { createdAt: "desc" } : sort === "views" ? { views: "desc" } : { voteScore: "desc" };

    const questions = await prisma.question.findMany({
      where,
      select: {
        id: true,
        question: true,
        answer: true,
        views: true,
        helpful: true,
        notHelpful: true,
        voteScore: true,
        category: { select: { name: true, slug: true } },
        answers: {
          where: { status: "published" },
          select: {
            id: true,
            answerText: true,
            voteScore: true,
            contributor: { select: { name: true } },
            createdAt: true,
          },
          orderBy: { voteScore: "desc" },
        },
        _count: { select: { answers: true } },
        createdAt: true,
      },
      orderBy,
    });

    res.json({ faqs: questions, total: questions.length });
  } catch (error) {
    console.error("Webhook GET error:", error);
    res.status(500).json({ error: "Failed to fetch FAQs" });
  }
});

module.exports = router;
