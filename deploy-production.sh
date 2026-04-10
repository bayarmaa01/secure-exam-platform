#!/bin/bash

echo "=== PRODUCTION DEPLOYMENT SCRIPT ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
}

print_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

print_header() {
    echo -e "${PURPLE}=== $1 ===${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites"
    
    # Check kubectl
    if ! command -v kubectl >/dev/null 2>&1; then
        print_error "kubectl is not installed"
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info >/dev/null 2>&1; then
        print_error "kubectl cannot connect to cluster"
        exit 1
    fi
    
    # Check helm
    if ! command -v helm >/dev/null 2>&1; then
        print_error "helm is not installed"
        exit 1
    fi
    
    # Check docker
    if ! command -v docker >/dev/null 2>&1; then
        print_error "docker is not installed"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to build and push Docker images
build_and_push_images() {
    print_step "Building and pushing Docker images"
    
    # Build backend image
    echo "Building backend image..."
    cd backend
    docker build -t backend:v1.0.0 .
    docker tag backend:v1.0.0 backend:latest
    echo "Backend image built successfully"
    
    # Build frontend image
    echo "Building frontend image..."
    cd ../frontend
    docker build -t frontend:v1.0.0 .
    docker tag frontend:v1.0.0 frontend:latest
    echo "Frontend image built successfully"
    
    # Build AI service image
    echo "Building AI service image..."
    cd ../ai-proctoring
    docker build -t ai-proctoring:v1.0.0 .
    docker tag ai-proctoring:v1.0.0 ai-proctoring:latest
    echo "AI service image built successfully"
    
    cd ..
    print_success "All images built successfully"
}

# Function to create namespaces and secrets
setup_namespaces_and_secrets() {
    print_step "Setting up namespaces and secrets"
    
    # Create namespaces
    kubectl create namespace exam-platform --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
    
    # Create secret with all required environment variables
    kubectl create secret generic exam-platform-secret \
        --from-literal=DB_HOST=postgres \
        --from-literal=DB_PORT=5432 \
        --from-literal=DB_USER=exam_user \
        --from-literal=DB_PASSWORD=exam_password \
        --from-literal=DB_NAME=exam_platform \
        --from-literal=REDIS_HOST=redis \
        --from-literal=REDIS_PORT=6379 \
        --from-literal=DATABASE_URL=postgresql://exam_user:exam_password@postgres:5432/exam_platform \
        --from-literal=REDIS_URL=redis://redis:6379 \
        --from-literal=JWT_SECRET=your-production-jwt-secret-change-this \
        --from-literal=JWT_REFRESH_SECRET=your-production-refresh-secret-change-this \
        --from-literal=CORS_ORIGIN=http://localhost:3000 \
        --from-literal=RATE_LIMIT_WINDOW_MS=900000 \
        --from-literal=RATE_LIMIT_MAX_REQUESTS=100 \
        --dry-run=client -o yaml | kubectl apply -f - -n exam-platform
    
    print_success "Namespaces and secrets created"
}

# Function to deploy infrastructure (PostgreSQL, Redis)
deploy_infrastructure() {
    print_step "Deploying infrastructure"
    
    # Deploy PostgreSQL
    cat <<EOF | kubectl apply -f -
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
        env:
        - name: POSTGRES_DB
          value: exam_platform
        - name: POSTGRES_USER
          value: exam_user
        - name: POSTGRES_PASSWORD
          value: exam_password
        - name: POSTGRES_INITDB_ARGS
          value: "--encoding=UTF-8"
        ports:
        - containerPort: 5432
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - exam_user
            - -d
            - exam_platform
          initialDelaySeconds: 5
          periodSeconds: 5
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - exam_user
            - -d
            - exam_platform
          initialDelaySeconds: 30
          periodSeconds: 10
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
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
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: exam-platform
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
EOF

    # Deploy Redis
    cat <<EOF | kubectl apply -f -
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
        resources:
          requests:
            memory: "128Mi"
            cpu: "50m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
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

    print_success "Infrastructure deployed"
}

# Function to deploy application services
deploy_applications() {
    print_step "Deploying application services"
    
    # Deploy backend with production configuration
    kubectl apply -f k8s/backend-deployment-production.yaml
    
    # Deploy frontend
    cat <<EOF | kubectl apply -f -
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
        image: frontend:v1.0.0
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "50m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: exam-platform
spec:
  type: LoadBalancer
  ports:
  - port: 3000
    targetPort: 80
  selector:
    app: frontend
EOF

    # Deploy AI service
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-proctoring
  namespace: exam-platform
spec:
  replicas: 1
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
        image: ai-proctoring:v1.0.0
        ports:
        - containerPort: 5000
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 15
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: ai-proctoring
  namespace: exam-platform
spec:
  type: ClusterIP
  ports:
  - port: 5000
    targetPort: 5000
  selector:
    app: ai-proctoring
EOF

    print_success "Application services deployed"
}

# Function to deploy monitoring stack
deploy_monitoring() {
    print_step "Deploying monitoring stack"
    
    # Use the fix-grafana.sh script
    if [ -f "fix-grafana.sh" ]; then
        chmod +x fix-grafana.sh
        ./fix-grafana.sh
    else
        print_warning "fix-grafana.sh not found, deploying basic monitoring"
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        helm install prometheus prometheus-community/kube-prometheus-stack \
            -n monitoring \
            --create-namespace \
            --set grafana.adminPassword=admin123 \
            --set grafana.securityContext.runAsUser=472 \
            --set grafana.securityContext.runAsGroup=472 \
            --set grafana.securityContext.fsGroup=472 \
            --set grafana.initChownData.securityContext.runAsUser=0 \
            --set grafana.initChownData.securityContext.runAsGroup=0
    fi
    
    print_success "Monitoring stack deployed"
}

# Function to deploy ArgoCD
deploy_argocd() {
    print_step "Deploying ArgoCD"
    
    # Use the fix-argocd.sh script
    if [ -f "fix-argocd.sh" ]; then
        chmod +x fix-argocd.sh
        ./fix-argocd.sh
    else
        print_warning "fix-argocd.sh not found, deploying basic ArgoCD"
        kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
        kubectl apply -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml -n argocd
    fi
    
    print_success "ArgoCD deployed"
}

# Function to wait for all deployments to be ready
wait_for_deployments() {
    print_step "Waiting for all deployments to be ready"
    
    # Wait for infrastructure
    echo "Waiting for PostgreSQL..."
    kubectl wait --for=condition=ready pod -l app=postgres -n exam-platform --timeout=300s
    
    echo "Waiting for Redis..."
    kubectl wait --for=condition=ready pod -l app=redis -n exam-platform --timeout=300s
    
    # Wait for applications
    echo "Waiting for Backend..."
    kubectl wait --for=condition=ready pod -l app=backend -n exam-platform --timeout=300s
    
    echo "Waiting for Frontend..."
    kubectl wait --for=condition=ready pod -l app=frontend -n exam-platform --timeout=300s
    
    echo "Waiting for AI Service..."
    kubectl wait --for=condition=ready pod -l app=ai-proctoring -n exam-platform --timeout=300s
    
    # Wait for monitoring
    echo "Waiting for Grafana..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana -n monitoring --timeout=300s
    
    # Wait for ArgoCD
    echo "Waiting for ArgoCD..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
    
    print_success "All deployments are ready"
}

# Function to expose services
expose_services() {
    print_step "Exposing services"
    
    # Port-forward for local access
    echo "Setting up port forwards..."
    
    # Frontend
    kubectl port-forward svc/frontend -n exam-platform 3000:3000 >/dev/null 2>&1 &
    echo $! > /tmp/frontend-port-forward.pid
    
    # Backend
    kubectl port-forward svc/backend -n exam-platform 4000:4000 >/dev/null 2>&1 &
    echo $! > /tmp/backend-port-forward.pid
    
    # AI Service
    kubectl port-forward svc/ai-proctoring -n exam-platform 5005:5000 >/dev/null 2>&1 &
    echo $! > /tmp/ai-port-forward.pid
    
    # Grafana
    kubectl port-forward svc/prometheus-grafana -n monitoring 3002:3000 >/dev/null 2>&1 &
    echo $! > /tmp/grafana-port-forward.pid
    
    # ArgoCD
    kubectl port-forward svc/argocd-server -n argocd 18081:8080 >/dev/null 2>&1 &
    echo $! > /tmp/argocd-port-forward.pid
    
    print_success "Services exposed"
}

# Function to show access information
show_access_info() {
    print_header "=== DEPLOYMENT COMPLETE ==="
    
    echo -e "${GREEN}Services are now accessible:${NC}"
    echo -e "${GREEN}   Frontend:   http://localhost:3000${NC}"
    echo -e "${GREEN}   Backend:    http://localhost:4000${NC}"
    echo -e "${GREEN}   AI Service: http://localhost:5005${NC}"
    echo -e "${GREEN}   Grafana:    http://localhost:3002${NC}"
    echo -e "${GREEN}   ArgoCD:     http://localhost:18081${NC}"
    echo ""
    
    echo -e "${GREEN}Login Credentials:${NC}"
    echo -e "${GREEN}   Grafana:    admin / admin123${NC}"
    echo -e "${GREEN}   ArgoCD:     admin / <check secret>${NC}"
    echo ""
    
    echo -e "${GREEN}To get ArgoCD password:${NC}"
    echo -e "${GREEN}   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d${NC}"
    echo ""
    
    print_success "Production deployment completed successfully!"
}

# Function to cleanup port forwards
cleanup_port_forwards() {
    echo "Cleaning up port forwards..."
    
    for pid_file in /tmp/*-port-forward.pid; do
        if [ -f "$pid_file" ]; then
            kill $(cat "$pid_file") 2>/dev/null || true
            rm -f "$pid_file"
        fi
    done
}

# Main execution
main() {
    echo -e "${PURPLE}=== PRODUCTION DEPLOYMENT ===${NC}"
    echo ""
    
    # Set up cleanup trap
    trap cleanup_port_forwards EXIT
    
    # Execute deployment steps
    check_prerequisites
    build_and_push_images
    setup_namespaces_and_secrets
    deploy_infrastructure
    deploy_applications
    deploy_monitoring
    deploy_argocd
    wait_for_deployments
    expose_services
    show_access_info
}

# Run main function
main "$@"
