# FAQ Manager — Shopify App

A full-stack FAQ management application built for Shopify stores.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Prisma ORM

## Project Structure

```
faq-app/
├── frontend/          # Next.js app
│   ├── app/
│   │   ├── dashboard/    # Overview & quick actions
│   │   ├── questions/    # CRUD & moderation
│   │   ├── analytics/    # Stats & charts
│   │   └── settings/     # Widget & moderation config
│   ├── components/       # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   └── services/         # API client (shopifyApi.ts)
│
├── backend/           # Express API
│   ├── routes/
│   │   ├── auth.js       # Shopify OAuth flow
│   │   ├── webhooks.js   # Shopify webhook handlers
│   │   └── questions.js  # FAQ CRUD + moderation
│   ├── services/
│   │   ├── shopifyService.js  # Shopify API integration
│   │   └── faqService.js      # FAQ business logic
│   ├── middleware/
│   │   ├── auth.js            # Shop authentication
│   │   └── errorHandler.js    # Global error handler
│   ├── prisma/
│   │   └── schema.prisma      # Database models
│   └── server.js              # Express entry point
```

## Getting Started

### 1. Clone & install

```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && npm install
```

### 2. Configure environment

```bash
# Copy example env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit backend/.env with your PostgreSQL URL and Shopify credentials
```

### 3. Set up the database

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run both servers

```bash
# Terminal 1 — Backend (port 4000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 3000)
cd frontend && npm run dev
```

## Database Models

- **Shop** — installed Shopify stores
- **Category** — FAQ categories per shop
- **Question** — FAQ entries with status (pending/published/rejected)
- **Setting** — per-shop widget & moderation configuration

## API Endpoints

| Method | Endpoint                        | Description           |
|--------|----------------------------------|-----------------------|
| GET    | `/api/auth/install`             | Start OAuth flow      |
| GET    | `/api/auth/callback`            | OAuth callback        |
| POST   | `/api/webhooks/app/uninstalled` | App uninstall handler |
| GET    | `/api/questions`                | List questions        |
| POST   | `/api/questions`                | Create question       |
| PUT    | `/api/questions/:id`            | Update question       |
| DELETE | `/api/questions/:id`            | Delete question       |
| POST   | `/api/questions/:id/moderate`   | Approve/reject        |
| GET    | `/api/questions/categories`     | List categories       |
| POST   | `/api/questions/categories`     | Create category       |
