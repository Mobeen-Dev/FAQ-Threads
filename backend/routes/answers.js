const express = require("express");
const router = express.Router();
const faqService = require("../services/faqService");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);

// GET /api/answers?questionId=xxx&status=published&search=text — list answers
router.get("/", async (req, res, next) => {
  try {
    if (!req.shopId) return res.json({ answers: [] });
    const { questionId, status, search } = req.query;
    const answers = await faqService.getAnswers(req.shopId, questionId, { status, search });
    res.json({ answers });
  } catch (error) {
    next(error);
  }
});

// POST /api/answers — create an answer (from dashboard)
router.post("/", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(400).json({ error: "No shop configured" });
    const { questionId, answerText, status } = req.body;
    if (!questionId || !answerText) {
      return res.status(400).json({ error: "questionId and answerText are required" });
    }
    const answer = await faqService.createAnswer(req.shopId, questionId, {
      answerText,
      status: status || "published", // dashboard answers default to published
      source: "dashboard",
    });
    res.status(201).json({ answer });
  } catch (error) {
    next(error);
  }
});

// PUT /api/answers/:id — update an answer
router.put("/:id", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Answer not found" });
    const answer = await faqService.updateAnswer(req.shopId, req.params.id, req.body);
    res.json({ answer });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/answers/:id — delete an answer
router.delete("/:id", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Answer not found" });
    await faqService.deleteAnswer(req.shopId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/answers/:id/moderate — moderate an answer
router.post("/:id/moderate", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Answer not found" });
    const { action } = req.body; // approve, reject, suspend
    const answer = await faqService.moderateAnswer(req.shopId, req.params.id, action);
    res.json({ answer });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
