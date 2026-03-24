#!/bin/bash

# 🚀 Secure Exam Platform - Simple First-Time Deployment
# One-command setup for Minikube with NodePort services

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

# Step 1: Prerequisites
print_step "Checking prerequisites..."
command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl required"; exit 1; }
command -v minikube >/dev/null 2>&1 || { echo "❌ minikube required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ docker required"; exit 1; }
print_success "All tools found"

# Step 2: Start Minikube
print_step "Starting Minikube..."
if ! minikube status | grep -q "Running"; then
    minikube start --driver=docker --cpus=4 --memory=4096
fi
print_success "Minikube running"

# Step 3: Create namespaces
print_step "Creating namespaces..."
kubectl create namespace exam-platform --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
print_success "Namespaces created"

# Step 4: Deploy databases
print_step "Deploying databases..."
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n exam-platform --timeout=300s
print_success "Databases ready"

# Step 5: Deploy application services
print_step "Deploying application services..."
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/ai-proctoring-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl wait --for=condition=ready pod -l app=backend -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=ai-proctoring -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n exam-platform --timeout=300s
print_success "Application services ready"

# Step 6: Deploy monitoring (optional)
print_step "Setting up monitoring..."
# Apply ServiceMonitor for Prometheus
kubectl apply -f monitoring/servicemonitor.yaml 2>/dev/null || print_info "No ServiceMonitor found"
print_success "Monitoring configured"

# Step 7: Setup ArgoCD (optional)
print_step "Setting up ArgoCD..."
kubectl apply -f argocd/application-fixed.yaml 2>/dev/null || print_info "No ArgoCD config found"
print_success "ArgoCD configured"

# Step 8: Display access information
print_step "Deployment complete! 🎉"
echo ""
print_info "📱 Access URLs:"
MINIKUBE_IP=$(minikube ip)
echo "   • Frontend:        http://$MINIKUBE_IP:30010"
echo "   • Backend API:    http://$MINIKUBE_IP:30011"
echo "   • AI Proctoring:  http://$MINIKUBE_IP:30012"
echo ""
print_info "🔧 Management Commands:"
echo "   • Check pods:       kubectl get pods -n exam-platform"
echo "   • Check services:   kubectl get svc -n exam-platform"
echo "   • View logs:        kubectl logs -f deployment/<name> -n exam-platform"
echo ""
print_info "🛑 To stop:       minikube stop"
echo ""
print_success "🚀 Your Secure Exam Platform is ready!"
echo ""
print_info "💡 Next: Run './run.sh' for daily access"
