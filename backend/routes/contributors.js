const express = require("express");
const router = express.Router();
const contributorService = require("../services/contributorService");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);

// GET /api/contributors — list storefront contributors
router.get("/", async (req, res, next) => {
  try {
    if (!req.shopId) return res.json({ contributors: [] });
    const { status, trusted, search } = req.query;
    const contributors = await contributorService.getContributors(req.shopId, {
      status,
      trusted: trusted === "true" ? true : trusted === "false" ? false : undefined,
      search,
    });
    res.json({ contributors });
  } catch (error) {
    next(error);
  }
});

// PUT /api/contributors/:id — update contributor (trust, suspend, name)
router.put("/:id", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Contributor not found" });
    const contributor = await contributorService.updateContributor(req.shopId, req.params.id, req.body);
    res.json({ contributor });
  } catch (error) {
    next(error);
  }
});

// POST /api/contributors/:id/suspend
router.post("/:id/suspend", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Contributor not found" });
    const contributor = await contributorService.suspendContributor(req.shopId, req.params.id);
    res.json({ contributor });
  } catch (error) {
    next(error);
  }
});

// POST /api/contributors/:id/unsuspend
router.post("/:id/unsuspend", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Contributor not found" });
    const contributor = await contributorService.unsuspendContributor(req.shopId, req.params.id);
    res.json({ contributor });
  } catch (error) {
    next(error);
  }
});

// POST /api/contributors/:id/trust
router.post("/:id/trust", async (req, res, next) => {
  try {
    if (!req.shopId) return res.status(404).json({ error: "Contributor not found" });
    const { trusted } = req.body;
    const contributor = await contributorService.setTrusted(req.shopId, req.params.id, trusted !== false);
    res.json({ contributor });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
