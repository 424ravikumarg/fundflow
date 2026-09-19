#!/usr/bin/env bash
# ==============================================================================
# Fundflow - Automated Linux Server Bootstrap & Setup Script
# ==============================================================================
# Compatible with: RHEL 9, RHEL 8, RHEL 7, Amazon Linux 2, Amazon Linux 2023
# Architecture: Node.js 20 LTS + Next.js 16 (Standalone) + Nginx + Systemd + SELinux
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo " Starting Fundflow Setup on Linux Server..."
echo "=========================================================="

# 1. Verify root privileges
if [ "$EUID" -ne 0 ]; then
  echo "[ERROR] Please run this script as root: sudo bash $0"
  exit 1
fi

APP_NAME="fundflow"
APP_USER="fundflow"
APP_DIR="/opt/${APP_NAME}"
ENV_FILE="${APP_DIR}/.env.local"
NODE_VERSION="20"

# Detect Package Manager (dnf vs yum)
if command -v dnf &> /dev/null; then
  PKG_MGR="dnf"
  POLICYCORE="policycoreutils-python-utils"
  echo "Detected package manager: dnf"
elif command -v yum &> /dev/null; then
  PKG_MGR="yum"
  POLICYCORE="policycoreutils-python"
  echo "Detected package manager: yum"
else
  echo "[ERROR] Neither dnf nor yum package manager found on this system."
  exit 1
fi

# 2. System update & prerequisite packages
echo ">>> [1/7] Updating system packages & installing core utilities..."
$PKG_MGR check-update || true
$PKG_MGR install -y curl wget git tar make gcc-c++ $POLICYCORE || $PKG_MGR install -y curl wget git tar make gcc-c++

# Ensure sshd is running
systemctl enable sshd || true
systemctl restart sshd || true

# 3. Enable EPEL & Nginx
echo ">>> [2/7] Installing EPEL repository and Nginx..."
if [ "$PKG_MGR" = "dnf" ]; then
  dnf install -y "https://dl.fedoraproject.org/pub/epel/epel-release-latest-$(rpm -E %rhel).noarch.rpm" || true
  dnf install -y nginx certbot python3-certbot-nginx || dnf install -y nginx
else
  amazon-linux-extras install nginx1 -y 2>/dev/null || true
  yum install -y epel-release || yum install -y "https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm" || true
  yum install -y nginx certbot python2-certbot-nginx || yum install -y nginx certbot python3-certbot-nginx || yum install -y nginx || true
fi

# 4. Install Node.js 20 LTS
echo ">>> [3/7] Installing Node.js ${NODE_VERSION} LTS..."
if ! command -v node &> /dev/null || [[ "$(node -v)" != v${NODE_VERSION}* ]]; then
  set +e
  curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
  $PKG_MGR install -y nodejs
  set -e
fi

# Fallback to nvm if package manager failed to install Node.js
if ! command -v node &> /dev/null; then
  echo ">>> Package manager Node.js setup encountered an issue; installing Node.js via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install ${NODE_VERSION}
  nvm use ${NODE_VERSION}
  NODE_BIN=$(which node || echo "/root/.nvm/versions/node/v20.0.0/bin/node")
  NPM_BIN=$(which npm || echo "/root/.nvm/versions/node/v20.0.0/bin/npm")
  ln -sf "$NODE_BIN" /usr/bin/node || true
  ln -sf "$NODE_BIN" /usr/local/bin/node || true
  ln -sf "$NPM_BIN" /usr/bin/npm || true
  ln -sf "$NPM_BIN" /usr/local/bin/npm || true
fi

echo "Installed Node.js version: $(node -v)"
echo "Installed NPM version: $(npm -v)"

# 5. Create Dedicated Service User & App Directory
echo ">>> [4/7] Creating service account and application directory..."
if ! id -u "${APP_USER}" &> /dev/null; then
  useradd -r -m -d "${APP_DIR}" -s /bin/bash "${APP_USER}" || true
fi

mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# 6. Configure SELinux
echo ">>> [5/7] Configuring SELinux for Nginx reverse proxy..."
if command -v setsebool &> /dev/null; then
  setsebool -P httpd_can_network_connect 1 || true
fi

# 7. Configure Nginx Reverse Proxy
echo ">>> [6/7] Configuring Nginx reverse proxy..."
mkdir -p /etc/nginx/conf.d
cat << 'NGINX_EOF' > /etc/nginx/conf.d/fundflow.conf
server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Maximum upload size for bank statements (PDFs, Excel, Docx up to 50MB)
    client_max_body_size 50M;

    # Gzip Compression
    gzip on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_vary on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static assets caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000/_next/static/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 365d;
        access_log off;
    }

    location /public/ {
        proxy_pass http://127.0.0.1:3000/public/;
        expires 30d;
        access_log off;
    }

    # Main Application Proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 60s;
    }
}
NGINX_EOF

# Test and enable Nginx
nginx -t || true
systemctl enable --now nginx || systemctl start nginx || true
systemctl reload nginx || true

# 8. Create Systemd Service for Fundflow
echo ">>> [7/7] Creating Systemd service unit..."
NODE_PATH=$(which node)
cat << SYSTEMD_EOF > /etc/systemd/system/fundflow.service
[Unit]
Description=Fundflow Personal Finance & Statement Engine (Next.js)
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
EnvironmentFile=-${ENV_FILE}
ExecStart=${NODE_PATH} ${APP_DIR}/.next/standalone/server.js
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=fundflow

# Resource limits & hardening
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

systemctl daemon-reload

echo ">>> Environment template verification..."
if [ ! -f "${ENV_FILE}" ]; then
  cat << 'ENV_EOF' > "${ENV_FILE}"
# PostgreSQL RDS Connection
DATABASE_URL="postgresql://user:password@rds-endpoint.ap-south-1.rds.amazonaws.com:5432/dbname"

# AWS S3 Document Vault
AWS_ACCESS_KEY_ID="YOUR_AWS_ACCESS_KEY"
AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_KEY"
AWS_REGION="ap-south-1"
S3_BUCKET_NAME="ledgerly-vault"

# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=""
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
NEXT_PUBLIC_FIREBASE_APP_ID=""
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=""
ENV_EOF
  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
fi

echo "=========================================================="
echo " Fundflow Server Setup Completed Successfully!"
echo "=========================================================="
echo "Next Steps:"
echo "1. Run application deployment: bash deploy/deploy.sh"
echo "2. Check status: systemctl status fundflow"
echo "=========================================================="
