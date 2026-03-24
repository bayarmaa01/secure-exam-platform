#!/bin/bash

# 🏃 Secure Exam Platform - Daily Usage Script
# Quick start and access for running platform

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

# Help function
show_help() {
    echo "🏃 Secure Exam Platform - Daily Usage"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start     Start all services and show access URLs"
    echo "  stop      Stop all services"
    echo "  status    Check status of all services"
    echo "  logs      Show logs for all services"
    echo "  access    Show access URLs and start port forwards"
    echo "  restart   Restart all services"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start      # Start everything"
    echo "  $0 access     # Show URLs and start port forwards"
    echo "  $0 status     # Check if everything is running"
}

# Check if Minikube is running
check_minikube() {
    if ! minikube status | grep -q "Running"; then
        print_error "Minikube is not running"
        print_info "Run: minikube start --driver=docker"
        exit 1
    fi
}

# Start services
start_services() {
    print_step "Starting Secure Exam Platform..."
    
    check_minikube
    
    # Check if namespace exists
    if ! kubectl get namespace exam-platform >/dev/null 2>&1; then
        print_error "exam-platform namespace not found"
        print_info "Run: ./deploy-simple.sh first"
        exit 1
    fi
    
    # Scale up deployments if needed
    print_step "Ensuring services are running..."
    kubectl scale deployment backend --replicas=2 -n exam-platform 2>/dev/null || true
    kubectl scale deployment ai-proctoring --replicas=2 -n exam-platform 2>/dev/null || true
    kubectl scale deployment frontend --replicas=2 -n exam-platform 2>/dev/null || true
    
    # Wait for services to be ready
    print_step "Waiting for services to be ready..."
    kubectl wait --for=condition=available deployment/backend -n exam-platform --timeout=120s 2>/dev/null || true
    kubectl wait --for=condition=available deployment/ai-proctoring -n exam-platform --timeout=120s 2>/dev/null || true
    kubectl wait --for=condition=available deployment/frontend -n exam-platform --timeout=120s 2>/dev/null || true
    
    print_success "All services started"
    show_access
}

# Stop services
stop_services() {
    print_step "Stopping Secure Exam Platform..."
    
    # Scale down deployments
    kubectl scale deployment backend --replicas=0 -n exam-platform 2>/dev/null || true
    kubectl scale deployment ai-proctoring --replicas=0 -n exam-platform 2>/dev/null || true
    kubectl scale deployment frontend --replicas=0 -n exam-platform 2>/dev/null || true
    
    # Kill port forwards
    pkill -f "kubectl port-forward.*3000" 2>/dev/null || true
    pkill -f "kubectl port-forward.*4000" 2>/dev/null || true
    pkill -f "kubectl port-forward.*5000" 2>/dev/null || true
    pkill -f "kubectl port-forward.*8081" 2>/dev/null || true
    pkill -f "kubectl port-forward.*3002" 2>/dev/null || true
    
    print_success "Services stopped"
}

# Show status
show_status() {
    print_step "Secure Exam Platform Status"
    echo ""
    
    # Minikube status
    print_info "🔥 Minikube:"
    minikube status
    echo ""
    
    # Pod status
    print_info "📦 Pods in exam-platform:"
    kubectl get pods -n exam-platform -o wide
    echo ""
    
    # Service status
    print_info "🌐 Services in exam-platform:"
    kubectl get svc -n exam-platform
    echo ""
    
    # NodePort access
    MINIKUBE_IP=$(minikube ip)
    print_info "🎯 NodePort Access Test:"
    curl -s http://$MINIKUBE_IP:30010/health >/dev/null 2>&1 && print_success "Frontend accessible" || print_error "Frontend not accessible"
    curl -s http://$MINIKUBE_IP:30011/health >/dev/null 2>&1 && print_success "Backend accessible" || print_error "Backend not accessible"
    curl -s http://$MINIKUBE_IP:30012/health >/dev/null 2>&1 && print_success "AI Service accessible" || print_error "AI Service not accessible"
    echo ""
}

# Show logs
show_logs() {
    print_step "Showing logs for all services..."
    
    echo -e "${BLUE}=== Backend Logs ===${NC}"
    kubectl logs -f deployment/backend -n exam-platform --tail=20 &
    BACKEND_PID=$!
    
    echo -e "${BLUE}=== AI Proctoring Logs ===${NC}"
    kubectl logs -f deployment/ai-proctoring -n exam-platform --tail=20 &
    AI_PID=$!
    
    echo -e "${BLUE}=== Frontend Logs ===${NC}"
    kubectl logs -f deployment/frontend -n exam-platform --tail=20 &
    FRONTEND_PID=$!
    
    # Wait for Ctrl+C
    trap "kill $BACKEND_PID $AI_PID $FRONTEND_PID 2>/dev/null" INT
    wait
}

# Show access and start port forwards
show_access() {
    print_step "Access Information"
    echo ""
    
    MINIKUBE_IP=$(minikube ip)
    
    print_info "📱 Direct Access (NodePort):"
    echo "   • Frontend:        http://$MINIKUBE_IP:30010"
    echo "   • Backend API:    http://$MINIKUBE_IP:30011"
    echo "   • AI Proctoring:  http://$MINIKUBE_IP:30012"
    echo ""
    
    print_info "🔧 Port Forward Access (Local):"
    
    # Start port forwards in background
    if ! pgrep -f "kubectl port-forward.*3000" > /dev/null; then
        kubectl port-forward svc/frontend -n exam-platform 3000:80 > /dev/null 2>&1 &
        echo "   • Frontend:        http://localhost:3000 (port-forward started)"
    else
        echo "   • Frontend:        http://localhost:3000 (port-forward already running)"
    fi
    
    if ! pgrep -f "kubectl port-forward.*4000" > /dev/null; then
        kubectl port-forward svc/backend -n exam-platform 4000:4000 > /dev/null 2>&1 &
        echo "   • Backend API:    http://localhost:4000 (port-forward started)"
    else
        echo "   • Backend API:    http://localhost:4000 (port-forward already running)"
    fi
    
    if ! pgrep -f "kubectl port-forward.*5000" > /dev/null; then
        kubectl port-forward svc/ai-proctoring -n exam-platform 5000:5000 > /dev/null 2>&1 &
        echo "   • AI Proctoring:  http://localhost:5000 (port-forward started)"
    else
        echo "   • AI Proctoring:  http://localhost:5000 (port-forward already running)"
    fi
    
    echo ""
    
    # ArgoCD and Grafana if available
    if kubectl get pods -n argocd | grep -q "argocd-server"; then
        if ! pgrep -f "kubectl port-forward.*8081" > /dev/null; then
            kubectl port-forward svc/argocd-server -n argocd 8081:443 > /dev/null 2>&1 &
            echo "   • ArgoCD:          https://localhost:8081 (port-forward started)"
        else
            echo "   • ArgoCD:          https://localhost:8081 (port-forward already running)"
        fi
    fi
    
    if kubectl get pods -n monitoring | grep -q "grafana"; then
        if ! pgrep -f "kubectl port-forward.*3002" > /dev/null; then
            kubectl port-forward svc/prometheus-grafana -n monitoring 3002:80 > /dev/null 2>&1 &
            echo "   • Grafana:         http://localhost:3002 (port-forward started)"
        else
            echo "   • Grafana:         http://localhost:3002 (port-forward already running)"
        fi
    fi
    
    echo ""
    print_info "🔐 Credentials:"
    echo "   • ArgoCD Password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath=\"{.data.password}\" | base64 -d"
    echo "   • Grafana Login:   admin / prom-operator"
    echo ""
    
    print_success "🚀 All access URLs ready!"
}

# Restart services
restart_services() {
    print_step "Restarting Secure Exam Platform..."
    stop_services
    sleep 5
    start_services
}

# Main command handler
case "${1:-start}" in
    "start")
        start_services
        ;;
    "stop")
        stop_services
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
        ;;
    "access")
        show_access
        ;;
    "restart")
        restart_services
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
