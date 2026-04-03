#!/bin/bash
# =============================================================================
# Port Conflict Resolver for FAQ App
# =============================================================================
# This script checks for and resolves port conflicts before deployment
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}FAQ App - Port Conflict Resolver${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ ERROR: .env file not found in current directory${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Load ports from .env
source .env 2>/dev/null || true

# Set defaults if not in .env
FRONTEND_PORT=${FRONTEND_PORT:-3004}
BACKEND_PORT=${BACKEND_PORT:-4004}
DB_PORT=${DB_PORT:-5434}

echo -e "${YELLOW}📋 Configured Ports:${NC}"
echo "   Frontend: ${FRONTEND_PORT}"
echo "   Backend:  ${BACKEND_PORT}"
echo "   Database: ${DB_PORT}"
echo ""

# Function to check and kill process on port
check_and_free_port() {
    local port=$1
    local service=$2
    
    if sudo lsof -ti:$port >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $port ($service) is in use${NC}"
        
        # Check if it's a Docker container
        container=$(docker ps --filter "publish=$port" --format "{{.Names}}" 2>/dev/null | head -1)
        
        if [ -n "$container" ]; then
            echo "   Container using port: $container"
            read -p "   Stop container $container? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker stop "$container"
                docker rm "$container" 2>/dev/null || true
                echo -e "${GREEN}   ✅ Container stopped and removed${NC}"
            fi
        else
            # It's a regular process
            pid=$(sudo lsof -ti:$port)
            process=$(sudo ps -p $pid -o comm= 2>/dev/null || echo "unknown")
            echo "   Process using port: $process (PID: $pid)"
            read -p "   Kill process $pid? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sudo kill -9 $pid
                echo -e "${GREEN}   ✅ Process killed${NC}"
            fi
        fi
    else
        echo -e "${GREEN}✅ Port $port ($service) is free${NC}"
    fi
}

# Check all required ports
echo -e "${BLUE}🔍 Checking for port conflicts...${NC}"
echo ""

check_and_free_port $FRONTEND_PORT "Frontend"
check_and_free_port $BACKEND_PORT "Backend"
check_and_free_port $DB_PORT "Database"

echo ""
echo -e "${BLUE}🐳 Checking Docker containers...${NC}"
echo ""

# Stop FAQ app containers if running
if docker ps | grep -q "faq-"; then
    echo -e "${YELLOW}⚠️  FAQ app containers are running${NC}"
    read -p "Stop all FAQ app containers? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker stop faq-db faq-backend faq-frontend 2>/dev/null || true
        docker rm faq-db faq-backend faq-frontend 2>/dev/null || true
        echo -e "${GREEN}✅ All FAQ containers stopped${NC}"
    fi
else
    echo -e "${GREEN}✅ No FAQ app containers running${NC}"
fi

echo ""
echo -e "${BLUE}📊 Current Port Usage:${NC}"
echo ""

for port in $FRONTEND_PORT $BACKEND_PORT $DB_PORT; do
    if sudo lsof -ti:$port >/dev/null 2>&1; then
        process=$(sudo lsof -ti:$port | xargs -I {} sudo ps -p {} -o comm= 2>/dev/null | head -1)
        echo -e "   Port $port: ${RED}IN USE${NC} ($process)"
    else
        echo -e "   Port $port: ${GREEN}FREE${NC}"
    fi
done

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Port conflict check complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "💡 Next steps:"
echo "   1. Ensure all required ports are free"
echo "   2. Run: docker compose up -d"
echo "   3. Check status: docker compose ps"
echo ""
