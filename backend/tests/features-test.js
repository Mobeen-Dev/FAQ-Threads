/**
 * Comprehensive Feature Test Suite
 * Tests all new features: Settings, Answers, Votes, Contributors, Enhanced Webhooks
 * 
 * Usage: node tests/features-test.js
 */

const BASE = "http://localhost:4004/api";
let TOKEN = "";
let SHOP_ID = "";
let USER_ID = "";
let QUESTION_ID = "";
let ANSWER_ID = "";
let CATEGORY_ID = "";
let CONTRIBUTOR_ID = "";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

async function req(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (TOKEN) opts.headers.Authorization = `Bearer ${TOKEN}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = res.status !== 204 ? await res.json().catch(() => ({})) : {};
  return { status: res.status, data };
}

// ─── Setup ───────────────────────────────────────────────────────────

async function setup() {
  console.log("\n═══ SETUP ═══");

  // Signup
  const email = `feattest_${Date.now()}@test.com`;
  let r = await req("POST", "/auth/signup", { email, password: "test123" });
  if (r.status === 409) {
    r = await req("POST", "/auth/login", { email, password: "test123" });
  }
  assert(r.data.token, "Auth: got token");
  TOKEN = r.data.token;
  USER_ID = r.data.user?.id || "";

  // Get user info
  r = await req("GET", "/auth/me");
  assert(r.status === 200, "Auth: /me works");
  USER_ID = r.data.user?.id || USER_ID;

  // Save credentials to get a shop
  r = await req("POST", "/credentials", { domain: "feat-test.myshopify.com" });
  assert(r.status === 200 || r.status === 201, "Credentials: saved shop");
  SHOP_ID = r.data.shop?.id || "";
  assert(!!SHOP_ID, `Credentials: got shopId=${SHOP_ID.slice(0, 12)}...`);
}

// ─── Settings ────────────────────────────────────────────────────────

async function testSettings() {
  console.log("\n═══ SETTINGS ═══");

  // Get defaults
  let r = await req("GET", "/settings");
  assert(r.status === 200, "GET /settings returns 200");
  assert(r.data.settings !== undefined, "Has settings object");
  const s = r.data.settings;
  assert(s.widgetEnabled === true, "Default: widgetEnabled=true");
  assert(s.autoPublishQuestions === false, "Default: autoPublishQuestions=false");
  assert(s.trustedCustomerAutoPublish === false, "Default: trustedCustomerAutoPublish=false");

  // Update
  r = await req("PUT", "/settings", {
    autoPublishQuestions: true,
    trustedCustomerAutoPublish: true,
    autoPublishIfAnswersLessThan: 3,
    notifyEmail: "admin@test.com",
  });
  assert(r.status === 200, "PUT /settings returns 200");
  assert(r.data.settings.autoPublishQuestions === true, "Updated autoPublishQuestions");
  assert(r.data.settings.manualPublishQuestions === false, "Mode exclusivity: manual off when auto on");
  assert(r.data.settings.publishQuestionsAfterTimeEnabled === false, "Mode exclusivity: time off when auto on");
  assert(r.data.settings.trustedCustomerAutoPublish === true, "Updated trustedCustomerAutoPublish");
  assert(r.data.settings.autoPublishIfAnswersLessThan === 3, "Updated autoPublishIfAnswersLessThan");

  // Verify persistence
  r = await req("GET", "/settings");
  assert(r.data.settings.autoPublishQuestions === true, "Setting persisted: autoPublishQuestions");
  assert(r.data.settings.notifyEmail === "admin@test.com", "Setting persisted: notifyEmail");

  // Reset to manual for other tests
  await req("PUT", "/settings", {
    autoPublishQuestions: false,
    manualPublishQuestions: true,
    publishQuestionsAfterTimeEnabled: false,
    autoPublishAnswers: false,
    manualPublishAnswers: true,
    publishAnswersAfterTimeEnabled: false,
    trustedCustomerAutoPublish: false,
  });
}

// ─── Categories ──────────────────────────────────────────────────────

async function testCategories() {
  console.log("\n═══ CATEGORIES ═══");

  let r = await req("POST", "/questions/categories", { name: "Test Category Feat", description: "For testing" });
  assert(r.status === 201, "Create category returns 201");
  assert(r.data.category.slug, "Category has slug");
  CATEGORY_ID = r.data.category.id;

  r = await req("GET", "/questions/categories");
  assert(r.status === 200, "List categories works");
  assert(r.data.categories.length > 0, "Has categories");
}

// ─── Questions (CRUD) ────────────────────────────────────────────────

async function testQuestions() {
  console.log("\n═══ QUESTIONS ═══");

  // Create
  let r = await req("POST", "/questions", {
    question: "Feature test Q?",
    answer: "Feature test A.",
    categoryId: CATEGORY_ID,
    status: "published",
  });
  assert(r.status === 201, "Create question returns 201");
  QUESTION_ID = r.data.question.id;
  assert(!!QUESTION_ID, "Got questionId");

  // Get single
  r = await req("GET", `/questions/${QUESTION_ID}`);
  assert(r.status === 200, "Get single question");
  assert(r.data.question.question === "Feature test Q?", "Question text matches");

  // Update
  r = await req("PUT", `/questions/${QUESTION_ID}`, { answer: "Updated answer." });
  assert(r.status === 200, "Update question");
  assert(r.data.question.answer === "Updated answer.", "Answer updated");

  // Status change
  r = await req("PUT", `/questions/${QUESTION_ID}`, { status: "suspended" });
  assert(r.status === 200, "Change status to suspended");
  assert(r.data.question.status === "suspended", "Status is suspended");

  // Back to published
  r = await req("PUT", `/questions/${QUESTION_ID}`, { status: "published" });
  assert(r.data.question.status === "published", "Status back to published");

  // List with filter
  r = await req("GET", "/questions?status=published");
  assert(r.status === 200, "List questions with filter");
  assert(r.data.questions.length > 0, "Has published questions");
}

// ─── Answers ─────────────────────────────────────────────────────────

async function testAnswers() {
  console.log("\n═══ ANSWERS ═══");

  // Create answer
  let r = await req("POST", "/answers", {
    questionId: QUESTION_ID,
    answerText: "Test answer from admin",
    status: "published",
  });
  assert(r.status === 201, "Create answer returns 201");
  ANSWER_ID = r.data.answer.id;
  assert(!!ANSWER_ID, "Got answerId");

  // List answers
  r = await req("GET", `/answers?questionId=${QUESTION_ID}`);
  assert(r.status === 200, "List answers works");
  assert(r.data.answers.length > 0, "Has answers");

  // Update answer
  r = await req("PUT", `/answers/${ANSWER_ID}`, { answerText: "Updated answer text" });
  assert(r.status === 200, "Update answer");
  assert(r.data.answer.answerText === "Updated answer text", "Answer text updated");

  // Moderate answer
  r = await req("POST", `/answers/${ANSWER_ID}/moderate`, { action: "approve" });
  assert(r.status === 200, "Moderate answer");
  assert(r.data.answer.status === "published", "Answer approved/published");

  // Reject
  r = await req("POST", `/answers/${ANSWER_ID}/moderate`, { action: "reject" });
  assert(r.status === 200, "Reject answer");
  assert(r.data.answer.status === "rejected", "Answer rejected");

  // Re-approve
  r = await req("POST", `/answers/${ANSWER_ID}/moderate`, { action: "approve" });
}

// ─── Webhooks (Enhanced) ─────────────────────────────────────────────

async function testWebhooks() {
  console.log("\n═══ WEBHOOKS ═══");

  // Make webhook-submitted questions published so they are visible in public FAQ GET assertions.
  await req("PUT", "/settings", { autoPublishQuestions: true, manualPublishQuestions: false });

  // Submit question via webhook (with customer)
  let r = await req("POST", `/webhooks/${USER_ID}/faq`, {
    question: "Webhook Q from customer?",
    customer: {
      email: "customer@test.com",
      name: "Test Customer",
      phone: "+1234567890",
    },
  });
  assert(r.status === 201, "Webhook POST creates question");
  assert(r.data.questionId, "Webhook response has questionId");
  const webhookQId = r.data.questionId;

  // Get published FAQs via webhook (public, no PII)
  r = await req("GET", `/webhooks/${USER_ID}/faq`);
  assert(r.status === 200, "Webhook GET returns FAQs");
  const publicQ = r.data.faqs?.find((f) => f.customerEmail);
  assert(!publicQ, "Public API: no customer PII exposed");

  // Submit answer via webhook
  r = await req("POST", `/webhooks/${USER_ID}/answer`, {
    questionId: webhookQId,
    answerText: "Community answer via webhook",
    customer: { email: "answerer@test.com", name: "Answerer" },
  });
  assert(r.status === 201 || r.status === 200, "Webhook answer submission");

  // Submit vote via webhook
  r = await req("POST", `/webhooks/${USER_ID}/vote`, {
    entityType: "question",
    entityId: webhookQId,
    voteValue: 1,
    customer: { email: "voter@test.com" },
  });
  assert(r.status === 200 || r.status === 201, "Webhook vote submission");

  // Product-scoped retrieval regression test
  const productTag = `prod-scope-${Date.now()}`;
  const questionA = `${productTag}-A`;
  const questionB = `${productTag}-B`;
  const productAUrl = "https://feat-test.myshopify.com/products/product-a";
  const productBUrl = "https://feat-test.myshopify.com/products/product-b";

  r = await req("POST", `/webhooks/${USER_ID}/faq`, {
    question: questionA,
    productId: "product-111",
    productHandle: "product-a",
    productUrl: productAUrl,
    customer: { email: "product-a@test.com", name: "Product A User" },
  });
  assert(r.status === 201, "Webhook POST product A question");
  assert(r.data.status === "published", "Product A question published");
  const productAQuestionId = r.data.questionId;

  r = await req("POST", `/webhooks/${USER_ID}/faq`, {
    question: questionB,
    productId: "product-222",
    productHandle: "product-b",
    productUrl: productBUrl,
    customer: { email: "product-b@test.com", name: "Product B User" },
  });
  assert(r.status === 201, "Webhook POST product B question");
  assert(r.data.status === "published", "Product B question published");

  r = await req("GET", `/webhooks/${USER_ID}/faq?productId=product-111&search=${encodeURIComponent(productTag)}`);
  const productAQuestions = (r.data.faqs || []).map((faq) => faq.question);
  assert(r.status === 200, "Webhook GET with productId works");
  assert(productAQuestions.includes(questionA), "Product A fetch includes product A question");
  assert(!productAQuestions.includes(questionB), "Product A fetch excludes product B question");

  r = await req("GET", `/webhooks/${USER_ID}/faq?productHandle=product-b&search=${encodeURIComponent(productTag)}`);
  const productBQuestions = (r.data.faqs || []).map((faq) => faq.question);
  assert(r.status === 200, "Webhook GET with productHandle works");
  assert(productBQuestions.includes(questionB), "Product B fetch includes product B question");
  assert(!productBQuestions.includes(questionA), "Product B fetch excludes product A question");

  // Verify product linkage exists in admin question detail
  r = await req("GET", `/questions/${productAQuestionId}`);
  assert(r.status === 200, "Admin GET question with product returns 200");
  assert(!!r.data.question.product, "Admin question has linked product object");
  assert(
    r.data.question.product?.frontendUrl === "https://feat-test.myshopify.com/products/product-a",
    "Product frontend URL stored in linked product"
  );

  // Product linkage should be immutable via webhook PUT
  r = await req("PUT", `/webhooks/${USER_ID}/faq`, {
    id: productAQuestionId,
    question: `${questionA}-updated`,
    productHandle: "product-z",
    productTitle: "Mutated title",
    productUrl: "https://feat-test.myshopify.com/products/product-z",
  });
  assert(r.status === 200, "Webhook PUT question update accepted");
  assert(r.data.question.productHandle === "product-a", "Webhook PUT cannot mutate productHandle");
  assert(r.data.question.productTitle !== "Mutated title", "Webhook PUT cannot mutate productTitle");

  // Reset webhook publishing behavior for later tests.
  await req("PUT", "/settings", { autoPublishQuestions: false, manualPublishQuestions: true });
}

// ─── Contributors ────────────────────────────────────────────────────

async function testContributors() {
  console.log("\n═══ CONTRIBUTORS ═══");

  // List
  let r = await req("GET", "/contributors");
  assert(r.status === 200, "List contributors");
  assert(r.data.contributors.length > 0, "Has contributors (created by webhooks)");
  CONTRIBUTOR_ID = r.data.contributors[0].id;

  // Trust
  r = await req("POST", `/contributors/${CONTRIBUTOR_ID}/trust`, { trusted: true });
  assert(r.status === 200, "Trust contributor");
  assert(r.data.contributor.trusted === true, "Contributor is trusted");

  // Suspend
  r = await req("POST", `/contributors/${CONTRIBUTOR_ID}/suspend`);
  assert(r.status === 200, "Suspend contributor");
  assert(r.data.contributor.status === "suspended", "Contributor suspended");

  // Unsuspend
  r = await req("POST", `/contributors/${CONTRIBUTOR_ID}/unsuspend`);
  assert(r.status === 200, "Unsuspend contributor");
  assert(r.data.contributor.status === "active", "Contributor active again");

  // Untrust
  r = await req("POST", `/contributors/${CONTRIBUTOR_ID}/trust`, { trusted: false });
  assert(r.data.contributor.trusted === false, "Contributor untrusted");
}

// ─── Votes ───────────────────────────────────────────────────────────

async function testVotes() {
  console.log("\n═══ VOTES ═══");

  // We need a contributor to cast votes
  const contribR = await req("GET", "/contributors");
  const votingContrib = contribR.data.contributors[0];
  assert(!!votingContrib, "Have a contributor for voting");

  // Cast vote on question
  let r = await req("POST", "/votes", {
    shopId: SHOP_ID,
    contributorId: votingContrib.id,
    entityType: "question",
    entityId: QUESTION_ID,
    voteValue: 1,
  });
  assert(r.status === 200, "Cast vote on question");

  // Get votes for question
  r = await req("GET", `/votes?entityType=question&entityId=${QUESTION_ID}`);
  assert(r.status === 200, "Get question votes");
  assert(r.data.score !== undefined, "Has vote score");

  // Cast vote on answer
  r = await req("POST", "/votes", {
    shopId: SHOP_ID,
    contributorId: votingContrib.id,
    entityType: "answer",
    entityId: ANSWER_ID,
    voteValue: 1,
  });
  assert(r.status === 200, "Cast vote on answer");

  // Toggle vote (same value = remove)
  r = await req("POST", "/votes", {
    shopId: SHOP_ID,
    contributorId: votingContrib.id,
    entityType: "answer",
    entityId: ANSWER_ID,
    voteValue: 1,
  });
  assert(r.status === 200, "Toggle vote (remove)");
}

// ─── Analytics ───────────────────────────────────────────────────────

async function testAnalytics() {
  console.log("\n═══ ANALYTICS ═══");

  const r = await req("GET", "/questions/analytics");
  assert(r.status === 200, "Analytics endpoint works");
  assert(typeof r.data.totalQuestions === "number", "Has totalQuestions");
  assert(typeof r.data.totalAnswers === "number", "Has totalAnswers");
  assert(typeof r.data.totalContributors === "number", "Has totalContributors");
  assert(typeof r.data.trustedContributors === "number", "Has trustedContributors");
  assert(typeof r.data.publishedAnswers === "number", "Has publishedAnswers");
  assert(r.data.suspended !== undefined, "Has suspended count");
}

// ─── Publishing Rules ────────────────────────────────────────────────

async function testPublishingRules() {
  console.log("\n═══ PUBLISHING RULES ═══");

  // Enable auto-publish questions
  await req("PUT", "/settings", { autoPublishQuestions: true, manualPublishQuestions: false });

  // Submit question via webhook — should be auto-published
  let r = await req("POST", `/webhooks/${USER_ID}/faq`, {
    question: "Auto-publish test Q?",
    customer: { email: "auto-pub@test.com" },
  });
  assert(r.data.status === "published", "Auto-publish: question auto-published");

  // Disable auto, enable trusted customer publish
  await req("PUT", "/settings", {
    autoPublishQuestions: false,
    manualPublishQuestions: true,
    trustedCustomerAutoPublish: true,
  });

  // First, trust the contributor
  const contribR = await req("GET", "/contributors");
  const autoContrib = contribR.data.contributors?.find((c) => c.email === "auto-pub@test.com");
  if (autoContrib) {
    await req("POST", `/contributors/${autoContrib.id}/trust`, { trusted: true });

    // Submit another question from trusted customer
    r = await req("POST", `/webhooks/${USER_ID}/faq`, {
      question: "Trusted customer Q?",
      customer: { email: "auto-pub@test.com" },
    });
    assert(r.data.status === "published", "Trusted customer: auto-published");

    // Untrust and try again
    await req("POST", `/contributors/${autoContrib.id}/trust`, { trusted: false });
    r = await req("POST", `/webhooks/${USER_ID}/faq`, {
      question: "Untrusted customer Q?",
      customer: { email: "auto-pub@test.com" },
    });
    assert(r.data.status === "pending", "Untrusted customer: pending status");
  } else {
    console.log("  ⏭️  Skipped trusted customer test (contributor not found)");
  }

  // Reset
  await req("PUT", "/settings", {
    autoPublishQuestions: false,
    trustedCustomerAutoPublish: false,
    manualPublishQuestions: true,
  });

  // Time-based mode (0 delay): starts pending, becomes published on next retrieval
  let settingsR = await req("PUT", "/settings", {
    autoPublishQuestions: false,
    manualPublishQuestions: false,
    publishQuestionsAfterTimeEnabled: true,
    publishQuestionsAfterHours: 0,
    publishQuestionsAfterMinutes: 0,
  });
  assert(settingsR.data.settings.publishQuestionsAfterTimeEnabled === true, "Time mode enabled");
  assert(settingsR.data.settings.autoPublishQuestions === false, "Time mode: auto disabled");
  assert(settingsR.data.settings.manualPublishQuestions === false, "Time mode: manual disabled");

  const timedTag = `time-based-${Date.now()}`;
  r = await req("POST", `/webhooks/${USER_ID}/faq`, {
    question: timedTag,
    customer: { email: "time-based@test.com" },
  });
  assert(r.data.status === "pending", "Time mode: initial status pending");

  r = await req("GET", `/webhooks/${USER_ID}/faq?search=${encodeURIComponent(timedTag)}`);
  const timedQuestion = (r.data.faqs || []).find((q) => q.question === timedTag);
  assert(!!timedQuestion, "Time mode: question appears as published after retrieval");

  // Reset to manual for subsequent tests
  await req("PUT", "/settings", {
    autoPublishQuestions: false,
    manualPublishQuestions: true,
    publishQuestionsAfterTimeEnabled: false,
  });
}

// ─── Cleanup ─────────────────────────────────────────────────────────

async function cleanup() {
  console.log("\n═══ CLEANUP ═══");

  // Delete answer
  let r = await req("DELETE", `/answers/${ANSWER_ID}`);
  assert(r.status === 200 || r.status === 204, "Delete answer");

  // Delete question
  r = await req("DELETE", `/questions/${QUESTION_ID}`);
  assert(r.status === 200 || r.status === 204, "Delete question");

  // Delete category
  // Category may have other questions from webhooks, skip delete
  console.log("  ℹ️  Skipping category delete (may have webhook questions)");
}

// ─── Run ─────────────────────────────────────────────────────────────

async function main() {
  console.log("🧪 Feature Test Suite — FAQ App");
  console.log("================================");

  const start = Date.now();

  try {
    await setup();
    await testSettings();
    await testCategories();
    await testQuestions();
    await testAnswers();
    await testWebhooks();
    await testContributors();
    await testVotes();
    await testAnalytics();
    await testPublishingRules();
    await cleanup();
  } catch (err) {
    console.error("\n💥 FATAL ERROR:", err.message);
    failed++;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n================================`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Time: ${elapsed}s`);
  console.log(`================================`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
