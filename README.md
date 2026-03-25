# FAQ Manager — Shopify App

A full-stack FAQ management application built for Shopify stores with community Q&A features, voting, and storefront widget integration.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend**: Node.js, Express.js 5
- **Database**: PostgreSQL with Prisma ORM 7
- **Storefront**: Shopify Theme App Extension (Liquid + Vanilla JS)

## Project Structure

```
faq-app/
├── frontend/              # Next.js dashboard app (port 3004)
│   ├── app/
│   │   ├── dashboard/        # Overview & quick actions
│   │   ├── questions/        # CRUD & moderation
│   │   ├── answers/          # Answer management
│   │   ├── contributors/     # Contributor management
│   │   ├── analytics/        # Stats & charts
│   │   ├── credentials/      # Shopify shop setup & widget code
│   │   └── settings/         # Widget & moderation config
│   ├── components/           # Reusable UI components
│   ├── hooks/                # Custom React hooks (useAuth, useFetch, useTheme)
│   └── services/             # API client (shopifyApi.ts)
│
├── backend/               # Express API (port 4004)
│   ├── routes/
│   │   ├── auth.js           # User signup/login (JWT)
│   │   ├── webhooks.js       # Public storefront API
│   │   ├── questions.js      # FAQ CRUD + moderation
│   │   ├── answers.js        # Answer management
│   │   ├── contributors.js   # Contributor management
│   │   ├── votes.js          # Voting system
│   │   └── settings.js       # Shop settings
│   ├── services/
│   │   ├── faqService.js        # FAQ business logic
│   │   ├── settingsService.js   # Publishing rules
│   │   ├── voteService.js       # Vote tracking
│   │   ├── contributorService.js # Storefront users
│   │   └── productService.js    # Product scraping
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   ├── rateLimit.js         # Rate limiting
│   │   └── errorHandler.js      # Global error handler
│   ├── prisma/
│   │   └── schema.prisma        # Database models
│   └── server.js                # Express entry point
│
└── ui-extension/          # Shopify Theme App Extension
    └── v1/
        ├── product-faq.liquid   # FAQ block for product pages
        └── assets/
            ├── faq.js           # Widget JavaScript
            └── faq.css          # Widget styles
```

## Features

- **Community Q&A** — Customers ask questions, community members provide answers
- **Voting System** — Upvote/downvote questions and answers
- **Product-Scoped FAQs** — Link questions to specific products
- **Moderation Workflows** — Manual, auto-publish, or time-based publishing
- **Contributor Management** — Track, trust, or suspend storefront users
- **Storefront Widget** — Embeddable FAQ widget for Shopify themes
- **Analytics Dashboard** — Track engagement and moderation metrics

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
# Backend
cp backend/.env.example backend/.env
# Edit with: DATABASE_URL, JWT_SECRET, FRONTEND_URL

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit with: NEXT_PUBLIC_API_URL=http://localhost:4004/api
```

### 3. Set up the database

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run both servers

```bash
# Terminal 1 — Backend (port 4004)
cd backend && npm run dev

# Terminal 2 — Frontend (port 3004)
cd frontend && npm run dev
```

## Database Models

- **User** — Dashboard admin accounts
- **Shop** — Shopify store configuration (domain, webhookKey, credentials)
- **Category** — FAQ categories per shop
- **Question** — FAQ entries with status, product linking, contributor tracking
- **Answer** — Community answers to questions
- **Vote** — Upvote/downvote tracking (+1/-1)
- **StoreContributor** — Storefront customers who submit Q&A
- **Setting** — Per-shop widget & moderation configuration
- **Product** — Product metadata (auto-scraped from storefront)

## API Endpoints

### Authentication (Public)
| Method | Endpoint              | Description         |
|--------|-----------------------|---------------------|
| POST   | `/api/auth/signup`    | Register new user   |
| POST   | `/api/auth/login`     | Login & get JWT     |
| GET    | `/api/auth/me`        | Get current user    |

### Credentials (Protected)
| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| GET    | `/api/credentials`    | Get shop & widget embed HTML   |
| POST   | `/api/credentials`    | Save Shopify credentials       |
| DELETE | `/api/credentials`    | Remove credentials             |

### Questions (Protected)
| Method | Endpoint                        | Description           |
|--------|----------------------------------|-----------------------|
| GET    | `/api/questions`                | List questions        |
| POST   | `/api/questions`                | Create question       |
| GET    | `/api/questions/:id`            | Get single question   |
| PUT    | `/api/questions/:id`            | Update question       |
| DELETE | `/api/questions/:id`            | Delete question       |
| POST   | `/api/questions/:id/moderate`   | Approve/reject        |
| GET    | `/api/questions/categories`     | List categories       |
| POST   | `/api/questions/categories`     | Create category       |
| GET    | `/api/questions/analytics`      | Get analytics         |

### Answers (Protected)
| Method | Endpoint                        | Description           |
|--------|----------------------------------|-----------------------|
| GET    | `/api/answers`                  | List answers          |
| POST   | `/api/answers`                  | Create answer         |
| PUT    | `/api/answers/:id`              | Update answer         |
| DELETE | `/api/answers/:id`              | Delete answer         |
| POST   | `/api/answers/:id/moderate`     | Approve/reject        |

### Contributors (Protected)
| Method | Endpoint                           | Description           |
|--------|------------------------------------|-----------------------|
| GET    | `/api/contributors`                | List contributors     |
| PUT    | `/api/contributors/:id`            | Update contributor    |
| POST   | `/api/contributors/:id/suspend`    | Suspend contributor   |
| POST   | `/api/contributors/:id/unsuspend`  | Unsuspend contributor |
| POST   | `/api/contributors/:id/trust`      | Set trusted status    |

### Settings (Protected)
| Method | Endpoint              | Description           |
|--------|-----------------------|-----------------------|
| GET    | `/api/settings`       | Get shop settings     |
| PUT    | `/api/settings`       | Update settings       |

### Votes (Public)
| Method | Endpoint              | Description           |
|--------|-----------------------|-----------------------|
| POST   | `/api/votes`          | Cast/toggle vote      |
| GET    | `/api/votes`          | Get vote counts       |
| DELETE | `/api/votes`          | Remove vote           |

### Public Webhooks (Storefront)
| Method | Endpoint                              | Description           |
|--------|---------------------------------------|-----------------------|
| GET    | `/api/webhooks/:webhookKey/faq`       | Fetch published FAQs  |
| POST   | `/api/webhooks/:webhookKey/faq`       | Submit question       |
| PUT    | `/api/webhooks/:webhookKey/faq`       | Update question       |
| POST   | `/api/webhooks/:webhookKey/answer`    | Submit answer         |
| POST   | `/api/webhooks/:webhookKey/vote`      | Cast vote             |

## Storefront Widget

The UI extension (`ui-extension/v1/`) provides a Shopify Theme App Extension block that:

- Displays product-specific FAQs on product pages
- Allows logged-in customers to ask questions and submit answers
- Supports upvoting/downvoting
- Integrates via the webhook API (no authentication required)

Shop owners get their webhook URL and embeddable widget HTML from the **Credentials** page in the dashboard.

## Documentation

- **[API_DOCS.md](./API_DOCS.md)** — Complete API reference with request/response examples
- **[WEBHOOK_DOCS.md](./WEBHOOK_DOCS.md)** — Storefront integration guide for plugin developers

## CI/CD and Deployment

GitHub Actions workflows are configured for CI and deploy-branch CD:

- CI + build checks on `main` and `deploy`
- Automatic server deployment on pushes to `deploy`

See deployment setup:

- `deploy/README.md`
- `.github/workflows/ci-cd.yml`
