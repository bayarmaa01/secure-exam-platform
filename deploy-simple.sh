#!/bin/bash

# 🚀 Secure Exam Platform - Production Deployment Script
# One-command full deployment for Minikube with port-forward access

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

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Check prerequisites
print_step "Checking prerequisites..."
command -v kubectl >/dev/null 2>&1 || { print_error "kubectl required"; exit 1; }
command -v minikube >/dev/null 2>&1 || { print_error "minikube required"; exit 1; }
command -v docker >/dev/null 2>&1 || { print_error "docker required"; exit 1; }
print_success "All tools found"

# Step 2: Start Minikube (docker driver, no recreate if running)
print_step "Starting Minikube..."
if ! minikube status | grep -q "Running"; then
    print_info "Starting Minikube with docker driver..."
    minikube start --driver=docker --cpus=4 --memory=4096
else
    print_info "Minikube already running"
fi
print_success "Minikube ready"

# Step 3: Create namespaces (idempotent)
print_step "Creating namespaces..."
kubectl create namespace exam-platform --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
print_success "Namespaces ready"

# Step 4: Deploy databases
print_step "Deploying databases..."
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml
print_success "Databases deployed"

# Step 5: Deploy application services
print_step "Deploying application services..."
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/ai-proctoring-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
print_success "Application services deployed"

# Step 6: Deploy Grafana
print_step "Deploying Grafana..."
kubectl apply -f k8s/grafana.yaml
print_success "Grafana deployed"

# Step 7: Install ArgoCD (stable version)
print_step "Installing ArgoCD..."
if ! kubectl get pods -n argocd | grep -q "argocd-server"; then
    print_info "Installing ArgoCD v2.11.3..."
    kubectl apply -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.11.3/manifests/install.yaml
else
    print_info "ArgoCD already installed"
fi
print_success "ArgoCD installed"

# Step 8: Wait for all pods to be READY
print_step "Waiting for all pods to be ready..."

# exam-platform namespace
print_info "Waiting for exam-platform pods..."
kubectl wait --for=condition=ready pod -l app=postgres -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=backend -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=ai-proctoring -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n exam-platform --timeout=300s

# monitoring namespace
print_info "Waiting for monitoring pods..."
kubectl wait --for=condition=ready pod -l app=grafana -n monitoring --timeout=300s

# argocd namespace
print_info "Waiting for ArgoCD pods..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

print_success "All pods ready"

# Step 9: Kill old port-forward processes
print_step "Cleaning up old port-forward processes..."
pkill -f "port-forward" || true
sleep 2
print_success "Old port-forwards cleaned up"

# Step 10: Start port-forward with FIXED ports (background)
print_step "Starting port-forward services..."

# Frontend → localhost:3005
kubectl port-forward svc/frontend -n exam-platform 3005:80 > /dev/null 2>&1 &
FRONTEND_PID=$!

# Backend → localhost:4005
kubectl port-forward svc/backend -n exam-platform 4005:4000 > /dev/null 2>&1 &
BACKEND_PID=$!

# AI Proctoring → localhost:5005
kubectl port-forward svc/ai-proctoring -n exam-platform 5005:5000 > /dev/null 2>&1 &
AI_PID=$!

# Grafana → localhost:3002
kubectl port-forward svc/grafana -n monitoring 3002:3000 > /dev/null 2>&1 &
GRAFANA_PID=$!

# ArgoCD → localhost:18081
kubectl port-forward svc/argocd-server -n argocd 18081:443 > /dev/null 2>&1 &
ARGOCD_PID=$!

print_success "All port-forwards started"

# Step 11: Wait for port-forwards to be ready
print_step "Waiting for port-forwards to initialize..."
sleep 5

# Step 12: Fetch ArgoCD admin password
print_step "Fetching credentials..."
ARGOCD_PASSWORD=$(kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d 2>/dev/null || echo "argocd")

# Step 13: Print clean output with URLs and credentials
echo ""
echo -e "${GREEN}🚀 Deployment Complete! All services ready.${NC}"
echo ""
print_info "📱 Access URLs:"
echo "   • Frontend:        http://localhost:3005"
echo "   • Backend API:    http://localhost:4005"
echo "   • AI Proctoring:  http://localhost:5005"
echo "   • Grafana:         http://localhost:3002"
echo "   • ArgoCD:          https://localhost:18081"
echo ""
print_info "🔐 Login Credentials:"
echo "   • Grafana:         admin / admin123"
echo "   • ArgoCD:          admin / $ARGOCD_PASSWORD"
echo ""
print_info "🔧 Management Commands:"
echo "   • Check pods:       kubectl get pods -A"
echo "   • Check services:   kubectl get svc -A"
echo "   • View logs:        kubectl logs -f deployment/<name> -n <namespace>"
echo ""
print_info "🛑 To stop:       pkill -f 'port-forward' && minikube stop"
echo ""
print_success "🎉 Your Secure Exam Platform is ready!"

# Store PIDs for cleanup
echo $FRONTEND_PID > /tmp/frontend-port-forward.pid
echo $BACKEND_PID > /tmp/backend-port-forward.pid
echo $AI_PID > /tmp/ai-port-forward.pid
echo $GRAFANA_PID > /tmp/grafana-port-forward.pid
echo $ARGOCD_PID > /tmp/argocd-port-forward.pid

print_info "📝 Port-forward PIDs saved to /tmp/*-port-forward.pid"
