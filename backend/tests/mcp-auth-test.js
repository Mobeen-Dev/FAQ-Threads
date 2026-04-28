const { describe, it, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

const prisma = require("../services/prismaClient");
const mcpTokenService = require("../services/mcpTokenService");
const mcpTokenAuth = require("../middleware/mcpTokenAuth");
const originalSettingDelegate = prisma.setting;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("MCP token service", () => {
  afterEach(() => {
    prisma.setting = originalSettingDelegate;
    mock.restoreAll();
  });

  it("rotateToken stores hashed token and hashed client key", async () => {
    let capturedArgs = null;
    prisma.setting = {
      upsert: async (args) => {
        capturedArgs = args;
        return {};
      },
    };

    const result = await mcpTokenService.rotateToken("shop_1", "user_1");

    assert.ok(result.token.startsWith("mcp_"));
    assert.ok(result.clientKey.startsWith("mcpk_"));
    assert.strictEqual(result.clientKey.length, 69);
    assert.ok(result.createdAt instanceof Date);

    assert.ok(capturedArgs);
    assert.strictEqual(capturedArgs.where.shopId, "shop_1");
    assert.strictEqual(capturedArgs.update.mcpTokenHash, sha256(result.token));
    assert.strictEqual(capturedArgs.update.mcpClientKeyHash, sha256(result.clientKey));
    assert.notStrictEqual(capturedArgs.update.mcpTokenHash, result.token);
    assert.notStrictEqual(capturedArgs.update.mcpClientKeyHash, result.clientKey);
  });

  it("getTokenStatus maps persisted fields to status booleans", async () => {
    const createdAt = new Date("2026-04-01T00:00:00.000Z");
    prisma.setting = {
      findUnique: async () => ({
        mcpTokenHash: "hashed-token",
        mcpTokenCreatedAt: createdAt,
        mcpClientKeyHash: "hashed-client-key",
        mcpClientKeyCreatedAt: createdAt,
      }),
    };

    const status = await mcpTokenService.getTokenStatus("shop_1");

    assert.strictEqual(status.tokenConfigured, true);
    assert.strictEqual(status.clientKeyConfigured, true);
    assert.strictEqual(status.tokenCreatedAt, createdAt);
    assert.strictEqual(status.clientKeyCreatedAt, createdAt);
  });

  it("resolveToken returns null when token hash does not exist", async () => {
    prisma.setting = {
      findFirst: async () => null,
    };

    const context = await mcpTokenService.resolveToken("missing-token");
    assert.strictEqual(context, null);
  });

  it("resolveClientKey returns context when hash exists", async () => {
    const createdAt = new Date("2026-04-01T00:00:00.000Z");
    let capturedArgs = null;
    prisma.setting = {
      findFirst: async (args) => {
        capturedArgs = args;
        return {
          shopId: "shop_1",
          mcpClientKeyCreatedAt: createdAt,
          shop: {
            id: "shop_1",
            userId: "user_1",
            domain: "test-store.myshopify.com",
          },
        };
      },
    };

    const context = await mcpTokenService.resolveClientKey("mcpk_test-key");

    assert.ok(capturedArgs);
    assert.strictEqual(capturedArgs.where.mcpClientKeyHash, sha256("mcpk_test-key"));
    assert.deepStrictEqual(context, {
      shopId: "shop_1",
      createdAt,
      shop: {
        id: "shop_1",
        userId: "user_1",
        domain: "test-store.myshopify.com",
      },
    });
  });
});

describe("MCP token auth middleware", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("rejects when client key is missing from route params", async () => {
    const req = { params: {}, headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    await mcpTokenAuth(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body.error, /client key/i);
  });

  it("rejects when token header is missing", async () => {
    const req = { params: { clientKey: "mcpk_abc" }, headers: {} };
    const res = createMockRes();

    await mcpTokenAuth(req, res, () => {});

    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body.error, /missing mcp token/i);
  });

  it("rejects when token and client key belong to different shops", async () => {
    mock.method(mcpTokenService, "resolveToken", async () => ({ shopId: "shop_1", createdAt: new Date(), shop: {} }));
    mock.method(mcpTokenService, "resolveClientKey", async () => ({ shopId: "shop_2", createdAt: new Date(), shop: {} }));

    const req = {
      params: { clientKey: "mcpk_abc" },
      headers: { authorization: "Bearer mcp_123" },
    };
    const res = createMockRes();
    let nextCalled = false;

    await mcpTokenAuth(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body.error, /mismatch/i);
  });

  it("accepts valid x-mcp-token header and sets request context", async () => {
    const tokenCreatedAt = new Date("2026-04-01T00:00:00.000Z");
    const keyCreatedAt = new Date("2026-04-02T00:00:00.000Z");

    mock.method(mcpTokenService, "resolveToken", async () => ({
      shopId: "shop_1",
      createdAt: tokenCreatedAt,
      shop: { id: "shop_1", userId: "user_1", domain: "test-store.myshopify.com" },
    }));
    mock.method(mcpTokenService, "resolveClientKey", async () => ({
      shopId: "shop_1",
      createdAt: keyCreatedAt,
      shop: { id: "shop_1", userId: "user_1", domain: "test-store.myshopify.com" },
    }));

    const req = {
      params: { clientKey: "mcpk_abc" },
      headers: { "x-mcp-token": "mcp_123" },
    };
    const res = createMockRes();
    let nextCallCount = 0;

    await mcpTokenAuth(req, res, () => {
      nextCallCount += 1;
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(nextCallCount, 1);
    assert.strictEqual(req.shopId, "shop_1");
    assert.strictEqual(req.mcp.shopId, "shop_1");
    assert.strictEqual(req.mcp.createdAt, tokenCreatedAt);
    assert.strictEqual(req.mcp.clientKeyCreatedAt, keyCreatedAt);
  });
});
