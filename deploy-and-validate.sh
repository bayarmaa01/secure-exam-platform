#!/bin/bash

# 🔒 Secure Exam Platform - Production Deployment & Validation
# Azure VM: 4.247.154.224 | Domain: secure-exam.duckdns.org

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Secure Exam Platform Production Deployment${NC}"
echo "=================================================="

# Step 1: Clean up existing containers
echo -e "\n${YELLOW}🧹 Cleaning up existing containers...${NC}"
docker-compose down --remove-orphans || true
docker system prune -f

# Step 2: Build and start services
echo -e "\n${BLUE}🔨 Building and starting all services...${NC}"
docker-compose up -d --build

# Step 3: Wait for services to initialize
echo -e "\n${YELLOW}⏳ Waiting for services to initialize (60 seconds)...${NC}"
sleep 60

# Step 4: Check container status
echo -e "\n${BLUE}📋 Checking container status...${NC}"
docker-compose ps

# Step 5: Run comprehensive validation
echo -e "\n${BLUE}🧪 Running comprehensive validation...${NC}"
chmod +x validate-production.sh
./validate-production.sh

# Step 6: Display final information
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
    echo "=================================================="
    echo -e "${GREEN}✅ SYSTEM FULLY PRODUCTION READY${NC}"
    echo ""
    echo -e "${BLUE}🌐 APPLICATION URLS:${NC}"
    echo "   Main App:        http://secure-exam.duckdns.org"
    echo "   Direct IP:       http://4.247.154.224"
    echo "   Frontend Direct: http://4.247.154.224:3005"
    echo "   Backend API:     http://4.247.154.224:4005/api"
    echo "   AI Proctoring:   http://4.247.154.224:5005"
    echo ""
    echo -e "${BLUE}📊 MONITORING URLS:${NC}"
    echo "   Grafana:         http://4.247.154.224:3002"
    echo "   Prometheus:      http://4.247.154.224:9092"
    echo ""
    echo -e "${BLUE}🔐 CREDENTIALS:${NC}"
    echo "   Grafana:         admin / SecureGrafanaAdmin2024!"
    echo "   Database:        postgres / SecureExamPlatform2024!"
    echo ""
    echo -e "${BLUE}📝 USEFUL COMMANDS:${NC}"
    echo "   View logs:        docker-compose logs -f [service]"
    echo "   Restart:          docker-compose restart"
    echo "   Stop:             docker-compose down"
    echo "   Validate again:    ./validate-production.sh"
    echo ""
    echo -e "${GREEN}🎯 NEXT STEPS:${NC}"
    echo "   1. Configure DNS: secure-exam.duckdns.org → 4.247.154.224"
    echo "   2. Set up SSL certificate (optional)"
    echo "   3. Configure backup for database"
    echo "   4. Set up monitoring alerts"
    echo ""
else
    echo -e "\n${RED}❌ DEPLOYMENT FAILED!${NC}"
    echo "=================================================="
    echo -e "${RED}Please check the validation errors above and fix issues.${NC}"
    echo -e "${YELLOW}Common fixes:${NC}"
    echo "   - Check if ports are available"
    echo "   - Verify Docker is running"
    echo "   - Check container logs: docker-compose logs [service]"
    echo "   - Re-run deployment: ./deploy-and-validate.sh"
    exit 1
fi
