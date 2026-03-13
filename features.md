# AI Agent Task: Implement Advanced Q&A Moderation, Publishing, and Voting System

## Objective

Design, implement, and document enhancements to the existing Question & Answer (Q&A) application. The system should support configurable publishing rules, user-based contributions, storefront answer submissions via webhook, and a voting-based ranking mechanism for FAQs.

The AI agent must follow a structured workflow:

1. Research the current architecture
2. Design the new architecture
3. Implement backend and frontend changes
4. Write tests
5. Document the system

---

# Phase 1 — Research and Analysis

## 1. Analyze Current System

The agent must first inspect the current system and document:

* Existing database schema
* Question and answer lifecycle
* Current moderation workflow
* Current API structure
* Frontend voting or FAQ display logic
* Webhook integrations (if any)

Produce a **short architecture overview document** before implementing changes.

---

# Phase 2 — Settings System Implementation

## Goal

Extend the **Settings Page** to support configurable publishing behavior for both **questions and answers**.

---

# Question Publishing Settings

Add the following configurable options:

### 1. Auto Publish Questions

* Questions become visible immediately after submission.

### 2. Manual Publish Questions

* Questions remain in **pending review** state.
* Admin must manually approve.

### 3. Publish After Time

* Questions automatically publish if not reviewed within a selected time.
* Admin can configure:

  * Minutes
  * Hours

Example fields:

```
auto_publish_questions: boolean
manual_publish_questions: boolean
publish_after_time_enabled: boolean
publish_after_minutes: integer
publish_after_hours: integer
```

---

# Answer Publishing Settings

Add a similar configuration for answers:

### 1. Auto Publish Answers

Answers immediately become visible.

### 2. Publish Manually

Answers require admin approval.

### 3. Publish After X Time

Answers auto publish if not reviewed after a configured time.

### 4. Publish if Answers are Less Than X

If the number of answers on a question is below a threshold, new answers auto publish.

Example configuration fields:

```
auto_publish_answers: boolean
manual_publish_answers: boolean
publish_answer_after_time_enabled: boolean
publish_answer_after_minutes: integer
publish_answer_after_hours: integer
auto_publish_if_answers_less_than: integer
```

---

# Phase 3 — Storefront Answer Submission via Webhook

## Objective

Allow answering a question directly from the **storefront**.

### Requirements

1. Create a webhook endpoint:

```
POST /webhooks/storefront/answer
```

### Webhook Payload

```
{
  question_id: string,
  user_id: string,
  answer_text: string
}
```

### Logic

1. Validate the question exists
2. Validate user identity
3. Create answer record
4. Apply publishing settings
5. Link answer to:

   * Question
   * User

---

# Phase 4 — Architecture Reconstruction

Rebuild the architecture to support **user contribution tracking**.

## Core Entities

### Users

Tracks contributors.

Fields:

```
user_id
name
email
status (active/suspended)
```

---

### Questions

```
question_id
user_id
question_text
status (pending, published, suspended)
votes
created_at
published_at
```

---

### Answers

```
answer_id
question_id
user_id
answer_text
status (pending, published, suspended)
votes
created_at
published_at
```

---

### Votes

```
vote_id
user_id
entity_type (question|answer)
entity_id
vote_value (+1 | -1)
```

---

# Phase 5 — Moderation and Suspension System

Admins must be able to:

Suspend or enable:

* Questions
* Answers
* Votes
* Users

Add moderation flags:

```
status = active | suspended | pending
```

Admin actions:

```
suspend_question
suspend_answer
suspend_votes
suspend_user
```

---

# Phase 6 — Customer Based Auto Publish

Add configuration allowing **trusted customers** to bypass moderation.

Example logic:

```
if user.trusted == true
   auto_publish = true
```

Admin must be able to toggle this capability.

---

# Phase 7 — Voting System

## Frontend Feature

Add voting UI to:

* Questions
* Answers

Users can:

* Upvote
* Downvote

Restrictions:

* One vote per user per entity.

---

# Vote Calculation

Vote score:

```
vote_score = sum(vote_value)
```

Votes should update dynamically when:

* a vote is created
* a vote is removed
* a vote is changed

---

# Phase 8 — FAQ Retrieval

When fetching FAQs:

```
GET /faqs
```

The response must always be:

1. Filtered to **published questions**
2. Sorted by **vote score descending**

Example query logic:

```
ORDER BY votes DESC
```

---

# Phase 9 — Testing

The agent must create tests for:

### Unit Tests

* Publishing rules
* Voting logic
* Suspension rules

### Integration Tests

* Storefront webhook answer submission
* Question publishing lifecycle
* FAQ sorting by votes

### Edge Cases

* Duplicate votes
* Suspended users
* Questions with no answers

---

# Phase 10 — Documentation

The agent must generate the following documentation:

### 1. Architecture Diagram

Explain the updated system architecture.

### 2. API Documentation

Document endpoints including:

```
POST /questions
POST /answers
POST /votes
GET /faqs
POST /webhooks/storefront/answer
```

### 3. Database Schema

Document all tables and relationships.

### 4. Settings Configuration Guide

Explain how admins configure publishing rules.

---

# Final Deliverables

The AI agent must produce:

1. Updated architecture design
2. Database schema
3. Backend implementation
4. Frontend voting UI
5. Webhook integration
6. Automated tests
7. Complete documentation
