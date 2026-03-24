#!/bin/bash

# Secure Exam Platform - Complete Setup Script
# ============================================
# This script sets up:
# - Minikube cluster
# - Secure Exam Platform
# - Grafana monitoring
# - ArgoCD GitOps
# - All access services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
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
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Cleanup function
cleanup() {
    print_info "Cleaning up background processes..."
    pkill -f "minikube tunnel" || true
    pkill -f "kubectl port-forward" || true
}

# Trap cleanup on script exit
trap cleanup EXIT

# Main function
main() {
    print_header "🚀 Secure Exam Platform - Complete Setup"
    echo ""
    print_info "This script will set up:"
    echo "  • Minikube cluster"
    echo "  • Secure Exam Platform application"
    echo "  • Grafana monitoring"
    echo "  • ArgoCD GitOps"
    echo "  • All access services"
    echo ""
    
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Setup cancelled"
        exit 0
    fi

    # 1. Check prerequisites
    print_header "🔧 Checking Prerequisites"
    echo "=================================="
    
    # Check Docker
    if command -v docker &> /dev/null; then
        print_success "Docker is installed"
    else
        print_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check if user is in docker group
    if groups $USER | grep -q docker; then
        print_success "User is in docker group"
    else
        print_warning "User is not in docker group. Adding user to docker group..."
        sudo usermod -aG docker $USER
        print_warning "Please logout and login again, then run this script again."
        exit 1
    fi
    
    # Check Minikube
    if command -v minikube &> /dev/null; then
        print_success "Minikube is installed"
    else
        print_info "Installing Minikube..."
        curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
        sudo install minikube-linux-amd64 /usr/local/bin/minikube
        rm minikube-linux-amd64
        print_success "Minikube installed"
    fi
    
    # Check kubectl
    if command -v kubectl &> /dev/null; then
        print_success "kubectl is installed"
    else
        print_info "Installing kubectl..."
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
        rm kubectl
        print_success "kubectl installed"
    fi
    
    # Check Helm
    if command -v helm &> /dev/null; then
        print_success "Helm is installed"
    else
        print_info "Installing Helm..."
        curl https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz | tar xz
        sudo install linux-amd64/helm /usr/local/bin/helm
        rm -rf linux-amd64
        print_success "Helm installed"
    fi

    # 2. Setup Minikube
    print_header "🏗️  Setting up Minikube Cluster"
    echo "===================================="
    
    if minikube status | grep -q "Running"; then
        print_success "Minikube is already running"
    else
        print_info "Starting Minikube..."
        minikube start --cpus=2 --memory=4096 --disk-size=20g
        print_success "Minikube started"
    fi
    
    # Enable addons
    print_info "Enabling Minikube addons..."
    minikube addons enable ingress
    minikube addons enable metrics-server
    print_success "Minikube addons enabled"

    # 3. Setup namespaces and secrets
    print_header "🔐 Setting up Namespaces and Secrets"
    echo "=========================================="
    
    # Create namespaces
    kubectl create namespace exam-platform --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
    print_success "Namespaces created"
    
    # Create secrets
    print_info "Creating secrets..."
    kubectl create secret generic exam-platform-secret \
        --from-literal=DB_USER=admin \
        --from-literal=DB_PASSWORD=password123 \
        --from-literal=JWT_SECRET=your-jwt-secret-key-here \
        --from-literal=JWT_REFRESH_SECRET=your-refresh-secret-key-here \
        -n exam-platform --dry-run=client -o yaml | kubectl apply -f -
    print_success "Secrets created"

    # 4. Deploy databases
    print_header "🗄️  Deploying Databases"
    echo "=========================="
    
    # Deploy PostgreSQL
    print_info "Deploying PostgreSQL..."
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: exam-platform
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: exam-platform-secret
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: exam-platform-secret
              key: DB_PASSWORD
        - name: POSTGRES_DB
          value: exam_platform
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: exam-platform
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
EOF
    
    # Deploy Redis
    print_info "Deploying Redis..."
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: exam-platform
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: exam-platform
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
EOF
    
    # Wait for databases
    print_info "Waiting for databases to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n exam-platform --timeout=300s
    kubectl wait --for=condition=ready pod -l app=redis -n exam-platform --timeout=300s
    print_success "Databases are ready"

    # 5. Deploy application services
    print_header "🚀 Deploying Application Services"
    echo "======================================="
    
    # Deploy Backend
    print_info "Deploying Backend..."
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: exam-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: bayarmaa/exam-platform-backend:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 4000
        env:
        - name: DB_HOST
          value: postgres
        - name: DB_PORT
          value: "5432"
        - name: DB_NAME
          value: exam_platform
        - name: REDIS_HOST
          value: redis
        - name: REDIS_PORT
          value: "6379"
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: exam-platform-secret
              key: DB_USER
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: exam-platform-secret
              key: DB_PASSWORD
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: exam-platform
spec:
  selector:
    app: backend
  ports:
  - port: 4000
    targetPort: 4000
  type: ClusterIP
EOF
    
    # Deploy AI Proctoring
    print_info "Deploying AI Proctoring..."
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-proctoring
  namespace: exam-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ai-proctoring
  template:
    metadata:
      labels:
        app: ai-proctoring
    spec:
      containers:
      - name: ai-proctoring
        image: bayarmaa/exam-ai-proctor:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 5000
---
apiVersion: v1
kind: Service
metadata:
  name: ai-proctoring
  namespace: exam-platform
spec:
  selector:
    app: ai-proctoring
  ports:
  - port: 5000
    targetPort: 5000
  type: ClusterIP
EOF
    
    # Deploy Frontend
    print_info "Deploying Frontend..."
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: exam-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: bayarmaa/exam-frontend:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: exam-platform
spec:
  selector:
    app: frontend
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
EOF
    
    # Wait for application services
    print_info "Waiting for application services to be ready..."
    kubectl wait --for=condition=ready pod -l app=backend -n exam-platform --timeout=300s
    kubectl wait --for=condition=ready pod -l app=ai-proctoring -n exam-platform --timeout=300s
    kubectl wait --for=condition=ready pod -l app=frontend -n exam-platform --timeout=300s
    print_success "Application services are ready"

    # 6. Setup Ingress
    print_header "🌐 Setting up Ingress"
    echo "=========================="
    
    kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: exam-platform-ingress
  namespace: exam-platform
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
spec:
  ingressClassName: nginx
  rules:
  - host: exam-platform.local
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 4000
      - path: /ai
        pathType: Prefix
        backend:
          service:
            name: ai-proctoring
            port:
              number: 5000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 3000
EOF
    
    print_success "Ingress configured"

    # 7. Setup Grafana Monitoring
    print_header "📊 Setting up Grafana Monitoring"
    echo "====================================="
    
    print_info "Adding Helm repositories..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    print_info "Installing monitoring stack..."
    helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
    
    print_info "Waiting for Grafana to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana -n monitoring --timeout=300s
    print_success "Grafana is ready"

    # 8. Setup ArgoCD
    print_header "⚙️  Setting up ArgoCD GitOps"
    echo "==============================="
    
    print_info "Installing ArgoCD..."
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
    
    print_info "Waiting for ArgoCD to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
    print_success "ArgoCD is ready"

    # 9. Start Access Services
    print_header "🔗 Starting Access Services"
    echo "============================="
    
    # Start Minikube tunnel
    print_info "Starting Minikube tunnel for ingress..."
    if ! pgrep -f "minikube tunnel" > /dev/null; then
        minikube tunnel > /dev/null 2>&1 &
        TUNNEL_PID=$!
        print_success "Minikube tunnel started (PID: $TUNNEL_PID)"
        sleep 5
    else
        print_info "Minikube tunnel already running"
    fi
    
    # Start Grafana port-forward (find available port)
    print_info "Starting Grafana port-forward..."
    if ! pgrep -f "kubectl port-forward.*grafana" > /dev/null; then
        # Find available port starting from 3002
        GRAFANA_LOCAL_PORT=3002
        while netstat -tlnp 2>/dev/null | grep ":$GRAFANA_LOCAL_PORT " > /dev/null; do
            GRAFANA_LOCAL_PORT=$((GRAFANA_LOCAL_PORT + 1))
            if [ $GRAFANA_LOCAL_PORT -gt 3010 ]; then
                print_error "No available ports found for Grafana"
                exit 1
            fi
        done
        
        kubectl port-forward svc/prometheus-grafana -n monitoring $GRAFANA_LOCAL_PORT:80 > /dev/null 2>&1 &
        GRAFANA_PID=$!
        print_success "Grafana port-forward started on port $GRAFANA_LOCAL_PORT (PID: $GRAFANA_PID)"
    else
        print_info "Grafana port-forward already running"
        GRAFANA_LOCAL_PORT=3002  # Default assumption
    fi
    
    # Start ArgoCD port-forward (find available port)
    print_info "Starting ArgoCD port-forward..."
    if ! pgrep -f "kubectl port-forward.*argocd" > /dev/null; then
        # Find available port starting from 8081
        ARGOCD_LOCAL_PORT=8081
        while netstat -tlnp 2>/dev/null | grep ":$ARGOCD_LOCAL_PORT " > /dev/null; do
            ARGOCD_LOCAL_PORT=$((ARGOCD_LOCAL_PORT + 1))
            if [ $ARGOCD_LOCAL_PORT -gt 8090 ]; then
                print_error "No available ports found for ArgoCD"
                exit 1
            fi
        done
        
        kubectl port-forward svc/argocd-server -n argocd $ARGOCD_LOCAL_PORT:443 > /dev/null 2>&1 &
        ARGOCD_PID=$!
        print_success "ArgoCD port-forward started on port $ARGOCD_LOCAL_PORT (PID: $ARGOCD_PID)"
    else
        print_info "ArgoCD port-forward already running"
        ARGOCD_LOCAL_PORT=8081  # Default assumption
    fi
    
    # Get ArgoCD password
    ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' 2>/dev/null | base64 --decode || echo "password-not-found")

    # 10. Display Final Information
    print_header "🎉 Setup Complete!"
    echo "==================="
    echo ""
    print_success "🌐 Exam Platform:    http://exam-platform.local"
    print_success "📊 Grafana:           http://localhost:$GRAFANA_LOCAL_PORT"
    print_success "⚙️  ArgoCD:            https://localhost:$ARGOCD_LOCAL_PORT"
    echo ""
    print_info "🔑 Grafana Credentials:"
    echo "   Username: admin"
    echo "   Password: prom-operator"
    echo ""
    print_info "🔑 ArgoCD Credentials:"
    echo "   Username: admin"
    echo "   Password: $ARGOCD_PASSWORD"
    echo ""
    print_info "📝 Management Commands:"
    echo "   • Check pods:       kubectl get pods -n exam-platform"
    echo "   • Check services:   kubectl get svc -n exam-platform"
    echo "   • Check ingress:    kubectl get ingress -n exam-platform"
    echo "   • Check monitoring: kubectl get pods -n monitoring"
    echo "   • Check ArgoCD:     kubectl get pods -n argocd"
    echo "   • View logs:        kubectl logs -f deployment/<name> -n exam-platform"
    echo ""
    print_info "🛑 To stop all services:"
    echo "   pkill -f 'minikube tunnel'"
    echo "   pkill -f 'kubectl port-forward'"
    echo ""
    print_success "🎊 Enjoy your Secure Exam Platform!"
}

# Run main function
main "$@"
