#!/bin/bash

# 🗄️ Database Reset Script
# Use this when persistent volume causes authentication issues

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

print_step "Resetting PostgreSQL database and persistent volume..."

# Check if Minikube is running
if ! minikube status | grep -q "Running"; then
    print_error "Minikube is not running"
    exit 1
fi

print_warning "This will delete all PostgreSQL data!"
read -p "Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Database reset cancelled"
    exit 0
fi

# Step 1: Delete deployments
print_step "Deleting application deployments..."
$KUBECTL delete deployment backend -n exam-platform --ignore-not-found=true
$KUBECTL delete deployment ai-proctoring -n exam-platform --ignore-not-found=true
$KUBECTL delete deployment frontend -n exam-platform --ignore-not-found=true

# Step 2: Delete PostgreSQL
print_step "Deleting PostgreSQL deployment..."
$KUBECTL delete deployment postgres -n exam-platform --ignore-not-found=true
$KUBECTL delete service postgres -n exam-platform --ignore-not-found=true

# Step 3: Delete persistent volume and claim
print_step "Deleting persistent volume and claim..."
$KUBECTL delete pvc postgres-pvc -n exam-platform --ignore-not-found=true
$KUBECTL delete pv postgres-pv -n exam-platform --ignore-not-found=true
sleep 5

# Step 4: Wait for cleanup
print_step "Waiting for cleanup to complete..."
sleep 10

# Step 5: Recreate PostgreSQL
print_step "Recreating PostgreSQL with fresh persistent volume..."
$KUBECTL apply -f k8s/postgres-deployment.yaml

# Step 6: Wait for PostgreSQL to be ready
print_step "Waiting for PostgreSQL to be ready..."
$KUBECTL wait --for=condition=ready pod -l app=postgres -n exam-platform --timeout=300s

# Step 7: Recreate applications
print_step "Recreating application deployments..."
$KUBECTL apply -f k8s/backend-deployment.yaml
$KUBECTL apply -f k8s/ai-proctoring-deployment.yaml
$KUBECTL apply -f k8s/frontend-deployment.yaml

# Step 8: Wait for all pods
print_step "Waiting for all pods to be ready..."
$KUBECTL wait --for=condition=ready pod -l app=backend -n exam-platform --timeout=300s
$KUBECTL wait --for=condition=ready pod -l app=ai-proctoring -n exam-platform --timeout=300s
$KUBECTL wait --for=condition=ready pod -l app=frontend -n exam-platform --timeout=300s

print_success "Database reset completed!"
echo ""
print_info "All services are running with fresh database:"
echo "   • PostgreSQL: Fresh database with exam_user/exam_password"
echo "   • Backend: Connected to new database"
echo "   • AI Proctoring: Connected to new database"
echo "   • Frontend: Ready for user access"
echo ""
print_success "Run './run.sh' to start port-forwards and access the platform"
