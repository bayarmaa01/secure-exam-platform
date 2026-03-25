#!/bin/bash

# 🚀 Secure Exam Platform - First-Time Setup Script
# Production deployment with proper separation of concerns

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

# Step 1: Check prerequisites
print_info "Checking prerequisites..."
command -v kubectl >/dev/null 2>&1 || { print_error "kubectl required"; exit 1; }
command -v minikube >/dev/null 2>&1 || { print_error "minikube required"; exit 1; }
command -v helm >/dev/null 2>&1 || { print_error "helm required"; exit 1; }
print_ok "All tools found"

# Step 2: Start Minikube
print_info "Starting Minikube..."
if ! minikube status | grep -q "Running"; then
    minikube start --driver=docker --cpus=4 --memory=4096
else
    print_ok "Minikube already running"
fi

# Step 3: Create namespaces
print_info "Creating namespaces..."
kubectl create namespace exam-platform --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
print_ok "Namespaces created"

# Step 4: Install ArgoCD (official manifest only)
print_info "Installing ArgoCD..."
if ! kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server 2>/dev/null | grep -q "Running"; then
    print_info "Installing ArgoCD from official manifest..."
    kubectl apply -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.11.3/manifests/install.yaml
    kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s
    print_ok "ArgoCD installed"
else
    print_ok "ArgoCD already installed"
fi

# Step 5: Install kube-prometheus-stack (Helm)
print_info "Installing monitoring stack..."
if ! helm list -n monitoring | grep -q "prometheus"; then
    print_info "Installing kube-prometheus-stack via Helm..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    helm install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set grafana.adminPassword=admin123 \
        --set grafana.service.type=ClusterIP \
        --set prometheus.service.type=ClusterIP
    print_ok "Monitoring stack installed"
else
    print_ok "Monitoring stack already installed"
fi

# Step 6: Remove ArgoCD/Grafana manifests from k8s folder
print_info "Cleaning up conflicting manifests..."
rm -f k8s/argocd.yaml k8s/grafana.yaml 2>/dev/null || true

# Step 7: Deploy application services only
print_info "Deploying application services..."
kubectl apply -f k8s/
print_ok "Application services deployed"

# Step 8: Wait for application pods
print_info "Waiting for application pods..."
kubectl wait --for=condition=ready pod -l app=postgres -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=backend -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=ai-proctoring -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n exam-platform --timeout=300s
print_ok "All application pods ready"

# Step 9: Get credentials
print_info "Fetching credentials..."
ARGOCD_PASSWORD=$(kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d 2>/dev/null || echo "argocd")
GRAFANA_PASSWORD=$(kubectl get secret -n monitoring prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d 2>/dev/null || echo "admin123")

# Step 10: Start port-forwards
print_info "Starting port-forwards..."
pkill -f "port-forward" || true
sleep 2

# ArgoCD → 18081
kubectl port-forward svc/argocd-server -n argocd 18081:443 > /dev/null 2>&1 &
ARGOCD_PID=$!

# Grafana → 13000
kubectl port-forward svc/prometheus-grafana -n monitoring 13000:80 > /dev/null 2>&1 &
GRAFANA_PID=$!

# Frontend via minikube service
MINIKUBE_IP=$(minikube ip)
FRONTEND_URL="http://$MINIKUBE_IP:$(kubectl get svc frontend -n exam-platform -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo '30010')"

sleep 3

# Step 11: Print access information
echo ""
print_ok "🚀 Deployment Complete!"
echo ""
print_info "📱 Access URLs:"
echo "   • ArgoCD:          https://localhost:18081"
echo "   • Grafana:         http://localhost:13000"
echo "   • Frontend:        $FRONTEND_URL"
echo ""
print_info "🔐 Credentials:"
echo "   • ArgoCD:          admin / $ARGOCD_PASSWORD"
echo "   • Grafana:         admin / $GRAFANA_PASSWORD"
echo ""
print_ok "✅ All services ready!"

# Save PIDs for cleanup
echo $ARGOCD_PID > /tmp/argocd-port-forward.pid
echo $GRAFANA_PID > /tmp/grafana-port-forward.pid
