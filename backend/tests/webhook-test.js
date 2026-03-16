#!/usr/bin/env node
/**
 * ============================================================================
 *  FAQ App — Comprehensive Webhook Test Script
 * ============================================================================
 *
 *  Simulates ecommerce storefront traffic hitting the webhook endpoint.
 *  Tests the full lifecycle: signup → credentials → webhook POST/PUT/GET.
 *
 *  Usage:
 *    node tests/webhook-test.js                    # default: http://localhost:4004
 *    node tests/webhook-test.js http://myhost:5000 # custom base URL
 *
 *  Prerequisites:
 *    - Backend server running (`npm run dev`)
 *    - PostgreSQL running with `faq_app` database
 * ============================================================================
 */

const http = require("http");
const https = require("https");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = process.argv[2] || "http://localhost:4004";
const parsed = new URL(BASE_URL);
const IS_HTTPS = parsed.protocol === "https:";
const HOST = parsed.hostname;
const PORT = parsed.port || (IS_HTTPS ? 443 : 80);

const TEST_USER = {
  email: `webhook-test-${Date.now()}@example.com`,
  password: "TestPass123!",
  name: "Webhook Test User",
};

const TEST_SHOP = {
  domain: "test-store-webhook.myshopify.com",
  apiKey: "shpka_test_webhook_key_" + Date.now(),
  accessToken: "shpat_test_webhook_token_" + Date.now(),
};

// Simulated ecommerce customers
const CUSTOMERS = [
  { id: "cust_001", name: "Alice Johnson", email: "alice@example.com", phone: "+1-555-100-2001" },
  { id: "cust_002", name: "Bob Smith", email: "bob@example.com", phone: "+1-555-100-2002" },
  { id: "cust_003", name: "Carol Williams", email: "carol@example.com", phone: "+44-7700-900001" },
  { id: "cust_004", name: "David Kim", email: "david.kim@example.com", phone: "+82-10-1234-5678" },
  { id: "cust_005", name: "Emma García", email: "emma.garcia@example.com", phone: "+34-612-345-678" },
];

// Simulated FAQ questions from storefront visitors
const STOREFRONT_QUESTIONS = [
  {
    question: "How do I return an item I purchased?",
    answer: "",
    customer: CUSTOMERS[0],
  },
  {
    question: "What are your shipping times for international orders?",
    answer: "",
    customer: CUSTOMERS[1],
  },
  {
    question: "Do you offer gift wrapping?",
    answer: "",
    customer: CUSTOMERS[2],
  },
  {
    question: "Can I change my order after it's been placed?",
    answer: "",
    customer: CUSTOMERS[3],
  },
  {
    question: "What payment methods do you accept?",
    answer: "",
    customer: CUSTOMERS[4],
  },
  {
    // Anonymous question (no customer details)
    question: "Is there a warranty on electronics?",
    answer: "",
  },
  {
    // Partial customer details (only email)
    question: "How do I track my order?",
    answer: "",
    customer: { email: "tracker@anon.com" },
  },
  {
    // Using flat fields instead of nested customer object
    question: "Do you ship to Alaska?",
    answer: "",
    customerName: "Frank Alaska",
    customerEmail: "frank@alaska.com",
  },
];

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const transport = IS_HTTPS ? https : http;
    const req = transport.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

function assert(condition, testName, detail = "") {
  if (condition) {
    passed++;
    results.push({ status: "PASS", name: testName });
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failed++;
    results.push({ status: "FAIL", name: testName, detail });
    console.log(`  ❌ FAIL: ${testName}${detail ? " — " + detail : ""}`);
  }
}

function skip(testName, reason) {
  skipped++;
  results.push({ status: "SKIP", name: testName, detail: reason });
  console.log(`  ⏭️ SKIP: ${testName} — ${reason}`);
}

function section(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

async function testHealthCheck() {
  section("1. Health Check");
  const res = await request("GET", "/health");
  assert(res.status === 200, "Server is healthy", `status=${res.status}`);
  assert(res.body.status === "ok", "Health returns {status: ok}");
}

async function testSignup() {
  section("2. User Signup");
  const res = await request("POST", "/api/auth/signup", TEST_USER);
  assert(res.status === 201, "Signup returns 201", `status=${res.status}`);
  assert(res.body.token, "Signup returns JWT token");
  assert(res.body.user?.id, "Signup returns user ID");
  assert(res.body.user?.email === TEST_USER.email, "Email matches");
  return { token: res.body.token, userId: res.body.user?.id };
}

async function testDuplicateSignup() {
  section("3. Duplicate Signup (should fail)");
  const res = await request("POST", "/api/auth/signup", TEST_USER);
  assert(res.status === 409, "Duplicate signup returns 409", `status=${res.status}`);
  assert(res.body.error, "Returns error message");
}

async function testLogin(token) {
  section("4. Login");
  const res = await request("POST", "/api/auth/login", {
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  assert(res.status === 200, "Login returns 200", `status=${res.status}`);
  assert(res.body.token, "Login returns JWT token");
  return res.body.token;
}

async function testSaveCredentials(token) {
  section("5. Save Shopify Credentials");
  const res = await request("POST", "/api/credentials", TEST_SHOP, {
    Authorization: `Bearer ${token}`,
  });
  assert(res.status === 200 || res.status === 201, "Credentials saved", `status=${res.status}`);
  assert(res.body.webhookUrl, "Returns webhook URL");
  console.log(`  📌 Webhook URL: ${res.body.webhookUrl}`);
  return res.body.webhookUrl;
}

async function testGetCredentials(token) {
  section("6. Verify Credentials");
  const res = await request("GET", "/api/credentials", null, {
    Authorization: `Bearer ${token}`,
  });
  assert(res.status === 200, "GET credentials returns 200", `status=${res.status}`);
  assert(res.body.shop?.domain === TEST_SHOP.domain, "Shop domain matches");
  assert(res.body.webhookUrl, "Webhook URL present in response");
}

async function testWebhookPostWithCustomer(webhookPath) {
  section("7. Webhook POST — Questions with Customer Details");
  const createdIds = [];

  for (let i = 0; i < STOREFRONT_QUESTIONS.length; i++) {
    const q = STOREFRONT_QUESTIONS[i];
    const label = q.customer?.name || q.customerName || "anonymous";
    const res = await request("POST", webhookPath, q);

    assert(res.status === 201, `POST question ${i + 1} from "${label}"`, `status=${res.status}`);
    assert(res.body.success === true, `Question ${i + 1} success=true`);
    assert(res.body.questionId, `Question ${i + 1} has ID`);

    if (res.body.questionId) createdIds.push(res.body.questionId);
  }

  return createdIds;
}

async function testWebhookPostValidation(webhookPath) {
  section("8. Webhook POST — Validation / Edge Cases");

  // Missing question field
  const res1 = await request("POST", webhookPath, { answer: "some answer" });
  assert(res1.status === 400, "Reject payload without 'question' field", `status=${res1.status}`);

  // Empty body
  const res2 = await request("POST", webhookPath, {});
  assert(res2.status === 400, "Reject empty body", `status=${res2.status}`);

  // Accepts 'title' as alias for 'question'
  const res3 = await request("POST", webhookPath, {
    title: "Using title field as alias",
    customer: CUSTOMERS[0],
  });
  assert(res3.status === 201, "Accept 'title' as alias for 'question'", `status=${res3.status}`);

  return res3.body.questionId;
}

async function testWebhookPostInvalidUser() {
  section("9. Webhook POST — Invalid User ID");
  const res = await request("POST", "/api/webhooks/nonexistent-user-id/faq", {
    question: "Should fail — no such user",
    customer: CUSTOMERS[0],
  });
  assert(res.status === 404, "Returns 404 for invalid userId", `status=${res.status}`);
  assert(res.body.error, "Returns error message");
}

async function testWebhookPut(webhookPath, questionId) {
  section("10. Webhook PUT — Update Question");

  // Update question text and customer details
  const res1 = await request("PUT", webhookPath, {
    id: questionId,
    question: "Updated: How do I return an item I purchased online?",
    customer: {
      id: "cust_001",
      name: "Alice Johnson-Updated",
      email: "alice.updated@example.com",
      phone: "+1-555-100-9999",
    },
  });
  assert(res1.status === 200, "PUT update succeeds", `status=${res1.status}`);
  assert(res1.body.success === true, "Update success=true");
  assert(res1.body.question?.question?.includes("Updated"), "Question text updated");
  assert(res1.body.question?.customerName === "Alice Johnson-Updated", "Customer name updated");
  assert(res1.body.question?.customerEmail === "alice.updated@example.com", "Customer email updated");

  // Update with flat customer fields
  const res2 = await request("PUT", webhookPath, {
    id: questionId,
    customerPhone: "+1-555-FLAT-TEST",
  });
  assert(res2.status === 200, "PUT with flat customer fields succeeds", `status=${res2.status}`);
}

async function testWebhookPutValidation(webhookPath) {
  section("11. Webhook PUT — Validation");

  // Missing id
  const res1 = await request("PUT", webhookPath, {
    question: "No ID provided",
  });
  assert(res1.status === 400, "Reject PUT without 'id'", `status=${res1.status}`);

  // Non-existent question ID
  const res2 = await request("PUT", webhookPath, {
    id: "non-existent-question-id",
    question: "Should fail",
  });
  assert(res2.status === 404, "Returns 404 for non-existent question", `status=${res2.status}`);
}

async function testWebhookGet(webhookPath) {
  section("12. Webhook GET — Fetch Published FAQs (Storefront)");

  // No published FAQs yet (all are pending)
  const res1 = await request("GET", webhookPath);
  assert(res1.status === 200, "GET returns 200", `status=${res1.status}`);
  assert(Array.isArray(res1.body.faqs), "Response has faqs array");
  assert(res1.body.faqs.length === 0, "No published FAQs yet (all pending)", `count=${res1.body.faqs?.length}`);
  assert(typeof res1.body.total === "number", "Response has total count");
}

async function testDashboardQuestionsAPI(token) {
  section("13. Dashboard API — Verify Webhook Questions Appear");
  const res = await request("GET", "/api/questions?limit=50", null, {
    Authorization: `Bearer ${token}`,
  });
  assert(res.status === 200, "Dashboard questions API returns 200", `status=${res.status}`);

  const webhookQuestions = (res.body.questions || []).filter((q) => q.source === "webhook");
  assert(webhookQuestions.length > 0, `Webhook questions visible in dashboard (${webhookQuestions.length} found)`);

  // Check customer fields are persisted
  const withCustomer = webhookQuestions.filter((q) => q.customerEmail);
  assert(withCustomer.length > 0, `Questions with customer email found (${withCustomer.length})`);

  const withName = webhookQuestions.filter((q) => q.customerName);
  assert(withName.length > 0, `Questions with customer name found (${withName.length})`);

  return webhookQuestions;
}

async function testModerateAndPublish(token, questionId) {
  section("14. Moderate Question -> Publish");
  const res = await request("POST", `/api/questions/${questionId}/moderate`, { action: "approve" }, {
    Authorization: `Bearer ${token}`,
  });
  assert(res.status === 200, "Moderate/approve returns 200", `status=${res.status}`);
  assert(res.body.question?.status === "published", "Status changed to published");
}

async function testWebhookGetAfterPublish(webhookPath) {
  section("15. Webhook GET — After Publishing");
  const res = await request("GET", webhookPath);
  assert(res.status === 200, "GET returns 200", `status=${res.status}`);
  assert(res.body.faqs.length > 0, `Published FAQs now visible (${res.body.faqs.length})`, `count=${res.body.faqs.length}`);

  // Customer details should NOT leak in public GET
  const faq = res.body.faqs[0];
  assert(!faq.customerEmail, "Customer email NOT exposed in public GET");
  assert(!faq.customerPhone, "Customer phone NOT exposed in public GET");
  assert(!faq.customerId, "Customer ID NOT exposed in public GET");
}

async function testWebhookGetWithSearch(webhookPath) {
  section("16. Webhook GET — Search & Filter");
  const res = await request("GET", `${webhookPath}?search=return`);
  assert(res.status === 200, "GET with search returns 200", `status=${res.status}`);
  assert(Array.isArray(res.body.faqs), "Search returns faqs array");
}

async function testBulkTraffic(webhookPath) {
  section("17. Bulk Traffic Simulation (20 rapid requests)");
  const promises = [];
  for (let i = 0; i < 20; i++) {
    const customer = CUSTOMERS[i % CUSTOMERS.length];
    promises.push(
      request("POST", webhookPath, {
        question: `Bulk test question #${i + 1}: Does this product come in size ${i + 10}?`,
        customer: { ...customer, id: `bulk_${i}` },
      })
    );
  }

  const allResults = await Promise.all(promises);
  const successes = allResults.filter((r) => r.status === 201).length;
  const failures = allResults.filter((r) => r.status !== 201).length;

  assert(successes === 20, `All 20 bulk requests succeeded`, `success=${successes}, fail=${failures}`);
}

async function testDeleteQuestion(token, questionId) {
  section("18. Delete Question via Dashboard");
  const res = await request("DELETE", `/api/questions/${questionId}`, null, {
    Authorization: `Bearer ${token}`,
  });
  assert(res.status === 204, "Delete returns 204", `status=${res.status}`);

  // Verify it's gone
  const res2 = await request("GET", `/api/questions/${questionId}`, null, {
    Authorization: `Bearer ${token}`,
  });
  assert(res2.status === 404, "Deleted question returns 404", `status=${res2.status}`);
}

async function testAnalytics(token) {
  section("19. Analytics After All Operations");
  const res = await request("GET", "/api/questions/analytics", null, {
    Authorization: `Bearer ${token}`,
  });
  assert(res.status === 200, "Analytics returns 200", `status=${res.status}`);
  assert(res.body.totalQuestions > 0, `Total questions: ${res.body.totalQuestions}`);
  assert(typeof res.body.pending === "number", `Pending: ${res.body.pending}`);
  assert(typeof res.body.published === "number", `Published: ${res.body.published}`);
  console.log(`  📊 Analytics: ${JSON.stringify(res.body)}`);
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------
async function main() {
  console.log(`
================================================================
       FAQ App — Webhook Integration Test Suite
================================================================
  Target:  ${BASE_URL}
  User:    ${TEST_USER.email}
  Shop:    ${TEST_SHOP.domain}
================================================================
`);

  const startTime = Date.now();
  let token, userId, webhookUrl, webhookPath, questionIds;

  try {
    // ---- Setup ----
    await testHealthCheck();

    const signup = await testSignup();
    token = signup.token;
    userId = signup.userId;

    await testDuplicateSignup();

    token = await testLogin(token);

    webhookUrl = await testSaveCredentials(token);
    // Extract the path from full webhook URL
    webhookPath = new URL(webhookUrl).pathname;

    await testGetCredentials(token);

    // ---- Webhook POST ----
    questionIds = await testWebhookPostWithCustomer(webhookPath);
    const titleQuestionId = await testWebhookPostValidation(webhookPath);
    if (titleQuestionId) questionIds.push(titleQuestionId);

    await testWebhookPostInvalidUser();

    // ---- Webhook PUT ----
    if (questionIds.length > 0) {
      await testWebhookPut(webhookPath, questionIds[0]);
    } else {
      skip("Webhook PUT", "No question IDs to update");
    }
    await testWebhookPutValidation(webhookPath);

    // ---- Webhook GET (before publish) ----
    await testWebhookGet(webhookPath);

    // ---- Dashboard verification ----
    await testDashboardQuestionsAPI(token);

    // ---- Moderate & Publish ----
    if (questionIds.length > 0) {
      await testModerateAndPublish(token, questionIds[0]);
    } else {
      skip("Moderate/Publish", "No question IDs");
    }

    // ---- Webhook GET (after publish) ----
    await testWebhookGetAfterPublish(webhookPath);
    await testWebhookGetWithSearch(webhookPath);

    // ---- Bulk traffic ----
    await testBulkTraffic(webhookPath);

    // ---- Cleanup ----
    if (questionIds.length > 1) {
      await testDeleteQuestion(token, questionIds[1]);
    }

    // ---- Analytics ----
    await testAnalytics(token);

  } catch (error) {
    console.error(`\n  FATAL ERROR: ${error.message}`);
    if (error.code === "ECONNREFUSED") {
      console.error(`\n   Is the backend running on ${BASE_URL}?`);
      console.error(`   Start it with: cd backend && npm run dev\n`);
    }
    process.exit(1);
  }

  // ---- Summary ----
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  TEST SUMMARY`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Time:    ${elapsed}s`);
  console.log(`${"=".repeat(60)}`);

  if (failed > 0) {
    console.log(`\n  Failed tests:`);
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => console.log(`    - ${r.name}${r.detail ? ": " + r.detail : ""}`));
  }

  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main();
