const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const mcpTokenAuth = require("../middleware/mcpTokenAuth");
const faqService = require("../services/faqService");
const mcpTokenService = require("../services/mcpTokenService");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function resolvePublicBackendBase(req) {
  const configuredBase = process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL;
  if (configuredBase) {
    return String(configuredBase).replace(/\/+$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
}

function parsePositiveInt(value, fallback, { max } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return typeof max === "number" ? Math.min(parsed, max) : parsed;
}

function hasAnyAnswer(question) {
  const hasLegacyAnswer = typeof question?.answer === "string" && question.answer.trim().length > 0;
  const hasCommunityAnswers = Number(question?._count?.answers ?? 0) > 0;
  return hasLegacyAnswer || hasCommunityAnswers;
}

function summarizeQuestion(question) {
  return {
    id: question.id,
    question: question.question,
    status: question.status,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    answerCount: Number(question?._count?.answers ?? 0),
    hasLegacyAnswer: typeof question?.answer === "string" && question.answer.trim().length > 0,
    isAnswered: hasAnyAnswer(question),
    category: question?.category?.name ?? null,
    customerName: question?.customerName ?? question?.contributor?.name ?? question?.contributor?.email ?? null,
    customerEmail: question?.customerEmail ?? question?.contributor?.email ?? null,
    customerPhone: question?.customerPhone ?? question?.contributor?.phone ?? null,
  };
}

// Rotate MCP token (JWT-protected)
router.post("/token/rotate", authMiddleware, async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(400).json({ error: "No shop configured." });

    const { token, clientKey, createdAt } = await mcpTokenService.rotateToken(req.shopId, req.userId);
    const backendBase = resolvePublicBackendBase(req);
    const mcpApiBaseUrl = `${backendBase}/api/mcp/c/${clientKey}`;

    res.json({
      token,
      clientKey,
      createdAt,
      mcpApiBaseUrl,
      warning:
        "Previous MCP token and client key were revoked. Store these new values now; they are shown only once.",
    });
  } catch (error) {
    next(error);
  }
});

// MCP token status (JWT-protected)
router.get("/token/status", authMiddleware, async (req, res, next) => {
  try {
    if (!req.shopId) {
      return res.json({
        tokenConfigured: false,
        tokenCreatedAt: null,
        clientKeyConfigured: false,
        clientKeyCreatedAt: null,
      });
    }
    const status = await mcpTokenService.getTokenStatus(req.shopId);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

// Revoke MCP token (JWT-protected)
router.delete("/token", authMiddleware, async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(400).json({ error: "No shop configured." });
    await mcpTokenService.revokeToken(req.shopId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// List questions for MCP answering workflows (MCP-token + client-key protected)
router.get("/c/:clientKey/questions", mcpTokenAuth, async (req, res, next) => {
  try {
    const answerState = ["unanswered", "answered", "all"].includes(req.query.answerState)
      ? req.query.answerState
      : "unanswered";

    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, DEFAULT_PAGE_SIZE, { max: MAX_PAGE_SIZE });
    const scanPages = parsePositiveInt(req.query.scanPages, 1, { max: 10 });
    const { status, search, sortBy, fromDate, toDate } = req.query;

    const collected = [];
    let currentPage = page;
    let pagesScanned = 0;
    let backendPagination = null;

    while (pagesScanned < scanPages && collected.length < limit) {
      const result = await faqService.getQuestions(req.shopId, {
        status,
        search,
        page: currentPage,
        limit,
        sortBy,
        fromDate,
        toDate,
      });

      const questions = Array.isArray(result.questions) ? result.questions : [];
      const filteredQuestions = questions.filter((question) => {
        if (answerState === "all") return true;
        const answered = hasAnyAnswer(question);
        return answerState === "answered" ? answered : !answered;
      });

      for (const question of filteredQuestions) {
        if (collected.length >= limit) break;
        collected.push(summarizeQuestion(question));
      }

      pagesScanned += 1;
      backendPagination = result.pagination;
      if (!backendPagination?.hasNextPage) break;
      currentPage += 1;
    }

    res.json({
      questions: collected,
      filters: {
        answerState,
        page,
        limit,
        scanPages,
        status: status || null,
        search: search || null,
        sortBy: sortBy || "newest",
      },
      pagesScanned,
      backendPagination,
    });
  } catch (error) {
    next(error);
  }
});

// Get full question details (MCP-token + client-key protected)
router.get("/c/:clientKey/questions/:id", mcpTokenAuth, async (req, res, next) => {
  try {
    const question = await faqService.getQuestion(req.shopId, req.params.id);
    if (!question) return res.status(404).json({ error: "Question not found" });

    res.json({
      question: summarizeQuestion(question),
      details: {
        fullQuestionText: question.question,
        currentAnswerText: question.answer || null,
        views: question.views,
        voteScore: question.voteScore,
        productTitle: question.productTitle ?? question?.product?.title ?? null,
      },
      answers: (question.answers || []).map((answer) => ({
        id: answer.id,
        answerText: answer.answerText,
        status: answer.status,
        voteScore: answer.voteScore,
        createdAt: answer.createdAt,
        contributor: answer?.contributor
          ? {
              id: answer.contributor.id,
              name: answer.contributor.name,
              email: answer.contributor.email,
              trusted: answer.contributor.trusted,
            }
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Post answer generated by MCP/LLM (MCP-token + client-key protected)
router.post("/c/:clientKey/answers", mcpTokenAuth, async (req, res, next) => {
  try {
    const { questionId, answerText, status = "pending" } = req.body;
    if (!questionId || !answerText) {
      return res.status(400).json({ error: "questionId and answerText are required" });
    }

    const answer = await faqService.createAnswer(req.shopId, questionId, {
      answerText,
      status,
      source: "mcp",
    });

    res.status(201).json({ answer });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
