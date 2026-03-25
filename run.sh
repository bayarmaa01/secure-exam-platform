#!/bin/bash

# 🏃 Secure Exam Platform - Daily Run Script
# Fast restart without reinstalling monitoring/ArgoCD

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Step 1: Start Minikube if needed
print_info "Checking Minikube..."
if ! minikube status | grep -q "Running"; then
    minikube start --driver=docker
else
    print_ok "Minikube already running"
fi

# Step 2: Apply only application manifests (ignore ArgoCD/monitoring)
print_info "Updating application services..."
kubectl apply -f k8s/

# Step 3: Restart deployments if needed
print_info "Restarting application deployments..."
kubectl rollout restart deployment/backend -n exam-platform 2>/dev/null || true
kubectl rollout restart deployment/ai-proctoring -n exam-platform 2>/dev/null || true
kubectl rollout restart deployment/frontend -n exam-platform 2>/dev/null || true

# Step 4: Wait for application pods
print_info "Waiting for application pods..."
kubectl wait --for=condition=ready pod -l app=backend -n exam-platform --timeout=120s 2>/dev/null || true
kubectl wait --for=condition=ready pod -l app=ai-proctoring -n exam-platform --timeout=120s 2>/dev/null || true
kubectl wait --for=condition=ready pod -l app=frontend -n exam-platform --timeout=120s 2>/dev/null || true

# Step 5: Start application port-forwards only
print_info "Starting application port-forwards..."
pkill -f "port-forward.*frontend\|port-forward.*backend\|port-forward.*ai-proctoring" 2>/dev/null || true
sleep 2

# Frontend → minikube service (no port-forward needed)
MINIKUBE_IP=$(minikube ip)
FRONTEND_URL="http://$MINIKUBE_IP:$(kubectl get svc frontend -n exam-platform -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo '30010')"

# Backend & AI via port-forward (optional, for development)
kubectl port-forward svc/backend -n exam-platform 4005:4000 > /dev/null 2>&1 &
kubectl port-forward svc/ai-proctoring -n exam-platform 5005:5000 > /dev/null 2>&1 &

sleep 3

# Step 6: Print service URLs only
echo ""
print_ok "🚀 Application Services Ready!"
echo ""
print_info "📱 Service URLs:"
echo "   • Frontend:        $FRONTEND_URL"
echo "   • Backend API:    http://localhost:4005 (dev access)"
echo "   • AI Proctoring:  http://localhost:5005 (dev access)"
echo ""
print_info "💡 Note: ArgoCD and Grafana are managed separately"
print_ok "✅ Application services accessible!"
