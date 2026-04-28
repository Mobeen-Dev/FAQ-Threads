const crypto = require("crypto");
const prisma = require("./prismaClient");

function generateRawToken() {
  return `mcp_${crypto.randomBytes(48).toString("hex")}`;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateClientKey(shopId, userId) {
  const randomPart = crypto.randomBytes(16).toString("hex");
  const digest = crypto
    .createHash("sha256")
    .update(`${userId || "unknown-user"}:${shopId}:${randomPart}`)
    .digest("hex");
  return `mcpk_${digest}`;
}

async function rotateToken(shopId, userId) {
  const token = generateRawToken();
  const clientKey = generateClientKey(shopId, userId);
  const tokenHash = hashToken(token);
  const clientKeyHash = hashToken(clientKey);
  const createdAt = new Date();

  await prisma.setting.upsert({
    where: { shopId },
    update: {
      mcpTokenHash: tokenHash,
      mcpTokenCreatedAt: createdAt,
      mcpClientKeyHash: clientKeyHash,
      mcpClientKeyCreatedAt: createdAt,
    },
    create: {
      shopId,
      mcpTokenHash: tokenHash,
      mcpTokenCreatedAt: createdAt,
      mcpClientKeyHash: clientKeyHash,
      mcpClientKeyCreatedAt: createdAt,
    },
  });

  return { token, clientKey, createdAt };
}

async function revokeToken(shopId) {
  await prisma.setting.upsert({
    where: { shopId },
    update: {
      mcpTokenHash: null,
      mcpTokenCreatedAt: null,
      mcpClientKeyHash: null,
      mcpClientKeyCreatedAt: null,
    },
    create: {
      shopId,
      mcpTokenHash: null,
      mcpTokenCreatedAt: null,
      mcpClientKeyHash: null,
      mcpClientKeyCreatedAt: null,
    },
  });
}

async function getTokenStatus(shopId) {
  const settings = await prisma.setting.findUnique({
    where: { shopId },
    select: {
      mcpTokenHash: true,
      mcpTokenCreatedAt: true,
      mcpClientKeyHash: true,
      mcpClientKeyCreatedAt: true,
    },
  });

  return {
    tokenConfigured: Boolean(settings?.mcpTokenHash),
    tokenCreatedAt: settings?.mcpTokenCreatedAt || null,
    clientKeyConfigured: Boolean(settings?.mcpClientKeyHash),
    clientKeyCreatedAt: settings?.mcpClientKeyCreatedAt || null,
  };
}

async function resolveToken(token) {
  const tokenHash = hashToken(token);

  const settings = await prisma.setting.findFirst({
    where: { mcpTokenHash: tokenHash },
    select: {
      shopId: true,
      mcpTokenCreatedAt: true,
      shop: {
        select: {
          id: true,
          userId: true,
          domain: true,
        },
      },
    },
  });

  if (!settings?.shopId) return null;

  return {
    shopId: settings.shopId,
    createdAt: settings.mcpTokenCreatedAt || null,
    shop: settings.shop,
  };
}

async function resolveClientKey(clientKey) {
  const clientKeyHash = hashToken(clientKey);

  const settings = await prisma.setting.findFirst({
    where: { mcpClientKeyHash: clientKeyHash },
    select: {
      shopId: true,
      mcpClientKeyCreatedAt: true,
      shop: {
        select: {
          id: true,
          userId: true,
          domain: true,
        },
      },
    },
  });

  if (!settings?.shopId) return null;

  return {
    shopId: settings.shopId,
    createdAt: settings.mcpClientKeyCreatedAt || null,
    shop: settings.shop,
  };
}

module.exports = {
  rotateToken,
  revokeToken,
  getTokenStatus,
  resolveToken,
  resolveClientKey,
};
