#!/bin/bash

# 🔧 Quick PVC Fix for Deployment Issues
# Use this when PVC resize error occurs

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

print_step "Fixing PVC resize issue..."

# Check if Minikube is running
if ! minikube status | grep -q "Running"; then
    print_error "Minikube is not running"
    exit 1
fi

# Step 1: Delete the problematic PVC
print_step "Deleting existing PVC to fix resize issue..."
$KUBECTL delete pvc postgres-pvc -n exam-platform --ignore-not-found=true

# Step 2: Wait for cleanup
print_step "Waiting for PVC cleanup..."
sleep 5

# Step 3: Recreate PostgreSQL with fresh PVC
print_step "Recreating PostgreSQL..."
$KUBECTL apply -f k8s/postgres-deployment.yaml

# Step 4: Wait for PostgreSQL to be ready
print_step "Waiting for PostgreSQL to be ready..."
$KUBECTL wait --for=condition=ready pod -l app=postgres -n exam-platform --timeout=300s

print_success "PVC issue fixed! PostgreSQL is ready."
echo ""
print_info "You can now continue with:"
echo "   ./deploy-simple.sh"
echo ""
print_info "Or restart the deployment with:"
echo "   ./run.sh"
