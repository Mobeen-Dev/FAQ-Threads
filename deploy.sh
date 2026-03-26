#!/bin/bash
# =============================================================================
# FAQ App - Unified Deployment Script
# =============================================================================
# Usage:
#   ./deploy.sh [command] [options]
#
# Commands:
#   up          - Start all services (default)
#   down        - Stop all services
#   restart     - Restart all services
#   build       - Build Docker images
#   logs        - View logs
#   status      - Show service status
#   migrate     - Run database migrations
#   backup      - Backup database
#   restore     - Restore database from backup
#   clean       - Remove all containers, volumes, and images
#   setup       - Initial setup (create .env, generate secrets)
#
# Options:
#   --prod      - Use production profile (includes nginx)
#   --build     - Force rebuild images
#   --detach    - Run in background (default for up)
#   --follow    - Follow logs
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default values
COMMAND="${1:-up}"
COMPOSE_FILE="docker-compose.yml"
COMPOSE_PROFILES=""
COMPOSE_OPTS=""
BACKUP_DIR="./backups"

# Parse options
shift || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            COMPOSE_PROFILES="--profile production"
            ;;
        --build)
            COMPOSE_OPTS="$COMPOSE_OPTS --build"
            ;;
        --detach|-d)
            COMPOSE_OPTS="$COMPOSE_OPTS -d"
            ;;
        --follow|-f)
            FOLLOW_LOGS=true
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
    shift
done

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    local deps=("docker" "docker-compose")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            # Try docker compose (v2) if docker-compose not found
            if [[ "$dep" == "docker-compose" ]] && docker compose version &> /dev/null; then
                DOCKER_COMPOSE="docker compose"
                continue
            fi
            log_error "$dep is required but not installed."
            exit 1
        fi
    done
    DOCKER_COMPOSE="${DOCKER_COMPOSE:-docker-compose}"
}

check_env_file() {
    if [[ ! -f ".env" ]]; then
        log_warn ".env file not found!"
        log_info "Run './deploy.sh setup' to create one, or copy from .env.example"
        exit 1
    fi
}

generate_secret() {
    openssl rand -hex 32
}

# =============================================================================
# Commands
# =============================================================================

cmd_setup() {
    log_info "Setting up FAQ App deployment..."
    
    if [[ -f ".env" ]]; then
        log_warn ".env file already exists. Backup created at .env.backup"
        cp .env .env.backup
    fi
    
    # Copy example and generate secrets
    cp .env.example .env
    
    # Generate secure passwords
    DB_PASS=$(generate_secret)
    JWT_SEC=$(generate_secret)
    
    # Replace placeholders (works on both Linux and macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/CHANGE_ME_STRONG_PASSWORD_HERE/$DB_PASS/" .env
        sed -i '' "s/CHANGE_ME_GENERATE_SECURE_64_CHAR_SECRET/$JWT_SEC/" .env
    else
        sed -i "s/CHANGE_ME_STRONG_PASSWORD_HERE/$DB_PASS/" .env
        sed -i "s/CHANGE_ME_GENERATE_SECURE_64_CHAR_SECRET/$JWT_SEC/" .env
    fi
    
    log_success ".env file created with secure secrets"
    log_warn "Please review and update the following in .env:"
    echo "  - DEPLOY_HOST: Your server IP or domain"
    echo "  - PUBLIC_BACKEND_URL: Your public API URL"
    echo "  - DOCKER_IMAGE_PREFIX: Your Docker registry path"
    
    # Create required directories
    mkdir -p "$BACKUP_DIR"
    mkdir -p deploy/nginx/ssl
    
    log_success "Setup complete!"
}

cmd_build() {
    log_info "Building Docker images..."
    check_env_file
    
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" $COMPOSE_PROFILES build $COMPOSE_OPTS
    
    log_success "Build complete!"
}

cmd_up() {
    log_info "Starting FAQ App services..."
    check_env_file
    
    # Default to detached mode
    if [[ ! "$COMPOSE_OPTS" =~ "-d" ]]; then
        COMPOSE_OPTS="$COMPOSE_OPTS -d"
    fi
    
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" $COMPOSE_PROFILES up $COMPOSE_OPTS
    
    log_success "Services started!"
    log_info "Frontend: http://localhost:${FRONTEND_PORT:-3000}"
    log_info "Backend:  http://localhost:${BACKEND_PORT:-4004}"
    
    if [[ "$FOLLOW_LOGS" == "true" ]]; then
        cmd_logs
    fi
}

cmd_down() {
    log_info "Stopping FAQ App services..."
    
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" $COMPOSE_PROFILES down
    
    log_success "Services stopped!"
}

cmd_restart() {
    log_info "Restarting FAQ App services..."
    cmd_down
    cmd_up
}

cmd_logs() {
    log_info "Showing logs (Ctrl+C to exit)..."
    
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs -f --tail=100
}

cmd_status() {
    log_info "Service Status:"
    echo ""
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps
    echo ""
    
    log_info "Health Checks:"
    for service in db backend frontend; do
        status=$(docker inspect --format='{{.State.Health.Status}}' "faq-$service" 2>/dev/null || echo "not running")
        case $status in
            healthy)
                echo -e "  $service: ${GREEN}$status${NC}"
                ;;
            unhealthy)
                echo -e "  $service: ${RED}$status${NC}"
                ;;
            *)
                echo -e "  $service: ${YELLOW}$status${NC}"
                ;;
        esac
    done
}

cmd_migrate() {
    log_info "Running database migrations..."
    check_env_file
    
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec backend \
        node node_modules/prisma/build/index.js db push
    
    log_success "Migrations complete!"
}

cmd_backup() {
    log_info "Backing up database..."
    check_env_file
    
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/faq_app_$TIMESTAMP.sql.gz"
    
    source .env
    
    docker exec faq-db pg_dump -U "${DB_USER:-faquser}" "${DB_NAME:-faq_app}" | gzip > "$BACKUP_FILE"
    
    log_success "Database backed up to: $BACKUP_FILE"
    
    # Keep only last 7 backups
    ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm
    log_info "Old backups cleaned (keeping last 7)"
}

cmd_restore() {
    log_info "Restoring database from backup..."
    check_env_file
    
    # Find latest backup or use provided file
    BACKUP_FILE="${2:-$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)}"
    
    if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
        log_error "No backup file found. Usage: ./deploy.sh restore [backup_file]"
        exit 1
    fi
    
    log_warn "This will overwrite the current database!"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled."
        exit 0
    fi
    
    source .env
    
    gunzip -c "$BACKUP_FILE" | docker exec -i faq-db psql -U "${DB_USER:-faquser}" "${DB_NAME:-faq_app}"
    
    log_success "Database restored from: $BACKUP_FILE"
}

cmd_clean() {
    log_warn "This will remove all containers, volumes, and images!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Clean cancelled."
        exit 0
    fi
    
    log_info "Stopping services..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" down -v --rmi all
    
    log_success "Cleanup complete!"
}

cmd_help() {
    head -30 "$0" | tail -28
}

# =============================================================================
# Main
# =============================================================================

check_dependencies

case "$COMMAND" in
    setup)
        cmd_setup
        ;;
    build)
        cmd_build
        ;;
    up|start)
        cmd_up
        ;;
    down|stop)
        cmd_down
        ;;
    restart)
        cmd_restart
        ;;
    logs)
        cmd_logs
        ;;
    status|ps)
        cmd_status
        ;;
    migrate)
        cmd_migrate
        ;;
    backup)
        cmd_backup
        ;;
    restore)
        cmd_restore "$@"
        ;;
    clean)
        cmd_clean
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        cmd_help
        exit 1
        ;;
esac
