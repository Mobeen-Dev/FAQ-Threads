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
2. Stops existing containers for `deploy/docker-compose.deploy.yml`.
3. Runs:
   - `sudo docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml up -d --build`
4. Checks backend (`/health`) and frontend (`/login`) locally.
5. Prints compose logs on failure.

PostgreSQL is exposed on host port `5434` (`5434:5432`) for external access.

## Server setup steps (one-time)

1. Configure a Linux self-hosted GitHub Actions runner for this repository.
2. Install Docker and Docker Compose plugin on the runner host.
3. Ensure the runner user can run Docker non-interactively:
   - Preferred: add runner user to `docker` group (`sudo usermod -aG docker <runner-user>`), then restart runner host/session.
   - Alternative: passwordless sudo for Docker (`<runner-user> ALL=(ALL) NOPASSWD:/usr/bin/docker`).
   - If neither is configured, deployment fails because GitHub Actions cannot enter a sudo password.
4. Add GitHub repository secrets:
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DB`
   - `FRONTEND_URL`
   - `BACKEND_URL`
   - `JWT_SECRET`
   - `ALLOWED_ORIGINS` (optional)

If `ALLOWED_ORIGINS` is empty, it defaults to `FRONTEND_URL`.
Set `FRONTEND_URL` to the exact browser origin (example: `http://92.222.229.140:3004`) so CORS preflight succeeds.
Admin API traffic is forced to internal routing:
- browser uses `NEXT_PUBLIC_API_URL=/api`
- frontend container proxies `/api/*` to `INTERNAL_API_URL=http://backend:4004/api`
5. Keep `deploy/.env.production.example` as the reference template.

## Branch strategy

- Use `main` for regular development integration.
- Push to `deploy` for release flow.
