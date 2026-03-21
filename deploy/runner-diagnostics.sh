#!/usr/bin/env bash
set -euo pipefail

echo "=== Basic identity ==="
whoami
id
groups

echo
echo "=== Docker group and binaries ==="
getent group docker || true
command -v docker || true
ls -l /usr/bin/docker || true
docker --version || true
docker compose version || true

echo
echo "=== Docker daemon accessibility ==="
if docker info >/dev/null 2>&1; then
  echo "docker_direct_ok=yes"
else
  echo "docker_direct_ok=no"
fi

if sudo -n docker info >/dev/null 2>&1; then
  echo "docker_sudo_nopasswd_ok=yes"
else
  echo "docker_sudo_nopasswd_ok=no"
fi

echo
echo "=== Sudo policy (non-interactive) ==="
sudo -n -l || true

echo
echo "=== Docker service/socket state ==="
systemctl is-active docker || true
systemctl status docker --no-pager -l | tail -n 30 || true
ls -l /var/run/docker.sock || true

echo
echo "=== Runner service/process discovery ==="
systemctl list-units --type=service --no-pager | grep -i actions.runner || true
ps -ef | grep -i "runsvc.sh\\|Runner.Listener" | grep -v grep || true

echo
echo "=== Summary ==="
echo "If docker_direct_ok=no and docker_sudo_nopasswd_ok=no, fix runner access first."
