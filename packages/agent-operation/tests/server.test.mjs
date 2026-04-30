import assert from "node:assert/strict";
import test from "node:test";
import {
  createFaqMcpServer,
  IDEMPOTENCY_KEY_PATTERN,
  QUESTION_ID_PATTERN,
  normalizeApiBase,
  redactApiBaseForLogs,
} from "../src/server.mjs";

function withEnv(envPatch, run) {
  const previousEnv = { ...process.env };
  process.env = { ...process.env, ...envPatch };
  try {
    run();
  } finally {
    process.env = previousEnv;
  }
}

test("normalizeApiBase appends MCP path and client key when needed", () => {
  assert.equal(
    normalizeApiBase("https://api.example.com/api", "mcpk_123"),
    "https://api.example.com/api/mcp/c/mcpk_123"
  );
});

test("redactApiBaseForLogs hides client key value", () => {
  const redacted = redactApiBaseForLogs("https://example.com/api/mcp/c/mcpk_secret-key/questions");
  assert.equal(redacted, "https://example.com/api/mcp/c/[redacted-client-key]/questions");
});

test("production config rejects non-https URLs for non-loopback hosts", () => {
  withEnv(
    {
      NODE_ENV: "production",
      FAQ_MCP_TOKEN: "mcp_test",
      FAQ_MCP_API_BASE_URL: "http://example.com/api/mcp/c/mcpk_abc12345",
      FAQ_MCP_CLIENT_KEY: "",
      BACKEND_URL: "",
    },
    () => {
      const { apiClient } = createFaqMcpServer();
      assert.throws(() => apiClient.validateConfiguration(), /must use HTTPS/i);
    }
  );
});

test("production config allows loopback http URLs", () => {
  withEnv(
    {
      NODE_ENV: "production",
      FAQ_MCP_TOKEN: "mcp_test",
      FAQ_MCP_API_BASE_URL: "http://localhost:4004/api/mcp/c/mcpk_abc12345",
      FAQ_MCP_CLIENT_KEY: "",
      BACKEND_URL: "",
    },
    () => {
      const { apiClient } = createFaqMcpServer();
      assert.doesNotThrow(() => apiClient.validateConfiguration());
    }
  );
});

test("questionId schema pattern allows safe identifier characters", () => {
  assert.equal(QUESTION_ID_PATTERN.test("cm9tm0k2n0000l7084x4c1abc"), true);
  assert.equal(QUESTION_ID_PATTERN.test("../../token"), false);
});

test("idempotency key schema pattern accepts expected format", () => {
  assert.equal(IDEMPOTENCY_KEY_PATTERN.test("req_20260430_abc12345"), true);
  assert.equal(IDEMPOTENCY_KEY_PATTERN.test("bad key"), false);
});
