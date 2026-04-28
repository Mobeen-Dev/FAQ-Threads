import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 30000;

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

class BackendApiClient {
  constructor() {
    this.clientKey = process.env.FAQ_MCP_CLIENT_KEY || null;
    this.apiBaseUrl = normalizeApiBase(process.env.FAQ_MCP_API_BASE_URL || process.env.BACKEND_URL, this.clientKey);
    this.timeoutMs = parsePositiveInt(process.env.FAQ_MCP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
    this.token = process.env.FAQ_MCP_TOKEN || null;
  }

  validateConfiguration() {
    if (!this.token) {
      throw new Error("Missing FAQ_MCP_TOKEN. Rotate one from /api/mcp/token/rotate and set it in env.");
    }
    if (!this.apiBaseUrl.includes("/api/mcp/c/")) {
      throw new Error(
        "MCP base URL must include client key path (/api/mcp/c/<clientKey>). Set FAQ_MCP_API_BASE_URL from token rotate response or provide FAQ_MCP_CLIENT_KEY."
      );
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
        throw new Error(`Request timed out after ${this.timeoutMs}ms: ${method} ${url.pathname}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const payload = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      const authHint =
        response.status === 401
          ? " MCP token may be missing, invalid, or rotated. Generate a new one from /api/mcp/token/rotate."
          : "";
      throw new Error(`${method} ${url.pathname} failed: ${message}.${authHint}`);
    }

    return payload;
  }
}

function textResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
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
    async ({ answerState, page, limit, scanPages, status, search, sortBy }) => {
      const response = await apiClient.request("/questions", {
        query: {
          answerState,
          page,
          limit,
          scanPages,
          status,
          search,
          sortBy,
        },
      });

      return textResult(response);
    }
  );

  server.registerTool(
    "get_question_details",
    {
      title: "Get Question Details",
      description:
        "Fetch one question with full context and existing answers from MCP operations API.",
      inputSchema: {
        questionId: z.string().min(1),
      },
    },
    async ({ questionId }) => {
      const response = await apiClient.request(`/questions/${questionId}`);
      return textResult(response);
    }
  );

  server.registerTool(
    "post_answer",
    {
      title: "Post Answer",
      description: "Create an answer via MCP operations API.",
      inputSchema: {
        questionId: z.string().min(1),
        answerText: z.string().min(3).max(20000),
        status: z.enum(["pending", "published", "rejected", "suspended"]).default("pending"),
      },
    },
    async ({ questionId, answerText, status }) => {
      const response = await apiClient.request("/answers", {
        method: "POST",
        body: { questionId, answerText, status },
      });

      return textResult({
        created: true,
        answer: response?.answer ?? null,
      });
    }
  );

  server.registerTool(
    "backend_health_check",
    {
      title: "Backend Health Check",
      description: "Check backend API health.",
    },
    async () => {
      const health = await apiClient.request("/health", { requiresAuth: false });
      return textResult({
        apiBaseUrl: apiClient.apiBaseUrl,
        health,
      });
    }
  );

  return { server, apiClient };
}

export async function startFaqMcpServer() {
  const { server, apiClient } = createFaqMcpServer();
  apiClient.validateConfiguration();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`FAQ Backend MCP server connected over stdio (API: ${apiClient.apiBaseUrl})`);
}
