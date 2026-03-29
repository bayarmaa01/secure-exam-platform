#!/bin/bash

# 🔍 Kubernetes Connectivity Verification Script
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Use minikube kubectl
KUBECTL="minikube kubectl --"

echo -e "${BLUE}🔍 Kubernetes Connectivity Verification${NC}"
echo ""

# Step 1: Check cluster status
print_step "Checking Kubernetes cluster status..."
if ! $KUBECTL cluster-info >/dev/null 2>&1; then
    print_error "Kubernetes cluster not accessible"
    exit 1
fi
print_success "Kubernetes cluster accessible"

# Step 2: Check all namespaces
print_step "Checking namespaces..."
echo "Available namespaces:"
$KUBECTL get namespaces
echo ""

# Step 3: Check exam-platform services
print_step "Checking exam-platform services..."
echo "Services in exam-platform namespace:"
$KUBECTL get svc -n exam-platform
echo ""

# Step 4: Check monitoring services
print_step "Checking monitoring services..."
echo "Services in monitoring namespace:"
$KUBECTL get svc -n monitoring
echo ""

# Step 5: Test DNS resolution from within cluster
print_step "Testing DNS resolution from within cluster..."

# Test backend DNS resolution
echo "Testing backend DNS resolution..."
$KUBECTL run dns-test --image=busybox --rm -i --restart=Never -- nslookup backend.exam-platform.svc.cluster.local || print_error "Backend DNS resolution failed"

# Test Prometheus DNS resolution
echo "Testing Prometheus DNS resolution..."
$KUBECTL run dns-test --image=busybox --rm -i --restart=Never -- nslookup prometheus-operated.monitoring.svc.cluster.local || print_warning "Prometheus DNS resolution failed (may not be installed)"

# Step 6: Test service connectivity
print_step "Testing service connectivity..."

# Test backend service
echo "Testing backend service connectivity..."
$KUBECTL run connectivity-test --image=curlimages/curl --rm -i --restart=Never -- curl -f http://backend.exam-platform.svc.cluster.local:4000/health || print_error "Backend service connectivity failed"

# Test Prometheus service (if exists)
if $KUBECTL get svc prometheus-operated -n monitoring >/dev/null 2>&1; then
    echo "Testing Prometheus service connectivity..."
    $KUBECTL run connectivity-test --image=curlimages/curl --rm -i --restart=Never -- curl -f http://prometheus-operated.monitoring.svc.cluster.local:9090/-/healthy || print_error "Prometheus service connectivity failed"
fi

# Step 7: Check pod status
print_step "Checking pod status..."
echo "Pods in exam-platform namespace:"
$KUBECTL get pods -n exam-platform
echo ""

echo "Pods in monitoring namespace:"
$KUBECTL get pods -n monitoring
echo ""

# Step 8: Verify port-forward targets
print_step "Verifying port-forward configuration..."

echo "Expected port-forward mappings:"
echo "  Frontend: 3005:80 (svc/frontend.exam-platform.svc.cluster.local:80)"
echo "  Backend:  4005:4000 (svc/backend.exam-platform.svc.cluster.local:4000)"
echo "  AI:       5005:80 (svc/ai-proctoring.exam-platform.svc.cluster.local:80)"
echo "  Grafana:  3002:80 (svc/prometheus-grafana.monitoring.svc.cluster.local:80)"
echo ""

# Step 9: Test local connectivity (if port-forwards are running)
print_step "Testing local connectivity..."

if curl -f http://localhost:4005/health >/dev/null 2>&1; then
    print_success "Backend accessible via port-forward"
else
    print_warning "Backend not accessible via port-forward (may not be running)"
fi

if curl -f http://localhost:3002 >/dev/null 2>&1; then
    print_success "Grafana accessible via port-forward"
else
    print_warning "Grafana not accessible via port-forward (may not be running)"
fi

echo ""
print_success "🔍 Connectivity verification completed!"
echo ""
echo "If any tests failed, check:"
echo "1. Kubernetes cluster is running"
echo "2. Services are properly configured"
echo "3. Pods are in Running state"
echo "4. Port-forwards are active"
