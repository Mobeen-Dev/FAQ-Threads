import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 30000;
const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/;

function normalizeApiBase(rawUrl, clientKey) {
  if (!rawUrl) {
    return clientKey
      ? `http://localhost:4004/api/mcp/c/${clientKey}`
      : "http://localhost:4004/api/mcp";
  }

  const trimmed = String(rawUrl).trim().replace(/\/+$/, "");
  if (trimmed.includes("/api/mcp/c/")) return trimmed;
  if (trimmed.includes("/api/mcp")) {
    return clientKey ? `${trimmed}/c/${clientKey}` : trimmed;
  }
  if (trimmed.endsWith("/api")) {
    return clientKey ? `${trimmed}/mcp/c/${clientKey}` : `${trimmed}/mcp`;
  }

  return clientKey ? `${trimmed}/api/mcp/c/${clientKey}` : `${trimmed}/api/mcp`;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isLoopbackHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function redactApiBaseForLogs(apiBaseUrl) {
  return String(apiBaseUrl).replace(/(\/api\/mcp\/c\/)([^/?#]+)/, "$1[redacted-client-key]");
}

function mapHttpError(status, backendCode) {
  if (backendCode) {
    return {
      code: backendCode,
      retryable: status >= 500 || status === 429,
    };
  }

  if (status === 400) return { code: "MCP_INVALID_REQUEST", retryable: false };
  if (status === 401) return { code: "MCP_AUTH_INVALID", retryable: false };
  if (status === 404) return { code: "MCP_NOT_FOUND", retryable: false };
  if (status === 409) return { code: "MCP_CONFLICT", retryable: false };
  if (status === 429) return { code: "MCP_RATE_LIMITED", retryable: true };
  if (status >= 500) return { code: "MCP_BACKEND_UNAVAILABLE", retryable: true };
  return { code: "MCP_HTTP_ERROR", retryable: false };
}

class ApiRequestError extends Error {
  constructor({ message, code, httpStatus = null, retryable = false, details = null, operation = null }) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    this.details = details;
    this.operation = operation;
  }
}

class BackendApiClient {
  constructor() {
    this.clientKey = process.env.FAQ_MCP_CLIENT_KEY || null;
    this.apiBaseUrl = normalizeApiBase(process.env.FAQ_MCP_API_BASE_URL || process.env.BACKEND_URL, this.clientKey);
    this.timeoutMs = parsePositiveInt(process.env.FAQ_MCP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
    this.token = process.env.FAQ_MCP_TOKEN || null;
  }

  validateConfiguration() {
    if (!this.token) {
      throw new ApiRequestError({
        code: "MCP_TOKEN_MISSING",
        message: "Missing FAQ_MCP_TOKEN. Rotate one from /api/mcp/token/rotate and set it in env.",
        operation: "validate_configuration",
      });
    }
    if (!this.apiBaseUrl.includes("/api/mcp/c/")) {
      throw new ApiRequestError({
        code: "MCP_BASE_URL_INVALID",
        message:
          "MCP base URL must include client key path (/api/mcp/c/<clientKey>). Set FAQ_MCP_API_BASE_URL from token rotate response or provide FAQ_MCP_CLIENT_KEY.",
        operation: "validate_configuration",
      });
    }

    const isProduction = process.env.NODE_ENV === "production";
    const parsedApiBase = new URL(this.apiBaseUrl);
    if (isProduction && parsedApiBase.protocol !== "https:" && !isLoopbackHostname(parsedApiBase.hostname)) {
      throw new ApiRequestError({
        code: "MCP_INSECURE_TRANSPORT",
        message: "Production MCP API base URL must use HTTPS.",
        operation: "validate_configuration",
        details: { apiBaseUrl: redactApiBaseForLogs(this.apiBaseUrl) },
      });
    }
  }

  async request(path, options = {}) {
    const {
      method = "GET",
      query = {},
      body,
      requiresAuth = true,
    } = options;

    if (requiresAuth) {
      this.validateConfiguration();
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
        throw new ApiRequestError({
          code: "MCP_REQUEST_TIMEOUT",
          message: `Request timed out after ${this.timeoutMs}ms: ${method} ${url.pathname}`,
          retryable: true,
          operation: method,
          details: { path: url.pathname },
        });
      }
      throw new ApiRequestError({
        code: "MCP_NETWORK_ERROR",
        message: `Network error while calling ${method} ${url.pathname}`,
        retryable: true,
        operation: method,
        details: { path: url.pathname, reason: error?.message || "unknown" },
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      const { code, retryable } = mapHttpError(response.status, payload?.errorCode);
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new ApiRequestError({
        code,
        message: `${method} ${url.pathname} failed: ${message}`,
        httpStatus: response.status,
        retryable,
        operation: method,
        details: payload?.details ?? null,
      });
    }

    return payload;
  }
}

function textResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function toolSuccess(tool, data) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { ...data, _meta: { ok: true, tool } };
  }
  return { data, _meta: { ok: true, tool } };
}

function toolError(tool, error) {
  const normalizedError =
    error instanceof ApiRequestError
      ? {
          code: error.code,
          message: error.message,
          httpStatus: error.httpStatus,
          retryable: error.retryable,
          operation: error.operation,
          details: error.details,
        }
      : {
          code: "MCP_UNEXPECTED_ERROR",
          message: error?.message || "Unexpected MCP tool error",
          httpStatus: null,
          retryable: false,
          operation: null,
          details: null,
        };

  return {
    _meta: {
      ok: false,
      tool,
    },
    error: normalizedError,
  };
}

async function runTool(tool, handler) {
  try {
    const data = await handler();
    return textResult(toolSuccess(tool, data));
  } catch (error) {
    return textResult(toolError(tool, error));
  }
}

export function createFaqMcpServer({ name = "faq-backend-operations", version = "1.0.0" } = {}) {
  const apiClient = new BackendApiClient();

  const server = new McpServer({ name, version });

  server.registerTool(
    "list_questions_for_answering",
    {
      title: "List Questions for Answering",
      description:
        "Fetch questions from the backend MCP operations API and filter by answer state.",
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
    async ({ answerState, page, limit, scanPages, status, search, sortBy }) =>
      runTool("list_questions_for_answering", async () =>
        apiClient.request("/questions", {
          query: {
            answerState,
            page,
            limit,
            scanPages,
            status,
            search,
            sortBy,
          },
        })
      )
  );

  server.registerTool(
    "get_question_details",
    {
      title: "Get Question Details",
      description:
        "Fetch one question with full context and existing answers from MCP operations API.",
      inputSchema: {
        questionId: z.string().trim().regex(QUESTION_ID_PATTERN, "questionId format is invalid."),
      },
    },
    async ({ questionId }) =>
      runTool("get_question_details", async () => {
        const encodedQuestionId = encodeURIComponent(questionId);
        return apiClient.request(`/questions/${encodedQuestionId}`);
      })
  );

  server.registerTool(
    "post_answer",
    {
      title: "Post Answer",
      description: "Create an answer via MCP operations API.",
      inputSchema: {
        questionId: z.string().trim().regex(QUESTION_ID_PATTERN, "questionId format is invalid."),
        answerText: z.string().min(3).max(20000),
        status: z.enum(["pending", "published", "rejected", "suspended", "draft"]).default("pending"),
        idempotencyKey: z.string().trim().regex(IDEMPOTENCY_KEY_PATTERN).optional(),
      },
    },
    async ({ questionId, answerText, status, idempotencyKey }) =>
      runTool("post_answer", async () => {
        const response = await apiClient.request("/answers", {
          method: "POST",
          body: { questionId, answerText, status, idempotencyKey },
        });

        return {
          created: Boolean(response?.created ?? true),
          idempotencyReplayed: Boolean(response?.idempotencyReplayed),
          idempotencyKey: response?.idempotencyKey ?? idempotencyKey ?? null,
          answer: response?.answer ?? null,
        };
      })
  );

  server.registerTool(
    "backend_health_check",
    {
      title: "Backend Health Check",
      description: "Check backend API health.",
    },
    async () =>
      runTool("backend_health_check", async () => {
        const health = await apiClient.request("/health");
        return {
          apiBaseUrl: redactApiBaseForLogs(apiClient.apiBaseUrl),
          health,
        };
      })
  );

  return { server, apiClient };
}

export async function startFaqMcpServer() {
  const { server, apiClient } = createFaqMcpServer();
  apiClient.validateConfiguration();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`FAQ Backend MCP server connected over stdio (API: ${redactApiBaseForLogs(apiClient.apiBaseUrl)})`);
}

export {
  normalizeApiBase,
  parsePositiveInt,
  redactApiBaseForLogs,
  ApiRequestError,
  isLoopbackHostname,
  QUESTION_ID_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
};
