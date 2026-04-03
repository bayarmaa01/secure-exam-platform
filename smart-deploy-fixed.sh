#!/bin/bash

# 🔧 SMART DEPLOY FIXED - Clean Working Version
# Uses deploy-simple.sh directly without complex logic

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
# MODE SELECTION
# ========================================
select_mode() {
    echo -e "${CYAN}🎯 Select deployment mode:${NC}"
    echo "1) FULL CLEAN DEPLOY (recommended)"
    echo "2) FAST DEPLOY (no deletion, quick restart)"
    echo ""
    
    while true; do
        read -p "Enter mode [1-2]: " choice
        case $choice in
            1)
                DEPLOY_MODE="FULL"
                print_success "Selected: FULL CLEAN DEPLOY"
                break
                ;;
            2)
                DEPLOY_MODE="FAST"
                print_success "Selected: FAST DEPLOY"
                break
                ;;
            *)
                print_error "Invalid choice. Please enter 1 or 2."
                ;;
        esac
    done
}

# ========================================
# CLUSTER CHECK
# ========================================
check_cluster() {
    print_step "Checking Kubernetes cluster..."
    
    if ! minikube kubectl -- cluster-info >/dev/null 2>&1; then
        print_error "Kubernetes cluster not accessible"
        print_info "Starting Minikube..."
        minikube start
        print_success "Minikube started"
    else
        print_success "Kubernetes cluster accessible"
    fi
}

# ========================================
# DEPLOYMENT FUNCTIONS
# ========================================
full_clean_deploy() {
    print_step "Starting FULL CLEAN DEPLOY..."
    
    # Clean up everything
    print_info "Cleaning up old deployments..."
    minikube kubectl -- delete namespace exam-platform --ignore-not-found=true --grace-period=0 >/dev/null 2>&1 || true
    minikube kubectl -- delete namespace monitoring --ignore-not-found=true --grace-period=0 >/dev/null 2>&1 || true
    minikube kubectl -- delete namespace argocd --ignore-not-found=true --grace-period=0 >/dev/null 2>&1 || true
    
    # Wait for cleanup
    sleep 15
    
    # Use the working deploy-simple.sh directly
    print_info "Running deploy-simple.sh..."
    if [[ -f "deploy-simple.sh" ]]; then
        ./deploy-simple.sh
        if [[ $? -eq 0 ]]; then
            print_success "Deployment completed successfully"
            display_credentials
            return 0
        else
            print_error "Deployment failed"
            return 1
        fi
    else
        print_error "deploy-simple.sh not found"
        return 1
    fi
}

fast_deploy() {
    print_step "Starting FAST DEPLOY..."
    
    # Only restart deployments, keep data
    print_info "Restarting existing deployments..."
    minikube kubectl -- rollout restart deployment/backend -n exam-platform >/dev/null 2>&1 || true
    minikube kubectl -- rollout restart deployment/frontend -n exam-platform >/dev/null 2>&1 || true
    minikube kubectl -- rollout restart deployment/ai-proctoring -n exam-platform >/dev/null 2>&1 || true
    minikube kubectl -- rollout restart deployment/postgres -n exam-platform >/dev/null 2>&1 || true
    minikube kubectl -- rollout restart deployment/redis -n exam-platform >/dev/null 2>&1 || true
    
    sleep 10
    display_credentials
}

# ========================================
# PASSWORD DISPLAY
# ========================================
display_credentials() {
    print_step "Retrieving service passwords..."
    
    # Get Grafana password
    local grafana_password=$(minikube kubectl -- get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 -d 2>/dev/null || echo "admin")
    
    # Get ArgoCD password
    local argocd_password=""
    if minikube kubectl -- get namespace argocd >/dev/null 2>&1; then
        argocd_password=$(minikube kubectl -- get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" 2>/dev/null | base64 -d 2>/dev/null || echo "admin")
    fi
    
    echo ""
    echo -e "${GREEN}🚀 Platform Ready!${NC}"
    echo ""
    print_success "📱 Access URLs:"
    echo "   Frontend: http://localhost:3005"
    echo "   Backend:  http://localhost:4005"
    echo "   AI:       http://localhost:5005"
    echo "   Grafana:  http://localhost:3002"
    if [[ ! -z "$argocd_password" ]]; then
        echo "   ArgoCD:   https://localhost:18081"
    fi
    echo ""
    print_success "🔐 Login Credentials:"
    echo "   Grafana:  admin / $grafana_password"
    if [[ ! -z "$argocd_password" ]]; then
        echo "   ArgoCD:   admin / $argocd_password"
    fi
    echo ""
    print_success "✅ All services accessible!"
}

# ========================================
# MAIN EXECUTION
# ========================================
main() {
    echo -e "${CYAN}🔧 SMART DEPLOY FIXED - Clean Working Version${NC}"
    echo ""
    
    # Select mode
    select_mode
    
    # Check cluster
    check_cluster
    
    # Execute based on mode
    case $DEPLOY_MODE in
        "FULL")
            full_clean_deploy
            ;;
        "FAST")
            fast_deploy
            ;;
    esac
}

# Execute main function
main "$@"
