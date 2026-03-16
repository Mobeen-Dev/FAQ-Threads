**Role:**
You are a senior Shopify developer and system architect specializing in **Shopify Theme App Extensions, Liquid, and performance-optimized storefront components**.

Your task is to design and implement a **Shopify Theme App Extension** that displays and manages **Product FAQs** powered by a webhook-based backend.

---

# Objective

Create a **Shopify Theme App Extension** that allows merchants to embed a **Product FAQ component** on product pages.

The component should:

1. **Display FAQs for the current product**
2. Allow users to **ask new questions**
3. Allow users to **contribute answers to existing questions**
4. Use **high-performance loading strategies**
5. Follow **Shopify Theme Extension and Liquid best practices**

---

# Data Source

All FAQ data is managed externally via a backend webhook API.

Merchants will copy the following webhook URL from the app admin panel and paste it into their Shopify app or Chrome extension:

```
📡 Your Webhook URL
Paste this URL in your Shopify app or Chrome extension. It accepts POST and PUT requests.

http://localhost:4004/api/webhooks/cmmous8m700006oio7in04wzr/faq
```

The theme extension must **read and display data provided through this API**.

---

# Documentation

Before implementation you MUST:

1. Read the file:

```
API_DOCS.md
```

2. Extract:

* API endpoints
* request/response formats
* authentication (if any)
* product identification logic
* question/answer submission format

Use this information to design the frontend data layer.

---

# UX Reference

A sample implementation exists in:

```
frontend/sample
```

You must:

* Analyze the sample
* Understand interaction patterns
* Improve design for **Shopify storefront compatibility**
* Maintain **clean UX and responsiveness**

---

# Core Functional Requirements

## 1. FAQ Display

On the **Product Page**, the extension must:

* Load FAQs for the current product
* Show them in a **collapsible accordion UI**
* Display:

  * Question
  * Top answer
  * Number of answers
  * Ability to view more answers

---

## 2. Performance Strategy

FAQ reading should use **lazy or non-blocking loading**.

Preferred strategies:

* IntersectionObserver lazy loading
* fetch only when component becomes visible
* caching where possible
* avoid blocking Shopify page rendering

Important goals:

* minimal JS bundle
* minimal Liquid processing
* no blocking scripts

---

## 3. Asking Questions

Users must be able to **submit a new question**.

Requirements:

* Requires **user login**
* If user not logged in:

  * show login prompt
  * redirect to Shopify customer login

Submission must:

* send request to webhook API
* update UI optimistically if possible

---

## 4. Contributing Answers

Users must be able to **add answers to existing questions**.

Requirements:

* must be logged in
* answer form expands under the question
* POST request to webhook API

---

# Shopify Architecture Requirements

The implementation MUST follow **Shopify Theme App Extension architecture**.

Use:

* Theme App Extension
* App Embed or Product Block
* Liquid
* Minimal JavaScript

Structure example:

```
extensions/
  faq-extension/
    blocks/
      product-faq.liquid
    assets/
      faq.js
      faq.css
```

---

# Liquid Requirements

Use Liquid to:

* detect product context
* pass product ID / handle to JS
* mount the FAQ component

Example context:

```
product.id
product.handle
```

---

# Design Requirements

The UI must be:

* fully responsive
* mobile-first
* clean Shopify-native styling
* accessible (ARIA accordion)

Components:

* FAQ list
* expand/collapse answers
* ask question form
* answer form

---

# Performance Requirements

The extension must:

* not slow down product pages
* load JS **only when component exists**
* lazy fetch FAQ data
* avoid large frameworks

Prefer:

* vanilla JS
* Alpine.js (optional)
* small utilities only

Avoid:

* React
* large frameworks
* blocking scripts

---

# Shopify Best Practices

You MUST research and follow best practices for:

* Shopify Theme App Extensions
* Liquid performance
* asset loading
* storefront compatibility
* section/block architecture

Use knowledge from:

* Shopify Theme Extension documentation
* Liquid best practices
* storefront performance guidelines

---

# Tools Available

Use **shopify-dev-mcp** and Shopify documentation to:

* validate theme extension architecture
* ensure correct Liquid usage
* ensure compatibility with Online Store 2.0

---

# Implementation Plan

Before writing code, produce:

1. **Architecture Plan**
2. **Data flow design**
3. **Theme extension structure**
4. **API interaction design**
5. **Performance strategy**

Then implement the extension.

---

# Deliverables

Provide:

1. Theme extension folder structure
2. Liquid block implementation
3. JS logic for:

   * lazy loading FAQs
   * submitting questions
   * submitting answers
4. Responsive CSS
5. Setup instructions
6. Example theme integration

---

# Quality Requirements

Your implementation must be:

* production-ready
* modular
* cleanly structured
* fully documented
* optimized for Shopify storefront performance

---

# Important Notes

* FAQ **reading must not hurt storefront performance**
* All **writes go through the webhook API**
* Authentication must rely on **Shopify customer login**
* The extension must be **safe to install on any Shopify theme**
