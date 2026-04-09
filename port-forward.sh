#!/bin/bash

# ========================================
# 🚀 PORT FORWARD SETUP SCRIPT
# ========================================
# This script sets up all port forwards for the secure exam platform
# Usage: ./port-forward.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
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

print_header() {
    echo -e "${GREEN}"
    echo "======================================"
    echo "$1"
    echo "======================================"
    echo -e "${NC}"
}

# Function to kill existing port forwards
kill_existing_port_forwards() {
    print_info "Killing existing port forwards..."
    
    # Kill any existing port forwards on our target ports
    pkill -f "kubectl.*port-forward.*3005" 2>/dev/null || true
    pkill -f "kubectl.*port-forward.*4005" 2>/dev/null || true
    pkill -f "kubectl.*port-forward.*5005" 2>/dev/null || true
    pkill -f "kubectl.*port-forward.*3002" 2>/dev/null || true
    pkill -f "kubectl.*port-forward.*9092" 2>/dev/null || true
    pkill -f "kubectl.*port-forward.*18081" 2>/dev/null || true
    
    # Wait a moment for processes to die
    sleep 2
    
    print_success "Existing port forwards killed"
}

# Function to wait for service to be ready
wait_for_service() {
    local namespace=$1
    local service_name=$2
    local timeout=${3:-300}
    
    print_info "Waiting for service $service_name in namespace $namespace..."
    
    local count=0
    while [ $count -lt $timeout ]; do
        if kubectl get svc $service_name -n $namespace &>/dev/null; then
            local ready=$(kubectl get svc $service_name -n $namespace -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
            if [ -n "$ready" ] || kubectl get endpoints $service_name -n $namespace -o jsonpath='{.subsets}' 2>/dev/null | grep -q "addresses"; then
                print_success "Service $service_name is ready!"
                return 0
            fi
        fi
        
        sleep 2
        count=$((count + 2))
        
        if [ $((count % 10)) -eq 0 ]; then
            print_info "Still waiting for $service_name... (${count}s elapsed)"
        fi
    done
    
    print_error "Timeout waiting for service $service_name"
    return 1
}

# Function to setup port forwards
setup_port_forwards() {
    print_header "Setting Up Port Forwards"
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    print_info "Waiting for services to be ready before port forwarding..."
    
    # Wait for services to be ready
    wait_for_service "exam-platform" "frontend" 180 || {
        print_warning "Frontend service not ready, continuing anyway..."
    }
    
    wait_for_service "exam-platform" "backend" 180 || {
        print_warning "Backend service not ready, continuing anyway..."
    }
    
    wait_for_service "exam-platform" "ai-proctoring" 180 || {
        print_warning "AI service not ready, continuing anyway..."
    }
    
    wait_for_service "monitoring" "prometheus-grafana" 180 || {
        print_warning "Grafana service not ready, continuing anyway..."
    }
    
    wait_for_service "argocd" "argocd-server" 180 || {
        print_warning "ArgoCD service not ready, continuing anyway..."
    }
    
    print_info "Setting up port forwards in background..."
    
    # Frontend port forward
    print_info "Setting up frontend port forward (3005)..."
    kubectl port-forward -n exam-platform svc/frontend 3005:80 &
    FRONTEND_PID=$!
    
    # Backend port forward  
    print_info "Setting up backend port forward (4005)..."
    kubectl port-forward -n exam-platform svc/backend 4005:4000 &
    BACKEND_PID=$!
    
    # AI Service port forward
    print_info "Setting up AI service port forward (5005)..."
    kubectl port-forward -n exam-platform svc/ai-proctoring 5005:80 &
    AI_PID=$!
    
    # Grafana port forward
    print_info "Setting up Grafana port forward (3002)..."
    kubectl port-forward -n monitoring svc/prometheus-grafana 3002:80 &
    GRAFANA_PID=$!
    
    # Prometheus port forward
    print_info "Setting up Prometheus port forward (9092)..."
    kubectl port-forward -n monitoring svc/prometheus-server 9092:9090 &
    PROMETHEUS_PID=$!
    
    # ArgoCD port forward
    print_info "Setting up ArgoCD port forward (18081)..."
    kubectl port-forward -n argocd svc/argocd-server 18081:80 &
    ARGOCD_PID=$!
    
    # Wait a moment for port forwards to establish
    sleep 3
    
    print_success "All port forwards established!"
    
    # Save PIDs to file for cleanup
    cat > /tmp/port-forward-pids.txt << EOF
$FRONTEND_PID
$BACKEND_PID
$AI_PID
$GRAFANA_PID
$PROMETHEUS_PID
$ARGOCD_PID
EOF
    
    print_info "PIDs saved to /tmp/port-forward-pids.txt"
}

# Function to test port forwards
test_port_forwards() {
    print_header "🧪 Testing Port Forwards"
    
    # Test each service
    services=(
        "Frontend:3005:http://localhost:3005"
        "Backend:4005:http://localhost:4005/health"
        "AI Service:5005:http://localhost:5005/health"
        "Grafana:3002:http://localhost:3002"
        "Prometheus:9092:http://localhost:9092"
        "ArgoCD:18081:https://localhost:18081"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port url <<< "$service"
        
        print_info "Testing $name (port $port)..."
        
        if curl -s --connect-timeout 3 "$url" >/dev/null 2>&1; then
            print_success "$name is accessible on $url"
        else
            print_warning "$name may still be starting up on $url"
        fi
    done
}

# Function to display access information
show_access_info() {
    print_header "📱 Access Information"
    
    echo -e "${GREEN}🌐 Access URLs:${NC}"
    echo -e "${GREEN}   Frontend:   http://localhost:3005${NC}"
    echo -e "${GREEN}   Backend:    http://localhost:4005${NC}"
    echo -e "${GREEN}   AI:         http://localhost:5005${NC}"
    echo -e "${GREEN}   Grafana:    http://localhost:3002${NC}"
    echo -e "${GREEN}   ArgoCD:     https://localhost:18081${NC}"
    echo ""
    
    # Get Grafana password
    GRAFANA_PASSWORD=$(kubectl get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 -d || echo "admin")
    
    # Get ArgoCD password
    ARGOCD_PASSWORD=$(kubectl get secret argocd-secret -n argocd -o jsonpath="{.data.admin.password}" 2>/dev/null | base64 -d || echo "admin")
    
    echo -e "${GREEN}🔐 Login Credentials:${NC}"
    echo -e "${GREEN}   Grafana:    admin / $GRAFANA_PASSWORD${NC}"
    echo -e "${GREEN}   ArgoCD:     admin / $ARGOCD_PASSWORD${NC}"
    echo ""
    
    echo -e "${YELLOW}💡 To stop all port forwards, run:${NC}"
    echo -e "${YELLOW}   ./port-forward.sh stop${NC}"
    echo ""
    
    echo -e "${YELLOW}💡 To restart port forwards, run:${NC}"
    echo -e "${YELLOW}   ./port-forward.sh${NC}"
}

# Function to stop port forwards
stop_port_forwards() {
    print_header "🛑 Stopping Port Forwards"
    
    # Kill by PIDs file if it exists
    if [ -f /tmp/port-forward-pids.txt ]; then
        print_info "Stopping port forwards using saved PIDs..."
        while read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
                print_info "Stopped process $pid"
            fi
        done < /tmp/port-forward-pids.txt
        rm -f /tmp/port-forward-pids.txt
    fi
    
    # Also kill by pattern (backup)
    print_info "Killing any remaining port forward processes..."
    pkill -f "kubectl.*port-forward.*3005" 2>/dev/null || true
    pkill -f "kubectl.*port-forward.*4005" 2>/dev/null || true
    pkill -f "kubectl.*port-forward.*5005" 2>/dev/null || true
    pkill -f "kubectl.*port-forward.*3002" 2>/dev/null || true
    pkill -f "kubectl.*port-forward.*18081" 2>/dev/null || true
    
    print_success "All port forwards stopped"
}

# Function to show status
show_status() {
    print_header "📊 Port Forward Status"
    
    # Check if processes are running
    services=(
        "Frontend:3005"
        "Backend:4005" 
        "AI:5005"
        "Grafana:3002"
        "ArgoCD:18081"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        
        if pgrep -f "kubectl.*port-forward.*$port" >/dev/null; then
            print_success "$name (port $port): Running"
        else
            print_error "$name (port $port): Not running"
        fi
    done
}

# Main script logic
case "${1:-start}" in
    "start"|"")
        kill_existing_port_forwards
        setup_port_forwards
        sleep 2
        test_port_forwards
        show_access_info
        ;;
    "stop")
        stop_port_forwards
        ;;
    "status")
        show_status
        ;;
    "restart")
        stop_port_forwards
        sleep 2
        kill_existing_port_forwards
        setup_port_forwards
        sleep 2
        test_port_forwards
        show_access_info
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start     Start port forwards (default)"
        echo "  stop      Stop all port forwards"
        echo "  status    Show status of port forwards"
        echo "  restart   Restart port forwards"
        echo "  help      Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0              # Start port forwards"
        echo "  $0 stop         # Stop port forwards"
        echo "  $0 status       # Check status"
        echo "  $0 restart      # Restart port forwards"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
