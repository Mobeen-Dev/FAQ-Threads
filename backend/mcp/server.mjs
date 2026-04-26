import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 30000;

function normalizeApiBase(rawUrl) {
  if (!rawUrl) return "http://localhost:4004/api";
  const trimmed = String(rawUrl).trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasAnyAnswer(question) {
  const hasLegacyAnswer = typeof question?.answer === "string" && question.answer.trim().length > 0;
  const hasCommunityAnswers = Number(question?._count?.answers ?? 0) > 0;
  return hasLegacyAnswer || hasCommunityAnswers;
}

function toQuestionSummary(question) {
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

class BackendApiClient {
  constructor() {
    this.apiBaseUrl = normalizeApiBase(process.env.FAQ_MCP_API_BASE_URL || process.env.BACKEND_URL);
    this.timeoutMs = parsePositiveInt(process.env.FAQ_MCP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
    this.token = process.env.FAQ_MCP_TOKEN || null;
    this.email = process.env.FAQ_MCP_EMAIL || null;
    this.password = process.env.FAQ_MCP_PASSWORD || null;
  }

  get hasCredentials() {
    return Boolean(this.email && this.password);
  }

  async login() {
    if (!this.hasCredentials) {
      throw new Error(
        "Authentication is not configured. Set FAQ_MCP_TOKEN, or set FAQ_MCP_EMAIL and FAQ_MCP_PASSWORD."
      );
    }

    const payload = await this.request("/auth/login", {
      method: "POST",
      body: { email: this.email, password: this.password },
      requiresAuth: false,
      retryOnAuthFailure: false,
    });

    if (!payload?.token) {
      throw new Error("Login succeeded without token. Check /api/auth/login response format.");
    }

    this.token = payload.token;
    return this.token;
  }

  async ensureToken() {
    if (this.token) return this.token;
    return this.login();
  }

  async request(path, options = {}) {
    const {
      method = "GET",
      query = {},
      body,
      requiresAuth = true,
      retryOnAuthFailure = true,
    } = options;

    if (requiresAuth) {
      await this.ensureToken();
    }

    const url = new URL(`${this.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers = { "Content-Type": "application/json" };
    if (requiresAuth && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeoutMs}ms: ${method} ${url.pathname}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const payload = response.status === 204 ? null : await response.json().catch(() => null);

    if (response.status === 401 && requiresAuth && retryOnAuthFailure && this.hasCredentials) {
      this.token = null;
      await this.login();
      return this.request(path, { ...options, retryOnAuthFailure: false });
    }

    if (!response.ok) {
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new Error(`${method} ${url.pathname} failed: ${message}`);
    }

    return payload;
  }
}

const apiClient = new BackendApiClient();

function textResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer({
  name: "faq-backend-operations",
  version: "1.0.0",
});

server.registerTool(
  "list_questions_for_answering",
  {
    title: "List Questions for Answering",
    description:
      "Fetch questions from the backend and filter by answer state (unanswered, answered, or all).",
    inputSchema: {
      answerState: z.enum(["unanswered", "answered", "all"]).default("unanswered"),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
      scanPages: z.number().int().min(1).max(10).default(1),
      status: z.string().optional(),
      search: z.string().optional(),
      sortBy: z.enum(["newest", "oldest", "popular"]).default("newest"),
    },
  },
  async ({ answerState, page, limit, scanPages, status, search, sortBy }) => {
    const normalizedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const normalizedScanPages = Math.max(scanPages, 1);
    const collected = [];
    let currentPage = page;
    let pagesScanned = 0;
    let lastPagination = null;

    while (pagesScanned < normalizedScanPages && collected.length < normalizedLimit) {
      const response = await apiClient.request("/questions", {
        query: {
          page: currentPage,
          limit: normalizedLimit,
          status,
          search,
          sortBy,
        },
      });

      const questions = Array.isArray(response?.questions) ? response.questions : [];
      const filtered = questions.filter((question) => {
        if (answerState === "all") return true;
        const answered = hasAnyAnswer(question);
        return answerState === "answered" ? answered : !answered;
      });

      for (const question of filtered) {
        if (collected.length >= normalizedLimit) break;
        collected.push(toQuestionSummary(question));
      }

      pagesScanned += 1;
      lastPagination = response?.pagination ?? null;
      if (!lastPagination?.hasNextPage) break;
      currentPage += 1;
    }

    return textResult({
      filters: {
        answerState,
        page,
        limit: normalizedLimit,
        scanPages: normalizedScanPages,
        status: status ?? null,
        search: search ?? null,
        sortBy,
      },
      questions: collected,
      pagesScanned,
      backendPagination: lastPagination,
      note:
        answerState === "all"
          ? undefined
          : "Filtering by answer state is applied in the MCP server after data is fetched from /api/questions.",
    });
  }
);

server.registerTool(
  "get_question_details",
  {
    title: "Get Question Details",
    description:
      "Fetch a single question with full details, including existing answers, to give your LLM complete context.",
    inputSchema: {
      questionId: z.string().min(1),
    },
  },
  async ({ questionId }) => {
    const response = await apiClient.request(`/questions/${questionId}`);
    const question = response?.question;
    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    const answers = Array.isArray(question.answers)
      ? question.answers.map((answer) => ({
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
        }))
      : [];

    return textResult({
      question: {
        ...toQuestionSummary(question),
        fullQuestionText: question.question,
        currentAnswerText: question.answer || null,
        views: question.views,
        voteScore: question.voteScore,
        productTitle: question.productTitle ?? question?.product?.title ?? null,
      },
      answers,
    });
  }
);

server.registerTool(
  "post_answer",
  {
    title: "Post Answer",
    description:
      "Create an answer for a question via /api/answers. Use this after your LLM drafts an answer.",
    inputSchema: {
      questionId: z.string().min(1),
      answerText: z.string().min(3).max(20000),
      status: z.enum(["pending", "published", "rejected", "suspended"]).default("published"),
    },
  },
  async ({ questionId, answerText, status }) => {
    const response = await apiClient.request("/answers", {
      method: "POST",
      body: { questionId, answerText, status },
    });

    const answer = response?.answer;
    if (!answer) {
      throw new Error("Answer creation succeeded without an answer payload.");
    }

    return textResult({
      created: true,
      answer: {
        id: answer.id,
        questionId: answer.questionId,
        status: answer.status,
        answerText: answer.answerText,
        createdAt: answer.createdAt,
      },
    });
  }
);

server.registerTool(
  "backend_health_check",
  {
    title: "Backend Health Check",
    description: "Check whether the backend API is reachable.",
  },
  async () => {
    const response = await apiClient.request("/health", { requiresAuth: false });
    return textResult({
      apiBaseUrl: apiClient.apiBaseUrl,
      health: response,
    });
  }
);

async function start() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`FAQ Backend MCP server connected over stdio (API: ${apiClient.apiBaseUrl})`);
}

start().catch((error) => {
  console.error("Failed to start FAQ Backend MCP server:", error);
  process.exit(1);
});
