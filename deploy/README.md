# Deployment (GitHub Actions + `deploy` branch)

This project now supports CI/CD with GitHub Actions and a deploy pipeline on a **self-hosted runner**.

## What was added

- `.github/workflows/ci-cd.yml`
  - CD on push to `deploy` via self-hosted runner
- `backend/Dockerfile` and `frontend/Dockerfile`
- `deploy/docker-compose.deploy.yml`
- `deploy/.env.production.example`

## CD flow (self-hosted runner)

When code is pushed to `deploy`:

1. Generates `deploy/.env.production` from GitHub Secrets.
2. Tries to create a pre-deploy PostgreSQL SQL dump under `deploy/backups/`.
3. Stops existing containers for `deploy/docker-compose.deploy.yml`.
4. Backs up current app images (`faq-app-backend:backup`, `faq-app-frontend:backup`).
5. Builds and starts updated services with Docker Compose.
6. Runs health checks for PostgreSQL, backend (`/health`), and frontend (`/login`).
7. On failure, attempts rollback from backup images.

PostgreSQL is exposed on host port `5434` (`5434:5432`) for external access.

> Rollback restores container images only. Database state is not auto-restored; use the SQL backup file if needed.

## Server setup steps (one-time)

1. Configure a Linux self-hosted GitHub Actions runner for this repository.
2. Install Docker and Docker Compose plugin on the runner host.
3. Add GitHub repository secrets:
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DB`
   - `FRONTEND_URL`
   - `BACKEND_URL`
   - `NEXT_PUBLIC_API_URL`
   - `JWT_SECRET`
   - `ALLOWED_ORIGINS` (optional)
4. Keep `deploy/.env.production.example` as the reference template.

## Branch strategy

- Use `main` for regular development integration.
- Push to `deploy` for release flow.
