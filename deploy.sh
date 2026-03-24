#!/bin/bash

# Secure Exam Platform - Production Deployment Script
# This script deploys the entire application stack to Kubernetes with Minikube

# Enable strict bash safety
set -e
set -o pipefail
set -u

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions for colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header() {
    echo -e "${BLUE}🚀 $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for deployment
wait_for_deployment() {
    local namespace=$1
    local deployment=$2
    local timeout=${3:-300}
    
    print_info "Waiting for deployment $deployment in namespace $namespace (timeout: ${timeout}s)..."
    
    if kubectl rollout status deployment/$deployment -n $namespace --timeout=${timeout}s; then
        print_success "Deployment $deployment is ready"
    else
        print_error "Deployment $deployment failed to become ready within ${timeout}s"
        return 1
    fi
}

# Function to check if namespace exists
namespace_exists() {
    kubectl get namespace $1 >/dev/null 2>&1
}

# Function to create namespace if it doesn't exist
ensure_namespace() {
    local namespace=$1
    if ! namespace_exists $namespace; then
        print_info "Creating namespace: $namespace"
        kubectl create namespace $namespace
        print_success "Namespace $namespace created"
    else
        print_info "Namespace $namespace already exists"
    fi
}

# Main deployment function
main() {
    print_header "Secure Exam Platform - Production Deployment"
    echo "=================================================="
    echo ""

    # 1. Verify required tools exist
    print_info "Verifying required tools..."
    
    local missing_tools=()
    
    for tool in kubectl minikube docker git; do
        if command_exists $tool; then
            print_success "$tool is installed"
        else
            print_error "$tool is not installed"
            missing_tools+=($tool)
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install the missing tools and try again"
        exit 1
    fi
    
    print_success "All required tools are installed"
    echo ""

    # 2. Start Minikube if not running
    print_info "Checking Minikube status..."
    
    if minikube status | grep -q "Running"; then
        print_success "Minikube is already running"
    else
        print_info "Starting Minikube..."
        minikube start --driver=docker --cpus=4 --memory=4096
        
        if minikube status | grep -q "Running"; then
            print_success "Minikube started successfully"
        else
            print_error "Failed to start Minikube"
            exit 1
        fi
    fi
    echo ""

    # 3. Ensure Kubernetes is reachable
    print_info "Verifying Kubernetes cluster connectivity..."
    
    if kubectl cluster-info >/dev/null 2>&1; then
        print_success "Kubernetes cluster is reachable"
        kubectl cluster-info
    else
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    echo ""

    # 4. Ensure required namespaces exist
    print_info "Creating required namespaces..."
    
    for namespace in exam-platform monitoring argocd; do
        ensure_namespace $namespace
    done
    echo ""

    # 5. Enable ingress addon if not enabled
    print_info "Checking ingress addon..."
    
    if minikube addons list | grep "ingress" | grep -q "enabled"; then
        print_success "Ingress addon is already enabled"
    else
        print_info "Enabling ingress addon..."
        minikube addons enable ingress
        
        if minikube addons list | grep "ingress" | grep -q "enabled"; then
            print_success "Ingress addon enabled"
        else
            print_error "Failed to enable ingress addon"
            exit 1
        fi
    fi
    echo ""

    # 6. Apply Kubernetes manifests in order
    print_header "Applying Kubernetes Manifests"
    echo "=================================="
    
    # Check if k8s directory exists
    if [ ! -d "k8s" ]; then
        print_error "k8s directory not found. Please ensure you're running this script from the project root."
        exit 1
    fi
    
    # Apply namespace manifests first
    print_info "Applying namespace manifests..."
    if ls k8s/*namespace*.yaml 1> /dev/null 2>&1; then
        kubectl apply -f k8s/*namespace*.yaml
        print_success "Namespace manifests applied"
    else
        print_warning "No namespace manifests found, skipping..."
    fi
    
    # Apply database services (postgres, redis)
    print_info "Applying database services..."
    
    # Apply postgres manifests
    if ls k8s/*postgres*.yaml 1> /dev/null 2>&1; then
        kubectl apply -f k8s/*postgres*.yaml
        print_success "PostgreSQL manifests applied"
    else
        print_info "No PostgreSQL manifests found, skipping..."
    fi
    
    # Apply redis manifests
    if ls k8s/*redis*.yaml 1> /dev/null 2>&1; then
        kubectl apply -f k8s/*redis*.yaml
        print_success "Redis manifests applied"
    else
        print_info "No Redis manifests found, skipping..."
    fi
    
    # Wait for databases to be ready
    sleep 10
    if kubectl get pods -n exam-platform | grep -q "postgres"; then
        wait_for_deployment exam-platform postgres
    fi
    if kubectl get pods -n exam-platform | grep -q "redis"; then
        wait_for_deployment exam-platform redis
    fi
    
    # Apply backend service
    print_info "Applying backend service..."
    if ls k8s/*backend*.yaml 1> /dev/null 2>&1; then
        kubectl apply -f k8s/*backend*.yaml
        print_success "Backend service applied"
        wait_for_deployment exam-platform backend
    else
        print_warning "No backend manifests found, skipping..."
    fi
    
    # Apply AI service
    print_info "Applying AI proctoring service..."
    
    # Apply AI proctoring manifests
    if ls k8s/*ai*.yaml 1> /dev/null 2>&1; then
        kubectl apply -f k8s/*ai*.yaml
        print_success "AI proctoring service applied"
        wait_for_deployment exam-platform ai-proctoring
    else
        print_warning "No AI proctoring manifests found, skipping..."
    fi
    
    # Apply proctoring manifests (alternative naming)
    if ls k8s/*proctor*.yaml 1> /dev/null 2>&1; then
        kubectl apply -f k8s/*proctor*.yaml
        print_success "Proctoring service applied"
        wait_for_deployment exam-platform ai-proctoring
    fi
    
    # Apply frontend service
    print_info "Applying frontend service..."
    if ls k8s/*frontend*.yaml 1> /dev/null 2>&1; then
        kubectl apply -f k8s/*frontend*.yaml
        print_success "Frontend service applied"
        wait_for_deployment exam-platform frontend
    else
        print_warning "No frontend manifests found, skipping..."
    fi
    
    # Apply ingress
    print_info "Applying ingress manifests..."
    if ls k8s/*ingress*.yaml 1> /dev/null 2>&1; then
        kubectl apply -f k8s/ingress.yaml
        print_success "Ingress manifests applied"
    else
        print_warning "No ingress manifests found, skipping..."
    fi
    echo ""

    # 7. Validate services and ingress after deploy
    print_header "Validating Deployment"
    echo "========================="
    
    print_info "Checking pod status in exam-platform namespace..."
    kubectl get pods -n exam-platform
    echo ""
    
    print_info "Checking services in exam-platform namespace..."
    kubectl get svc -n exam-platform
    echo ""
    
    print_info "Checking ingress resources..."
    kubectl get ingress -A
    echo ""

    # 8. Automatically start port forwards and tunnel
    print_header "Starting Access Services"
    echo "==========================="
    
    # Start minikube tunnel in background
    print_info "Starting Minikube tunnel for ingress..."
    if ! pgrep -f "minikube tunnel" > /dev/null; then
        minikube tunnel > /dev/null 2>&1 &
        TUNNEL_PID=$!
        print_success "Minikube tunnel started (PID: $TUNNEL_PID)"
        sleep 5  # Give tunnel time to start
    else
        print_info "Minikube tunnel is already running"
    fi
    
    # Start ArgoCD port-forward if ArgoCD is installed
    print_info "Starting ArgoCD port-forward..."
    if kubectl get pods -n argocd | grep -q "argocd-server"; then
        if ! pgrep -f "kubectl port-forward.*argocd" > /dev/null; then
            kubectl port-forward svc/argocd-server -n argocd 9091:443 > /dev/null 2>&1 &
            ARGOCD_PID=$!
            print_success "ArgoCD port-forward started (PID: $ARGOCD_PID)"
            sleep 3
        else
            print_info "ArgoCD port-forward is already running"
        fi
    else
        print_warning "ArgoCD not found, skipping port-forward"
    fi
    
    # Start Grafana port-forward if Grafana is installed
    print_info "Starting Grafana port-forward..."
    if kubectl get pods -n monitoring | grep -q "grafana"; then
        if ! pgrep -f "kubectl port-forward.*grafana" > /dev/null; then
            kubectl port-forward svc/grafana -n monitoring 3001:3000 > /dev/null 2>&1 &
            GRAFANA_PID=$!
            print_success "Grafana port-forward started (PID: $GRAFANA_PID)"
            sleep 3
        else
            print_info "Grafana port-forward is already running"
        fi
    else
        print_warning "Grafana not found, skipping port-forward"
    fi
    echo ""

    # 9. Display final access URLs
    print_header "Deployment Complete!"
    echo "======================="
    echo ""
    print_success "🎉 Secure Exam Platform deployed successfully!"
    echo ""
    echo "📱 Access URLs:"
    echo "   • Frontend:        http://exam-platform.local"
    echo "   • ArgoCD:          https://localhost:9091"
    echo "   • Grafana:         http://localhost:3001"
    echo ""
    echo "🔧 Management Commands:"
    echo "   • Check pods:       kubectl get pods -n exam-platform"
    echo "   • Check services:   kubectl get svc -n exam-platform"
    echo "   • Check ingress:    kubectl get ingress -A"
    echo "   • View logs:        kubectl logs -f deployment/<name> -n exam-platform"
    echo ""
    echo "🛑 To stop services:"
    echo "   • Stop tunnel:      pkill -f 'minikube tunnel'"
    echo "   • Stop port-forwards: pkill -f 'kubectl port-forward'"
    echo "   • Stop cluster:     minikube stop"
    echo ""
    echo "📊 To monitor deployment:"
    echo "   • Watch pods:       watch kubectl get pods -n exam-platform"
    echo "   • ArgoCD dashboard:  https://localhost:9091"
    echo "   • Grafana dashboard: http://localhost:3001"
    echo ""
    
    # Store PIDs for cleanup
    if [ ! -z "${TUNNEL_PID:-}" ]; then
        echo $TUNNEL_PID > /tmp/minikube_tunnel.pid
    fi
    if [ ! -z "${ARGOCD_PID:-}" ]; then
        echo $ARGOCD_PID > /tmp/argocd_portforward.pid
    fi
    if [ ! -z "${GRAFANA_PID:-}" ]; then
        echo $GRAFANA_PID > /tmp/grafana_portforward.pid
    fi
    
    print_success "🚀 Your Secure Exam Platform is now ready!"
}

# Error handling
trap 'print_error "Deployment failed at line $LINENO"' ERR

# Cleanup function
cleanup() {
    print_info "Cleaning up background processes..."
    pkill -f "minikube tunnel" || true
    pkill -f "kubectl port-forward" || true
    rm -f /tmp/minikube_tunnel.pid /tmp/argocd_portforward.pid /tmp/grafana_portforward.pid
}

# Trap cleanup on script exit
trap cleanup EXIT

# Run main function
main "$@"
