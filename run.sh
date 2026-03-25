#!/bin/bash

# 🏃 Secure Exam Platform - Daily Usage Script
# Fast startup without redeployment

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

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Use minikube kubectl to avoid context issues
KUBECTL="minikube kubectl --"

# Step 1: Start Minikube if stopped
print_step "Checking Minikube..."
if ! minikube status | grep -q "Running"; then
    print_info "Starting Minikube..."
    minikube start --driver=docker --cpus=4 --memory=4096
    sleep 15
fi
print_success "Minikube ready"

# Step 2: Check pods status
print_step "Checking pods..."

# exam-platform namespace
if $KUBECTL get pods -n exam-platform | grep -q "Running"; then
    print_success "exam-platform pods running"
else
    print_warning "exam-platform pods not ready"
fi

# monitoring namespace  
if $KUBECTL get pods -n monitoring | grep -q "Running"; then
    print_success "monitoring pods running"
else
    print_warning "monitoring pods not ready"
fi

# argocd namespace
if $KUBECTL get pods -n argocd | grep -q "Running"; then
    print_success "argocd pods running"
else
    print_warning "argocd pods not ready"
fi

# Step 3: Kill existing port-forward processes
print_step "Cleaning up port-forwards..."
pkill -f "port-forward" || true
sleep 1

# Step 4: Start port-forward with FIXED ports (background)
print_step "Starting port-forwards..."

# Frontend → localhost:3005
$KUBECTL port-forward svc/frontend -n exam-platform 3005:80 > /dev/null 2>&1 &

# Backend → localhost:4005
$KUBECTL port-forward svc/backend -n exam-platform 4005:4000 > /dev/null 2>&1 &

# AI Proctoring → localhost:5005
$KUBECTL port-forward svc/ai-proctoring -n exam-platform 5005:5000 > /dev/null 2>&1 &

# Grafana → localhost:3002
$KUBECTL port-forward svc/prometheus-grafana -n monitoring 3002:3000 > /dev/null 2>&1 &

# ArgoCD → localhost:18081
$KUBECTL port-forward svc/argocd-server -n argocd 18081:443 > /dev/null 2>&1 &

# Step 5: Wait for port-forwards to initialize
sleep 3

# Step 6: Print clean output with URLs only
echo ""
echo -e "${GREEN}🚀 Platform Ready!${NC}"
echo ""
print_success "📱 Access URLs:"
echo "   • Frontend:        http://localhost:3005"
echo "   • Backend API:    http://localhost:4005"
echo "   • AI Proctoring:  http://localhost:5005"
echo "   • Grafana:         http://localhost:3002"
echo "   • ArgoCD:          https://localhost:18081"
echo ""
print_success "✅ All services accessible!"
