# FAQ App — Webhook Documentation

## Overview

The FAQ App exposes **public webhook endpoints** that allow ecommerce storefronts (Shopify, custom sites, etc.) to:

1. **Submit customer questions** (POST) — visitors ask questions from the storefront
2. **Submit customer answers** (POST) — visitors answer existing questions
3. **Cast votes** (POST) — visitors upvote/downvote questions and answers
4. **Update existing questions** (PUT) — append info or correct a question
5. **Fetch published FAQs** (GET) — display approved Q&A on the storefront

Each registered user gets a **unique webhook URL** tied to their account:

```
http://your-server.com/api/webhooks/{webhookKey}/faq
http://your-server.com/api/webhooks/{webhookKey}/answer
http://your-server.com/api/webhooks/{webhookKey}/vote
```

This URL is generated when the user saves their Shopify credentials and is displayed on the **Credentials** page in the dashboard.

---

## Authentication Model

| Endpoint | Auth Required? | Notes |
|----------|---------------|-------|
| `POST /api/webhooks/:webhookKey/faq` | ❌ No | Public — storefront JS can call it |
| `POST /api/webhooks/:webhookKey/answer` | ❌ No | Public — submit answers to questions |
| `POST /api/webhooks/:webhookKey/vote` | ❌ No | Public — cast votes (requires customer email) |
| `PUT  /api/webhooks/:webhookKey/faq` | ❌ No | Public — uses question `id` for access control |
| `GET  /api/webhooks/:webhookKey/faq` | ❌ No | Public — returns only published FAQs |
| Dashboard APIs (`/api/questions/*`) | ✅ JWT | Admin-only, requires `Authorization: Bearer <token>` |

> **Security note:** The `webhookKey` in the URL is an opaque random key generated per shop. Keep it private and rotate if exposed.

---

## Endpoints

### 1. Submit a Question (POST)

```
POST /api/webhooks/{webhookKey}/faq
Content-Type: application/json
```

#### Request Body

```json
{
  "question": "How do I return an item?",
  "answer": "",
  "productId": "9440623329521",
  "productHandle": "cool-product-handle",
  "productUrl": "https://mystore.myshopify.com/products/cool-product-handle",
  "productTitle": "Cool Product Name",
  "customer": {
    "id": "cust_abc123",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1-555-123-4567"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | ✅ Yes | The question text (also accepts `title` as alias) |
| `answer` | string | No | Pre-filled answer (usually empty from storefront) |
| `productId` | string | Recommended | Shopify product ID for product-scoped FAQs |
| `productHandle` | string | Recommended | Product handle/slug (used if productId not provided) |
| `productUrl` | string | No | Full product URL (used for metadata scraping) |
| `productTitle` | string | No | Product title for display context |
| `customer` | object | Recommended | Customer details (see below) |
| `customer.id` | string | No | External customer ID from your ecommerce platform |
| `customer.name` | string | No | Customer's display name |
| `customer.email` | string | Recommended | Customer's email address (creates contributor record) |
| `customer.phone` | string | No | Customer's phone number |

**Alternative flat format** — customer fields can also be sent at the top level:

```json
{
  "question": "Do you ship to Alaska?",
  "customerName": "Frank Alaska",
  "customerEmail": "frank@alaska.com",
  "customerPhone": "+1-907-555-0001",
  "customerId": "cust_frank_99"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "questionId": "cmmoldq890001e8iosp6ynt4g",
  "status": "pending",
  "message": "Question submitted (pending review)"
}
```

**Status Logic:**
- If shop has `autoPublishQuestions: true` → status = `"published"`
- If customer is trusted AND `trustedCustomerAutoPublish: true` → status = `"published"`
- Otherwise → status = `"pending"` (requires admin approval)

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `question` field |
| 403 | Customer is suspended |
| 404 | Invalid `webhookKey` (no shop found) |
| 500 | Internal server error |

---

### 2. Submit an Answer (POST)

```
POST /api/webhooks/{webhookKey}/answer
Content-Type: application/json
```

#### Request Body

```json
{
  "questionId": "cmmoldq890001e8iosp6ynt4g",
  "answerText": "You can return items within 30 days of purchase.",
  "customer": {
    "email": "john@example.com",
    "name": "John Helper",
    "phone": "+1-555-987-6543",
    "id": "cust_john456"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `questionId` | string | ✅ Yes | ID of the question to answer |
| `answerText` | string | ✅ Yes | The answer text |
| `customer` | object | Recommended | Customer details |
| `customer.email` | string | Recommended | Creates/finds a contributor record |
| `customer.name` | string | No | Display name shown with the answer |

#### Response (201 Created)

```json
{
  "success": true,
  "answerId": "cm1answer456",
  "status": "pending",
  "message": "Answer submitted (pending review)"
}
```

**Status Logic:**
- If `autoPublishAnswers: true` → `"published"`
- If customer is trusted AND `trustedCustomerAutoPublish: true` → `"published"`
- If `autoPublishIfAnswersLessThan > 0` AND current published answers < threshold → `"published"`
- Otherwise → `"pending"`

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `questionId` or `answerText` |
| 403 | Customer is suspended |
| 404 | No shop found OR question not found |

---

### 3. Cast a Vote (POST)

```
POST /api/webhooks/{webhookKey}/vote
Content-Type: application/json
```

#### Request Body

```json
{
  "entityType": "question",
  "entityId": "cmmoldq890001e8iosp6ynt4g",
  "voteValue": 1,
  "customer": {
    "email": "voter@example.com",
    "name": "Voter Name"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entityType` | string | ✅ Yes | `"question"` or `"answer"` |
| `entityId` | string | ✅ Yes | ID of the question or answer |
| `voteValue` | integer | ✅ Yes | `1` (upvote) or `-1` (downvote) |
| `customer` | object | ✅ Yes | Must include `email` |
| `customer.email` | string | ✅ Yes | Identifies the voter |

#### Response (200 OK)

```json
{
  "success": true,
  "action": "created",
  "vote": {
    "id": "cm1vote123",
    "voteValue": 1,
    "entityType": "question",
    "questionId": "cmmoldq890001e8iosp6ynt4g",
    "contributorId": "cm1contrib456"
  }
}
```

**Vote Toggle Behavior:**
| Current Vote | New Vote | Action | Result |
|-------------|----------|--------|--------|
| None | +1 | `"created"` | Vote created |
| None | -1 | `"created"` | Vote created |
| +1 | +1 | `"removed"` | Vote removed (toggle off) |
| +1 | -1 | `"changed"` | Vote changed to downvote |
| -1 | -1 | `"removed"` | Vote removed (toggle off) |
| -1 | +1 | `"changed"` | Vote changed to upvote |

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing required fields |
| 403 | Customer is suspended |
| 404 | No shop found |

---

### 4. Update a Question (PUT)

```
PUT /api/webhooks/{webhookKey}/faq
Content-Type: application/json
```

#### Request Body

```json
{
  "id": "cmmoldq890001e8iosp6ynt4g",
  "question": "Updated question text",
  "answer": "Updated answer",
  "customer": {
    "name": "Jane Doe-Updated",
    "email": "jane.updated@example.com"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ Yes | ID of the question to update (returned from POST) |
| `question` | string | No | Updated question text |
| `answer` | string | No | Updated answer |
| `status` | string | No | Status change (pending/published/rejected/draft) |
| `customer` | object | No | Updated customer details |

#### Response (200 OK)

```json
{
  "success": true,
  "question": {
    "id": "cmmoldq890001e8iosp6ynt4g",
    "question": "Updated question text",
    "answer": "Updated answer",
    "status": "pending",
    "customerName": "Jane Doe-Updated",
    "customerEmail": "jane.updated@example.com",
    "category": null,
    ...
  }
}
```

---

### 5. Fetch Published FAQs (GET)

```
GET /api/webhooks/{webhookKey}/faq
GET /api/webhooks/{webhookKey}/faq?categorySlug=shipping
GET /api/webhooks/{webhookKey}/faq?search=return
GET /api/webhooks/{webhookKey}/faq?productId=9440623329521
GET /api/webhooks/{webhookKey}/faq?sort=votes
```

#### Query Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `categorySlug` | — | Filter FAQs by category (uses the slug, e.g., "shipping-policy") |
| `search` | — | Full-text search across questions and answers |
| `productId` | — | Filter to FAQs for a specific product (exact match) |
| `productHandle` | — | Filter by product handle (used if productId not provided) |
| `sort` | `"votes"` | Sort order: `"votes"`, `"newest"`, or `"views"` |

#### Response (200 OK)

```json
{
  "faqs": [
    {
      "id": "cmmoldq890001e8iosp6ynt4g",
      "question": "How do I return an item?",
      "answer": "You can return items within 30 days...",
      "views": 42,
      "helpful": 8,
      "notHelpful": 1,
      "voteScore": 7,
      "category": {
        "name": "Returns",
        "slug": "returns"
      },
      "answers": [
        {
          "id": "cm1answer456",
          "answerText": "I returned an item last week and it was easy!",
          "voteScore": 3,
          "contributor": {
            "name": "John Doe"
          },
          "createdAt": "2026-03-14T09:00:00.000Z"
        }
      ],
      "_count": {
        "answers": 1
      },
      "createdAt": "2026-03-13T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

> **Privacy:** The GET endpoint only returns published questions and answers. Customer emails, phones, and external IDs are **never** exposed. Only contributor names are shown alongside published answers.

---

## Data Flow Diagram

```
┌─────────────────────┐       POST /api/webhooks/{webhookKey}/faq
│  Shopify Storefront  │ ─────────────────────────────────────────►┌──────────────┐
│  (Customer Browser)  │                                           │              │
│                      │◄──────────────────────────────────────────│   Backend    │
│  "Ask a Question"    │       { success: true, questionId }       │   (Express)  │
│   form / widget      │                                           │              │
└─────────────────────┘                                            │              │
                                                                   │   Webhook    │
┌─────────────────────┐       GET /api/webhooks/{webhookKey}/faq       │   Routes     │──────►┌────────────┐
│  Storefront FAQ Page │ ─────────────────────────────────────────►│              │       │ PostgreSQL │
│  (Public display)    │◄──────────────────────────────────────────│              │◄──────│ (Prisma)   │
│                      │       { faqs: [...] }                     │              │       └────────────┘
└─────────────────────┘                                            └──────┬───────┘
                                                                          │
                                                                          │ JWT Auth
                                                                          │
                                                                   ┌──────┴───────┐
                                                                   │  Dashboard   │
                                                                   │  (Next.js)   │
                                                                   │              │
                                                                   │  • Review    │
                                                                   │  • Approve   │
                                                                   │  • Answer    │
                                                                   │  • Analytics │
                                                                   └──────────────┘
```

---

## Question Lifecycle

```
  Customer submits        Admin reviews          Admin answers       Published
  via storefront          in dashboard           & approves          on storefront
       │                       │                      │                   │
       ▼                       ▼                      ▼                   ▼
  ┌─────────┐           ┌───────────┐          ┌────────────┐     ┌───────────┐
  │ PENDING │──────────►│ REVIEWING │─────────►│ PUBLISHED  │────►│ VISIBLE   │
  │ (new)   │           │ (in dash) │          │ (approved) │     │ (via GET) │
  └─────────┘           └───────────┘          └────────────┘     └───────────┘
       │                       │
       │                       ▼
       │                ┌───────────┐
       │                │ REJECTED  │  (spam, off-topic, etc.)
       │                └───────────┘
       │
       ▼
  ┌─────────┐
  │  DRAFT  │  (admin wants to save for later)
  └─────────┘
```

**Status values:** `pending` → `published` | `rejected` | `draft` | `suspended`

---

## Storefront Integration Examples

### Vanilla JavaScript (Embed in Shopify Theme)

```html
<!-- FAQ Question Submission Widget -->
<script>
const WEBHOOK_BASE = "https://your-server.com/api/webhooks/YOUR_WEBHOOK_KEY";

// Submit a question (with product context)
async function submitQuestion(formData, productContext) {
  const response = await fetch(`${WEBHOOK_BASE}/faq`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: formData.question,
      productId: productContext?.id,
      productHandle: productContext?.handle,
      productTitle: productContext?.title,
      customer: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        id: window.__st?.cid || undefined, // Shopify customer ID
      },
    }),
  });

  const result = await response.json();
  if (result.success) {
    const msg = result.status === "published"
      ? "Your question has been posted!"
      : "Your question has been submitted for review.";
    alert(msg);
  }
}

// Submit an answer to a question
async function submitAnswer(questionId, answerText, customer) {
  const response = await fetch(`${WEBHOOK_BASE}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId,
      answerText,
      customer: { email: customer.email, name: customer.name },
    }),
  });
  return response.json();
}

// Vote on a question or answer
async function vote(entityType, entityId, voteValue, customerEmail) {
  const response = await fetch(`${WEBHOOK_BASE}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entityType,   // "question" or "answer"
      entityId,
      voteValue,    // 1 (upvote) or -1 (downvote)
      customer: { email: customerEmail },
    }),
  });
  const { action } = await response.json();
  // action: "created" | "changed" | "removed"
  return action;
}
</script>
```

### Fetch Published FAQs

```javascript
async function loadFAQs({ categorySlug, productId, sort = "votes" } = {}) {
  const params = new URLSearchParams({ sort });
  if (categorySlug) params.set("categorySlug", categorySlug);
  if (productId) params.set("productId", productId);

  const url = `https://your-server.com/api/webhooks/YOUR_WEBHOOK_KEY/faq?${params}`;
  const res = await fetch(url);
  const { faqs, total } = await res.json();

  const container = document.getElementById("faq-list");
  container.innerHTML = faqs
    .map(faq => `
      <details class="faq-item">
        <summary>
          ${faq.question}
          <span class="vote-score">${faq.voteScore > 0 ? '+' : ''}${faq.voteScore}</span>
        </summary>
        <p>${faq.answer || '<em>No answer yet</em>'}</p>
        ${faq.answers?.length ? `
          <div class="community-answers">
            <h4>Community Answers (${faq._count.answers})</h4>
            ${faq.answers.map(a => `
              <div class="answer">
                <p>${a.answerText}</p>
                <small>By ${a.contributor?.name || 'Anonymous'} • Score: ${a.voteScore}</small>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </details>
    `)
    .join("");
}
```

### React Component

```jsx
function FAQWidget({ webhookBaseUrl, productId }) {
  const [faqs, setFaqs] = useState([]);
  const [question, setQuestion] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ sort: "votes" });
    if (productId) params.set("productId", productId);
    fetch(`${webhookBaseUrl}/faq?${params}`)
      .then(r => r.json())
      .then(d => setFaqs(d.faqs));
  }, [webhookBaseUrl, productId]);

  const submitQuestion = async (e) => {
    e.preventDefault();
    const res = await fetch(`${webhookBaseUrl}/faq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        productId,
        customer: { email },
      }),
    });
    const { status } = await res.json();
    setQuestion("");
    alert(status === "published" ? "Question posted!" : "Question submitted for review!");
  };

  const handleVote = async (entityType, entityId, voteValue) => {
    await fetch(`${webhookBaseUrl}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType,
        entityId,
        voteValue,
        customer: { email },
      }),
    });
    // Refresh FAQs to show updated scores
    const params = new URLSearchParams({ sort: "votes" });
    if (productId) params.set("productId", productId);
    const res = await fetch(`${webhookBaseUrl}/faq?${params}`);
    const data = await res.json();
    setFaqs(data.faqs);
  };

  return (
    <div>
      <h2>Frequently Asked Questions</h2>
      {faqs.map(faq => (
        <details key={faq.id}>
          <summary>
            {faq.question}
            <span className="vote-score">{faq.voteScore}</span>
          </summary>
          <p>{faq.answer || <em>No answer yet</em>}</p>
          <div className="vote-buttons">
            <button onClick={() => handleVote("question", faq.id, 1)}>👍</button>
            <button onClick={() => handleVote("question", faq.id, -1)}>👎</button>
          </div>
          {faq.answers?.map(answer => (
            <div key={answer.id} className="answer">
              <p>{answer.answerText}</p>
              <small>By {answer.contributor?.name || "Anonymous"}</small>
            </div>
          ))}
        </details>
      ))}

      <h3>Can't find your answer?</h3>
      <form onSubmit={submitQuestion}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email" required />
        <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Your question" required />
        <button type="submit">Ask</button>
      </form>
    </div>
  );
}
```

---

## Database Schema (Question Model)

| Column | Type | Description |
|--------|------|-------------|
| `id` | CUID | Primary key |
| `question` | String | The FAQ question text |
| `answer` | Text | The answer (may be empty for pending questions) |
| `status` | String | `pending`, `published`, `rejected`, `draft`, or `suspended` |
| `sortOrder` | Int | Display order (0 = default) |
| `source` | String | `webhook` (from storefront), `dashboard` (admin-created), `import` |
| `productId` | String? | Shopify product ID associated with the question |
| `productHandle` | String? | Product handle/slug |
| `productTitle` | String? | Product title snapshot at submission time |
| `productRefId` | String? | FK to Product model (for scraped metadata) |
| `customerName` | String? | Name of the customer who asked |
| `customerEmail` | String? | Email of the customer |
| `customerPhone` | String? | Phone number |
| `customerId` | String? | External ID from ecommerce platform |
| `contributorId` | String? | FK to StoreContributor |
| `views` | Int | View counter |
| `helpful` | Int | "Was this helpful?" positive count (legacy) |
| `notHelpful` | Int | "Was this helpful?" negative count (legacy) |
| `voteScore` | Int | Net score from +1/-1 voting system |
| `categoryId` | String? | FK to Category |
| `shopId` | String | FK to Shop |
| `publishedAt` | DateTime? | When the question was published |
| `createdAt` | DateTime | Auto-set on creation |
| `updatedAt` | DateTime | Auto-updated |

## Database Schema (Answer Model)

| Column | Type | Description |
|--------|------|-------------|
| `id` | CUID | Primary key |
| `answerText` | Text | The answer text content |
| `status` | String | `pending`, `published`, `rejected`, or `suspended` |
| `voteScore` | Int | Net score from votes |
| `contributorId` | String? | FK to StoreContributor |
| `questionId` | String | FK to Question |
| `shopId` | String | FK to Shop |
| `source` | String? | `webhook` or `dashboard` |
| `publishedAt` | DateTime? | When published |
| `createdAt` | DateTime | Auto-set on creation |
| `updatedAt` | DateTime | Auto-updated |

## Database Schema (StoreContributor Model)

| Column | Type | Description |
|--------|------|-------------|
| `id` | CUID | Primary key |
| `email` | String | Customer email (unique per shop) |
| `name` | String? | Display name |
| `phone` | String? | Phone number |
| `externalId` | String? | External customer ID from platform |
| `status` | String | `active` or `suspended` |
| `trusted` | Boolean | Trusted contributor flag (bypasses moderation) |
| `shopId` | String | FK to Shop |
| `createdAt` | DateTime | Auto-set on creation |
| `updatedAt` | DateTime | Auto-updated |

---

## Running the Test Script

```bash
# Start the backend
cd backend
npm run dev

# In another terminal, run the tests
node tests/webhook-test.js

# Or with a custom URL
node tests/webhook-test.js http://localhost:4004
```

The test script performs 19 test sections covering:
1. Health check
2. User signup
3. Duplicate signup prevention
4. Login
5. Shopify credentials setup
6. Credentials verification
7. Webhook POST with full customer details
8. POST validation (missing fields, aliases)
9. POST with invalid user ID
10. Webhook PUT (update question + customer)
11. PUT validation
12. Webhook GET (before publishing)
13. Dashboard verification (webhook questions visible)
14. Question moderation (approve → publish)
15. Webhook GET (after publishing)
16. Search & filter on GET
17. Bulk traffic simulation (20 concurrent requests)
18. Question deletion
19. Analytics verification

---

## CORS & Security Considerations

- The webhook endpoints are **public** (no auth) — this is intentional so storefront JavaScript can call them
- The `webhookKey` in the URL is an opaque random value, not a sequential identifier
- The GET endpoint **never exposes** customer PII (email, phone, ID)
- **Rate limiting** is enabled:
  - Auth endpoints: 40 requests per 15 minutes per IP
  - Webhook writes (POST/PUT): 120 requests per 60 seconds per IP
- **CORS**: Webhook endpoints allow any origin; dashboard endpoints restrict to `FRONTEND_URL` and `ALLOWED_ORIGINS`
- For additional production security, consider:
  - **HMAC signature** verification for Shopify webhook payloads
  - **Captcha** on the storefront question form
