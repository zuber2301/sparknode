#!/bin/bash
# ===========================================
# SparkNode Port Management Script
# ===========================================
# Detects conflicts and manages Docker services

set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Default ports if not set
PROJECT_NAME=${PROJECT_NAME:-sparknode}
POSTGRES_EXTERNAL_PORT=${POSTGRES_EXTERNAL_PORT:-6432}
BACKEND_EXTERNAL_PORT=${BACKEND_EXTERNAL_PORT:-6100}
FRONTEND_EXTERNAL_PORT=${FRONTEND_EXTERNAL_PORT:-6173}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     SparkNode Port Management Utility     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a port is in use
check_port() {
    local port=$1
    local service=$2
    
    if lsof -i :$port > /dev/null 2>&1; then
        local pid=$(lsof -t -i :$port 2>/dev/null | head -1)
        local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        echo -e "${RED}✗${NC} Port $port ($service): ${RED}IN USE${NC} by $process (PID: $pid)"
        return 1
    else
        echo -e "${GREEN}✓${NC} Port $port ($service): ${GREEN}AVAILABLE${NC}"
        return 0
    fi
}

# Function to find next available port
find_available_port() {
    local start_port=$1
    local port=$start_port
    while lsof -i :$port > /dev/null 2>&1; do
        ((port++))
    done
    echo $port
}

case "${1:-check}" in
    check)
        echo -e "${YELLOW}Checking port availability for $PROJECT_NAME...${NC}"
        echo ""
        
        conflicts=0
        check_port $POSTGRES_EXTERNAL_PORT "PostgreSQL" || ((conflicts++))
        check_port $BACKEND_EXTERNAL_PORT "Backend API" || ((conflicts++))
        check_port $FRONTEND_EXTERNAL_PORT "Frontend" || ((conflicts++))
        
        echo ""
        if [ $conflicts -gt 0 ]; then
            echo -e "${RED}Found $conflicts port conflict(s)!${NC}"
            echo ""
            echo "To resolve, either:"
            echo "  1. Stop conflicting services"
            echo "  2. Update ports in .env file"
            echo "  3. Run: $0 suggest"
            exit 1
        else
            echo -e "${GREEN}All ports are available!${NC}"
        fi
        ;;
        
    suggest)
        echo -e "${YELLOW}Suggesting available ports...${NC}"
        echo ""
        
        new_pg=$(find_available_port $POSTGRES_EXTERNAL_PORT)
        new_be=$(find_available_port $BACKEND_EXTERNAL_PORT)
        new_fe=$(find_available_port $FRONTEND_EXTERNAL_PORT)
        
        echo "Recommended .env settings:"
        echo ""
        echo -e "${GREEN}POSTGRES_EXTERNAL_PORT=$new_pg${NC}"
        echo -e "${GREEN}BACKEND_EXTERNAL_PORT=$new_be${NC}"
        echo -e "${GREEN}FRONTEND_EXTERNAL_PORT=$new_fe${NC}"
        echo -e "${GREEN}CORS_ORIGINS=http://localhost:$new_fe${NC}"
        echo -e "${GREEN}VITE_API_URL=http://localhost:$new_be${NC}"
        ;;
        
    list)
        echo -e "${YELLOW}All ports in use (5xxx-9xxx range):${NC}"
        echo ""
        lsof -i -P -n | grep LISTEN | grep -E ':[5-9][0-9]{3} ' | awk '{print $1, $9}' | sort -t: -k2 -n | uniq
        ;;
        
    start)
        echo -e "${YELLOW}Starting $PROJECT_NAME services...${NC}"
        
        # Check ports first
        $0 check || { echo -e "${RED}Please resolve port conflicts first${NC}"; exit 1; }
        
        # Stop old containers if running
        docker-compose down 2>/dev/null || true
        
        # Start services
        docker-compose up -d --build
        
        echo ""
        echo -e "${GREEN}Services started!${NC}"
        echo ""
        echo "Access points:"
        echo -e "  Frontend: ${BLUE}http://localhost:$FRONTEND_EXTERNAL_PORT${NC}"
        echo -e "  Backend:  ${BLUE}http://localhost:$BACKEND_EXTERNAL_PORT${NC}"
        echo -e "  API Docs: ${BLUE}http://localhost:$BACKEND_EXTERNAL_PORT/docs${NC}"
        echo -e "  Database: ${BLUE}localhost:$POSTGRES_EXTERNAL_PORT${NC}"
        ;;
        
    stop)
        echo -e "${YELLOW}Stopping $PROJECT_NAME services...${NC}"
        docker-compose down
        echo -e "${GREEN}Services stopped.${NC}"
        ;;
        
    status)
        echo -e "${YELLOW}Service Status:${NC}"
        echo ""
        docker-compose ps
        ;;
        
    *)
        echo "Usage: $0 {check|suggest|list|start|stop|status}"
        echo ""
        echo "Commands:"
        echo "  check   - Check if configured ports are available"
        echo "  suggest - Suggest available ports if conflicts exist"
        echo "  list    - List all ports currently in use"
        echo "  start   - Start all services (checks ports first)"
        echo "  stop    - Stop all services"
        echo "  status  - Show service status"
        ;;
esac
