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
   - `docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml up -d --build`
   - fallback if required by runner policy: `sudo -n docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml up -d --build`
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

## Runner Docker access verification and recovery

Use the included diagnostics script:

```bash
chmod +x deploy/runner-diagnostics.sh
./deploy/runner-diagnostics.sh | tee deploy/runner-diagnostics.out
```

Expected healthy state:

- `docker_direct_ok=yes` (preferred)
- Runner user is listed in `docker` group
- `/var/run/docker.sock` is owned by `root:docker` with group read/write

If the user was recently added to `docker` group, restart the runner service so the service process picks up updated groups:

```bash
sudo systemctl restart actions.runner.<owner>-<repo>.<runner-name>.service
systemctl status actions.runner.<owner>-<repo>.<runner-name>.service --no-pager
pid=$(pgrep -f "Runner.Listener run --startuptype service" | head -n1)
cat /proc/$pid/status | grep ^Groups:
```

Confirm docker GID appears in the runner process groups.

If group-based access is disallowed by policy, configure a tightly scoped sudoers fallback:

```bash
echo "<runner-user> ALL=(ALL) NOPASSWD:/usr/bin/docker" | sudo tee /etc/sudoers.d/runner-docker
sudo chmod 440 /etc/sudoers.d/runner-docker
sudo visudo -cf /etc/sudoers.d/runner-docker
```

Never use broad sudoers grants like `NOPASSWD: ALL`.

## Branch strategy

- Use `main` for regular development integration.
- Push to `deploy` for release flow.
