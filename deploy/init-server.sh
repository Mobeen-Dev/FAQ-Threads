#!/bin/bash
# =============================================================================
# FAQ App - KVM Server Initialization Script
# =============================================================================
# Run this script on a fresh KVM/VPS to set up the deployment environment
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/faq-app/main/deploy/init-server.sh | bash
#   # OR
#   wget -qO- https://raw.githubusercontent.com/YOUR_REPO/faq-app/main/deploy/init-server.sh | bash
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/faq-app}"
REPO_URL="${REPO_URL:-}"

# =============================================================================
# Pre-flight checks
# =============================================================================

if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

log_info "Starting FAQ App server initialization..."

# =============================================================================
# System updates
# =============================================================================

log_info "Updating system packages..."
apt update && apt upgrade -y

# =============================================================================
# Install Docker
# =============================================================================

if ! command -v docker &> /dev/null; then
    log_info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log_success "Docker installed"
else
    log_info "Docker already installed"
fi

# Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    log_info "Installing Docker Compose plugin..."
    apt install -y docker-compose-plugin
    log_success "Docker Compose installed"
fi

# =============================================================================
# Install additional tools
# =============================================================================

log_info "Installing additional tools..."
apt install -y \
    git \
    curl \
    wget \
    htop \
    nano \
    ufw \
    fail2ban \
    unzip \
    certbot

# =============================================================================
# Create deploy user
# =============================================================================

if ! id "$DEPLOY_USER" &>/dev/null; then
    log_info "Creating deploy user: $DEPLOY_USER"
    useradd -m -s /bin/bash "$DEPLOY_USER"
    usermod -aG docker "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    
    # Setup SSH for deploy user
    mkdir -p /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    touch /home/$DEPLOY_USER/.ssh/authorized_keys
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    
    log_success "Deploy user created"
    log_warn "Add your SSH public key to /home/$DEPLOY_USER/.ssh/authorized_keys"
else
    log_info "Deploy user already exists"
    usermod -aG docker "$DEPLOY_USER" 2>/dev/null || true
fi

# =============================================================================
# Configure firewall
# =============================================================================

log_info "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# Allow Docker networking
ufw allow from 172.16.0.0/12
ufw allow from 192.168.0.0/16

# Enable without prompt
echo "y" | ufw enable
log_success "Firewall configured (SSH, HTTP, HTTPS allowed)"

# =============================================================================
# Configure fail2ban
# =============================================================================

log_info "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

systemctl enable fail2ban
systemctl restart fail2ban
log_success "fail2ban configured"

# =============================================================================
# Create application directory
# =============================================================================

log_info "Setting up application directory..."
mkdir -p "$DEPLOY_PATH"
mkdir -p "$DEPLOY_PATH/backups"
chown -R $DEPLOY_USER:$DEPLOY_USER "$DEPLOY_PATH"

# =============================================================================
# Clone repository (if URL provided)
# =============================================================================

if [[ -n "$REPO_URL" ]]; then
    log_info "Cloning repository..."
    su - $DEPLOY_USER -c "git clone $REPO_URL $DEPLOY_PATH"
    log_success "Repository cloned"
fi

# =============================================================================
# Setup automatic backups
# =============================================================================

log_info "Setting up automatic backups..."
cat > /etc/cron.daily/faq-app-backup << EOF
#!/bin/bash
cd $DEPLOY_PATH
./deploy.sh backup 2>&1 | logger -t faq-backup
EOF
chmod +x /etc/cron.daily/faq-app-backup
log_success "Daily backups configured"

# =============================================================================
# Setup automatic updates
# =============================================================================

log_info "Configuring automatic security updates..."
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# =============================================================================
# Create systemd service for auto-start
# =============================================================================

log_info "Creating systemd service..."
cat > /etc/systemd/system/faq-app.service << EOF
[Unit]
Description=FAQ App Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$DEPLOY_PATH
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=$DEPLOY_USER
Group=docker

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable faq-app
log_success "Systemd service created (faq-app.service)"

# =============================================================================
# Print summary
# =============================================================================

echo ""
echo "============================================================================="
log_success "Server initialization complete!"
echo "============================================================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Add your SSH public key for the deploy user:"
echo "   echo 'your-public-key' >> /home/$DEPLOY_USER/.ssh/authorized_keys"
echo ""
echo "2. Clone or copy your application to: $DEPLOY_PATH"
echo ""
echo "3. Run the setup script:"
echo "   cd $DEPLOY_PATH"
echo "   ./deploy.sh setup"
echo ""
echo "4. Start the application:"
echo "   ./deploy.sh up --build"
echo ""
echo "5. (Optional) Set up SSL with Let's Encrypt:"
echo "   certbot certonly --standalone -d yourdomain.com"
echo ""
echo "============================================================================="
echo "Server Information:"
echo "  - Deploy user: $DEPLOY_USER"
echo "  - App path: $DEPLOY_PATH"
echo "  - Firewall: Enabled (SSH, HTTP, HTTPS)"
echo "  - fail2ban: Enabled"
echo "  - Auto-start: Enabled (systemctl status faq-app)"
echo "  - Backups: Daily at /etc/cron.daily/faq-app-backup"
echo "============================================================================="
