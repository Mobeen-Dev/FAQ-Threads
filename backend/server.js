const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const credentialRoutes = require("./routes/credentials");
const webhookRoutes = require("./routes/webhooks");
const questionRoutes = require("./routes/questions");
const settingsRoutes = require("./routes/settings");
const answerRoutes = require("./routes/answers");
const voteRoutes = require("./routes/votes");
const contributorRoutes = require("./routes/contributors");
const { resolveCorsOptions } = require("./services/corsService");
const { createRateLimiter } = require("./middleware/rateLimit");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 4004;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET. Set JWT_SECRET in backend/.env before starting the server.");
}

app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors((req, callback) => {
    resolveCorsOptions(req)
      .then((options) => callback(null, options))
      .catch((error) => callback(error));
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "100kb" }));

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "Too many authentication attempts. Please try again in a few minutes.",
});

const webhookWriteRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: "Webhook rate limit exceeded. Please slow down.",
});

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/credentials", credentialRoutes);
app.use("/api/webhooks", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return webhookWriteRateLimiter(req, res, next);
  }
  return next();
}, webhookRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/answers", answerRoutes);
app.use("/api/votes", voteRoutes);
app.use("/api/contributors", contributorRoutes);

// Error handler
app.use(errorHandler);

const server = http.createServer(app);

// Prevent slow requests from holding connections forever
server.timeout = 30000;        // 30s max request time
server.keepAliveTimeout = 65000; // Slightly higher than typical LB timeout (60s)
server.headersTimeout = 66000;   // Must be > keepAliveTimeout

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

module.exports = { app, server };
