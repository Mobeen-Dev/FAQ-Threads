# FAQ App - Deployment Guide

## Quick Start (Local Development)

```bash
# 1. Setup environment
./deploy.sh setup

# 2. Review and edit .env file
nano .env

# 3. Start all services
./deploy.sh up

# 4. View logs
./deploy.sh logs
```

## KVM/VPS Deployment

### Prerequisites

On your KVM server, install:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Git
sudo apt install git -y

# Logout and login again for docker group to take effect
```

### Initial Server Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/faq-app.git /opt/faq-app
cd /opt/faq-app

# 2. Run setup (generates secure secrets)
./deploy.sh setup

# 3. Edit configuration
nano .env
# Update:
#   - PUBLIC_BACKEND_URL (your domain or IP)
#   - FRONTEND_URL (your domain or IP)

# 4. Start services
./deploy.sh up --build

# 5. Verify everything is running
./deploy.sh status
```

### With Nginx Reverse Proxy (Production)

```bash
# Start with nginx profile
./deploy.sh up --prod --build

# This starts:
#   - PostgreSQL on internal network
#   - Backend on internal network
#   - Frontend on internal network
#   - Nginx on ports 80/443 (public)
```

### SSL/TLS Setup (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot -y

# Get certificate (stop nginx first)
docker compose stop nginx
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem deploy/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem deploy/nginx/ssl/

# Update nginx.conf for SSL (see deploy/nginx/nginx-ssl.conf.example)

# Restart
./deploy.sh restart --prod
```

## GitHub Actions CI/CD Setup

### 1. Required Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these **Repository Secrets**:

| Secret | Description | Example |
|--------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | `your-secure-db-password` |
| `JWT_SECRET` | JWT signing key (min 32 chars) | `generate-with-openssl-rand-hex-32` |
| `DEPLOY_HOST` | Server IP or hostname | `192.168.1.100` or `faq.yourdomain.com` |
| `DEPLOY_USER` | SSH username | `deploy` |
| `DEPLOY_KEY` | SSH private key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_PATH` | App path on server | `/opt/faq-app` |

Optional secrets:
| Secret | Description |
|--------|-------------|
| `PUBLIC_BACKEND_URL` | Public API URL |
| `SLACK_WEBHOOK_URL` | Slack notifications |

### 2. Environment Variables

Add these **Repository Variables** (Settings → Secrets → Variables):

| Variable | Description |
|----------|-------------|
| `STAGING_URL` | Staging frontend URL |
| `PRODUCTION_URL` | Production frontend URL |

### 3. SSH Key Setup

On your local machine:
```bash
# Generate deployment key
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key

# Copy public key to server
ssh-copy-id -i ~/.ssh/deploy_key.pub deploy@your-server

# Copy private key content to DEPLOY_KEY secret
cat ~/.ssh/deploy_key
```

### 4. Workflow Triggers

- **Push to `develop`** → Deploys to staging
- **Push to `main`** → Deploys to production
- **Manual trigger** → Choose environment

## Commands Reference

```bash
# Start services
./deploy.sh up              # Start in background
./deploy.sh up --prod       # Start with nginx
./deploy.sh up --build      # Rebuild images first

# Stop services
./deploy.sh down

# View status and logs
./deploy.sh status          # Show service health
./deploy.sh logs            # Follow all logs

# Database operations
./deploy.sh migrate         # Run Prisma migrations
./deploy.sh backup          # Backup database
./deploy.sh restore         # Restore latest backup
./deploy.sh restore ./backups/file.sql.gz  # Restore specific backup

# Maintenance
./deploy.sh restart         # Restart all services
./deploy.sh clean           # Remove everything (⚠️ destructive)
```

## Troubleshooting

### Services won't start
```bash
# Check logs
./deploy.sh logs

# Verify .env exists and has required values
cat .env | grep -E "DB_PASSWORD|JWT_SECRET"
```

### Database connection issues
```bash
# Check if database is healthy
docker exec faq-db pg_isready -U faquser

# View database logs
docker logs faq-db
```

### Frontend can't reach backend
```bash
# Verify backend is running
curl http://localhost:4004/api/health

# Check container network
docker network inspect faq-app_faq-network
```

### Reset everything
```bash
./deploy.sh clean
./deploy.sh setup
./deploy.sh up --build
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        KVM Server                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Docker Network                       │  │
│  │                                                       │  │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────────────┐   │  │
│  │   │  Nginx  │──▶│ Frontend │   │    PostgreSQL    │   │  │
│  │   │  :80    │    │  :3000  │    │      :5432      │   │  │
│  │   │  :443   │    └─────────┘    └─────────────────┘   │  │
│  │   └────┬────┘          │                 ▲            │  │
│  │        │               │                 │            │  │
│  │        │        ┌──────▼──────┐          │            │  │
│  │        └───────▶│   Backend   │─────────┘            │  │
│  │                 │    :4004    │                       │  │
│  │                 └─────────────┘                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Security Checklist

- [ ] Change default database password
- [ ] Generate strong JWT secret (32+ chars)
- [ ] Enable SSL/TLS in production
- [ ] Configure firewall (only expose 80/443)
- [ ] Set up automated backups
- [ ] Enable rate limiting (built-in)
- [ ] Review CORS settings for production
