#!/bin/bash

# 🚀 SMART DEVOPS - Production-Grade Kubernetes + ArgoCD GitOps Deployment
# Senior DevOps Engineer Version

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Global variables
DEPLOY_MODE=""
ARGOCD_PASSWORD=""
KUBECTL_CMD="kubectl"

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

# ========================================
# DEPLOYMENT MODE SELECTION
# ========================================
select_mode() {
    echo -e "${CYAN}🎯 Select deployment mode:${NC}"
    echo "1) Full Deploy (clean everything)"
    echo "2) Fast Deploy"
    echo "3) Debug Mode"
    echo ""
    
    while true; do
        read -p "Enter mode [1-3]: " choice
        case $choice in
            1)
                DEPLOY_MODE="FULL"
                print_success "Selected: Full Deploy (clean everything)"
                break
                ;;
            2)
                DEPLOY_MODE="FAST"
                print_success "Selected: Fast Deploy"
                break
                ;;
            3)
                DEPLOY_MODE="DEBUG"
                print_success "Selected: Debug Mode"
                break
                ;;
            *)
                print_error "Invalid choice. Please enter 1, 2, or 3."
                ;;
        esac
    done
}

# ========================================
# PRE-CHECKS
# ========================================
pre_checks() {
    print_step "Running pre-checks..."
    
    # Check Docker
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running"
        print_info "Starting Docker..."
        sudo systemctl start docker || {
            print_error "Failed to start Docker"
            exit 1
        }
    fi
    print_success "Docker is running"
    
    # Check Minikube
    if ! minikube status >/dev/null 2>&1; then
        print_error "Minikube is not running"
        print_info "Starting Minikube..."
        minikube start || {
            print_error "Failed to start Minikube"
            exit 1
        }
    fi
    print_success "Minikube is running"
    
    # Set kubectl context
    $KUBECTL_CMD config use-context minikube >/dev/null 2>&1 || {
        print_error "Failed to set kubectl context"
        exit 1
    }
    print_success "kubectl context set to minikube"
    
    # Verify cluster access
    if ! $KUBECTL_CMD cluster-info >/dev/null 2>&1; then
        print_error "Cannot access Kubernetes cluster"
        exit 1
    fi
    print_success "Kubernetes cluster accessible"
}

# ========================================
# CLEANUP FUNCTIONS
# ========================================
cleanup_full() {
    print_step "Full cleanup - removing all resources..."
    
    # Delete namespaces
    $KUBECTL_CMD delete namespace exam-platform --ignore-not-found=true --grace-period=0 >/dev/null 2>&1 || true
    $KUBECTL_CMD delete namespace monitoring --ignore-not-found=true --grace-period=0 >/dev/null 2>&1 || true
    $KUBECTL_CMD delete namespace argocd --ignore-not-found=true --grace-period=0 >/dev/null 2>&1 || true
    
    # Wait for cleanup
    sleep 10
    print_success "Cleanup completed"
}

# ========================================
# KUBERNETES DEPLOYMENT
# ========================================
deploy_namespaces() {
    print_step "Creating namespaces..."
    
    $KUBECTL_CMD create namespace exam-platform --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    $KUBECTL_CMD create namespace monitoring --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    $KUBECTL_CMD create namespace argocd --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    
    print_success "Namespaces created"
}

deploy_postgres() {
    print_step "Deploying PostgreSQL..."
    
    # Apply PostgreSQL resources
    if [[ -f "k8s/postgres-deployment.yaml" ]]; then
        $KUBECTL_CMD apply -f k8s/postgres-deployment.yaml -n exam-platform
    else
        # Create inline PostgreSQL deployment
        cat <<EOF | $KUBECTL_CMD apply -f -
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
---
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
        image: postgres:15
        env:
        - name: POSTGRES_DB
          value: "exam_platform"
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          value: "postgres"
        ports:
        - containerPort: 5432
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
EOF
    fi
    
    print_success "PostgreSQL deployed"
}

deploy_redis() {
    print_step "Deploying Redis..."
    
    cat <<EOF | $KUBECTL_CMD apply -f -
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
    
    print_success "Redis deployed"
}

deploy_backend() {
    print_step "Deploying Backend..."
    
    # Build backend image
    print_info "Building backend image..."
    docker build -t backend:latest ./backend || {
        print_error "Failed to build backend image"
        exit 1
    }
    
    # Apply backend deployment
    if [[ -f "k8s/backend-deployment.yaml" ]]; then
        $KUBECTL_CMD apply -f k8s/backend-deployment.yaml -n exam-platform
    else
        # Create inline backend deployment
        cat <<EOF | $KUBECTL_CMD apply -f -
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
        image: backend:latest
        ports:
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "4000"
        - name: DATABASE_URL
          value: "postgresql://postgres:postgres@postgres:5432/exam_platform"
        - name: REDIS_URL
          value: "redis://redis:6379"
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
EOF
    fi
    
    print_success "Backend deployed"
}

deploy_ai_service() {
    print_step "Deploying AI Service..."
    
    # Build AI service image
    print_info "Building AI service image..."
    docker build -t ai-proctoring:latest ./ai-proctoring || {
        print_error "Failed to build AI service image"
        exit 1
    }
    
    # Apply AI service deployment
    if [[ -f "k8s/ai-deployment.yaml" ]]; then
        $KUBECTL_CMD apply -f k8s/ai-deployment.yaml -n exam-platform
    else
        # Create inline AI service deployment
        cat <<EOF | $KUBECTL_CMD apply -f -
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
        image: ai-proctoring:latest
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
  - port: 80
    targetPort: 5000
EOF
    fi
    
    print_success "AI Service deployed"
}

deploy_frontend() {
    print_step "Deploying Frontend..."
    
    # Build frontend image
    print_info "Building frontend image..."
    docker build -t frontend:latest ./frontend || {
        print_error "Failed to build frontend image"
        exit 1
    }
    
    # Fix nginx config if needed
    fix_nginx_config
    
    # Apply frontend deployment
    if [[ -f "k8s/frontend-deployment.yaml" ]]; then
        $KUBECTL_CMD apply -f k8s/frontend-deployment.yaml -n exam-platform
    else
        # Create inline frontend deployment
        cat <<EOF | $KUBECTL_CMD apply -f -
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
        image: frontend:latest
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: exam-platform
spec:
  selector:
    app: frontend
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
EOF
    fi
    
    print_success "Frontend deployed"
}

deploy_monitoring() {
    print_step "Deploying Monitoring Stack..."
    
    # Add Prometheus Helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Deploy Prometheus stack
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set grafana.adminPassword=admin \
        --set prometheus.prometheusSpec.retention=7d
    
    print_success "Monitoring stack deployed"
}

# ========================================
# 🔥 ARGOCD SETUP
# ========================================
install_argocd() {
    print_step "Installing ArgoCD..."
    
    # Create namespace
    $KUBECTL_CMD create namespace argocd --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    
    # Install ArgoCD using kustomize (avoids CRD annotation issues)
    kubectl apply -k https://github.com/argoproj/argo-cd/manifests/cluster-install?ref=stable -n argocd
    
    print_success "ArgoCD installed"
}

wait_argocd_ready() {
    print_step "Waiting for ArgoCD to be ready..."
    
    # Wait for ArgoCD server deployment
    $KUBECTL_CMD rollout status deployment/argocd-server -n argocd --timeout=300s || {
        print_error "ArgoCD server failed to become ready"
        return 1
    }
    
    print_success "ArgoCD is ready"
}

expose_argocd() {
    print_step "Exposing ArgoCD UI..."
    
    # Port-forward ArgoCD server
    $KUBECTL_CMD port-forward svc/argocd-server -n argocd 8080:443 >/dev/null 2>&1 &
    ARGOCD_PID=$!
    echo $ARGOCD_PID > /tmp/argocd-port-forward.pid
    
    print_success "ArgoCD UI exposed on https://localhost:8080"
}

get_argocd_credentials() {
    print_step "Retrieving ArgoCD credentials..."
    
    # Get ArgoCD admin password
    ARGOCD_PASSWORD=$($KUBECTL_CMD -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
    
    print_header "🚀 ArgoCD Access"
    echo -e "${GREEN}URL: https://localhost:8080${NC}"
    echo -e "${GREEN}Username: admin${NC}"
    echo -e "${GREEN}Password: ${ARGOCD_PASSWORD}${NC}"
    echo -e "${PURPLE}======================================${NC}"
}

# ========================================
# AUTO FIXES
# ========================================
fix_nginx_config() {
    print_info "Checking nginx configuration..."
    
    # Check if nginx config has wrong upstream
    if grep -q "backend.exam-platform" frontend/nginx.conf 2>/dev/null; then
        print_warning "Fixing nginx upstream configuration..."
        sed -i 's/backend.exam-platform:4000/backend:4000/g' frontend/nginx.conf
        sed -i 's/ai-proctoring.exam-platform:80/ai-proctoring:80/g' frontend/nginx.conf
        print_success "Nginx configuration fixed"
    fi
}

fix_backend_service() {
    print_info "Checking backend service..."
    
    # Check if backend service exists
    if ! $KUBECTL_CMD get service backend -n exam-platform >/dev/null 2>&1; then
        print_warning "Backend service missing, creating it..."
        cat <<EOF | $KUBECTL_CMD apply -f -
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
EOF
        print_success "Backend service created"
    fi
}

validate_dns() {
    print_info "Validating DNS resolution..."
    
    # Test DNS resolution using nslookup (available in busybox)
    cat <<EOF | $KUBECTL_CMD apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: dns-test
  namespace: exam-platform
spec:
  containers:
  - name: dns-test
    image: busybox
    command: ['sleep', '3600']
EOF
    
    # Wait for pod to be ready
    $KUBECTL_CMD wait --for=condition=Ready pod/dns-test -n exam-platform --timeout=60s
    
    # Test DNS resolution with nslookup
    if $KUBECTL_CMD exec dns-test -n exam-platform -- nslookup backend >/dev/null 2>&1; then
        print_success "DNS resolution working"
    else
        print_error "DNS resolution failed"
        # Show DNS debug info
        $KUBECTL_CMD exec dns-test -n exam-platform -- cat /etc/resolv.conf
        $KUBECTL_CMD exec dns-test -n exam-platform -- nslookup backend
    fi
    
    # Clean up test pod
    $KUBECTL_CMD delete pod dns-test -n exam-platform --force --grace-period=0 >/dev/null 2>&1 || true
}

# ========================================
# HEALTH CHECKS
# ========================================
wait_for_pods() {
    print_step "Waiting for all pods to be ready..."
    
    local max_wait=300
    local wait_time=0
    
    while [[ $wait_time -lt $max_wait ]]; do
        local not_ready=$($KUBECTL_CMD get pods -n exam-platform --no-headers | grep -v "Running\|Completed" | wc -l)
        
        if [[ $not_ready -eq 0 ]]; then
            print_success "All pods are ready"
            return 0
        fi
        
        print_info "Waiting for pods... (${wait_time}s/${max_wait}s)"
        sleep 10
        wait_time=$((wait_time + 10))
    done
    
    print_warning "Timeout waiting for pods, continuing..."
}

detect_failures() {
    print_step "Checking for pod failures..."
    
    local failed_pods=$($KUBECTL_CMD get pods -n exam-platform --no-headers | grep -E "CrashLoopBackOff|Error|Pending|ImagePullBackOff")
    
    if [[ ! -z "$failed_pods" ]]; then
        print_error "Failed pods detected:"
        echo "$failed_pods"
        echo ""
        
        # Show logs for failed pods
        while IFS= read -r line; do
            local pod_name=$(echo "$line" | awk '{print $1}')
            print_info "Logs for $pod_name:"
            $KUBECTL_CMD logs "$pod_name" -n exam-platform --tail=20
            echo ""
        done <<< "$failed_pods"
    else
        print_success "No pod failures detected"
    fi
}

# ========================================
# ACCESS SETUP
# ========================================
setup_port_forwards() {
    print_step "Setting up port forwards..."
    
    # Kill existing port forwards
    pkill -f "port-forward" || true
    
    # Frontend
    $KUBECTL_CMD port-forward svc/frontend 3005:80 -n exam-platform >/dev/null 2>&1 &
    echo $! > /tmp/frontend-port-forward.pid
    
    # Backend
    $KUBECTL_CMD port-forward svc/backend 3000:4000 -n exam-platform >/dev/null 2>&1 &
    echo $! > /tmp/backend-port-forward.pid
    
    # Grafana
    $KUBECTL_CMD port-forward svc/prometheus-grafana 3001:3000 -n monitoring >/dev/null 2>&1 &
    echo $! > /tmp/grafana-port-forward.pid
    
    # Prometheus
    $KUBECTL_CMD port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring >/dev/null 2>&1 &
    echo $! > /tmp/prometheus-port-forward.pid
    
    print_success "Port forwards established"
}

# ========================================
# FINAL OUTPUT
# ========================================
final_output() {
    print_header "🚀 DEPLOYMENT COMPLETE"
    
    echo -e "${GREEN}📊 Pod Status:${NC}"
    $KUBECTL_CMD get pods -n exam-platform
    echo ""
    
    echo -e "${GREEN}📱 Access URLs:${NC}"
    echo -e "${GREEN}Frontend:  http://localhost:3005${NC}"
    echo -e "${GREEN}Backend:   http://localhost:3000${NC}"
    echo -e "${GREEN}Grafana:    http://localhost:3001${NC}"
    echo -e "${GREEN}Prometheus: http://localhost:9090${NC}"
    echo ""
    
    # Get Grafana password
    local grafana_password=$($KUBECTL_CMD get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 -d || echo "admin")
    
    echo -e "${GREEN}🔐 Credentials:${NC}"
    echo -e "${GREEN}Grafana:    admin / $grafana_password${NC}"
    echo -e "${GREEN}ArgoCD:     admin / $ARGOCD_PASSWORD${NC}"
    echo ""
    
    print_success "🎉 All services are accessible!"
}

# ========================================
# CLEANUP FUNCTION
# ========================================
cleanup() {
    print_info "Cleaning up port forwards..."
    
    # Kill port forwards
    if [[ -f /tmp/frontend-port-forward.pid ]]; then
        kill $(cat /tmp/frontend-port-forward.pid) 2>/dev/null || true
        rm -f /tmp/frontend-port-forward.pid
    fi
    
    if [[ -f /tmp/backend-port-forward.pid ]]; then
        kill $(cat /tmp/backend-port-forward.pid) 2>/dev/null || true
        rm -f /tmp/backend-port-forward.pid
    fi
    
    if [[ -f /tmp/grafana-port-forward.pid ]]; then
        kill $(cat /tmp/grafana-port-forward.pid) 2>/dev/null || true
        rm -f /tmp/grafana-port-forward.pid
    fi
    
    if [[ -f /tmp/prometheus-port-forward.pid ]]; then
        kill $(cat /tmp/prometheus-port-forward.pid) 2>/dev/null || true
        rm -f /tmp/prometheus-port-forward.pid
    fi
    
    if [[ -f /tmp/argocd-port-forward.pid ]]; then
        kill $(cat /tmp/argocd-port-forward.pid) 2>/dev/null || true
        rm -f /tmp/argocd-port-forward.pid
    fi
}

# ========================================
# MAIN EXECUTION
# ========================================
main() {
    echo -e "${CYAN}🚀 SMART DEVOPS - Production-Grade Kubernetes + ArgoCD GitOps Deployment${NC}"
    echo ""
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Select deployment mode
    select_mode
    
    # Run pre-checks
    pre_checks
    
    # Full cleanup if needed
    if [[ "$DEPLOY_MODE" == "FULL" ]]; then
        cleanup_full
    fi
    
    # Deploy in order
    deploy_namespaces
    deploy_postgres
    deploy_redis
    deploy_backend
    deploy_ai_service
    deploy_frontend
    deploy_monitoring
    
    # Auto fixes
    fix_backend_service
    fix_nginx_config
    validate_dns
    
    # ArgoCD setup
    install_argocd
    wait_argocd_ready
    expose_argocd
    get_argocd_credentials
    
    # Health checks
    wait_for_pods
    detect_failures
    
    # Setup access
    setup_port_forwards
    
    # Final output
    final_output
}

# Execute main function
main "$@"
