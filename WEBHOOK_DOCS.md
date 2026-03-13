# FAQ App — Webhook Documentation

## Overview

The FAQ App exposes **public webhook endpoints** that allow ecommerce storefronts (Shopify, custom sites, etc.) to:

1. **Submit customer questions** (POST) — visitors ask questions from the storefront
2. **Update existing questions** (PUT) — append info or correct a question
3. **Fetch published FAQs** (GET) — display approved Q&A on the storefront

Each registered user gets a **unique webhook URL** tied to their account:

```
http://your-server.com/api/webhooks/{userId}/faq
```

This URL is generated when the user saves their Shopify credentials and is displayed on the **Credentials** page in the dashboard.

---

## Authentication Model

| Endpoint | Auth Required? | Notes |
|----------|---------------|-------|
| `POST /api/webhooks/:userId/faq` | ❌ No | Public — storefront JS can call it |
| `PUT  /api/webhooks/:userId/faq` | ❌ No | Public — uses question `id` for access control |
| `GET  /api/webhooks/:userId/faq` | ❌ No | Public — returns only published FAQs |
| Dashboard APIs (`/api/questions/*`) | ✅ JWT | Admin-only, requires `Authorization: Bearer <token>` |

> **Security note:** The `userId` in the URL acts as an unguessable identifier (CUID). For production, consider adding rate limiting and optional HMAC signature verification.

---

## Endpoints

### 1. Submit a Question (POST)

```
POST /api/webhooks/{userId}/faq
Content-Type: application/json
```

#### Request Body

```json
{
  "question": "How do I return an item?",
  "answer": "",
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
| `customer` | object | No | Customer details (see below) |
| `customer.id` | string | No | External customer ID from your ecommerce platform |
| `customer.name` | string | No | Customer's display name |
| `customer.email` | string | No | Customer's email address |
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
  "message": "Question received and queued for review"
}
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing `question` field |
| 404 | Invalid `userId` (no shop found) |
| 500 | Internal server error |

---

### 2. Update a Question (PUT)

```
PUT /api/webhooks/{userId}/faq
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

### 3. Fetch Published FAQs (GET)

```
GET /api/webhooks/{userId}/faq
GET /api/webhooks/{userId}/faq?categorySlug=shipping
GET /api/webhooks/{userId}/faq?search=return
```

#### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `categorySlug` | Filter FAQs by category (uses the slug, e.g., "shipping-policy") |
| `search` | Full-text search across questions and answers |

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
      "category": {
        "name": "Returns",
        "slug": "returns"
      },
      "createdAt": "2026-03-13T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

> **Privacy:** The GET endpoint only returns published questions and does **not** expose customer details (email, phone, ID).

---

## Data Flow Diagram

```
┌─────────────────────┐       POST /api/webhooks/{userId}/faq
│  Shopify Storefront  │ ─────────────────────────────────────────►┌──────────────┐
│  (Customer Browser)  │                                           │              │
│                      │◄──────────────────────────────────────────│   Backend    │
│  "Ask a Question"    │       { success: true, questionId }       │   (Express)  │
│   form / widget      │                                           │              │
└─────────────────────┘                                            │              │
                                                                   │   Webhook    │
┌─────────────────────┐       GET /api/webhooks/{userId}/faq       │   Routes     │──────►┌────────────┐
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

**Status values:** `pending` → `published` | `rejected` | `draft`

---

## Storefront Integration Examples

### Vanilla JavaScript (Embed in Shopify Theme)

```html
<!-- FAQ Question Submission Widget -->
<script>
const WEBHOOK_URL = "https://your-server.com/api/webhooks/YOUR_USER_ID/faq";

async function submitQuestion(formData) {
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: formData.question,
      customer: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        // If Shopify customer is logged in:
        id: window.__st?.cid || undefined,
      },
    }),
  });

  const result = await response.json();
  if (result.success) {
    alert("Thank you! Your question has been submitted for review.");
  }
}
</script>
```

### Fetch Published FAQs

```javascript
async function loadFAQs(categorySlug = null) {
  let url = `https://your-server.com/api/webhooks/YOUR_USER_ID/faq`;
  if (categorySlug) url += `?categorySlug=${categorySlug}`;

  const res = await fetch(url);
  const { faqs } = await res.json();

  const container = document.getElementById("faq-list");
  container.innerHTML = faqs
    .map(faq => `
      <details class="faq-item">
        <summary>${faq.question}</summary>
        <p>${faq.answer}</p>
      </details>
    `)
    .join("");
}
```

### React Component

```jsx
function FAQWidget({ webhookUrl }) {
  const [faqs, setFaqs] = useState([]);
  const [question, setQuestion] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetch(webhookUrl).then(r => r.json()).then(d => setFaqs(d.faqs));
  }, [webhookUrl]);

  const submitQuestion = async (e) => {
    e.preventDefault();
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        customer: { email },
      }),
    });
    setQuestion("");
    alert("Question submitted!");
  };

  return (
    <div>
      <h2>Frequently Asked Questions</h2>
      {faqs.map(faq => (
        <details key={faq.id}>
          <summary>{faq.question}</summary>
          <p>{faq.answer}</p>
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
| `status` | String | `pending`, `published`, `rejected`, or `draft` |
| `source` | String | `webhook` (from storefront), `dashboard` (admin-created), `import` |
| `customerName` | String? | Name of the customer who asked |
| `customerEmail` | String? | Email of the customer |
| `customerPhone` | String? | Phone number |
| `customerId` | String? | External ID from ecommerce platform |
| `views` | Int | View counter |
| `helpful` | Int | "Was this helpful?" positive count |
| `notHelpful` | Int | "Was this helpful?" negative count |
| `categoryId` | String? | FK to Category |
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
node tests/webhook-test.js http://localhost:4000
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
- The `userId` in the URL is a CUID (unguessable random string), not a sequential number
- The GET endpoint **never exposes** customer PII (email, phone, ID)
- For production, consider:
  - **Rate limiting** (e.g., `express-rate-limit`) on webhook POST
  - **HMAC signature** verification for Shopify webhook payloads
  - **CORS origin whitelisting** for specific store domains
  - **Captcha** on the storefront question form
