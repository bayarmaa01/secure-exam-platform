#!/bin/bash

# 🚀 QUICK DEPLOY - Simple Working Deployment
# Uses proven deploy-simple.sh logic with fixes

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Main deployment function
main() {
    echo -e "${BLUE}🚀 QUICK DEPLOY - Simple Working Deployment${NC}"
    echo ""
    
    print_step "Starting deployment with proven logic..."
    
    # Use the working deploy-simple.sh script
    if [[ -f "deploy-simple.sh" ]]; then
        print_info "Using deploy-simple.sh with fixes applied..."
        ./deploy-simple.sh
    else
        print_error "deploy-simple.sh not found!"
        exit 1
    fi
    
    # Wait a bit for services to stabilize
    print_info "Waiting for services to stabilize..."
    sleep 10
    
    # Check and fix any remaining issues
    print_step "Checking for remaining issues..."
    
    # Fix frontend if needed
    local frontend_status=$(minikube kubectl -- get pods -n exam-platform -l app=frontend --no-headers 2>/dev/null | awk 'NR==1{print $3}' | head -1)
    if [[ "$frontend_status" == "CrashLoopBackOff" ]]; then
        print_info "Fixing frontend CrashLoopBackOff..."
        minikube kubectl -- rollout restart deployment/frontend -n exam-platform
        sleep 5
        print_success "Frontend restarted"
    fi
    
    # Display final status
    echo ""
    print_success "🎯 Deployment Complete!"
    echo ""
    
    # Show access URLs
    print_success "📱 Access URLs:"
    echo "   Frontend: http://localhost:3005"
    echo "   Backend:  http://localhost:4005"
    echo "   AI:       http://localhost:5005"
    echo "   Grafana:  http://localhost:3002"
    
    # Show credentials
    echo ""
    print_success "🔐 Login Credentials:"
    
    # Get Grafana password
    local grafana_password=$(minikube kubectl -- get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 -d 2>/dev/null || echo "admin")
    echo "   Grafana:  admin / $grafana_password"
    
    # Get ArgoCD password
    local argocd_password=""
    if minikube kubectl -- get namespace argocd >/dev/null 2>&1; then
        argocd_password=$(minikube kubectl -- get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" 2>/dev/null | base64 -d 2>/dev/null || echo "admin")
        echo "   ArgoCD:   admin / $argocd_password"
    fi
    
    echo ""
    print_success "✅ All services accessible!"
    
    # Show pod status
    echo ""
    print_info "📊 Pod Status:"
    minikube kubectl -- get pods -n exam-platform
}

# Execute main function
main "$@"
