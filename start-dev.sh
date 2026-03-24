#!/bin/bash

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 1. Check Minikube status
log_info "Checking Minikube cluster status..."
if ! minikube status | grep -q "Running"; then
    log_info "Starting Minikube cluster..."
    minikube start --cpus=2 --memory=4096
    log_success "Minikube cluster started"
else
    log_success "Minikube cluster already running"
fi

# 2. Verify Kubernetes
log_info "Verifying Kubernetes connectivity..."
if ! kubectl get nodes > /dev/null 2>&1; then
    log_error "Kubernetes connectivity failed"
    exit 1
fi
log_success "Kubernetes connectivity verified"

# 3. Auto-recover pods
log_info "Checking pod status..."
CRASHING_PODS=$(kubectl get pods -A --no-headers 2>/dev/null | grep -c "CrashLoopBackOff\|Error" || true)
if [ "$CRASHING_PODS" -gt 0 ]; then
    log_info "Found $CRASHING_PODS problematic pods, restarting deployments..."
    kubectl rollout restart deployment --all -A 2>/dev/null || true
    sleep 5
    log_success "Pod restart initiated"
else
    log_success "All pods running normally"
fi

# 4. Start Minikube tunnel
log_info "Starting Minikube tunnel for ingress..."
if ! pgrep -f "minikube tunnel" > /dev/null; then
    minikube tunnel > /dev/null 2>&1 &
    TUNNEL_PID=$!
    sleep 5
    if pgrep -f "minikube tunnel" > /dev/null; then
        log_success "Minikube tunnel started (PID: $TUNNEL_PID)"
    else
        log_error "Failed to start Minikube tunnel"
        exit 1
    fi
else
    log_success "Minikube tunnel already running"
fi

# 5. Get Minikube IP
MINIKUBE_IP=$(minikube ip 2>/dev/null || echo "127.0.0.1")

# 6. Start Grafana port-forward (find available port)
log_info "Starting Grafana port-forward..."
if ! pgrep -f "kubectl port-forward.*grafana" > /dev/null; then
    # Find available port starting from 3002
    GRAFANA_LOCAL_PORT=3002
    while netstat -tlnp 2>/dev/null | grep ":$GRAFANA_LOCAL_PORT " > /dev/null; do
        GRAFANA_LOCAL_PORT=$((GRAFANA_LOCAL_PORT + 1))
        if [ $GRAFANA_LOCAL_PORT -gt 3010 ]; then
            log_error "No available ports found for Grafana"
            break
        fi
    done
    
    # Check if Grafana service exists
    if kubectl get svc prometheus-grafana -n monitoring > /dev/null 2>&1; then
        kubectl port-forward svc/prometheus-grafana -n monitoring $GRAFANA_LOCAL_PORT:80 > /dev/null 2>&1 &
        GRAFANA_PID=$!
        sleep 2
        if pgrep -f "kubectl port-forward.*grafana" > /dev/null; then
            log_success "Grafana port-forward started on port $GRAFANA_LOCAL_PORT (PID: $GRAFANA_PID)"
        else
            log_error "Failed to start Grafana port-forward"
            GRAFANA_LOCAL_PORT="N/A"
        fi
    else
        log_info "Grafana service not found - monitoring not installed"
        GRAFANA_LOCAL_PORT="N/A"
    fi
else
    log_info "Grafana port-forward already running"
    GRAFANA_LOCAL_PORT=3002
fi

# 7. Start ArgoCD port-forward (find available port)
log_info "Starting ArgoCD port-forward..."
if ! pgrep -f "kubectl port-forward.*argocd" > /dev/null; then
    # Find available port starting from 8081
    ARGOCD_LOCAL_PORT=8081
    while netstat -tlnp 2>/dev/null | grep ":$ARGOCD_LOCAL_PORT " > /dev/null; do
        ARGOCD_LOCAL_PORT=$((ARGOCD_LOCAL_PORT + 1))
        if [ $ARGOCD_LOCAL_PORT -gt 8090 ]; then
            log_error "No available ports found for ArgoCD"
            break
        fi
    done
    
    # Check if ArgoCD service exists
    if kubectl get svc argocd-server -n argocd > /dev/null 2>&1; then
        kubectl port-forward svc/argocd-server -n argocd $ARGOCD_LOCAL_PORT:443 > /dev/null 2>&1 &
        ARGOCD_PID=$!
        sleep 2
        if pgrep -f "kubectl port-forward.*argocd" > /dev/null; then
            log_success "ArgoCD port-forward started on port $ARGOCD_LOCAL_PORT (PID: $ARGOCD_PID)"
        else
            log_error "Failed to start ArgoCD port-forward"
            ARGOCD_LOCAL_PORT="N/A"
        fi
    else
        log_info "ArgoCD service not found - GitOps not installed"
        ARGOCD_LOCAL_PORT="N/A"
    fi
else
    log_info "ArgoCD port-forward already running"
    ARGOCD_LOCAL_PORT=8081
fi

# 8. Get credentials
GRAFANA_PASSWORD=""
ARGOCD_PASSWORD=""

if [ "$GRAFANA_LOCAL_PORT" != "N/A" ]; then
    GRAFANA_PASSWORD=$(kubectl -n monitoring get secret prometheus-grafana -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 --decode || echo "prom-operator")
fi

if [ "$ARGOCD_LOCAL_PORT" != "N/A" ]; then
    ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' 2>/dev/null | base64 --decode || echo "password-not-found")
fi

# 9. Display final URLs
echo ""
echo "----------------------------------"
echo -e "${GREEN}🚀 SECURE EXAM PLATFORM:${NC}"
echo "http://exam-platform.local"
echo ""

if [ "$GRAFANA_LOCAL_PORT" != "N/A" ]; then
    echo -e "${GREEN}📊 GRAFANA:${NC}"
    echo "http://localhost:$GRAFANA_LOCAL_PORT"
    echo ""
else
    echo -e "${YELLOW}📊 GRAFANA: Not installed${NC}"
    
    echo ""
fi

if [ "$ARGOCD_LOCAL_PORT" != "N/A" ]; then
    echo -e "${GREEN}⚙️ ARGOCD:${NC}"
    echo "https://localhost:$ARGOCD_LOCAL_PORT"
    echo ""
else
    echo -e "${YELLOW}⚙️ ARGOCD: Not installed${NC}"
    echo ""
fi

echo "----------------------------------"
echo ""

if [ "$GRAFANA_LOCAL_PORT" != "N/A" ] && [ -n "$GRAFANA_PASSWORD" ]; then
    echo -e "${BLUE}🔑 Grafana Credentials:${NC}"
    echo "   Username: admin"
    echo "   Password: $GRAFANA_PASSWORD"
    echo ""
fi

if [ "$ARGOCD_LOCAL_PORT" != "N/A" ] && [ -n "$ARGOCD_PASSWORD" ]; then
    echo -e "${BLUE}🔑 ArgoCD Credentials:${NC}"
    echo "   Username: admin"
    echo "   Password: $ARGOCD_PASSWORD"
    echo ""
fi

echo -e "${BLUE}📝 Management Commands:${NC}"
echo "   • Check pods:       kubectl get pods -n exam-platform"
echo "   • Check services:   kubectl get svc -n exam-platform"
echo "   • Check ingress:    kubectl get ingress -n exam-platform"
echo ""

echo -e "${BLUE}🛑 To stop all services:${NC}"
echo "   pkill -f 'minikube tunnel'"
echo "   pkill -f 'kubectl port-forward'"
echo ""

log_success "Development environment ready!"
