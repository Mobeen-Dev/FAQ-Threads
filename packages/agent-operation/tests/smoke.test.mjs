import assert from "node:assert/strict";
import test from "node:test";
import { createFaqMcpServer } from "../src/server.mjs";

test("createFaqMcpServer creates server and api client", () => {
  const { server, apiClient } = createFaqMcpServer();
  assert.ok(server);
  assert.ok(apiClient);
});
