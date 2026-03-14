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
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(
  cors((req, callback) => {
    resolveCorsOptions(req)
      .then((options) => callback(null, options))
      .catch((error) => callback(error));
  })
);
app.use(morgan("dev"));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/credentials", credentialRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/answers", answerRoutes);
app.use("/api/votes", voteRoutes);
app.use("/api/contributors", contributorRoutes);

// Error handler
app.use(errorHandler);

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

module.exports = { app, server };
