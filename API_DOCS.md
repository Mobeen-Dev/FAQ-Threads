# FAQ App — Complete API Documentation

> **Version:** 1.0.0  
> **Base URL:** `http://localhost:4000`  
> **Content-Type:** `application/json` (all requests and responses)

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Authentication](#2-authentication)
3. [Storefront / Plugin Endpoints (Public)](#3-storefront--plugin-endpoints-public)
   - [Submit a Question](#31-submit-a-question)
   - [Submit an Answer](#32-submit-an-answer)
   - [Cast a Vote](#33-cast-a-vote)
   - [Get Published FAQs](#34-get-published-faqs)
   - [Update a Question](#35-update-a-question-via-webhook)
4. [Dashboard Endpoints (Authenticated)](#4-dashboard-endpoints-authenticated)
   - [Credentials / Shop Setup](#41-credentials--shop-setup)
   - [Questions](#42-questions)
   - [Categories](#43-categories)
   - [Answers](#44-answers)
   - [Votes](#45-votes)
   - [Contributors](#46-contributors)
   - [Settings](#47-settings)
   - [Analytics](#48-analytics)
5. [Data Models](#5-data-models)
6. [Publishing Rules & Business Logic](#6-publishing-rules--business-logic)
7. [Error Handling](#7-error-handling)
8. [Integration Guide for Ecommerce Frontend Plugins](#8-integration-guide-for-ecommerce-frontend-plugins)

---

## 1. Overview & Architecture

This is a multi-tenant FAQ management system. Each **User** (shop owner) signs up, connects their Shopify store, and receives a unique **Webhook URL**. That URL is embedded in their ecommerce storefront so customers can submit questions, answers, and votes.

```
┌─────────────────────┐         ┌──────────────────┐        ┌────────────────┐
│  Ecommerce Frontend │  HTTP   │   FAQ Backend    │        │   PostgreSQL   │
│  (Your Plugin)      │ ──────► │   Express.js     │ ◄────► │   + Prisma ORM │
│                     │         │   Port 4000      │        │                │
└─────────────────────┘         └──────────────────┘        └────────────────┘
        │                              ▲
        │  Public Webhook URLs         │  JWT Auth
        │  (no auth needed)            │
        ▼                              │
  /api/webhooks/{userId}/faq     ┌─────┴──────┐
  /api/webhooks/{userId}/answer  │  Dashboard  │
  /api/webhooks/{userId}/vote    │  (Next.js)  │
                                 └────────────┘
```

**Two types of API consumers:**

| Consumer | Auth Required | Endpoints Used |
|----------|--------------|----------------|
| **Ecommerce Frontend Plugin** (your target) | ❌ No | `/api/webhooks/:userId/*` |
| **Dashboard Admin** (shop owner) | ✅ JWT Bearer | `/api/questions`, `/api/answers`, `/api/settings`, etc. |

---

## 2. Authentication

### POST `/api/auth/signup`

Create a new account.

**Request:**
```json
{
  "email": "owner@myshop.com",
  "password": "securepass123",
  "name": "Shop Owner"
}
```

**Response `201`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "cm1abc123def456",
    "email": "owner@myshop.com",
    "name": "Shop Owner"
  }
}
```

**Errors:**
| Status | Reason |
|--------|--------|
| 400 | Missing email or password |
| 400 | Password less than 6 characters |
| 409 | Email already registered |

---

### POST `/api/auth/login`

**Request:**
```json
{
  "email": "owner@myshop.com",
  "password": "securepass123"
}
```

**Response `200`:** Same shape as signup response.

**Errors:**
| Status | Reason |
|--------|--------|
| 400 | Missing credentials |
| 401 | Invalid email or password |

---

### GET `/api/auth/me`

Get current user info. Requires auth.

**Headers:** `Authorization: Bearer {token}`

**Response `200`:**
```json
{
  "user": {
    "id": "cm1abc123def456",
    "email": "owner@myshop.com",
    "name": "Shop Owner",
    "shops": [
      {
        "id": "cm1shop789",
        "domain": "mystore.myshopify.com",
        "name": "My Store"
      }
    ]
  }
}
```

---

### Auth Header Format

All authenticated endpoints require:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Token expires after **7 days**.

---

## 3. Storefront / Plugin Endpoints (Public)

> **🔑 These endpoints require NO authentication.** They use the `userId` in the URL path to identify the shop. This is the section most relevant for ecommerce frontend plugin developers.

The shop owner gets their webhook base URL from the dashboard:

```
https://your-api-domain.com/api/webhooks/{userId}/faq
```

---

### 3.1 Submit a Question

**`POST /api/webhooks/:userId/faq`**

A storefront visitor submits a new FAQ question.

**URL Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `userId` | string | The shop owner's user ID (provided in dashboard) |

**Request Body:**
```json
{
  "question": "How long does shipping take?",
  "answer": null,
  "customer": {
    "email": "jane@example.com",
    "name": "Jane Smith",
    "phone": "+1-555-0123",
    "id": "shopify_customer_12345"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | ✅ Yes | The question text. Also accepts `title` as alias. |
| `answer` | string | No | Optional answer (for pre-answered submissions) |
| `customer` | object | No | Customer details (highly recommended) |
| `customer.email` | string | Recommended | Creates/finds a contributor record |
| `customer.name` | string | No | Display name |
| `customer.phone` | string | No | Phone number |
| `customer.id` | string | No | External customer ID from your platform |

**Response `201`:**
```json
{
  "success": true,
  "questionId": "cm1question789",
  "status": "pending",
  "message": "Question submitted (pending review)"
}
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `success` | Always `true` on success |
| `questionId` | Unique ID of the created question |
| `status` | Initial status: `"published"` or `"pending"` (depends on shop settings) |
| `message` | Human-readable status message |

**Status Logic:**
- If shop has `autoPublishQuestions: true` → status = `"published"`
- If customer is trusted AND `trustedCustomerAutoPublish: true` → status = `"published"`
- Otherwise → status = `"pending"` (requires admin approval)

**Errors:**
| Status | Body | Reason |
|--------|------|--------|
| 400 | `{ "error": "Field 'question' is required" }` | Missing question text |
| 403 | `{ "error": "This account has been suspended" }` | Customer is suspended |
| 404 | `{ "error": "No shop found for this user" }` | Invalid userId |
| 500 | `{ "error": "Failed to process FAQ submission" }` | Server error |

---

### 3.2 Submit an Answer

**`POST /api/webhooks/:userId/answer`**

A storefront visitor submits an answer to an existing question.

**Request Body:**
```json
{
  "questionId": "cm1question789",
  "answerText": "Shipping usually takes 3-5 business days.",
  "customer": {
    "email": "john@example.com",
    "name": "John Doe",
    "phone": "+1-555-0456",
    "id": "shopify_customer_67890"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `questionId` | string | ✅ Yes | ID of the question to answer |
| `answerText` | string | ✅ Yes | The answer text |
| `customer` | object | No | Customer details |
| `customer.email` | string | Recommended | Creates/finds a contributor |

**Response `201`:**
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

**Errors:**
| Status | Reason |
|--------|--------|
| 400 | Missing `questionId` or `answerText` |
| 403 | Customer is suspended |
| 404 | No shop found OR question not found |

---

### 3.3 Cast a Vote

**`POST /api/webhooks/:userId/vote`**

A storefront visitor votes on a question or answer.

**Request Body:**
```json
{
  "entityType": "question",
  "entityId": "cm1question789",
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

**Response `200`:**
```json
{
  "success": true,
  "action": "created",
  "vote": {
    "id": "cm1vote123",
    "voteValue": 1,
    "entityType": "question",
    "questionId": "cm1question789",
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

**Errors:**
| Status | Reason |
|--------|--------|
| 400 | Missing required fields |
| 403 | Customer is suspended |
| 404 | No shop found |

---

### 3.4 Get Published FAQs

**`GET /api/webhooks/:userId/faq`**

Retrieve all published FAQs for display on the storefront. **Only returns published content — never exposes customer PII.**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `categorySlug` | string | — | Filter by category slug |
| `search` | string | — | Search in question and answer text |
| `sort` | string | `"votes"` | Sort order: `"votes"`, `"newest"`, `"views"` |

**Example:** `GET /api/webhooks/cm1user123/faq?sort=votes&categorySlug=shipping`

**Response `200`:**
```json
{
  "faqs": [
    {
      "id": "cm1question789",
      "question": "How long does shipping take?",
      "answer": "Standard shipping takes 3-5 business days.",
      "views": 42,
      "helpful": 15,
      "notHelpful": 2,
      "voteScore": 8,
      "category": {
        "name": "Shipping",
        "slug": "shipping"
      },
      "answers": [
        {
          "id": "cm1answer456",
          "answerText": "In my experience, it took 4 days.",
          "voteScore": 3,
          "contributor": {
            "name": "John Doe"
          },
          "createdAt": "2026-03-13T10:30:00.000Z"
        }
      ],
      "_count": {
        "answers": 1
      },
      "createdAt": "2026-03-10T08:00:00.000Z"
    }
  ],
  "total": 1
}
```

**Important Notes:**
- Only questions with status `"published"` are returned
- Only answers with status `"published"` are included
- Customer email, phone, and external ID are **never** exposed
- Answers are sorted by `voteScore` descending (best answers first)
- Contributor names are included for answers but no PII

---

### 3.5 Update a Question (via Webhook)

**`PUT /api/webhooks/:userId/faq`**

Update an existing question (typically used by the question author).

**Request Body:**
```json
{
  "id": "cm1question789",
  "question": "Updated: How long does express shipping take?",
  "answer": "Express shipping takes 1-2 business days.",
  "customer": {
    "email": "jane@example.com"
  }
}
```

**Response `200`:**
```json
{
  "success": true,
  "question": { ... }
}
```

---

## 4. Dashboard Endpoints (Authenticated)

> **🔒 All endpoints in this section require `Authorization: Bearer {token}` header.**

---

### 4.1 Credentials / Shop Setup

#### GET `/api/credentials`

Get the current user's shop credentials and webhook URL.

**Response `200`:**
```json
{
  "shop": {
    "id": "cm1shop789",
    "domain": "mystore.myshopify.com",
    "apiKey": "abc123",
    "accessToken": "••••••ef01",
    "name": "My Store"
  },
  "webhookUrl": "http://localhost:4000/api/webhooks/cm1user123/faq"
}
```

> **Note:** `accessToken` is masked — only last 4 characters shown.

**Response `200` (no shop):**
```json
{
  "shop": null,
  "webhookUrl": "http://localhost:4000/api/webhooks/cm1user123/faq"
}
```

#### POST `/api/credentials`

Save or update Shopify shop credentials.

**Request:**
```json
{
  "domain": "mystore.myshopify.com",
  "apiKey": "your-api-key",
  "accessToken": "your-access-token",
  "name": "My Store"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | string | ✅ Yes | Shopify store domain |
| `apiKey` | string | No | Shopify API key |
| `accessToken` | string | No | Shopify access token |
| `name` | string | No | Display name for the shop |

**Response `200`:** Same as GET response.

#### DELETE `/api/credentials`

Remove shop credentials.

**Response:** `204 No Content`

---

### 4.2 Questions

#### GET `/api/questions`

List questions with pagination and filters.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `categoryId` | string | — | Filter by category |
| `status` | string | — | `published`, `pending`, `rejected`, `draft`, `suspended` |
| `search` | string | — | Search in question and answer text |
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Results per page (max 100) |

**Response `200`:**
```json
{
  "questions": [
    {
      "id": "cm1q123",
      "question": "What is your return policy?",
      "answer": "30-day returns on all items.",
      "status": "published",
      "sortOrder": 0,
      "views": 10,
      "helpful": 5,
      "notHelpful": 1,
      "voteScore": 4,
      "customerName": "Jane Smith",
      "customerEmail": "jane@example.com",
      "customerPhone": "+1-555-0123",
      "customerId": "shopify_12345",
      "contributorId": "cm1contrib456",
      "source": "webhook",
      "publishedAt": "2026-03-10T08:00:00.000Z",
      "createdAt": "2026-03-10T08:00:00.000Z",
      "updatedAt": "2026-03-10T08:00:00.000Z",
      "category": {
        "id": "cm1cat789",
        "name": "Returns",
        "slug": "returns"
      },
      "contributor": {
        "id": "cm1contrib456",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "trusted": true
      },
      "_count": {
        "answers": 3
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### GET `/api/questions/:id`

Get a single question with all answers.

**Response `200`:**
```json
{
  "question": {
    "id": "cm1q123",
    "question": "What is your return policy?",
    "answer": "30-day returns on all items.",
    "status": "published",
    "voteScore": 4,
    "category": { "id": "...", "name": "Returns", "slug": "returns" },
    "contributor": { "id": "...", "name": "Jane", "email": "jane@example.com", "trusted": true },
    "answers": [
      {
        "id": "cm1a456",
        "answerText": "I returned an item and it was easy!",
        "status": "published",
        "voteScore": 2,
        "contributor": { "name": "John", "email": "john@example.com" },
        "createdAt": "2026-03-11T09:00:00.000Z"
      }
    ],
    "_count": { "answers": 1 }
  }
}
```

#### POST `/api/questions`

Create a question from the dashboard.

**Request:**
```json
{
  "question": "What payment methods do you accept?",
  "answer": "We accept Visa, Mastercard, and PayPal.",
  "status": "published",
  "categoryId": "cm1cat789"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | ✅ Yes | Question text |
| `answer` | string | No | Answer text |
| `status` | string | No | Default: `"pending"` |
| `categoryId` | string | No | Category ID |

**Response `201`:** `{ "question": { ... } }`

#### PUT `/api/questions/:id`

Update a question.

**Request:**
```json
{
  "question": "Updated question text?",
  "answer": "Updated answer.",
  "status": "published",
  "categoryId": "cm1cat789",
  "sortOrder": 1
}
```

All fields are optional — only include what you want to change.

**Response `200`:** `{ "question": { ... } }`

#### DELETE `/api/questions/:id`

**Response:** `204 No Content`

#### POST `/api/questions/:id/moderate`

Change question status via moderation action.

**Request:**
```json
{
  "action": "approve"
}
```

| Action | Resulting Status |
|--------|-----------------|
| `"approve"` | `"published"` (also sets `publishedAt`) |
| `"reject"` | `"rejected"` |
| `"suspend"` | `"suspended"` |
| `"draft"` | `"draft"` |

**Response `200`:** `{ "question": { ... } }`

---

### 4.3 Categories

#### GET `/api/questions/categories`

**Response `200`:**
```json
{
  "categories": [
    {
      "id": "cm1cat789",
      "name": "Shipping",
      "slug": "shipping",
      "description": "Questions about shipping",
      "sortOrder": 0,
      "_count": { "questions": 5 }
    }
  ]
}
```

#### POST `/api/questions/categories`

**Request:**
```json
{
  "name": "Returns & Refunds",
  "description": "Questions about our return policy"
}
```

> **Note:** `slug` is auto-generated from `name` (e.g., `"Returns & Refunds"` → `"returns-refunds"`).

**Response `201`:** `{ "category": { ... } }`

---

### 4.4 Answers

#### GET `/api/answers`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `questionId` | string | Filter by question (recommended) |
| `status` | string | `published`, `pending`, `rejected`, `suspended` |

**Response `200`:**
```json
{
  "answers": [
    {
      "id": "cm1a456",
      "answerText": "Great answer text here.",
      "status": "published",
      "voteScore": 5,
      "source": "webhook",
      "contributorId": "cm1contrib456",
      "questionId": "cm1q123",
      "publishedAt": "2026-03-11T09:00:00.000Z",
      "createdAt": "2026-03-11T09:00:00.000Z",
      "updatedAt": "2026-03-11T09:00:00.000Z",
      "contributor": {
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

#### POST `/api/answers`

**Request:**
```json
{
  "questionId": "cm1q123",
  "answerText": "Here is the official answer.",
  "status": "published"
}
```

**Response `201`:** `{ "answer": { ... } }`

#### PUT `/api/answers/:id`

**Request:**
```json
{
  "answerText": "Updated answer text.",
  "status": "published"
}
```

**Response `200`:** `{ "answer": { ... } }`

#### DELETE `/api/answers/:id`

**Response:** `204 No Content`

#### POST `/api/answers/:id/moderate`

**Request:**
```json
{
  "action": "approve"
}
```

| Action | Resulting Status |
|--------|-----------------|
| `"approve"` | `"published"` |
| `"reject"` | `"rejected"` |
| `"suspend"` | `"suspended"` |

**Response `200`:** `{ "answer": { ... } }`

---

### 4.5 Votes

> **Note:** The `/api/votes` endpoints are public (no JWT required). They use `shopId` and `contributorId` directly.

#### POST `/api/votes`

Cast or toggle a vote.

**Request:**
```json
{
  "shopId": "cm1shop789",
  "contributorId": "cm1contrib456",
  "entityType": "question",
  "entityId": "cm1q123",
  "voteValue": 1
}
```

**Response `200`:**
```json
{
  "action": "created",
  "vote": {
    "id": "cm1vote789",
    "voteValue": 1,
    "entityType": "question",
    "questionId": "cm1q123",
    "contributorId": "cm1contrib456"
  }
}
```

#### GET `/api/votes`

Get vote summary for an entity.

**Query Parameters:**
| Param | Type | Required |
|-------|------|----------|
| `entityType` | string | ✅ `"question"` or `"answer"` |
| `entityId` | string | ✅ ID of the entity |

**Response `200`:**
```json
{
  "up": 5,
  "down": 1,
  "score": 4,
  "votes": [
    {
      "id": "cm1vote789",
      "voteValue": 1,
      "contributor": { "id": "...", "name": "Jane" }
    }
  ]
}
```

#### DELETE `/api/votes`

Remove a specific vote.

**Request Body:**
```json
{
  "shopId": "cm1shop789",
  "contributorId": "cm1contrib456",
  "entityType": "question",
  "entityId": "cm1q123"
}
```

**Response `200`:** `{ "action": "removed" }` or `{ "action": "none" }`

---

### 4.6 Contributors

> **🔒 Auth required.** Contributors are storefront visitors who submitted questions/answers/votes.

#### GET `/api/contributors`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `"active"` or `"suspended"` |
| `trusted` | string | `"true"` or `"false"` |
| `search` | string | Search in name and email |

**Response `200`:**
```json
{
  "contributors": [
    {
      "id": "cm1contrib456",
      "email": "jane@example.com",
      "name": "Jane Smith",
      "phone": "+1-555-0123",
      "externalId": "shopify_12345",
      "status": "active",
      "trusted": true,
      "createdAt": "2026-03-10T08:00:00.000Z",
      "_count": {
        "questions": 3,
        "answers": 7,
        "votes": 15
      }
    }
  ]
}
```

#### PUT `/api/contributors/:id`

Update contributor details.

**Request:**
```json
{
  "name": "Jane S.",
  "trusted": true,
  "status": "active"
}
```

#### POST `/api/contributors/:id/suspend`

Suspend a contributor. Suspended contributors cannot submit questions, answers, or votes.

**Response `200`:** `{ "contributor": { "status": "suspended", ... } }`

#### POST `/api/contributors/:id/unsuspend`

Re-activate a suspended contributor.

**Response `200`:** `{ "contributor": { "status": "active", ... } }`

#### POST `/api/contributors/:id/trust`

Set trusted status.

**Request:**
```json
{
  "trusted": true
}
```

**Response `200`:** `{ "contributor": { "trusted": true, ... } }`

> **Trusted contributors** can have their content auto-published when `trustedCustomerAutoPublish` is enabled in settings.

---

### 4.7 Settings

#### GET `/api/settings`

Get current shop settings. Returns defaults if none saved.

**Response `200`:**
```json
{
  "settings": {
    "widgetEnabled": true,
    "widgetPosition": "bottom-right",
    "primaryColor": "#6366f1",
    "allowSubmission": true,
    "notifyEmail": null,

    "autoPublishQuestions": false,
    "manualPublishQuestions": true,
    "publishQuestionsAfterTimeEnabled": false,
    "publishQuestionsAfterMinutes": 0,
    "publishQuestionsAfterHours": 24,

    "autoPublishAnswers": false,
    "manualPublishAnswers": true,
    "publishAnswersAfterTimeEnabled": false,
    "publishAnswersAfterMinutes": 0,
    "publishAnswersAfterHours": 24,
    "autoPublishIfAnswersLessThan": 0,

    "autoModeration": false,
    "trustedCustomerAutoPublish": false
  }
}
```

**Settings Reference:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `widgetEnabled` | boolean | `true` | Enable/disable the FAQ widget |
| `widgetPosition` | string | `"bottom-right"` | Widget position on page |
| `primaryColor` | string | `"#6366f1"` | Widget primary color (hex) |
| `allowSubmission` | boolean | `true` | Allow visitors to submit questions |
| `notifyEmail` | string | `null` | Email for new submission notifications |
| `autoPublishQuestions` | boolean | `false` | Auto-publish all new questions |
| `manualPublishQuestions` | boolean | `true` | Require manual approval for questions |
| `publishQuestionsAfterTimeEnabled` | boolean | `false` | Enable time-based auto-publish |
| `publishQuestionsAfterMinutes` | integer | `0` | Minutes delay before auto-publish |
| `publishQuestionsAfterHours` | integer | `24` | Hours delay before auto-publish |
| `autoPublishAnswers` | boolean | `false` | Auto-publish all new answers |
| `manualPublishAnswers` | boolean | `true` | Require manual approval for answers |
| `publishAnswersAfterTimeEnabled` | boolean | `false` | Time-based auto-publish for answers |
| `publishAnswersAfterMinutes` | integer | `0` | Minutes delay |
| `publishAnswersAfterHours` | integer | `24` | Hours delay |
| `autoPublishIfAnswersLessThan` | integer | `0` | Auto-publish answers if question has fewer than N published answers (0 = disabled) |
| `autoModeration` | boolean | `false` | Enable automatic content moderation |
| `trustedCustomerAutoPublish` | boolean | `false` | Auto-publish content from trusted contributors |

#### PUT `/api/settings`

Update settings. Only include fields you want to change.

**Request:**
```json
{
  "autoPublishQuestions": true,
  "trustedCustomerAutoPublish": true,
  "notifyEmail": "admin@myshop.com"
}
```

**Response `200`:** `{ "settings": { ... } }` (full settings object)

---

### 4.8 Analytics

#### GET `/api/questions/analytics`

**Response `200`:**
```json
{
  "totalQuestions": 150,
  "published": 120,
  "pending": 20,
  "suspended": 5,
  "categories": [
    { "name": "Shipping", "count": 45 },
    { "name": "Returns", "count": 30 }
  ],
  "totalAnswers": 200,
  "publishedAnswers": 180,
  "totalContributors": 50,
  "trustedContributors": 10
}
```

---

## 5. Data Models

### Question

```
id              String    Unique identifier (CUID)
question        String    Question text
answer          String?   Direct answer from admin
status          String    "pending" | "published" | "rejected" | "draft" | "suspended"
sortOrder       Int       Display order (0 = default)
views           Int       View count
helpful         Int       Helpful vote count (legacy)
notHelpful      Int       Not helpful count (legacy)
voteScore       Int       Net score from votes (+1/-1 system)
customerName    String?   Name of the person who asked
customerEmail   String?   Email of the person who asked
customerPhone   String?   Phone of the person who asked
customerId      String?   External customer ID
contributorId   String?   FK to StoreContributor
source          String?   "webhook" | "dashboard" | null
categoryId      String?   FK to Category
shopId          String    FK to Shop
publishedAt     DateTime? When the question was published
createdAt       DateTime  Creation timestamp
updatedAt       DateTime  Last update timestamp
```

### Answer

```
id              String    Unique identifier (CUID)
answerText      String    Answer text content
status          String    "pending" | "published" | "rejected" | "suspended"
voteScore       Int       Net score from votes
contributorId   String?   FK to StoreContributor
questionId      String    FK to Question
shopId          String    FK to Shop
source          String?   "webhook" | "dashboard"
publishedAt     DateTime? When published
createdAt       DateTime
updatedAt       DateTime
```

### StoreContributor

```
id              String    Unique identifier (CUID)
email           String    Customer email (unique per shop)
name            String?   Display name
phone           String?   Phone number
externalId      String?   External customer ID
status          String    "active" | "suspended"
trusted         Boolean   Trusted contributor flag
shopId          String    FK to Shop
createdAt       DateTime
updatedAt       DateTime

Unique constraint: (shopId, email)
```

### Vote

```
id              String    Unique identifier (CUID)
voteValue       Int       +1 (upvote) or -1 (downvote)
entityType      String    "question" or "answer"
contributorId   String    FK to StoreContributor
questionId      String?   FK to Question (when entityType = "question")
answerId        String?   FK to Answer (when entityType = "answer")
shopId          String    FK to Shop
createdAt       DateTime
updatedAt       DateTime

Unique constraints:
  - (contributorId, entityType, questionId)  — one vote per contributor per question
  - (contributorId, entityType, answerId)    — one vote per contributor per answer
```

### Category

```
id              String    Unique identifier (CUID)
name            String    Category display name
description     String?   Optional description
slug            String    URL-friendly slug (auto-generated)
sortOrder       Int       Display order
shopId          String    FK to Shop

Unique constraint: (shopId, slug)
```

### Setting

```
id              String    Unique identifier (CUID)
shopId          String    FK to Shop (unique — one settings row per shop)
widgetEnabled   Boolean
widgetPosition  String
primaryColor    String
allowSubmission Boolean
notifyEmail     String?
autoPublishQuestions          Boolean
manualPublishQuestions        Boolean
publishQuestionsAfterTimeEnabled  Boolean
publishQuestionsAfterMinutes      Int
publishQuestionsAfterHours        Int
autoPublishAnswers           Boolean
manualPublishAnswers         Boolean
publishAnswersAfterTimeEnabled    Boolean
publishAnswersAfterMinutes        Int
publishAnswersAfterHours          Int
autoPublishIfAnswersLessThan      Int
autoModeration               Boolean
trustedCustomerAutoPublish   Boolean
```

---

## 6. Publishing Rules & Business Logic

### How Question Status Is Determined

When a question is submitted via webhook, the backend runs this logic:

```
IF autoPublishQuestions = true
  → status = "published"

ELSE IF trustedCustomerAutoPublish = true AND contributor.trusted = true
  → status = "published"

ELSE
  → status = "pending"  (requires manual approval)
```

### How Answer Status Is Determined

```
IF autoPublishAnswers = true
  → status = "published"

ELSE IF trustedCustomerAutoPublish = true AND contributor.trusted = true
  → status = "published"

ELSE IF autoPublishIfAnswersLessThan > 0
       AND (published answers for this question) < autoPublishIfAnswersLessThan
  → status = "published"

ELSE
  → status = "pending"
```

### Contributor Trust & Suspension

- **Trusted contributors:** Their content can bypass moderation when `trustedCustomerAutoPublish` is enabled.
- **Suspended contributors:** Cannot submit questions, answers, or votes. All webhook requests from suspended contributors return `403`.
- Contributors are auto-created on first webhook interaction (identified by email per shop).

### Vote Scoring

- Each contributor can cast one vote per entity (question or answer).
- Voting the same value again **removes** the vote (toggle behavior).
- Voting a different value **changes** the vote.
- `voteScore` on questions/answers is recalculated as `SUM(all vote values)` after each vote change.

---

## 7. Error Handling

### Standard Error Response

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted (no content) |
| 400 | Bad request (missing/invalid fields) |
| 401 | Unauthorized (missing/expired JWT) |
| 403 | Forbidden (suspended contributor) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email on signup) |
| 500 | Internal server error |

### Auth Errors

```json
// 401 — Missing token
{ "error": "No token provided" }

// 401 — Invalid/expired token
{ "error": "Invalid or expired token" }

// 401 — User not found
{ "error": "User not found" }
```

---

## 8. Integration Guide for Ecommerce Frontend Plugins

### Quick Start

As a frontend plugin developer, you only need the **public webhook endpoints** (Section 3). No authentication tokens are needed.

**You will receive from the shop owner:**
1. A `userId` string (e.g., `"cm1abc123def456"`)
2. The API base URL (e.g., `"https://faq-api.example.com"`)

From these, construct the webhook base URL:
```
{baseUrl}/api/webhooks/{userId}
```

### Typical Plugin Flow

```
┌──────────────────────────────────────────────────────┐
│                 STOREFRONT PAGE                       │
│                                                       │
│  1. Load FAQs                                         │
│     GET /api/webhooks/{userId}/faq?sort=votes         │
│           ↓                                           │
│  2. Display FAQ list with vote buttons                │
│           ↓                                           │
│  3. Customer clicks "Ask a Question"                  │
│     → Collect: question text + customer info          │
│     POST /api/webhooks/{userId}/faq                   │
│           ↓                                           │
│  4. Customer clicks "Answer" on a question            │
│     → Collect: answer text + customer info            │
│     POST /api/webhooks/{userId}/answer                │
│           ↓                                           │
│  5. Customer clicks ▲ or ▼ on question/answer         │
│     POST /api/webhooks/{userId}/vote                  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### JavaScript Example — Load & Display FAQs

```javascript
const API_BASE = "https://faq-api.example.com/api/webhooks";
const USER_ID = "cm1abc123def456"; // provided by shop owner

// Load published FAQs
async function loadFAQs(categorySlug = null, sort = "votes") {
  const params = new URLSearchParams({ sort });
  if (categorySlug) params.set("categorySlug", categorySlug);

  const response = await fetch(`${API_BASE}/${USER_ID}/faq?${params}`);
  const data = await response.json();
  return data.faqs; // Array of published FAQs
}

// Submit a new question
async function submitQuestion(questionText, customer) {
  const response = await fetch(`${API_BASE}/${USER_ID}/faq`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: questionText,
      customer: {
        email: customer.email,
        name: customer.name,
        phone: customer.phone || undefined,
        id: customer.shopifyId || undefined,
      },
    }),
  });

  const data = await response.json();
  // data.status will be "published" or "pending"
  return data;
}

// Submit an answer to a question
async function submitAnswer(questionId, answerText, customer) {
  const response = await fetch(`${API_BASE}/${USER_ID}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId,
      answerText,
      customer: {
        email: customer.email,
        name: customer.name,
      },
    }),
  });
  return response.json();
}

// Vote on a question or answer
async function vote(entityType, entityId, voteValue, customerEmail) {
  const response = await fetch(`${API_BASE}/${USER_ID}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entityType,   // "question" or "answer"
      entityId,     // the question/answer ID
      voteValue,    // 1 (upvote) or -1 (downvote)
      customer: { email: customerEmail },
    }),
  });

  const data = await response.json();
  // data.action: "created" | "changed" | "removed"
  return data;
}
```

### Customer Object

When calling webhook endpoints, always include as much customer info as available:

```json
{
  "customer": {
    "email": "required-for-voting@example.com",
    "name": "Display Name",
    "phone": "+1-555-0123",
    "id": "your_platform_customer_id"
  }
}
```

| Field | When Required | Why |
|-------|--------------|-----|
| `email` | Always recommended; **required for votes** | Identifies the contributor across sessions |
| `name` | Optional | Displayed next to answers |
| `phone` | Optional | Stored for admin reference |
| `id` | Optional | Links to your platform's customer record |

> **Privacy:** The GET FAQs endpoint never exposes customer emails, phones, or external IDs. Only contributor names are shown alongside published answers.

### Handling Responses

```javascript
// After submitting a question
const result = await submitQuestion("How do returns work?", customer);

if (result.success) {
  if (result.status === "published") {
    showMessage("Your question has been posted!");
  } else {
    showMessage("Your question has been submitted and is awaiting review.");
  }
} else {
  showError(result.error);
}
```

### CORS

The backend enables CORS for all origins. No special headers needed beyond `Content-Type: application/json`.

---

## Appendix: Health Check

```
GET /health
→ { "status": "ok" }
```

Use this to verify the API is running.

---

*Generated for FAQ App v1.0.0 — Last updated: March 2026*
