const express = require("express");
const router = express.Router();
const settingsService = require("../services/settingsService");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);

// GET /api/settings — fetch shop settings
router.get("/", async (req, res, next) => {
  try {
    if (!req.shopId) return res.json(settingsService.DEFAULTS);
    const settings = await settingsService.getSettings(req.shopId);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings — update shop settings
router.put("/", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(400).json({ error: "No shop configured" });
    const settings = await settingsService.updateSettings(req.shopId, req.body);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
