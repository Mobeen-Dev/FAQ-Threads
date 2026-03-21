const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const prisma = require("../services/prismaClient");
const authMiddleware = require("../middleware/auth");
const { buildWidgetHtml } = require("../services/widgetEmbedService");

router.use(authMiddleware);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function parseForwardedHeader(value) {
  if (!value || typeof value !== "string") return "";
  return value.split(",")[0].trim();
}

function normalizeBaseUrl(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function isLocalBaseUrl(value) {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function resolvePublicBaseUrl(req) {
  const configuredBase = normalizeBaseUrl(process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL);
  if (configuredBase && !isLocalBaseUrl(configuredBase)) {
    return configuredBase;
  }

  const host = parseForwardedHeader(req.headers["x-forwarded-host"]) || req.get("host");
  const proto = parseForwardedHeader(req.headers["x-forwarded-proto"]) || req.protocol || "http";
  const requestBase = host ? normalizeBaseUrl(`${proto}://${host}`) : "";
  if (requestBase && !isLocalBaseUrl(requestBase)) {
    return requestBase;
  }

  return configuredBase || "http://localhost:4004";
}

function buildWebhookUrl(req, identifier) {
  return `${resolvePublicBaseUrl(req)}/api/webhooks/${identifier}/faq`;
}

function generateWebhookKey() {
  return `whk_${crypto.randomBytes(20).toString("hex")}`;
}

async function ensureShopWebhookKey(shopId) {
  const updated = await prisma.shop.update({
    where: { id: shopId },
    data: { webhookKey: generateWebhookKey() },
  });
  return updated.webhookKey;
}

async function getWebhookIdentifier(shop) {
  if (shop.webhookKey) return shop.webhookKey;
  return ensureShopWebhookKey(shop.id);
}

async function buildShopWebhookUrl(req, shop) {
  const identifier = await getWebhookIdentifier(shop);
  return buildWebhookUrl(req, identifier);
}

function toShopPayload(shop) {
  return {
    id: shop.id,
    domain: shop.domain,
    apiKey: shop.apiKey,
    accessToken: shop.accessToken ? "••••••" + shop.accessToken.slice(-4) : null,
    name: shop.name,
  };
}

function buildCredentialsResponse(shop, widgetHtml) {
  return {
    shop: shop ? toShopPayload(shop) : null,
    widgetHtml,
  };
}

// Get user's Shopify credentials
router.get("/", async (req, res, next) => {
  try {
    const shop = await prisma.shop.findFirst({
      where: { userId: req.userId },
    });

    if (!shop) {
      return res.json({ shop: null, widgetHtml: "" });
    }

    const webhookUrl = await buildShopWebhookUrl(req, shop);
    const widgetHtml = buildWidgetHtml(webhookUrl);
    res.json(buildCredentialsResponse(shop, widgetHtml));
  } catch (error) {
    next(error);
  }
});

// Save / update Shopify credentials
router.post("/", async (req, res, next) => {
  try {
    const { domain, apiKey, accessToken, name } = req.body;

    if (!domain) {
      return res.status(400).json({ error: "Store domain is required" });
    }

    // Upsert: create or update the shop for this user
    const shop = await prisma.shop.upsert({
      where: {
        userId_domain: { userId: req.userId, domain },
      },
      update: {
        apiKey: apiKey || undefined,
        accessToken: accessToken || undefined,
        name: name || undefined,
      },
      create: {
        domain,
        webhookKey: generateWebhookKey(),
        apiKey,
        accessToken,
        name,
        userId: req.userId,
      },
    });

    const webhookUrl = await buildShopWebhookUrl(req, shop);
    const widgetHtml = buildWidgetHtml(webhookUrl);
    res.json(buildCredentialsResponse(shop, widgetHtml));
  } catch (error) {
    next(error);
  }
});

// Delete credentials
router.delete("/", async (req, res, next) => {
  try {
    await prisma.shop.deleteMany({ where: { userId: req.userId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
