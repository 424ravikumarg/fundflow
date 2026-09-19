# Fundflow — AWS Red Hat Enterprise Linux (RHEL 9 / 8) Deployment Guide

This guide provides the full blueprint and template to move **Fundflow** to an **AWS Red Hat Enterprise Linux (RHEL)** server.

---

## 🏗️ Architecture Overview

* **Host OS**: Red Hat Enterprise Linux 9 (x86_64) on AWS EC2 (Instance recommendation: `t3.medium` or higher, 2 vCPUs, 4GB RAM, 30GB gp3 EBS).
* **Runtime**: Node.js 20 LTS (NodeSource RPM).
* **Application Framework**: Next.js 16 (React 19, TypeScript, Standalone Output).
* **Process Management**: Native Linux `systemd` unit with automatic restart on failure and boot startup.
* **Web Server & Reverse Proxy**: Nginx with 50MB request body size (for large statement files), static asset caching, and security headers.
* **Firewall & Security**: `firewalld` (ports 80, 443, 22) + SELinux (`httpd_can_network_connect = 1`).
* **Database**: AWS RDS PostgreSQL (`database-1.cxqy6c4oohjo.ap-south-1.rds.amazonaws.com:5432`).
* **Storage**: AWS S3 Document Vault (`ledgerly-vault`).
* **Client Services**: Firebase Auth & Firestore (`fundflow-8e732`).

---

## 📁 Included Templates & Scripts

| File | Purpose |
| :--- | :--- |
| **[aws/cloudformation.yaml](file:///Users/ravimouni/fundflow/aws/cloudformation.yaml)** | Complete AWS CloudFormation template (EC2, Security Groups, IAM Role, UserData bootstrap). |
| **[deploy/setup-rhel.sh](file:///Users/ravimouni/fundflow/deploy/setup-rhel.sh)** | Shell script to configure any bare/existing RHEL 9 server from scratch. |
| **[deploy/deploy.sh](file:///Users/ravimouni/fundflow/deploy/deploy.sh)** | Application build and release script (dependencies, Next.js build, static assets, service reload). |

---

## 🚀 Option 1: Automated Launch via AWS CloudFormation

1. Open the **AWS CloudFormation Console** in your target region (e.g. `ap-south-1` Mumbai).
2. Click **Create stack** $\rightarrow$ **With new resources (standard)**.
3. Choose **Upload a template file** and select `aws/cloudformation.yaml`.
4. Enter Stack Details:
   * **Stack name**: `fundflow-production`
   * **KeyName**: Select your existing EC2 SSH key pair.
   * **InstanceType**: `t3.medium` (recommended) or `t3.small`.
5. Click **Next** $\rightarrow$ check **"I acknowledge that AWS CloudFormation might create IAM resources"** $\rightarrow$ **Submit**.
6. Once the stack status reaches `CREATE_COMPLETE`, view the **Outputs** tab to obtain the `PublicIP` and `WebsiteURL`.

---

## 🛠️ Option 2: Setup on an Existing / Fresh RHEL EC2 Instance

If you already launched a Red Hat Enterprise Linux 9 instance:

### Step 1: Connect to your RHEL instance
```bash
ssh -i /path/to/your-key.pem ec2-user@<YOUR_RHEL_IP>
```

### Step 2: Run the automated setup script
Clone or transfer the repository, then execute:
```bash
# Clone the repository to the standard app path
sudo mkdir -p /opt/fundflow
sudo chown -R ec2-user:ec2-user /opt/fundflow

git clone https://github.com/424ravikumarg/fundflow.git /opt/fundflow
cd /opt/fundflow

# Run the RHEL environment setup script (as root/sudo)
sudo bash deploy/setup-rhel.sh
```

### Step 3: Configure Production Environment Variables
Edit `/opt/fundflow/.env.local`:
```bash
sudo nano /opt/fundflow/.env.local
```
Add your production configuration:
```env
DATABASE_URL="postgresql://user:password@database-endpoint.ap-south-1.rds.amazonaws.com:5432/postgres"
AWS_ACCESS_KEY_ID="YOUR_AWS_ACCESS_KEY_ID"
AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_ACCESS_KEY"
AWS_REGION="ap-south-1"
S3_BUCKET_NAME="ledgerly-vault"

# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-app.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="your-measurement-id"
```
Secure file permissions:
```bash
sudo chown fundflow:fundflow /opt/fundflow/.env.local
sudo chmod 600 /opt/fundflow/.env.local
```

### Step 4: Build & Start the Service
```bash
sudo bash /opt/fundflow/deploy/deploy.sh
```

---

## 🔒 Step 5: Enabling Free HTTPS / SSL (Certbot)

Once your custom domain (e.g. `fundflow.yourdomain.com`) is pointed to the RHEL instance IP:

```bash
# Obtain and configure Let's Encrypt SSL certificate automatically
sudo certbot --nginx -d fundflow.yourdomain.com
```

Certbot will automatically install the certificate, configure HTTPS on port 443 in Nginx, and set up daily auto-renewal timers.

---

## 📊 Operational & Management Commands

* **Check Service Status**:
  ```bash
  sudo systemctl status fundflow
  ```
* **View Real-Time Application Logs**:
  ```bash
  sudo journalctl -u fundflow -f
  ```
* **Restart Application**:
  ```bash
  sudo systemctl restart fundflow
  ```
* **Reload Nginx Configuration**:
  ```bash
  sudo nginx -t && sudo systemctl reload nginx
  ```
* **Deploy Code Updates**:
  ```bash
  cd /opt/fundflow
  git pull origin main
  sudo bash deploy/deploy.sh
  ```
