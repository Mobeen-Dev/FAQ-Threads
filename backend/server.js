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
const emailRoutes = require("./routes/email");
const mcpRoutes = require("./routes/mcp");
const { resolveCorsOptions } = require("./services/corsService");
const { createRateLimiter } = require("./middleware/rateLimit");
const errorHandler = require("./middleware/errorHandler");
const emailService = require("./services/emailService");
const emailQueueService = require("./services/emailQueueService");
const emailScheduler = require("./jobs/emailScheduler");

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

const mcpOperationsRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 180,
  message: "MCP operation rate limit exceeded. Please slow down.",
});

// Health check (both paths for flexibility)
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

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
app.use("/api/email", emailRoutes);
app.use("/api/mcp", mcpOperationsRateLimiter, mcpRoutes);

// Error handler
app.use(errorHandler);

const server = http.createServer(app);

// Prevent slow requests from holding connections forever
server.timeout = 30000;        // 30s max request time
server.keepAliveTimeout = 65000; // Slightly higher than typical LB timeout (60s)
server.headersTimeout = 66000;   // Must be > keepAliveTimeout

// Initialize services and start server
async function startServer() {
  // Initialize email service
  await emailService.initialize();
  
  // Start email queue processor
  emailQueueService.startProcessor();
  
  // Start email scheduler for reports
  emailScheduler.start();

  server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  emailQueueService.stopProcessor();
  emailScheduler.stop();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  emailQueueService.stopProcessor();
  emailScheduler.stop();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

module.exports = { app, server };
