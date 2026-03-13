const express = require("express");
const router = express.Router();
const faqService = require("../services/faqService");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);

// List all FAQ categories for a user's shop
router.get("/categories", async (req, res, next) => {
  try {
    if (!req.shopId) return res.json({ categories: [] });
    const categories = await faqService.getCategories(req.shopId);
    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

// Create a category
router.post("/categories", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(400).json({ error: "No shop configured. Add Shopify credentials first." });
    const { name, description } = req.body;
    const category = await faqService.createCategory(req.shopId, { name, description });
    res.status(201).json({ category });
  } catch (error) {
    next(error);
  }
});

// List questions (with optional filters)
router.get("/", async (req, res, next) => {
  try {
    if (!req.shopId) return res.json({ questions: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    const { categoryId, status, search, page = 1, limit = 20 } = req.query;
    const result = await faqService.getQuestions(req.shopId, {
      categoryId,
      status,
      search,
      page: Number(page),
      limit: Number(limit),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get analytics
router.get("/analytics", async (req, res, next) => {
  try {
    if (!req.shopId) return res.json({ totalQuestions: 0, published: 0, pending: 0, categories: 0 });
    const analytics = await faqService.getAnalytics(req.shopId);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

// Get single question
router.get("/:id", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Question not found" });
    const question = await faqService.getQuestion(req.shopId, req.params.id);
    if (!question) return res.status(404).json({ error: "Question not found" });
    res.json({ question });
  } catch (error) {
    next(error);
  }
});

// Create question
router.post("/", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(400).json({ error: "No shop configured. Add Shopify credentials first." });
    const question = await faqService.createQuestion(req.shopId, req.body);
    res.status(201).json({ question });
  } catch (error) {
    next(error);
  }
});

// Update question
router.put("/:id", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Question not found" });
    const question = await faqService.updateQuestion(req.shopId, req.params.id, req.body);
    res.json({ question });
  } catch (error) {
    next(error);
  }
});

// Delete question
router.delete("/:id", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Question not found" });
    await faqService.deleteQuestion(req.shopId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Moderate a question (approve/reject)
router.post("/:id/moderate", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Question not found" });
    const { action } = req.body;
    const question = await faqService.moderateQuestion(req.shopId, req.params.id, action);
    res.json({ question });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
