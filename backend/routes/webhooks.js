const express = require("express");
const router = express.Router();
const prisma = require("../services/prismaClient");
const contributorService = require("../services/contributorService");
const settingsService = require("../services/settingsService");
const productService = require("../services/productService");

// ---------- Input Validation ----------

const MAX_QUESTION_LENGTH = 5000;
const MAX_ANSWER_LENGTH = 20000;
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 50;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate and sanitize a string field
 */
function sanitizeString(value, maxLen) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return String(value).slice(0, maxLen).trim();
  return value.slice(0, maxLen).trim();
}

/**
 * Validate email format (basic)
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(email);
}

/**
 * Safe JSON parser - avoids crashes when body is malformed string
 */
function safeParseBody(body) {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function findShopByWebhookIdentifier(identifier) {
  // Security: Only accept webhookKey for public webhook endpoints
  // Never accept userId directly - it could be predictable/enumerable
  if (!identifier || typeof identifier !== "string" || identifier.length < 10) {
    return null;
  }
  return prisma.shop.findFirst({
    where: { webhookKey: identifier },
  });
}

/**
 * POST /api/webhooks/:identifier/faq
 * Receive a new FAQ question from a storefront.
 */
router.post("/:identifier/faq", async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const payload = safeParseBody(req.body);
    if (!payload) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    // Validate and sanitize question
    const questionText = sanitizeString(payload.question || payload.title, MAX_QUESTION_LENGTH);
    if (!questionText) {
      return res.status(400).json({ error: "Field 'question' is required" });
    }

    const shop = await findShopByWebhookIdentifier(identifier);
    if (!shop) return res.status(404).json({ error: "No shop found for this webhook URL" });

    const customer = payload.customer || {};
    const rawEmail = customer.email || payload.customerEmail || null;
    const customerEmail = rawEmail && isValidEmail(rawEmail) ? sanitizeString(rawEmail, MAX_EMAIL_LENGTH) : null;

    // Find or create contributor
    let contributor = null;
    if (customerEmail) {
      contributor = await contributorService.findOrCreateContributor(shop.id, {
        email: customerEmail,
        name: sanitizeString(customer.name || payload.customerName, MAX_NAME_LENGTH),
        phone: sanitizeString(customer.phone || payload.customerPhone, MAX_PHONE_LENGTH),
        id: customer.id || payload.customerId || null,
      });
      if (contributor?.status === "suspended") {
        return res.status(403).json({ error: "This account has been suspended from submitting questions" });
      }
    }

    // Determine status via publishing rules
    const status = await settingsService.resolveQuestionStatus(shop.id, contributor?.id);
    const resolvedProductHandle = payload.productHandle
      ? sanitizeString(payload.productHandle, 255)
      : productService.extractHandleFromUrl(payload.productUrl ? String(payload.productUrl) : null);
    let linkedProduct = null;
    try {
      linkedProduct = await productService.upsertProductFromQuestionPayload({ shop, payload });
    } catch (productError) {
      console.error("Product linking failed during webhook POST:", productError);
    }

    const question = await prisma.question.create({
      data: {
        question: questionText,
        answer: sanitizeString(payload.answer, MAX_ANSWER_LENGTH) || "",
        status,
        source: "webhook",
        productId: payload.productId ? sanitizeString(payload.productId, 255) : null,
        productHandle: resolvedProductHandle || null,
        productTitle: sanitizeString(payload.productTitle, 500) || linkedProduct?.title || null,
        productRefId: linkedProduct?.id || null,
        customerName: sanitizeString(customer.name || payload.customerName, MAX_NAME_LENGTH),
        customerEmail,
        customerPhone: sanitizeString(customer.phone || payload.customerPhone, MAX_PHONE_LENGTH),
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
    next(error);
  }
});

/**
 * POST /api/webhooks/:identifier/answer
 * Submit an answer from the storefront.
 */
router.post("/:identifier/answer", async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const payload = safeParseBody(req.body);
    if (!payload) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    // Validate and sanitize answer
    const answerText = sanitizeString(payload.answerText, MAX_ANSWER_LENGTH);
    if (!payload.questionId || !answerText) {
      return res.status(400).json({ error: "questionId and answerText are required" });
    }

    const shop = await findShopByWebhookIdentifier(identifier);
    if (!shop) return res.status(404).json({ error: "No shop found for this webhook URL" });

    const question = await prisma.question.findFirst({ where: { id: payload.questionId, shopId: shop.id } });
    if (!question) return res.status(404).json({ error: "Question not found" });

    const customer = payload.customer || {};
    const rawEmail = customer.email || payload.customerEmail || null;
    const customerEmail = rawEmail && isValidEmail(rawEmail) ? sanitizeString(rawEmail, MAX_EMAIL_LENGTH) : null;

    let contributor = null;
    if (customerEmail) {
      contributor = await contributorService.findOrCreateContributor(shop.id, {
        email: customerEmail,
        name: sanitizeString(customer.name || payload.customerName, MAX_NAME_LENGTH),
        phone: sanitizeString(customer.phone || payload.customerPhone, MAX_PHONE_LENGTH),
        id: customer.id || payload.customerId || null,
      });
      if (contributor?.status === "suspended") {
        return res.status(403).json({ error: "This account has been suspended" });
      }
    }

    const status = await settingsService.resolveAnswerStatus(shop.id, payload.questionId, contributor?.id);

    const answer = await prisma.answer.create({
      data: {
        answerText,
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
    next(error);
  }
});

/**
 * POST /api/webhooks/:identifier/vote
 * Cast a vote from the storefront.
 */
router.post("/:identifier/vote", async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const payload = safeParseBody(req.body);
    if (!payload) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
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
    next(error);
  }
});

/**
 * PUT /api/webhooks/:identifier/faq
 * Update an existing FAQ question.
 */
router.put("/:identifier/faq", async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const payload = safeParseBody(req.body);
    if (!payload) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

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
    if (
      payload.productId !== undefined ||
      payload.productHandle !== undefined ||
      payload.productTitle !== undefined ||
      payload.productUrl !== undefined
    ) {
      console.warn("Webhook PUT ignored product mutation because product linkage is immutable.", {
        questionId: payload.id,
        shopId: shop.id,
      });
    }
    if (customer.name || payload.customerName) updateData.customerName = customer.name || payload.customerName;
    if (customer.email || payload.customerEmail) updateData.customerEmail = customer.email || payload.customerEmail;
    if (customer.phone || payload.customerPhone) updateData.customerPhone = customer.phone || payload.customerPhone;
    if (customer.id || payload.customerId) updateData.customerId = customer.id || payload.customerId;

    const updated = await prisma.question.update({
      where: { id: payload.id },
      data: updateData,
      include: { category: true, product: true },
    });

    res.json({ success: true, question: updated });
  } catch (error) {
    next(error);
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
    next(error);
  }
});

module.exports = router;
