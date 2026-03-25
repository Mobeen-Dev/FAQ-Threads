#!/usr/bin/env bash
set -euo pipefail

DC='docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml'

echo '=== 1) Load effective credentials from deploy/.env.production ==='
set -a
. deploy/.env.production
set +a

if [ -z "${DB_APP_USER:-}" ] || [ -z "${DB_APP_PASSWORD:-}" ]; then
  echo "❌ Missing DB_APP_USER/DB_APP_PASSWORD in deploy/.env.production"
  exit 1
fi
if [ "${DB_APP_USER}" = "postgres" ] || [ "${DB_APP_USER}" = "${POSTGRES_USER:-postgres}" ]; then
  echo "❌ DB_APP_USER must be a dedicated non-superuser role."
  exit 1
fi

TARGET_DB_USER="$DB_APP_USER"
TARGET_DB_PASSWORD="$DB_APP_PASSWORD"

if [ -z "${TARGET_DB_USER:-}" ] || [ -z "${TARGET_DB_PASSWORD:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
  echo "❌ Missing required values in deploy/.env.production"
  exit 1
fi

echo "Target DB user: $TARGET_DB_USER"
echo "Target DB name: $POSTGRES_DB"
echo "Target password length: ${#TARGET_DB_PASSWORD}"

echo
echo '=== 2) Reset role password inside postgres container (non-destructive) ==='
ESCAPED_PASSWORD=$(printf "%s" "$TARGET_DB_PASSWORD" | sed "s/'/''/g")
$DC exec -T postgres sh -lc \
  "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -c \"ALTER ROLE \\\"$TARGET_DB_USER\\\" WITH PASSWORD '$ESCAPED_PASSWORD';\""

echo
echo '=== 3) Verify auth with effective credentials ==='
$DC exec -T postgres sh -lc \
  "PGPASSWORD=\"$TARGET_DB_PASSWORD\" psql -h 127.0.0.1 -U \"$TARGET_DB_USER\" -d \"$POSTGRES_DB\" -c \"select current_user, current_database();\""

echo
echo '=== 4) Recreate backend container to force fresh env + connection state ==='
$DC up -d --no-deps --force-recreate backend

echo
echo '=== 5) Backend health ==='
for i in $(seq 1 20); do
  if curl -fsS http://localhost:4004/health >/dev/null 2>&1; then
    echo "✅ Backend healthy"
    exit 0
  fi
  echo "Attempt $i/20: waiting for backend..."
  sleep 3
done

echo "❌ Backend still unhealthy. Check: $DC logs --tail=200 backend"
exit 1
