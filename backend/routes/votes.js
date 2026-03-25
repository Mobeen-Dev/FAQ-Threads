const express = require("express");
const router = express.Router();
const voteService = require("../services/voteService");

// POST /api/votes — cast or toggle a vote (public, uses contributor email)
router.post("/", async (req, res, next) => {
  try {
    const { shopId, contributorId, entityType, entityId, voteValue } = req.body;

    if (!shopId || !contributorId || !entityType || !entityId || voteValue === undefined) {
      return res.status(400).json({
        error: "shopId, contributorId, entityType, entityId, and voteValue are required",
      });
    }

    const result = await voteService.castVote(shopId, contributorId, entityType, entityId, voteValue);
    res.json(result);
  } catch (error) {
    if (error.message.includes("suspended")) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// DELETE /api/votes — remove a vote
router.delete("/", async (req, res, next) => {
  try {
    const { shopId, contributorId, entityType, entityId } = req.body;
    if (!shopId || !contributorId || !entityType || !entityId) {
      return res.status(400).json({ error: "shopId, contributorId, entityType, and entityId are required" });
    }
    const result = await voteService.removeVote(shopId, contributorId, entityType, entityId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/votes?entityType=question&entityId=xxx
router.get("/", async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) {
      return res.status(400).json({ error: "entityType and entityId are required" });
    }
    const result = await voteService.getVotesForEntity(entityType, entityId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
