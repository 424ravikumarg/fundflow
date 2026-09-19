#!/usr/bin/env bash
# ==============================================================================
# Fundflow - Sync from GitHub & Re-deploy (Docker)
# ==============================================================================
set -euo pipefail

APP_DIR="/opt/fundflow"

echo "=========================================================="
echo " Syncing Fundflow from GitHub & Updating Server...\"
echo \"=========================================================="

cd "${APP_DIR}"

# 1. Pull latest code from GitHub using fetch & reset (safe for deployment)
echo ">>> [1/4] Pulling latest changes from GitHub main branch..."
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init
  git config --global --add safe.directory "${APP_DIR}" 2>/dev/null || true
fi

git remote add origin https://github.com/424ravikumarg/fundflow.git 2>/dev/null || git remote set-url origin https://github.com/424ravikumarg/fundflow.git
git fetch origin main
git checkout -B main
git reset --hard origin/main

# 2. Rebuild Docker image with latest code
echo ">>> [2/4] Rebuilding Docker image..."
docker build -t fundflow .

# 3. Stop and replace running container
echo ">>> [3/4] Restarting container with updated build..."
docker stop fundflow 2>/dev/null || true
docker rm fundflow 2>/dev/null || true

docker run -d \
  --name fundflow \
  --restart always \
  -p 127.0.0.1:3000:3000 \
  -v /opt/fundflow/storage:/app/storage \
  --env-file "${APP_DIR}/.env.local" \
  fundflow

# 4. Verify deployment
echo ">>> [4/4] Checking updated container status..."
sleep 3
docker ps --filter "name=fundflow"

echo "=========================================================="
echo " Successfully updated to the latest code from GitHub!"
echo "=========================================================="
