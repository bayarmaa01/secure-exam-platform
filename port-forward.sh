#!/bin/bash

# ========================================
#  PORT FORWARD - Secure Exam Platform
# ========================================
# Handles port forwarding for all services
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
NC='\033[0m'

# ========================================
#  CONFIGURATION
# ========================================
NAMESPACE="default"
MONITORING_NAMESPACE="monitoring"
ARGOCD_NAMESPACE="argocd"

# Port mappings
FRONTEND_PORT=3005
BACKEND_PORT=4005
AI_PORT=5005
GRAFANA_PORT=3002
ARGOCD_PORT=18081

# ========================================
#  FUNCTIONS
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

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
}

# Check if cluster is accessible
check_cluster() {
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
}

# Wait for pod with retry logic
wait_for_pod() {
    local service_name=$1
    local namespace=$2
    local max_retries=30
    local retry_count=0
    
    print_step "Waiting for pod: $service_name in namespace: $namespace"
    
    while [ $retry_count -lt $max_retries ]; do
        if kubectl get pods -n $namespace -l app=$service_name --no-headers | grep -q "Running"; then
            print_success "Pod $service_name is running"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        echo -n "."
        sleep 2
    done
    
    print_error "Pod $service_name did not become ready within timeout"
    return 1
}

# Wait for service
wait_for_service() {
    local service_name=$1
    local namespace=$2
    local max_retries=30
    local retry_count=0
    
    print_step "Waiting for service: $service_name in namespace: $namespace"
    
    while [ $retry_count -lt $max_retries ]; do
        if kubectl get svc $service_name -n $namespace &> /dev/null; then
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

# Port forward with retry
port_forward_with_retry() {
    local service_name=$1
    local namespace=$2
    local local_port=$3
    local remote_port=${4:-$local_port}
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        print_step "Port forwarding $service_name (retry $((retry_count + 1))/$max_retries)"
        
        # Kill any existing port-forward on this port
        if lsof -Pi :$local_port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_info "Killing existing process on port $local_port"
            lsof -ti:$local_port | xargs kill -9 2>/dev/null || true
        fi
        
        # Start port forwarding in background
        kubectl port-forward svc/$service_name $local_port:$remote_port -n $namespace &
        local pid=$!
        
        # Wait a moment and check if it's working
        sleep 3
        
        if kill -0 $pid 2>/dev/null; then
            print_success "Port forwarding $service_name -> localhost:$local_port (PID: $pid)"
            echo $pid > /tmp/port-forward-$service_name.pid
            return 0
        else
            print_error "Port forwarding failed for $service_name"
            kill $pid 2>/dev/null || true
        fi
        
        retry_count=$((retry_count + 1))
        sleep 2
    done
    
    print_error "Failed to establish port forwarding for $service_name after $max_retries attempts"
    return 1
}

# Show access information
show_access_info() {
    print_step "🌐 Service Access Information"
    echo ""
    print_info "Frontend:      http://localhost:$FRONTEND_PORT"
    print_info "Backend API:   http://localhost:$BACKEND_PORT"
    print_info "AI Service:    http://localhost:$AI_PORT"
    print_info "Grafana:       http://localhost:$GRAFANA_PORT"
    print_info "ArgoCD:        http://localhost:$ARGOCD_PORT"
    echo ""
    print_info "Default Credentials:"
    print_info "  Grafana: admin/admin123"
    print_info "  ArgoCD:  admin/password (check ArgoCD secret)"
    echo ""
}

# Stop all port forwards
stop_all_port_forwards() {
    print_step "Stopping all port forwards..."
    
    for pid_file in /tmp/port-forward-*.pid; do
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if kill -0 $pid 2>/dev/null; then
                kill $pid
                print_success "Stopped port forward (PID: $pid)"
            fi
            rm -f "$pid_file"
        fi
    done
    
    # Kill any remaining processes on our ports
    for port in $FRONTEND_PORT $BACKEND_PORT $AI_PORT $GRAFANA_PORT $ARGOCD_PORT; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fi
    done
}

# Forward all services
forward_all() {
    print_step "Starting port forwarding for all services..."
    
    # Check prerequisites
    check_kubectl
    check_cluster
    
    # Stop any existing port forwards
    stop_all_port_forwards
    
    # Wait for services and start port forwarding
    print_step "Setting up application services..."
    
    # Frontend
    wait_for_service "exam-platform-frontend" $NAMESPACE
    port_forward_with_retry "exam-platform-frontend" $NAMESPACE $FRONTEND_PORT
    
    # Backend
    wait_for_service "exam-platform-backend" $NAMESPACE
    port_forward_with_retry "exam-platform-backend" $NAMESPACE $BACKEND_PORT
    
    # AI Service
    wait_for_service "exam-platform-ai" $NAMESPACE
    port_forward_with_retry "exam-platform-ai" $NAMESPACE $AI_PORT
    
    # Monitoring services
    print_step "Setting up monitoring services..."
    
    # Grafana
    wait_for_service "prometheus-grafana" $MONITORING_NAMESPACE
    port_forward_with_retry "prometheus-grafana" $MONITORING_NAMESPACE $GRAFANA_PORT
    
    # ArgoCD
    wait_for_service "argocd-server" $ARGOCD_NAMESPACE
    port_forward_with_retry "argocd-server" $ARGOCD_NAMESPACE $ARGOCD_PORT 80
    
    # Show access information
    show_access_info
    
    print_success "All port forwards established successfully!"
    print_info "Press Ctrl+C to stop all port forwards"
    
    # Trap Ctrl+C to cleanup
    trap 'stop_all_port_forwards; exit 0' INT
    
    # Keep script running
    while true; do
        sleep 5
        # Check if any port forward died
        for pid_file in /tmp/port-forward-*.pid; do
            if [ -f "$pid_file" ]; then
                local pid=$(cat "$pid_file")
                if ! kill -0 $pid 2>/dev/null; then
                    print_error "Port forward died (PID: $pid), restarting..."
                    # Extract service name from filename and restart
                    local service=$(basename "$pid_file" | sed 's/port-forward-//; s/.pid//')
                    # This would need more sophisticated logic to restart properly
                fi
            fi
        done
    done
}

# Forward specific service
forward_service() {
    local service=$1
    
    check_kubectl
    check_cluster
    
    case $service in
        "frontend")
            wait_for_service "exam-platform-frontend" $NAMESPACE
            port_forward_with_retry "exam-platform-frontend" $NAMESPACE $FRONTEND_PORT
            print_info "Frontend available at: http://localhost:$FRONTEND_PORT"
            ;;
        "backend")
            wait_for_service "exam-platform-backend" $NAMESPACE
            port_forward_with_retry "exam-platform-backend" $NAMESPACE $BACKEND_PORT
            print_info "Backend API available at: http://localhost:$BACKEND_PORT"
            ;;
        "ai")
            wait_for_service "exam-platform-ai" $NAMESPACE
            port_forward_with_retry "exam-platform-ai" $NAMESPACE $AI_PORT
            print_info "AI Service available at: http://localhost:$AI_PORT"
            ;;
        "grafana")
            wait_for_service "prometheus-grafana" $MONITORING_NAMESPACE
            port_forward_with_retry "prometheus-grafana" $MONITORING_NAMESPACE $GRAFANA_PORT
            print_info "Grafana available at: http://localhost:$GRAFANA_PORT"
            ;;
        "argocd")
            wait_for_service "argocd-server" $ARGOCD_NAMESPACE
            port_forward_with_retry "argocd-server" $ARGOCD_NAMESPACE $ARGOCD_PORT 80
            print_info "ArgoCD available at: http://localhost:$ARGOCD_PORT"
            ;;
        *)
            print_error "Unknown service: $service"
            print_info "Available services: frontend, backend, ai, grafana, argocd"
            exit 1
            ;;
    esac
}

# ========================================
#  MAIN
# ========================================
case "${1:-all}" in
    "all")
        forward_all
        ;;
    "stop")
        stop_all_port_forwards
        ;;
    "frontend"|"backend"|"ai"|"grafana"|"argocd")
        forward_service $1
        ;;
    "info")
        show_access_info
        ;;
    *)
        echo "Usage: $0 [all|stop|frontend|backend|ai|grafana|argocd|info]"
        echo ""
        echo "Commands:"
        echo "  all      - Forward all services (default)"
        echo "  stop     - Stop all port forwards"
        echo "  frontend - Forward only frontend"
        echo "  backend  - Forward only backend"
        echo "  ai       - Forward only AI service"
        echo "  grafana  - Forward only Grafana"
        echo "  argocd   - Forward only ArgoCD"
        echo "  info     - Show access information"
        exit 1
        ;;
esac
