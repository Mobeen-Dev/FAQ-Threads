# Deployment (GitHub Actions + `deploy` branch)

This project now supports CI/CD with GitHub Actions and a deploy pipeline on a **self-hosted runner**.

## What was added

- `.github/workflows/ci-cd.yml`
  - CI on push/PR to `main`, `master`, and `deploy`
  - CD on push to `main` / `master` / `deploy` via self-hosted runner
- `backend/Dockerfile` and `frontend/Dockerfile`
- `deploy/docker-compose.deploy.yml`
- `deploy/.env.production.example`

## CI flow

For every push/PR:

1. Start PostgreSQL service in GitHub Actions.
2. Install backend dependencies.
3. Run Prisma `db push` + `generate`.
4. Start backend and run `backend/tests/features-test.js`.
5. Install frontend dependencies and run `npm run build`.

## CD flow (self-hosted runner)

When code is pushed to `main`, `master`, or `deploy`:

1. Stops existing containers for `deploy/docker-compose.deploy.yml`.
2. Backs up current app images (`faq-app-backend:backup`, `faq-app-frontend:backup`).
3. Builds and starts updated services with Docker Compose.
4. Runs health checks for PostgreSQL, backend (`/health`), and frontend (`/login`).
5. On failure, attempts rollback from backup images.

## Server setup steps (one-time)

1. Configure a Linux self-hosted GitHub Actions runner for this repository.
2. Install Docker and Docker Compose plugin on the runner host.
3. Ensure workflow runs from repository root and has access to:
   - `deploy/.env.production`
4. Start from template:
   - copy `deploy/.env.production.example` to `deploy/.env.production`
   - set production values.

## Branch strategy

- Use `main` for regular development integration.
- Push to `deploy` for release flow (or `main`/`master` if you want immediate deployment from those branches).
