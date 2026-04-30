const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert");

const prisma = require("../services/prismaClient");
const faqService = require("../services/faqService");

const originalQuestionFindFirst = prisma.question.findFirst;
const originalAnswerCreate = prisma.answer.create;
const originalAnswerFindFirst = prisma.answer.findFirst;

describe("faqService.createAnswer idempotency", () => {
  afterEach(() => {
    prisma.question.findFirst = originalQuestionFindFirst;
    prisma.answer.create = originalAnswerCreate;
    prisma.answer.findFirst = originalAnswerFindFirst;
  });

  it("stores idempotencyKey on first create and marks as non-replay", async () => {
    let capturedCreateArgs = null;
    prisma.question.findFirst = async () => ({ id: "q_1", shopId: "shop_1" });
    prisma.answer.create = async (args) => {
      capturedCreateArgs = args;
      return {
        id: "answer_1",
        answerText: args.data.answerText,
        status: args.data.status,
        source: args.data.source,
      };
    };

    const response = await faqService.createAnswer("shop_1", "q_1", {
      answerText: "This is an answer",
      status: "pending",
      source: "mcp",
      idempotencyKey: "req_20260430_abc12345",
    });

    assert.ok(capturedCreateArgs);
    assert.strictEqual(capturedCreateArgs.data.idempotencyKey, "req_20260430_abc12345");
    assert.strictEqual(response.idempotencyReplayed, false);
  });

  it("returns previously created answer when idempotency key is replayed", async () => {
    prisma.question.findFirst = async () => ({ id: "q_1", shopId: "shop_1" });
    prisma.answer.create = async () => {
      const err = new Error("Unique constraint failed");
      err.code = "P2002";
      err.meta = { target: ["shopId", "idempotencyKey"] };
      throw err;
    };
    prisma.answer.findFirst = async () => ({
      id: "answer_existing",
      answerText: "Original answer",
      status: "pending",
      source: "mcp",
    });

    const response = await faqService.createAnswer("shop_1", "q_1", {
      answerText: "Original answer",
      status: "pending",
      source: "mcp",
      idempotencyKey: "req_20260430_replay123",
    });

    assert.strictEqual(response.id, "answer_existing");
    assert.strictEqual(response.idempotencyReplayed, true);
  });
});
