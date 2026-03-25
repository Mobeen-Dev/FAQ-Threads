#!/usr/bin/env bash

# 0) REQUIRED: set GitHub repository secrets before deploy
#    DB_APP_USER and DB_APP_PASSWORD are mandatory now.
#    Use a dedicated app role (example: faq_app_user), not postgres.
#    Required secret set:
#    - POSTGRES_USER
#    - POSTGRES_PASSWORD
#    - POSTGRES_DB
#    - DB_APP_USER
#    - DB_APP_PASSWORD
#    - FRONTEND_URL
#    - BACKEND_URL
#    - JWT_SECRET
#    - ALLOWED_ORIGINS (optional)

# 1) Runner Docker access diagnostics
chmod +x deploy/runner-diagnostics.sh
./deploy/runner-diagnostics.sh | tee deploy/runner-diagnostics.out

# 2) If runner was just added to docker group, restart the runner service
sudo systemctl restart actions.runner.<owner>-<repo>.<runner-name>.service
systemctl status actions.runner.<owner>-<repo>.<runner-name>.service --no-pager
pid=$(pgrep -f "Runner.Listener run --startuptype service" | head -n1)
cat /proc/$pid/status | grep ^Groups:

# 3) (Recommended one-time) create dedicated app DB role
docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE ROLE faq_app_user WITH LOGIN PASSWORD 'REPLACE_ME';"
docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT CONNECT ON DATABASE \"$POSTGRES_DB\" TO faq_app_user;"
docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT USAGE, CREATE ON SCHEMA public TO faq_app_user;"
docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO faq_app_user;"
docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO faq_app_user;"

# 4) Deploy
docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml up -d --build

# 5) Verify running services
docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml ps

# 6) Check app health
curl -fsS http://localhost:4004/health
curl -fsS http://localhost:3004/login
