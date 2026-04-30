const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const mcpTokenAuth = require("../middleware/mcpTokenAuth");
const faqService = require("../services/faqService");
const mcpTokenService = require("../services/mcpTokenService");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const ANSWER_STATUSES = ["pending", "published", "rejected", "suspended", "draft"];

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

function sendMcpError(res, status, errorCode, error, retryable = false, details) {
  const payload = {
    error,
    errorCode,
    retryable,
  };
  if (details !== undefined) {
    payload.details = details;
  }
  return res.status(status).json(payload);
}

function isValidQuestionId(questionId) {
  return typeof questionId === "string" && QUESTION_ID_PATTERN.test(questionId);
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
    return sendMcpError(res, 500, "MCP_LIST_QUESTIONS_FAILED", "Unable to list questions right now.", true);
  }
});

// Get full question details (MCP-token + client-key protected)
router.get("/c/:clientKey/questions/:id", mcpTokenAuth, async (req, res, next) => {
  try {
    if (!isValidQuestionId(req.params.id)) {
      return sendMcpError(res, 400, "MCP_INVALID_QUESTION_ID", "questionId format is invalid.");
    }

    const question = await faqService.getQuestion(req.shopId, req.params.id);
    if (!question) return sendMcpError(res, 404, "MCP_QUESTION_NOT_FOUND", "Question not found.");

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
    return sendMcpError(res, 500, "MCP_GET_QUESTION_FAILED", "Unable to fetch question details right now.", true);
  }
});

// MCP-protected health check
router.get("/c/:clientKey/health", mcpTokenAuth, async (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    shopId: req.shopId,
  });
});

// Post answer generated by MCP/LLM (MCP-token + client-key protected)
router.post("/c/:clientKey/answers", mcpTokenAuth, async (req, res, next) => {
  try {
    const { questionId, answerText, status = "pending", idempotencyKey } = req.body || {};
    if (!questionId || !answerText) {
      return sendMcpError(res, 400, "MCP_MISSING_REQUIRED_FIELDS", "questionId and answerText are required.");
    }
    if (!isValidQuestionId(questionId)) {
      return sendMcpError(res, 400, "MCP_INVALID_QUESTION_ID", "questionId format is invalid.");
    }
    if (typeof status !== "string" || !ANSWER_STATUSES.includes(status)) {
      return sendMcpError(
        res,
        400,
        "MCP_INVALID_STATUS",
        `Invalid status. Must be one of: ${ANSWER_STATUSES.join(", ")}.`
      );
    }

    const answer = await faqService.createAnswer(req.shopId, questionId, {
      answerText,
      status,
      source: "mcp",
      idempotencyKey,
    });

    const idempotencyReplayed = Boolean(answer?.idempotencyReplayed);
    if (answer && Object.prototype.hasOwnProperty.call(answer, "idempotencyReplayed")) {
      delete answer.idempotencyReplayed;
    }

    res.status(idempotencyReplayed ? 200 : 201).json({
      answer,
      created: !idempotencyReplayed,
      idempotencyReplayed,
      idempotencyKey: idempotencyKey || null,
    });
  } catch (error) {
    if (error?.status === 404) {
      return sendMcpError(res, 404, "MCP_QUESTION_NOT_FOUND", "Question not found.");
    }
    if (error?.status === 400) {
      return sendMcpError(res, 400, "MCP_INVALID_INPUT", error.message || "Invalid answer payload.");
    }
    if (error?.code === "P2002") {
      return sendMcpError(res, 409, "MCP_DUPLICATE_ANSWER", "Duplicate answer submission detected.", false);
    }
    return sendMcpError(res, 500, "MCP_POST_ANSWER_FAILED", "Unable to create answer right now.", true);
  }
});

module.exports = router;
