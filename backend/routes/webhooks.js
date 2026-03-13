const express = require("express");
const router = express.Router();
const prisma = require("../services/prismaClient");

/**
 * POST /api/webhooks/:userId/faq
 * Receive a new FAQ question from a Shopify storefront / ecommerce frontend.
 *
 * Expected JSON body:
 *  {
 *    "question": "How do I return an item?",        // required
 *    "answer":   "",                                 // optional, usually empty from customer
 *    "customer": {                                   // optional customer details
 *      "id":    "cust_abc123",                       // external customer ID
 *      "name":  "Jane Doe",
 *      "email": "jane@example.com",
 *      "phone": "+1-555-123-4567"
 *    }
 *  }
 */
router.post("/:userId/faq", async (req, res) => {
  try {
    const { userId } = req.params;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (!payload.question && !payload.title) {
      return res.status(400).json({ error: "Field 'question' is required" });
    }

    const shop = await prisma.shop.findFirst({ where: { userId } });
    if (!shop) {
      return res.status(404).json({ error: "No shop found for this user" });
    }

    const customer = payload.customer || {};

    const question = await prisma.question.create({
      data: {
        question: payload.question || payload.title,
        answer: payload.answer || "",
        status: "pending",
        source: "webhook",
        customerName: customer.name || payload.customerName || null,
        customerEmail: customer.email || payload.customerEmail || null,
        customerPhone: customer.phone || payload.customerPhone || null,
        customerId: customer.id || payload.customerId || null,
        shopId: shop.id,
      },
    });

    res.status(201).json({
      success: true,
      questionId: question.id,
      message: "Question received and queued for review",
    });
  } catch (error) {
    console.error("Webhook POST error:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

/**
 * PUT /api/webhooks/:userId/faq
 * Update an existing FAQ question (e.g. customer adds more detail).
 *
 * Expected JSON body:
 *  {
 *    "id":       "cuid_of_question",                 // required
 *    "question": "Updated question text",            // optional
 *    "answer":   "Updated answer",                   // optional
 *    "customer": { ... }                             // optional, same shape as POST
 *  }
 */
router.put("/:userId/faq", async (req, res) => {
  try {
    const { userId } = req.params;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (!payload.id) {
      return res.status(400).json({ error: "Question 'id' is required for updates" });
    }

    const shop = await prisma.shop.findFirst({ where: { userId } });
    if (!shop) {
      return res.status(404).json({ error: "No shop found for this user" });
    }

    const existing = await prisma.question.findFirst({
      where: { id: payload.id, shopId: shop.id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Question not found" });
    }

    const customer = payload.customer || {};
    const updateData = {};
    if (payload.question) updateData.question = payload.question;
    if (payload.answer !== undefined) updateData.answer = payload.answer;
    if (payload.status) updateData.status = payload.status;
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
 * GET /api/webhooks/:userId/faq
 * Public endpoint: returns published FAQs for embedding on the storefront.
 * Supports optional ?categorySlug= and ?search= query params.
 */
router.get("/:userId/faq", async (req, res) => {
  try {
    const { userId } = req.params;
    const { categorySlug, search } = req.query;

    const shop = await prisma.shop.findFirst({ where: { userId } });
    if (!shop) {
      return res.status(404).json({ error: "No shop found for this user" });
    }

    const where = { shopId: shop.id, status: "published" };

    if (categorySlug) {
      const category = await prisma.category.findFirst({
        where: { shopId: shop.id, slug: categorySlug },
      });
      if (category) where.categoryId = category.id;
    }

    if (search) {
      where.OR = [
        { question: { contains: search, mode: "insensitive" } },
        { answer: { contains: search, mode: "insensitive" } },
      ];
    }

    const questions = await prisma.question.findMany({
      where,
      select: {
        id: true,
        question: true,
        answer: true,
        views: true,
        helpful: true,
        notHelpful: true,
        category: { select: { name: true, slug: true } },
        createdAt: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    res.json({ faqs: questions, total: questions.length });
  } catch (error) {
    console.error("Webhook GET error:", error);
    res.status(500).json({ error: "Failed to fetch FAQs" });
  }
});

module.exports = router;
