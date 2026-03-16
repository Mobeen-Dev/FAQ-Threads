const buckets = new Map();

function keyFromRequest(req) {
  const ipHeader = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(ipHeader) ? ipHeader[0] : ipHeader?.split(",")[0];
  return (forwardedIp || req.ip || req.socket?.remoteAddress || "unknown").trim();
}

function createRateLimiter({ windowMs, max, message }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.path}:${keyFromRequest(req)}`;
    const entry = buckets.get(key);

    if (!entry || entry.expiresAt <= now) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.ceil((entry.expiresAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(1, retryAfterSeconds)));
      return res.status(429).json({ error: message || "Too many requests. Please try again later." });
    }

    entry.count += 1;
    buckets.set(key, entry);
    next();
  };
}

module.exports = { createRateLimiter };
