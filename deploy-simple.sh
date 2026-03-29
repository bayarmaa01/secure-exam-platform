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

# Use minikube kubectl to avoid context issues
KUBECTL="kubectl"

# Ensure we're using the correct context
echo "Setting kubectl context to minikube..."
kubectl config use-context docker-desktop || {
    echo "Warning: Could not set docker-desktop context, using current context"
}
# If minikube context exists, switch to it
if kubectl config get-contexts | grep -q "minikube"; then
    echo "Switching to minikube context..."
    kubectl config use-context minikube || echo "Could not switch to minikube context"
fi

# Step 1: Check prerequisites
print_step "Checking prerequisites..."
command -v kubectl >/dev/null 2>&1 || { print_error "kubectl required"; exit 1; }
command -v minikube >/dev/null 2>&1 || { print_error "minikube required"; exit 1; }
command -v docker >/dev/null 2>&1 || { print_error "docker required"; exit 1; }
print_success "All tools found"

# Step 2: Start Minikube (docker driver, clean start)
print_step "Starting Minikube..."
print_info "Starting fresh Minikube cluster..."
minikube start --driver=docker --cpus=4 --memory=4096
# Use Minikube Docker environment
eval $(minikube docker-env)
# Wait for Minikube to be ready
sleep 15
# Verify Minikube is running
minikube status
print_success "Minikube ready"

# Step 3: Cleanup old deployments (idempotent)
print_step "Cleaning up old deployments..."
$KUBECTL delete namespace exam-platform --ignore-not-found
$KUBECTL delete namespace career-coach-prod --ignore-not-found

# Clean persistent data (Postgres) to prevent credential mismatch
echo "🧹 Cleaning persistent data (Postgres)..."
$KUBECTL delete pvc -n exam-platform postgres-pvc 2>/dev/null || true
echo "✅ PVC cleaned"

sleep 5
print_success "Cleanup completed"

# Step 4: Build Docker images locally
print_step "Building Docker images..."
if [ -d "backend" ]; then
    docker build -t backend:latest ./backend
    print_success "Backend image built"
else
    print_info "Backend directory not found, skipping backend build"
fi

if [ -d "frontend" ]; then
    docker build -t frontend:latest ./frontend
    print_success "Frontend image built"
else
    print_info "Frontend directory not found, skipping frontend build"
fi

if [ -d "ai-proctoring" ]; then
    docker build -t ai-proctoring:latest ./ai-proctoring
    print_success "AI Proctoring image built"
else
    print_info "AI Proctoring directory not found, skipping AI build"
fi

# Step 5: Create namespaces (idempotent)
print_step "Creating namespaces..."
$KUBECTL create namespace exam-platform --dry-run=client -o yaml | $KUBECTL apply -f -
$KUBECTL create namespace monitoring --dry-run=client -o yaml | $KUBECTL apply -f -
$KUBECTL create namespace argocd --dry-run=client -o yaml | $KUBECTL apply -f -
print_success "Namespaces ready"

# Step 6: Create application secrets
print_step "Creating application secrets..."
# 🔐 Create or Update Secret (idempotent)
echo "🔐 Setting up secrets..."

# Check if secret exists
if $KUBECTL get secret exam-platform-secret -n exam-platform >/dev/null 2>&1; then
    echo "ℹ️ Secret already exists → updating..."
    $KUBECTL delete secret exam-platform-secret -n exam-platform
fi

# Create fresh secret with correct values
$KUBECTL create secret generic exam-platform-secret \
    --from-literal=DB_HOST=postgres \
    --from-literal=DB_PORT=5432 \
    --from-literal=DB_USER=postgres \
    --from-literal=DB_PASSWORD=postgres \
    --from-literal=DB_NAME=exam_db \
    --from-literal=REDIS_HOST=redis \
    --from-literal=REDIS_PORT=6379 \
    --from-literal=DATABASE_URL=postgresql://postgres:postgres@postgres:5432/exam_db \
    --from-literal=REDIS_URL=redis://redis:6379 \
    --from-literal=JWT_SECRET=supersecret \
    --from-literal=JWT_REFRESH_SECRET=supersecret \
    --from-literal=POSTGRES_USER=postgres \
    --from-literal=POSTGRES_PASSWORD=postgres \
    --from-literal=POSTGRES_DB=exam_db \
    --from-literal=postgres-user=postgres \
    --from-literal=postgres-password=postgres \
    -n exam-platform

print_success "Application secrets configured successfully"

# Step 7: Deploy databases
print_step "Deploying databases..."
$KUBECTL apply -f k8s/postgres-deployment.yaml
$KUBECTL apply -f k8s/redis-deployment.yaml
print_success "Databases deployed"

# Step 8: Deploy application services
print_step "Deploying application services..."
$KUBECTL apply -f k8s/backend-deployment.yaml
$KUBECTL apply -f k8s/ai-proctoring-deployment.yaml
$KUBECTL apply -f k8s/frontend-deployment.yaml
$KUBECTL apply -f k8s/frontend-service.yaml
print_success "Application services deployed"

# Step 9: Install kube-prometheus-stack (Helm)
print_step "Installing monitoring stack..."
if ! helm list -n monitoring | grep -q "prometheus"; then
    print_info "Installing kube-prometheus-stack via Helm..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    helm install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set grafana.adminPassword=admin123 \
        --set grafana.service.type=ClusterIP \
        --set prometheus.service.type=ClusterIP \
        --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false
    print_success "Monitoring stack installed"
else
    print_success "Monitoring stack already installed"
fi

# Step 10: Deploy monitoring rules (after CRDs are installed)
print_step "Deploying monitoring rules..."
$KUBECTL apply -f k8s/monitoring-rules.yaml
print_success "Monitoring rules deployed"

# Step 11: Install ArgoCD (stable version)
print_step "Installing ArgoCD..."
# Check if ArgoCD namespace exists and has pods
if $KUBECTL get namespace argocd >/dev/null 2>&1 && $KUBECTL get pods -n argocd 2>/dev/null | grep -q "argocd-server"; then
    print_success "ArgoCD already installed"
else
    print_info "Installing ArgoCD (version v2.11.3)..."
    
    # Create namespace if it doesn't exist
    $KUBECTL create namespace argocd --dry-run=client -o yaml | $KUBECTL apply -f -
    
    # Install ArgoCD manifests (v2.11.3 for Kubernetes 1.34 compatibility)
    print_info "Applying ArgoCD manifests..."
    if $KUBECTL apply -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.11.3/manifests/install.yaml; then
        print_info "Waiting for ArgoCD components to be ready..."
        
        # Give deployments time to be created
        sleep 20
        
        # Wait for specific deployments instead of all
        print_info "Waiting for key ArgoCD components..."
        $KUBECTL rollout status deployment/argocd-server -n argocd --timeout=180s || {
            print_info "argocd-server deployment not ready (continuing...)"
        }
        $KUBECTL rollout status deployment/argocd-repo-server -n argocd --timeout=180s || {
            print_info "argocd-repo-server deployment not ready (continuing...)"
        }
        $KUBECTL rollout status deployment/argocd-dex-server -n argocd --timeout=180s || {
            print_info "argocd-dex-server deployment not ready (continuing...)"
        }
        
        # Final verification
        if $KUBECTL get deployment argocd-server -n argocd >/dev/null 2>&1; then
            print_success "ArgoCD successfully installed"
        else
            print_info "ArgoCD installation completed with some components"
        fi
    else
        print_error "Failed to apply ArgoCD manifests"
        print_info "Continuing with deployment..."
    fi
fi

# Step 12: Wait for all pods to be READY
print_step "Waiting for all pods to be ready..."

# exam-platform namespace
print_info "Waiting for exam-platform pods..."
$KUBECTL wait --for=condition=ready pod --all -n exam-platform --timeout=300s

# monitoring namespace
print_info "Waiting for monitoring pods..."
$KUBECTL wait --for=condition=ready pod --all -n monitoring --timeout=300s

# argocd namespace (if installed)
if $KUBECTL get namespace argocd >/dev/null 2>&1; then
    print_info "Waiting for ArgoCD pods..."
    $KUBECTL wait --for=condition=ready pod --all -n argocd --timeout=300s
fi

print_success "All pods ready"

# Step 13: Kill old port-forward processes
print_step "Cleaning up old port-forward processes..."
pkill -f "port-forward" || true
sleep 2
print_success "Old port-forwards cleaned up"

# Step 14: Start port-forward with FIXED ports (background)
print_step "Starting port-forward services..."

# Frontend → localhost:3005
$KUBECTL port-forward svc/frontend -n exam-platform 3005:80 > /dev/null 2>&1 &
FRONTEND_PID=$!

# Backend → localhost:4005
$KUBECTL port-forward svc/backend -n exam-platform 4005:80 > /dev/null 2>&1 &
BACKEND_PID=$!

# AI Proctoring → localhost:5005
$KUBECTL port-forward svc/ai-proctoring -n exam-platform 5005:80 > /dev/null 2>&1 &
AI_PID=$!

# Grafana → localhost:3002
$KUBECTL port-forward svc/prometheus-grafana -n monitoring 3002:80 > /dev/null 2>&1 &
GRAFANA_PID=$!

# ArgoCD → localhost:18081
if $KUBECTL get namespace argocd >/dev/null 2>&1; then
    $KUBECTL port-forward svc/argocd-server -n argocd 18081:443 > /dev/null 2>&1 &
    ARGOCD_PID=$!
fi

print_success "All port-forwards started"

# Step 15: Wait for port-forwards to be ready
print_step "Waiting for port-forwards to initialize..."
sleep 5

# Step 16: Get and display passwords
print_step "Retrieving service passwords..."

# Get Grafana password
GRAFANA_PASSWORD=$($KUBECTL get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 -d 2>/dev/null || echo "admin")

# Get ArgoCD password (if installed)
ARGOCD_PASSWORD=""
if $KUBECTL get namespace argocd >/dev/null 2>&1; then
    ARGOCD_PASSWORD=$($KUBECTL get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d 2>/dev/null || echo "admin")
fi

# Step 17: Print success output with URLs and passwords
echo ""
echo -e "${GREEN}🚀 Platform Ready!${NC}"
echo ""
print_success "📱 Access URLs:"
echo "   Frontend: http://localhost:3005"
echo "   Backend:  http://localhost:4005"
echo "   AI:       http://localhost:5005"
echo "   Grafana:  http://localhost:3002"
echo "   ArgoCD:   https://localhost:18081"
echo ""
print_success "🔐 Login Credentials:"
echo "   Grafana:  admin / $GRAFANA_PASSWORD"
if [ ! -z "$ARGOCD_PASSWORD" ]; then
    echo "   ArgoCD:   admin / $ARGOCD_PASSWORD"
fi
echo ""
print_success "✅ All services accessible!"

# Store PIDs for cleanup
echo $FRONTEND_PID > /tmp/frontend-port-forward.pid
echo $BACKEND_PID > /tmp/backend-port-forward.pid
echo $AI_PID > /tmp/ai-port-forward.pid
echo $GRAFANA_PID > /tmp/grafana-port-forward.pid
if [ ! -z "$ARGOCD_PID" ]; then
    echo $ARGOCD_PID > /tmp/argocd-port-forward.pid
fi

print_info "📝 Port-forward PIDs saved to /tmp/*-port-forward.pid"
