#!/bin/bash

# 🚀 DEVOPS SMART - Simple Working Deployment Script
# No errors, no complex logic, just working deployment

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# ========================================
# MAIN DEPLOYMENT
# ========================================
main() {
    echo -e "${CYAN}🚀 DEVOPS SMART - Simple Working Deployment${NC}"
    echo ""
    
    print_step "Starting deployment..."
    
    # Check if deploy-simple.sh exists
    if [[ ! -f "deploy-simple.sh" ]]; then
        print_error "deploy-simple.sh not found!"
        exit 1
    fi
    
    # Make it executable
    chmod +x deploy-simple.sh
    
    print_info "Running deploy-simple.sh (this will take 5-10 minutes)..."
    echo ""
    
    # Run the working deploy script
    ./deploy-simple.sh
    
    # Check result
    if [[ $? -eq 0 ]]; then
        print_success "Deployment completed successfully!"
        echo ""
        print_success "🚀 Platform Ready!"
        echo ""
        print_success "📱 Access URLs:"
        echo "   Frontend: http://localhost:3005"
        echo "   Backend:  http://localhost:4005"
        echo "   AI:       http://localhost:5005"
        echo "   Grafana:  http://localhost:3002"
        echo ""
        print_success "🔐 Use run.sh to get passwords and start services"
        echo ""
        print_success "✅ All services accessible!"
    else
        print_error "Deployment failed"
        exit 1
    fi
}

# Execute main function
main "$@"
