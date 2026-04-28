#!/usr/bin/env node
import { startFaqMcpServer } from "./server.mjs";

startFaqMcpServer().catch((error) => {
  console.error("Failed to start FAQ MCP server:", error);
  process.exit(1);
});
