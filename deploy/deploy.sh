#!/usr/bin/env bash
# ==============================================================================
# Fundflow - Application Build & Release Script (RHEL 9 / 8)
# ==============================================================================
set -euo pipefail

APP_DIR="/opt/fundflow"
APP_USER="fundflow"

echo ">>> Building and deploying Fundflow..."

cd "${APP_DIR}"

# 1. Install dependencies
echo ">>> Installing dependencies..."
npm ci --prefer-offline --no-audit

# 2. Build standalone package
echo ">>> Building Next.js production build..."
npm run build

# 3. Copy static assets and public folder into standalone directory
echo ">>> Preparing standalone artifacts..."
if [ -d "public" ]; then
  cp -rn public .next/standalone/ || true
fi

if [ -d ".next/static" ]; then
  mkdir -p .next/standalone/.next
  cp -rn .next/static .next/standalone/.next/ || true
fi

# 4. Set permissions
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# 5. Restart systemd service
echo ">>> Restarting systemd service..."
systemctl restart fundflow
systemctl status fundflow --no-pager

echo ">>> Fundflow deployed successfully!"
