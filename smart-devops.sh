#!/bin/bash

# ========================================
#  SMART DEVOPS - Complete Secure Exam Platform Deployment
# ========================================
# Production-Grade System with Full Automation
# Handles: Minikube, Kubernetes, ArgoCD, Grafana, Prometheus
# ========================================

set -euo pipefail

# ========================================
#  COLORS
# ========================================
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# ========================================
#  GLOBAL VARIABLES
# ========================================
DEPLOY_MODE=""
NAMESPACE="default"
MONITORING_NAMESPACE="monitoring"
ARGOCD_NAMESPACE="argocd"
KUBECTL_CMD="kubectl"
TIMEOUT=300
RETRY_COUNT=3
DEBUG_MODE=false
ENABLE_ANALYTICS=true
ENABLE_AI_PROCTORING=true
ENABLE_MONITORING=true
ENABLE_ARGOCD=true

# Version and build info
APP_VERSION=${APP_VERSION:-"latest"}
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"localhost:5000"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# ========================================
#  PRINT FUNCTIONS
# ========================================
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

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_header() {
    echo -e "${PURPLE}======================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}======================================${NC}"
}

print_debug() {
    if [[ "$DEBUG_MODE" == "true" ]]; then
        echo -e "${YELLOW}🐛 DEBUG: $1${NC}"
    fi
}

# ========================================
#  UTILITY FUNCTIONS
# ========================================
retry() {
    local retries=$1
    shift
    local count=0
    
    until "$@"; do
        exit_code=$?
        count=$((count + 1))
        if [[ $count -lt $retries ]]; then
            print_warning "Command failed (attempt $count/$retries). Retrying in 5 seconds..."
            sleep 5
        else
            print_error "Command failed after $retries attempts"
            return $exit_code
        fi
    done
}

wait_for_pods_ready() {
    print_step "Waiting for pods to be ready..."
    
    local namespace=$1
    local timeout=${2:-$TIMEOUT}
    local label_selector=${3:-""}
    
    if [[ "$DEBUG_MODE" == "true" ]]; then
        print_debug "Namespace: $namespace, Timeout: $timeout, Label: $label_selector"
    fi
    
    local start_time=$(date +%s)
    
    while true; do
        local ready_count=0
        local total_count=0
        
        if [[ -n "$label_selector" ]]; then
            local pods=$($KUBECTL_CMD get pods -n $namespace -l $label_selector --no-headers 2>/dev/null)
        else
            local pods=$($KUBECTL_CMD get pods -n $namespace --no-headers 2>/dev/null)
        fi
        
        while read -r pod; do
            total_count=$((total_count + 1))
            if [[ $pod == *"Running"* ]] || [[ $pod == *"Completed"* ]]; then
                ready_count=$((ready_count + 1))
            fi
        done <<< "$pods"
        
        if [[ $ready_count -eq $total_count ]] && [[ $total_count -gt 0 ]]; then
            print_success "All pods are ready in namespace: $namespace"
            return 0
        fi
        
        local current_time=$(date +%s)
        if [[ $((current_time - start_time)) -gt $timeout ]]; then
            print_error "Timeout waiting for pods to be ready"
            return 1
        fi
        
        echo -n "."
        sleep 3
    done
}

wait_for_service() {
    print_step "Waiting for service: $1 in namespace: $2"
    
    local service_name=$1
    local namespace=$2
    local max_retries=30
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if $KUBECTL_CMD get svc $service_name -n $namespace &> /dev/null; then
            print_success "Service $service_name is available"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        echo -n "."
        sleep 2
    done
    
    print_error "Service $service_name did not become available within timeout"
    return 1
}

check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check required commands
    local commands=("minikube" "kubectl" "helm" "docker")
    for cmd in "${commands[@]}"; do
        if ! command -v $cmd &> /dev/null; then
            print_error "$cmd is not installed or not in PATH"
            exit 1
        fi
    done
    
    print_success "All prerequisites are installed"
}

# ========================================
#  MINIKUBE FUNCTIONS
# ========================================
setup_minikube() {
    print_header "🚀 SETTING UP MINIKUBE"
    
    print_step "Resetting Minikube cluster..."
    minikube delete --all 2>/dev/null || true
    minikube start --driver=docker --cpus=4 --memory=8192 --disk-size=20g
    
    # Enable addons
    print_step "Enabling Minikube addons..."
    minikube addons enable ingress
    minikube addons enable metrics-server
    
    # Set docker environment
    eval $(minikube docker-env)
    
    print_success "Minikube is ready"
}

# ========================================
#  BUILD FUNCTIONS
# ========================================
build_images() {
    print_header "🏗️ BUILDING DOCKER IMAGES"
    
    # Build with no cache and version info
    local build_args="--build-arg APP_VERSION=$APP_VERSION --build-arg BUILD_DATE=$BUILD_DATE --no-cache"
    
    print_step "Building backend image..."
    docker build $build_args -t $DOCKER_REGISTRY/exam-backend:$IMAGE_TAG ./backend
    
    print_step "Building frontend image..."
    docker build $build_args -t $DOCKER_REGISTRY/exam-frontend:$IMAGE_TAG ./frontend
    
    if [[ "$ENABLE_AI_PROCTORING" == "true" ]]; then
        print_step "Building AI proctoring image..."
        docker build $build_args -t $DOCKER_REGISTRY/exam-ai:$IMAGE_TAG ./ai-proctoring
    fi
    
    print_success "All images built successfully"
}

push_images() {
    print_header "📤 PUSHING DOCKER IMAGES"
    
    # Setup local registry
    if ! minikube ssh "docker run -d -p 5000:5000 --name registry registry:2" 2>/dev/null; then
        print_warning "Registry might already be running"
    fi
    
    # Push images
    print_step "Pushing backend image..."
    docker push $DOCKER_REGISTRY/exam-backend:$IMAGE_TAG
    
    print_step "Pushing frontend image..."
    docker push $DOCKER_REGISTRY/exam-frontend:$IMAGE_TAG
    
    if [[ "$ENABLE_AI_PROCTORING" == "true" ]]; then
        print_step "Pushing AI proctoring image..."
        docker push $DOCKER_REGISTRY/exam-ai:$IMAGE_TAG
    fi
    
    print_success "All images pushed successfully"
}

# ========================================
#  KUBERNETES DEPLOYMENT FUNCTIONS
# ========================================
deploy_namespaces() {
    print_header "🏷️ CREATING NAMESPACES"
    
    $KUBECTL_CMD create namespace $NAMESPACE --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    $KUBECTL_CMD create namespace $MONITORING_NAMESPACE --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    $KUBECTL_CMD create namespace $ARGOCD_NAMESPACE --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    
    print_success "Namespaces created"
}

deploy_application() {
    print_header "🚀 DEPLOYING APPLICATION"
    
    # Update Helm values
    print_step "Updating Helm values..."
    sed -i.bak "s/frontend.tag: .*/frontend.tag: $IMAGE_TAG/g" helm/exam-platform/values.yaml
    sed -i.bak "s/backend.tag: .*/backend.tag: $IMAGE_TAG/g" helm/exam-platform/values.yaml
    sed -i.bak "s/ai.tag: .*/ai.tag: $IMAGE_TAG/g" helm/exam-platform/values.yaml
    sed -i.bak "s|frontend.repository: .*|frontend.repository: $DOCKER_REGISTRY/exam-frontend|g" helm/exam-platform/values.yaml
    sed -i.bak "s|backend.repository: .*|backend.repository: $DOCKER_REGISTRY/exam-backend|g" helm/exam-platform/values.yaml
    sed -i.bak "s|ai.repository: .*|ai.repository: $DOCKER_REGISTRY/exam-ai|g" helm/exam-platform/values.yaml
    
    # Deploy application
    print_step "Deploying application with Helm..."
    helm upgrade --install exam-platform ./helm/exam-platform \
        --namespace $NAMESPACE \
        --values helm/exam-platform/values.yaml \
        --wait \
        --timeout $TIMEOUT
    
    wait_for_pods_ready $NAMESPACE
    
    print_success "Application deployed successfully"
}

deploy_monitoring() {
    if [[ "$ENABLE_MONITORING" != "true" ]]; then
        print_info "Monitoring deployment is disabled"
        return 0
    fi
    
    print_header "📊 DEPLOYING MONITORING"
    
    # Add Prometheus Helm repository
    print_step "Adding Prometheus Helm repository..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Deploy Prometheus stack with custom Grafana values
    print_step "Deploylying Prometheus stack..."
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace $MONITORING_NAMESPACE \
        --values grafana-values.yaml \
        --wait \
        --timeout $TIMEOUT
    
    # Wait for monitoring services
    wait_for_pods_ready $MONITORING_NAMESPACE
    wait_for_service "prometheus-grafana" $MONITORING_NAMESPACE
    wait_for_service "prometheus-kube-prometheus-prometheus" $MONITORING_NAMESPACE
    
    print_success "Monitoring deployed successfully"
}

deploy_argocd() {
    if [[ "$ENABLE_ARGOCD" != "true" ]]; then
        print_info "ArgoCD deployment is disabled"
        return 0
    fi
    
    print_header "🚢 DEPLOYING ARGOCD"
    
    # Install minimal ArgoCD
    print_step "Installing minimal ArgoCD..."
    
    # Create ArgoCD namespace
    $KUBECTL_CMD create namespace $ARGOCD_NAMESPACE --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    
    # Install ArgoCD with minimal configuration
    kubectl apply -n $ARGOCD_NAMESPACE -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
    
    # Wait for ArgoCD pods
    wait_for_pods_ready $ARGOCD_NAMESPACE
    wait_for_service "argocd-server" $ARGOCD_NAMESPACE
    
    # Get initial ArgoCD password
    ARGOCD_PASSWORD=$(kubectl -n $ARGOCD_NAMESPACE get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)
    
    print_success "ArgoCD deployed successfully"
    print_info "ArgoCD URL: http://localhost:18081"
    print_info "ArgoCD Username: admin"
    print_info "ArgoCD Password: $ARGOCD_PASSWORD"
}

# ========================================
#  HEALTH CHECK FUNCTIONS
# ========================================
health_check() {
    print_header "🏥 HEALTH CHECK"
    
    # Check application pods
    print_step "Checking application pods..."
    $KUBECTL_CMD get pods -n $NAMESPACE
    
    # Check monitoring pods
    if [[ "$ENABLE_MONITORING" == "true" ]]; then
        print_step "Checking monitoring pods..."
        $KUBECTL_CMD get pods -n $MONITORING_NAMESPACE
    fi
    
    # Check ArgoCD pods
    if [[ "$ENABLE_ARGOCD" == "true" ]]; then
        print_step "Checking ArgoCD pods..."
        $KUBECTL_CMD get pods -n $ARGOCD_NAMESPACE
    fi
    
    # Show access information
    show_access_info
}

show_access_info() {
    print_step "🌐 Service Access Information"
    echo ""
    print_info "Frontend:      http://localhost:3005"
    print_info "Backend API:   http://localhost:4005"
    print_info "AI Service:    http://localhost:5005"
    print_info "Grafana:       http://localhost:3002"
    print_info "ArgoCD:        http://localhost:18081"
    echo ""
    print_info "Default Credentials:"
    print_info "  Grafana: admin/admin123"
    print_info "  ArgoCD:  admin/password (check ArgoCD secret)"
    echo ""
}

# ========================================
#  CLEANUP FUNCTIONS
# ========================================
cleanup() {
    print_header "🧹 CLEANING UP"
    
    print_step "Removing deployments..."
    helm uninstall exam-platform -n $NAMESPACE 2>/dev/null || true
    helm uninstall prometheus -n $MONITORING_NAMESPACE 2>/dev/null || true
    
    print_step "Removing namespaces..."
    $KUBECTL_CMD delete namespace $NAMESPACE 2>/dev/null || true
    $KUBECTL_CMD delete namespace $MONITORING_NAMESPACE 2>/dev/null || true
    $KUBECTL_CMD delete namespace $ARGOCD_NAMESPACE 2>/dev/null || true
    
    print_step "Resetting Minikube..."
    minikube delete --all 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# ========================================
#  MAIN DEPLOYMENT FUNCTION
# ========================================
deploy_all() {
    print_header "🚀 COMPLETE DEPLOYMENT"
    
    check_prerequisites
    setup_minikube
    build_images
    push_images
    deploy_namespaces
    deploy_application
    deploy_monitoring
    deploy_argocd
    health_check
    
    print_success "🎉 Complete deployment finished successfully!"
    print_info "Run './port-forward.sh' to access services"
}

# ========================================
#  COMMAND LINE INTERFACE
# ========================================
show_help() {
    echo "Secure Exam Platform - Smart DevOps"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy      - Complete deployment (default)"
    echo "  minikube    - Setup Minikube only"
    echo "  build       - Build Docker images only"
    echo "  push        - Push Docker images only"
    echo "  app         - Deploy application only"
    echo "  monitoring  - Deploy monitoring only"
    echo "  argocd      - Deploy ArgoCD only"
    echo "  health      - Health check only"
    echo "  cleanup     - Clean up everything"
    echo "  help        - Show this help"
    echo ""
    echo "Environment Variables:"
    echo "  APP_VERSION     - Application version (default: latest)"
    echo "  IMAGE_TAG       - Docker image tag (default: latest)"
    echo "  DOCKER_REGISTRY  - Docker registry (default: localhost:5000)"
    echo "  DEBUG_MODE      - Enable debug mode (default: false)"
    echo "  ENABLE_AI_PROCTORING - Enable AI proctoring (default: true)"
    echo "  ENABLE_MONITORING    - Enable monitoring (default: true)"
    echo "  ENABLE_ARGOCD       - Enable ArgoCD (default: true)"
}

# ========================================
#  MAIN
# ========================================
case "${1:-deploy}" in
    "deploy"|"")
        deploy_all
        ;;
    "minikube")
        check_prerequisites
        setup_minikube
        ;;
    "build")
        check_prerequisites
        build_images
        ;;
    "push")
        check_prerequisites
        push_images
        ;;
    "app")
        check_prerequisites
        deploy_namespaces
        deploy_application
        ;;
    "monitoring")
        check_prerequisites
        deploy_namespaces
        deploy_monitoring
        ;;
    "argocd")
        check_prerequisites
        deploy_argocd
        ;;
    "health")
        health_check
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
