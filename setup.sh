#!/bin/bash

# 🚀 Secure Exam Platform Setup Script
# This script automates the setup and deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker Desktop."
        exit 1
    fi
    print_status "Docker: ✓"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose."
        exit 1
    fi
    print_status "Docker Compose: ✓"
    
    # Check kubectl (optional)
    if command -v kubectl &> /dev/null; then
        print_status "kubectl: ✓"
    else
        print_warning "kubectl not found. Kubernetes deployment will not be available."
    fi
    
    # Check Helm (optional)
    if command -v helm &> /dev/null; then
        print_status "Helm: ✓"
    else
        print_warning "Helm not found. Helm deployment will not be available."
    fi
    
    echo ""
}

# Setup local development
setup_local() {
    print_header "Local Development Setup"
    
    # Stop any existing containers
    print_status "Stopping existing containers..."
    docker compose down 2>/dev/null || true
    
    # Build and start services
    print_status "Building and starting services..."
    docker compose up --build -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are running
    if docker compose ps | grep -q "Up"; then
        print_status "Services started successfully!"
        echo ""
        print_status "Frontend: http://localhost:3000"
        print_status "Backend API: http://localhost:4000/api"
        print_status "AI Proctoring: http://localhost:5001"
        echo ""
        print_status "To view logs: docker compose logs -f"
        print_status "To stop services: docker compose down"
    else
        print_error "Failed to start services. Check logs with: docker compose logs"
        exit 1
    fi
}

# Setup production environment
setup_production() {
    print_header "Production Setup"
    
    # Check for required files
    if [ ! -d "k8s" ]; then
        print_error "k8s directory not found. Cannot deploy to Kubernetes."
        exit 1
    fi
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is required for production deployment."
        exit 1
    fi
    
    # Get namespace
    NAMESPACE=${1:-exam-platform}
    
    print_status "Deploying to namespace: $NAMESPACE"
    
    # Apply Kubernetes configurations
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/configmaps.yaml
    kubectl apply -f k8s/secrets.yaml
    kubectl apply -f k8s/postgres.yaml
    kubectl apply -f k8s/redis.yaml
    kubectl apply -f k8s/backend.yaml
    kubectl apply -f k8s/frontend.yaml
    kubectl apply -f k8s/ai-proctoring.yaml
    kubectl apply -f k8s/ingress.yaml
    
    print_status "Kubernetes resources applied."
    
    # Wait for deployments to be ready
    print_status "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/backend -n $NAMESPACE
    kubectl wait --for=condition=available --timeout=300s deployment/frontend -n $NAMESPACE
    kubectl wait --for=condition=available --timeout=300s deployment/postgres -n $NAMESPACE
    
    print_status "Deployments are ready!"
    
    # Show status
    echo ""
    print_header "Deployment Status"
    kubectl get pods -n $NAMESPACE
    kubectl get services -n $NAMESPACE
    kubectl get ingress -n $NAMESPACE
}

# Setup with Helm
setup_helm() {
    print_header "Helm Deployment Setup"
    
    # Check for Helm chart
    if [ ! -d "helm/exam-platform" ]; then
        print_error "Helm chart directory not found."
        exit 1
    fi
    
    # Check if helm is available
    if ! command -v helm &> /dev/null; then
        print_error "Helm is required for Helm deployment."
        exit 1
    fi
    
    # Get namespace and release name
    NAMESPACE=${1:-exam-platform}
    RELEASE_NAME=${2:-exam-platform}
    
    # Add required repositories
    print_status "Adding Helm repositories..."
    helm repo add bitnami https://charts.bitnami.com/bitnami 2>/dev/null || true
    helm repo add jetstack https://charts.jetstack.io 2>/dev/null || true
    helm repo update
    
    # Install or upgrade
    if helm list -n $NAMESPACE | grep -q $RELEASE_NAME; then
        print_status "Upgrading existing release..."
        helm upgrade $RELEASE_NAME ./helm/exam-platform -n $NAMESPACE
    else
        print_status "Installing new release..."
        helm install $RELEASE_NAME ./helm/exam-platform -n $NAMESPACE \
            --set frontend.domain=${3:-exam.yourdomain.com} \
            --set backend.domain=${4:-api.exam.yourdomain.com} \
            --set postgresql.auth.postgresPassword=${5:-secure-password}
    fi
    
    print_status "Helm deployment completed!"
    
    # Show status
    echo ""
    print_header "Helm Release Status"
    helm list -n $NAMESPACE
    helm status $RELEASE_NAME -n $NAMESPACE
}

# Development utilities
dev_utils() {
    print_header "Development Utilities"
    
    case $1 in
        "logs")
            print_status "Showing logs for all services..."
            docker compose logs -f
            ;;
        "shell")
            print_status "Opening shell in backend container..."
            docker exec -it $(docker compose ps -q backend) /bin/bash
            ;;
        "db")
            print_status "Connecting to PostgreSQL..."
            docker exec -it $(docker compose ps -q postgres) psql -U postgres -d exam_platform
            ;;
        "test")
            print_status "Running tests..."
            docker exec -it $(docker compose ps -q backend) npm run test
            ;;
        "build")
            print_status "Building frontend..."
            cd frontend && npm run build
            ;;
        "clean")
            print_status "Cleaning up..."
            docker compose down -v
            docker system prune -f
            ;;
        *)
            print_warning "Unknown utility: $1"
            print_status "Available utilities: logs, shell, db, test, build, clean"
            ;;
    esac
}

# Production utilities
prod_utils() {
    print_header "Production Utilities"
    
    case $1 in
        "status")
            print_status "Cluster status..."
            kubectl get pods -n exam-platform
            kubectl get services -n exam-platform
            kubectl get ingress -n exam-platform
            ;;
        "scale")
            SERVICE=${2:-backend}
            REPLICAS=${3:-3}
            print_status "Scaling $SERVICE to $REPLICAS replicas..."
            kubectl scale deployment $SERVICE --replicas=$REPLICAS -n exam-platform
            ;;
        "logs")
            SERVICE=${2:-backend}
            print_status "Showing logs for $SERVICE..."
            kubectl logs -f deployment/$SERVICE -n exam-platform
            ;;
        "port-forward")
            SERVICE=${2:-backend}
            PORT=${3:-4000}
            print_status "Port-forwarding $SERVICE to port $PORT..."
            kubectl port-forward service/$SERVICE-service $PORT:$PORT -n exam-platform
            ;;
        "restart")
            SERVICE=${2:-backend}
            print_status "Restarting $SERVICE deployment..."
            kubectl rollout restart deployment/$SERVICE -n exam-platform
            ;;
        *)
            print_warning "Unknown utility: $1"
            print_status "Available utilities: status, scale, logs, port-forward, restart"
            ;;
    esac
}

# Help function
show_help() {
    echo -e "${BLUE}Secure Exam Platform Setup Script${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  local           Setup local development environment"
    echo "  prod            Deploy to production Kubernetes"
    echo "  helm            Deploy using Helm charts"
    echo "  dev-utils       Development utilities (logs, shell, db, test, build, clean)"
    echo "  prod-utils      Production utilities (status, scale, logs, port-forward, restart)"
    echo "  help            Show this help message"
    echo ""
    echo "Local Development:"
    echo "  $0 local                    Start all services locally"
    echo "  $0 dev-utils logs            Show logs"
    echo "  $0 dev-utils shell           Open shell in backend"
    echo "  $0 dev-utils db              Connect to database"
    echo "  $0 dev-utils test            Run tests"
    echo "  $0 dev-utils build           Build frontend"
    echo "  $0 dev-utils clean           Clean up containers"
    echo ""
    echo "Production Deployment:"
    echo "  $0 prod [namespace]           Deploy to Kubernetes"
    echo "  $0 prod-utils status [service]   Show deployment status"
    echo "  $0 prod-utils scale [service] [replicas]   Scale deployment"
    echo "  $0 prod-utils logs [service]    Show logs"
    echo "  $0 prod-utils port-forward [service] [port]   Port forward"
    echo "  $0 prod-utils restart [service]   Restart deployment"
    echo ""
    echo "Helm Deployment:"
    echo "  $0 helm [namespace] [release] [domain] [api-domain] [password]"
    echo ""
    echo "Examples:"
    echo "  $0 local"
    echo "  $0 prod exam-platform"
    echo "  $0 helm exam-platform exam-platform exam.yourdomain.com api.exam.yourdomain.com secure-password"
}

# Main script logic
main() {
    case $1 in
        "local")
            check_prerequisites
            setup_local
            ;;
        "prod")
            check_prerequisites
            setup_production $2
            ;;
        "helm")
            check_prerequisites
            setup_helm $2 $3 $4 $5 $6
            ;;
        "dev-utils")
            dev_utils $2 $3 $4
            ;;
        "prod-utils")
            prod_utils $2 $3 $4
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
}

# Run main function with all arguments
main "$@"
