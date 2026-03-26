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
KUBECTL="minikube kubectl --"

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
# Wait for Minikube to be ready
sleep 15
# Verify Minikube is running
minikube status
print_success "Minikube ready"

# Step 3: Create namespaces (idempotent)
print_step "Creating namespaces..."
$KUBECTL create namespace exam-platform --dry-run=client -o yaml | $KUBECTL apply -f -
$KUBECTL create namespace monitoring --dry-run=client -o yaml | $KUBECTL apply -f -
$KUBECTL create namespace argocd --dry-run=client -o yaml | $KUBECTL apply -f -
print_success "Namespaces ready"

# Step 4: Create application secrets
print_step "Creating application secrets..."
# Ensure namespace exists before creating secret
$KUBECTL create namespace exam-platform --dry-run=client -o yaml | $KUBECTL apply -f -
# Create the required secret idempotently
$KUBECTL create secret generic exam-platform-secret \
  --from-literal=POSTGRES_USER=exam_user \
  --from-literal=POSTGRES_PASSWORD=exam_password \
  --from-literal=POSTGRES_DB=exam_platform \
  --from-literal=DATABASE_URL=postgresql://exam_user:exam_password@postgres:5432/exam_platform \
  --namespace=exam-platform \
  --dry-run=client -o yaml | $KUBECTL apply -f -
print_success "Application secrets created"

# Step 5: Deploy databases
print_step "Deploying databases..."
$KUBECTL apply -f k8s/postgres-deployment.yaml
$KUBECTL apply -f k8s/redis-deployment.yaml
print_success "Databases deployed"

# Step 6: Deploy application services
print_step "Deploying application services..."
$KUBECTL apply -f k8s/backend-deployment.yaml
$KUBECTL apply -f k8s/ai-proctoring-deployment.yaml
$KUBECTL apply -f k8s/frontend-deployment.yaml
print_success "Application services deployed"

# Step 7: Install kube-prometheus-stack (Helm)
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

# Step 8: Deploy monitoring rules (after CRDs are installed)
print_step "Deploying monitoring rules..."
$KUBECTL apply -f k8s/monitoring-rules.yaml
print_success "Monitoring rules deployed"

# Step 9: Install ArgoCD (stable version)
print_step "Installing ArgoCD..."
if ! $KUBECTL get pods -n argocd 2>/dev/null | grep -q "argocd-server"; then
    print_info "Cleaning old ArgoCD resources..."
    $KUBECTL delete crd applications.argoproj.io 2>/dev/null || true
    $KUBECTL delete crd appprojects.argoproj.io 2>/dev/null || true
    $KUBECTL delete namespace argocd 2>/dev/null || true
    
    # Wait for namespace to be fully deleted
    print_info "Waiting for namespace deletion..."
    while $KUBECTL get namespace argocd >/dev/null 2>&1; do
        echo -n "."
        sleep 2
    done
    echo " Done"
    
    # Safe re-creation
    print_info "Installing ArgoCD v2.11.3..."
    $KUBECTL create namespace argocd --dry-run=client -o yaml | $KUBECTL apply -f -
    
    # Install ArgoCD with retry logic
    local max_retries=3
    local retry_count=0
    local install_success=false
    
    while [ $retry_count -lt $max_retries ] && [ "$install_success" = false ]; do
        print_info "Installation attempt $((retry_count + 1)) of $max_retries..."
        
        if $KUBECTL apply -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.11.3/manifests/install.yaml; then
            sleep 15
            
            # Validate installation
            print_info "Validating ArgoCD installation..."
            if $KUBECTL get deployments -n argocd | grep -q "argocd-server"; then
                print_info "Waiting for ArgoCD to be ready..."
                
                # Wait for ALL ArgoCD deployments to be available
                if $KUBECTL wait --for=condition=available deployment --all -n argocd --timeout=180s; then
                    # Final verification
                    if $KUBECTL get deployment argocd-server -n argocd >/dev/null 2>&1; then
                        install_success=true
                        print_success "ArgoCD successfully installed"
                    else
                        print_error "argocd-server deployment not found after installation"
                    fi
                else
                    print_error "Timeout waiting for ArgoCD deployments to be ready"
                fi
            else
                print_error "argocd-server deployment not found in namespace"
            fi
        else
            print_error "Failed to apply ArgoCD manifests"
        fi
        
        if [ "$install_success" = false ]; then
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                print_info "Cleaning up for retry..."
                $KUBECTL delete namespace argocd 2>/dev/null || true
                while $KUBECTL get namespace argocd >/dev/null 2>&1; do
                    sleep 2
                done
                $KUBECTL create namespace argocd --dry-run=client -o yaml | $KUBECTL apply -f -
                sleep 5
            fi
        fi
    done
    
    if [ "$install_success" = false ]; then
        print_error "Failed to install ArgoCD after $max_retries attempts"
        exit 1
    fi
else
    print_success "ArgoCD already installed"
fi

# Step 10: Wait for all pods to be READY
print_step "Waiting for all pods to be ready..."

# exam-platform namespace
print_info "Waiting for exam-platform pods..."
$KUBECTL wait --for=condition=ready pod -l app=postgres -n exam-platform --timeout=300s
$KUBECTL wait --for=condition=ready pod -l app=redis -n exam-platform --timeout=300s
$KUBECTL wait --for=condition=ready pod -l app=backend -n exam-platform --timeout=300s
$KUBECTL wait --for=condition=ready pod -l app=ai-proctoring -n exam-platform --timeout=300s
$KUBECTL wait --for=condition=ready pod -l app=frontend -n exam-platform --timeout=300s

# monitoring namespace
print_info "Waiting for monitoring pods..."
$KUBECTL wait --for=condition=ready pod -l app=grafana -n monitoring --timeout=300s

# argocd namespace
print_info "Waiting for ArgoCD pods..."
$KUBECTL wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

print_success "All pods ready"

# Step 11: Kill old port-forward processes
print_step "Cleaning up old port-forward processes..."
pkill -f "port-forward" || true
sleep 2
print_success "Old port-forwards cleaned up"

# Step 12: Start port-forward with FIXED ports (background)
print_step "Starting port-forward services..."

# Frontend → localhost:3005
$KUBECTL port-forward svc/frontend -n exam-platform 3005:80 > /dev/null 2>&1 &
FRONTEND_PID=$!

# Backend → localhost:4005
$KUBECTL port-forward svc/backend -n exam-platform 4005:4000 > /dev/null 2>&1 &
BACKEND_PID=$!

# AI Proctoring → localhost:5005
$KUBECTL port-forward svc/ai-proctoring -n exam-platform 5005:5000 > /dev/null 2>&1 &
AI_PID=$!

# Grafana → localhost:3002
$KUBECTL port-forward svc/prometheus-grafana -n monitoring 3002:3000 > /dev/null 2>&1 &
GRAFANA_PID=$!

# ArgoCD → localhost:18081
$KUBECTL port-forward svc/argocd-server -n argocd 18081:443 > /dev/null 2>&1 &
ARGOCD_PID=$!

print_success "All port-forwards started"

# Step 13: Wait for port-forwards to be ready
print_step "Waiting for port-forwards to initialize..."
sleep 5

# Step 14: Fetch ArgoCD admin password
print_step "Fetching credentials..."
ARGOCD_PASSWORD=$($KUBECTL get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d 2>/dev/null || echo "argocd")

# Step 15: Print clean output with URLs and credentials
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
