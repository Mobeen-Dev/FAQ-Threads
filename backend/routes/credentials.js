const express = require("express");
const router = express.Router();
const prisma = require("../services/prismaClient");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);

// Get user's Shopify credentials
router.get("/", async (req, res, next) => {
  try {
    const shop = await prisma.shop.findFirst({
      where: { userId: req.userId },
    });

    if (!shop) {
      return res.json({ shop: null });
    }

    res.json({
      shop: {
        id: shop.id,
        domain: shop.domain,
        apiKey: shop.apiKey,
        accessToken: shop.accessToken ? "••••••" + shop.accessToken.slice(-4) : null,
        name: shop.name,
      },
      webhookUrl: `${process.env.BACKEND_URL || "http://localhost:4000"}/api/webhooks/${req.userId}/faq`,
    });
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
        apiKey,
        accessToken,
        name,
        userId: req.userId,
      },
    });

    res.json({
      shop: {
        id: shop.id,
        domain: shop.domain,
        apiKey: shop.apiKey,
        accessToken: shop.accessToken ? "••••••" + shop.accessToken.slice(-4) : null,
        name: shop.name,
      },
      webhookUrl: `${process.env.BACKEND_URL || "http://localhost:4000"}/api/webhooks/${req.userId}/faq`,
    });
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
