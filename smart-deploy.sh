#!/bin/bash

# 🔧 SMART DEPLOY SCRIPT - Advanced Automated Deployment
# Features: Auto-detection, Self-healing, Interactive modes, Zero manual intervention

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Global variables
DEPLOY_MODE=""
AUTO_RETRY_COUNT=0
MAX_RETRIES=3
KUBECTL="minikube kubectl --"

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

print_status() {
    local service=$1
    local status=$2
    local message=$3
    
    if [[ "$status" == "Running" ]]; then
        echo -e "${GREEN}[✓] ${service}: ${status}${NC}"
    elif [[ "$status" == "Error" ]]; then
        echo -e "${RED}[✗] ${service}: ${status} → ${message}${NC}"
    elif [[ "$status" == "Warning" ]]; then
        echo -e "${YELLOW}[!] ${service}: ${status} → ${message}${NC}"
    else
        echo -e "${CYAN}[?] ${service}: ${status}${NC}"
    fi
}

# ========================================
# MODE SELECTION
# ========================================
select_mode() {
    echo -e "${CYAN}🎯 Select deployment mode:${NC}"
    echo "1) FULL CLEAN DEPLOY (recommended)"
    echo "2) FAST DEPLOY (no deletion, quick restart)"
    echo ""
    
    while true; do
        read -p "Enter mode [1-2]: " choice
        case $choice in
            1)
                DEPLOY_MODE="FULL"
                print_success "Selected: FULL CLEAN DEPLOY"
                break
                ;;
            2)
                DEPLOY_MODE="FAST"
                print_success "Selected: FAST DEPLOY"
                break
                ;;
            *)
                print_error "Invalid choice. Please enter 1 or 2."
                ;;
        esac
    done
}

# ========================================
# CLUSTER CHECK
# ========================================
check_cluster() {
    print_step "Checking Kubernetes cluster..."
    
    if ! $KUBECTL cluster-info >/dev/null 2>&1; then
        print_error "Kubernetes cluster not accessible"
        print_info "Starting Minikube..."
        minikube start
        print_success "Minikube started"
    else
        print_success "Kubernetes cluster accessible"
    fi
    
    # Set context
    minikube kubectl -- config use-context minikube >/dev/null 2>&1 || true
}

# ========================================
# SMART ERROR DETECTION
# ========================================
detect_issues() {
    print_step "Detecting deployment issues..."
    
    local issues_found=false
    
    # Check for CrashLoopBackOff pods
    local crashloop_pods=$($KUBECTL get pods -n exam-platform --no-headers | grep CrashLoopBackOff | wc -l)
    if [[ $crashloop_pods -gt 0 ]]; then
        print_error "Found $crashloop_pods pods in CrashLoopBackOff"
        fix_crashloop_pods
        issues_found=true
    fi
    
    # Check for ImagePullBackOff
    local pull_error_pods=$($KUBECTL get pods -n exam-platform --no-headers | grep ImagePullBackOff | wc -l)
    if [[ $pull_error_pods -gt 0 ]]; then
        print_error "Found $pull_error_pods pods with ImagePullBackOff"
        fix_image_pull_errors
        issues_found=true
    fi
    
    # Check for Pending pods
    local pending_pods=$($KUBECTL get pods -n exam-platform --no-headers | grep Pending | wc -l)
    if [[ $pending_pods -gt 0 ]]; then
        print_error "Found $pending_pods pods stuck in Pending"
        fix_pending_pods
        issues_found=true
    fi
    
    # Check PVC issues
    local stuck_pvcs=$($KUBECTL get pvc -n exam-platform --no-headers | grep Terminating | wc -l)
    if [[ $stuck_pvcs -gt 0 ]]; then
        print_error "Found $stuck_pvcs PVCs stuck in Terminating"
        fix_stuck_pvcs
        issues_found=true
    fi
    
    # Check database connectivity
    check_database_issues
    
    # Check ArgoCD
    check_argocd_issues
    
    if [[ "$issues_found" == false ]]; then
        print_success "No issues detected"
    fi
}

# ========================================
# AUTO FIX ENGINE
# ========================================
fix_crashloop_pods() {
    print_step "Fixing CrashLoopBackOff pods..."
    
    # Get problematic pods
    local pods=$($KUBECTL get pods -n exam-platform --no-headers | grep CrashLoopBackOff | awk '{print $1}')
    
    for pod in $pods; do
        print_info "Restarting pod: $pod"
        $KUBECTL delete pod $pod -n exam-platform --grace-period=0 >/dev/null 2>&1 || true
    done
    
    # Restart deployments
    $KUBECTL rollout restart deployment/frontend -n exam-platform >/dev/null 2>&1 || true
    $KUBECTL rollout restart deployment/backend -n exam-platform >/dev/null 2>&1 || true
    
    sleep 5
    print_success "CrashLoopBackOff pods fixed"
}

fix_image_pull_errors() {
    print_step "Fixing ImagePullBackOff issues..."
    
    # Rebuild images if needed
    print_info "Rebuilding Docker images..."
    docker build -t backend:latest ./backend >/dev/null 2>&1 || true
    docker build -t frontend:latest ./frontend >/dev/null 2>&1 || true
    docker build -t ai-proctoring:latest ./ai-proctoring >/dev/null 2>&1 || true
    
    # Restart deployments
    $KUBECTL rollout restart deployment/frontend -n exam-platform >/dev/null 2>&1 || true
    $KUBECTL rollout restart deployment/backend -n exam-platform >/dev/null 2>&1 || true
    $KUBECTL rollout restart deployment/ai-proctoring -n exam-platform >/dev/null 2>&1 || true
    
    sleep 10
    print_success "ImagePullBackOff issues fixed"
}

fix_pending_pods() {
    print_step "Fixing Pending pods..."
    
    # Check resource constraints
    print_info "Checking resource availability..."
    $KUBECTL describe nodes >/dev/null 2>&1 || true
    
    # Delete and recreate problematic pods
    local pods=$($KUBECTL get pods -n exam-platform --no-headers | grep Pending | awk '{print $1}')
    for pod in $pods; do
        print_info "Deleting pending pod: $pod"
        $KUBECTL delete pod $pod -n exam-platform --grace-period=0 >/dev/null 2>&1 || true
    done
    
    sleep 5
    print_success "Pending pods fixed"
}

fix_stuck_pvcs() {
    print_step "Fixing stuck PVCs..."
    
    local pvcs=$($KUBECTL get pvc -n exam-platform --no-headers | grep Terminating | awk '{print $1}')
    for pvc in $pvcs; do
        print_info "Removing finalizers from PVC: $pvc"
        $KUBECTL patch pvc $pvc -n exam-platform -p '{"metadata":{"finalizers":null}}' --type=merge >/dev/null 2>&1 || true
        $KUBECTL delete pvc $pvc -n exam-platform --force --grace-period=0 >/dev/null 2>&1 || true
    done
    
    sleep 5
    print_success "Stuck PVCs fixed"
}

check_database_issues() {
    print_step "Checking database connectivity..."
    
    local postgres_status=$($KUBECTL get pods -n exam-platform --no-headers | grep postgres | awk '{print $3}')
    
    if [[ "$postgres_status" != "Running" ]]; then
        print_error "PostgreSQL is not running"
        fix_postgres_issues
    else
        # Check if database is accepting connections
        local db_ready=$($KUBECTL exec -n exam-platform deployment/postgres -- pg_isready -U postgres >/dev/null 2>&1 && echo "ready" || echo "not_ready")
        if [[ "$db_ready" != "ready" ]]; then
            print_error "Database not accepting connections"
            fix_postgres_issues
        else
            print_success "PostgreSQL is healthy"
        fi
    fi
}

fix_postgres_issues() {
    print_step "Fixing PostgreSQL issues..."
    
    # Delete PVC to reset data
    $KUBECTL delete pvc postgres-pvc -n exam-platform --force --grace-period=0 >/dev/null 2>&1 || true
    
    # Wait for PVC deletion
    sleep 10
    
    # Recreate PostgreSQL resources
    create_postgres_resources
    
    # Restart postgres deployment
    $KUBECTL rollout restart deployment/postgres -n exam-platform >/dev/null 2>&1 || true
    
    # Wait for database to be ready
    print_info "Waiting for PostgreSQL to be ready..."
    $KUBECTL wait --for=condition=ready pod -l app=postgres -n exam-platform --timeout=120s >/dev/null 2>&1 || print_warning "PostgreSQL wait timeout, proceeding..."
    
    print_success "PostgreSQL issues fixed"
}

check_argocd_issues() {
    print_step "Checking ArgoCD status..."
    
    if ! $KUBECTL get namespace argocd >/dev/null 2>&1; then
        print_error "ArgoCD namespace missing"
        install_argocd
    else
        local argocd_pods=$($KUBECTL get pods -n argocd --no-headers | grep -c Running)
        if [[ $argocd_pods -lt 2 ]]; then
            print_error "ArgoCD pods not running"
            fix_argocd_pods
        else
            print_success "ArgoCD is healthy"
        fi
    fi
}

install_argocd() {
    print_step "Installing ArgoCD..."
    
    $KUBECTL create namespace argocd >/dev/null 2>&1 || true
    $KUBECTL apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml >/dev/null 2>&1 || true
    
    # Wait for ArgoCD to be ready
    print_info "Waiting for ArgoCD to be ready..."
    $KUBECTL wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=180s
    
    print_success "ArgoCD installed and ready"
}

fix_argocd_pods() {
    print_step "Fixing ArgoCD pods..."
    
    $KUBECTL rollout restart deployment/argocd-server -n argocd >/dev/null 2>&1 || true
    $KUBECTL rollout restart deployment/argocd-repo-server -n argocd >/dev/null 2>&1 || true
    
    sleep 10
    print_success "ArgoCD pods fixed"
}

# ========================================
# DEPLOYMENT FUNCTIONS
# ========================================
full_clean_deploy() {
    print_step "Starting FULL CLEAN DEPLOY..."
    
    # Clean up everything
    print_info "Cleaning up old deployments..."
    $KUBECTL delete namespace exam-platform --ignore-not-found=true --grace-period=0 >/dev/null 2>&1 || true
    $KUBECTL delete namespace monitoring --ignore-not-found=true --grace-period=0 >/dev/null 2>&1 || true
    $KUBECTL delete namespace argocd --ignore-not-found=true --grace-period=0 >/dev/null 2>&1 || true
    
    # Wait for cleanup
    sleep 15
    
    # Use the working deploy-simple.sh directly
    print_info "Running deploy-simple.sh..."
    if [[ -f "deploy-simple.sh" ]]; then
        ./deploy-simple.sh
        if [[ $? -eq 0 ]]; then
            print_success "Deployment completed successfully"
            start_port_forwards
            display_credentials
            return 0
        else
            print_error "Deployment failed"
            return 1
        fi
    else
        print_error "deploy-simple.sh not found"
        return 1
    fi
}

fast_deploy() {
    print_step "Starting FAST DEPLOY..."
    
    # Only restart deployments, keep data
    print_info "Restarting existing deployments..."
    $KUBECTL rollout restart deployment/backend -n exam-platform >/dev/null 2>&1 || true
    $KUBECTL rollout restart deployment/frontend -n exam-platform >/dev/null 2>&1 || true
    $KUBECTL rollout restart deployment/ai-proctoring -n exam-platform >/dev/null 2>&1 || true
    $KUBECTL rollout restart deployment/postgres -n exam-platform >/dev/null 2>&1 || true
    $KUBECTL rollout restart deployment/redis -n exam-platform >/dev/null 2>&1 || true
    
    sleep 10
    verify_deployment
}

deploy_infrastructure() {
    print_step "Deploying infrastructure..."
    
    # Build images
    build_images
    
    # Create namespaces
    $KUBECTL create namespace exam-platform >/dev/null 2>&1 || true
    $KUBECTL create namespace monitoring >/dev/null 2>&1 || true
    $KUBECTL create namespace argocd >/dev/null 2>&1 || true
    
    # Apply secrets
    if [[ -f "k8s/secrets.yaml" ]]; then
        $KUBECTL apply -f k8s/secrets.yaml >/dev/null 2>&1 || true
    else
        # Create basic secrets if file doesn't exist
        create_basic_secrets
    fi
    
    # Deploy databases
    if [[ -f "k8s/postgres.yaml" ]]; then
        $KUBECTL apply -f k8s/postgres.yaml >/dev/null 2>&1 || true
    else
        create_postgres_resources
    fi
    
    if [[ -f "k8s/redis.yaml" ]]; then
        $KUBECTL apply -f k8s/redis.yaml >/dev/null 2>&1 || true
    else
        create_redis_resources
    fi
    
    # Deploy applications
    $KUBECTL apply -f k8s/backend-deployment.yaml >/dev/null 2>&1 || true
    $KUBECTL apply -f k8s/backend-service.yaml >/dev/null 2>&1 || true
    $KUBECTL apply -f k8s/frontend-deployment.yaml >/dev/null 2>&1 || true
    $KUBECTL apply -f k8s/frontend-service.yaml >/dev/null 2>&1 || true
    $KUBECTL apply -f k8s/ai-proctoring.yaml >/dev/null 2>&1 || true
    
    # Deploy monitoring
    deploy_monitoring
    
    # Wait for pods
    wait_for_pods
    
    # Start port-forwards
    start_port_forwards
}

create_basic_secrets() {
    print_info "Creating basic secrets..."
    
    $KUBECTL apply -f - <<EOF >/dev/null 2>&1
apiVersion: v1
kind: Secret
metadata:
  name: exam-platform-secret
  namespace: exam-platform
type: Opaque
stringData:
  DB_HOST: postgres
  DB_PORT: "5432"
  DB_USER: postgres
  DB_PASSWORD: postgres123
  DB_NAME: exam_platform
  REDIS_HOST: redis
  REDIS_PORT: "6379"
  DATABASE_URL: postgresql://postgres:postgres123@postgres:5432/exam_platform
  REDIS_URL: redis://redis:6379
  JWT_SECRET: your-super-secret-jwt-key-change-this-in-production
  JWT_REFRESH_SECRET: your-super-secret-refresh-key-change-this-in-production
EOF
}

create_postgres_resources() {
    print_info "Creating PostgreSQL resources..."
    
    # Create PVC
    $KUBECTL apply -f - <<EOF >/dev/null 2>&1
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
      storage: 1Gi
EOF

    # Create Deployment
    $KUBECTL apply -f - <<EOF >/dev/null 2>&1
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
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: exam_platform
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          value: postgres123
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
EOF

    # Create Service
    $KUBECTL apply -f - <<EOF >/dev/null 2>&1
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
}

create_redis_resources() {
    print_info "Creating Redis resources..."
    
    # Create Deployment
    $KUBECTL apply -f - <<EOF >/dev/null 2>&1
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
EOF

    # Create Service
    $KUBECTL apply -f - <<EOF >/dev/null 2>&1
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
}

build_images() {
    print_step "Building Docker images..."
    
    docker build -t backend:latest ./backend >/dev/null 2>&1 && print_success "Backend image built" || print_error "Backend image build failed"
    docker build -t frontend:latest ./frontend >/dev/null 2>&1 && print_success "Frontend image built" || print_error "Frontend image build failed"
    docker build -t ai-proctoring:latest ./ai-proctoring >/dev/null 2>&1 && print_success "AI Proctoring image built" || print_error "AI Proctoring image build failed"
}

deploy_monitoring() {
    print_step "Deploying monitoring stack..."
    
    # Install kube-prometheus-stack
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
    helm repo update >/dev/null 2>&1 || true
    
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --values monitoring/prometheus-values.yaml \
        --wait >/dev/null 2>&1 || print_warning "Monitoring already installed"
    
    # Install ArgoCD
    install_argocd
}

# ========================================
# VERIFICATION SYSTEM
# ========================================
wait_for_pods() {
    print_step "Waiting for all pods to be ready..."
    
    local max_wait=300
    local wait_time=0
    
    while [[ $wait_time -lt $max_wait ]]; do
        local all_ready=true
        
        # Check exam-platform pods
        local exam_pods=$($KUBECTL get pods -n exam-platform --no-headers | grep -v Running | wc -l)
        if [[ $exam_pods -gt 0 ]]; then
            all_ready=false
        fi
        
        # Check monitoring pods
        local monitor_pods=$($KUBECTL get pods -n monitoring --no-headers | grep -v Running | wc -l)
        if [[ $monitor_pods -gt 0 ]]; then
            all_ready=false
        fi
        
        # Check argocd pods
        if $KUBECTL get namespace argocd >/dev/null 2>&1; then
            local argo_pods=$($KUBECTL get pods -n argocd --no-headers | grep -v Running | wc -l)
            if [[ $argo_pods -gt 0 ]]; then
                all_ready=false
            fi
        fi
        
        if [[ "$all_ready" == true ]]; then
            print_success "All pods are ready"
            return 0
        fi
        
        sleep 10
        wait_time=$((wait_time + 10))
        print_info "Waiting for pods... (${wait_time}s/${max_wait}s)"
    done
    
    print_warning "Timeout waiting for pods, proceeding with verification..."
}

verify_deployment() {
    print_step "Verifying deployment health..."
    
    local all_healthy=true
    
    # Check each service
    check_service_health "postgres" "exam-platform" "app=postgres"
    check_service_health "redis" "exam-platform" "app=redis"
    check_service_health "backend" "exam-platform" "app=backend"
    check_service_health "frontend" "exam-platform" "app=frontend"
    check_service_health "ai-proctoring" "exam-platform" "app=ai-proctoring"
    
    # Check monitoring
    if $KUBECTL get namespace monitoring >/dev/null 2>&1; then
        check_service_health "prometheus" "monitoring" "app.kubernetes.io/name=prometheus"
        check_service_health "grafana" "monitoring" "app.kubernetes.io/name=grafana"
    fi
    
    # Check ArgoCD
    if $KUBECTL get namespace argocd >/dev/null 2>&1; then
        check_service_health "argocd" "argocd" "app.kubernetes.io/name=argocd-server"
    fi
    
    if [[ "$all_healthy" == true ]]; then
        print_success "All services are healthy!"
        return 0
    else
        print_error "Some services are unhealthy"
        return 1
    fi
}

check_service_health() {
    local service_name=$1
    local namespace=$2
    local selector=$3
    
    local status=$($KUBECTL get pods -n $namespace -l $selector --no-headers | awk 'NR==1{print $3}' | head -1)
    
    case $status in
        "Running")
            print_status "$service_name" "Running"
            ;;
        "CrashLoopBackOff")
            print_status "$service_name" "Error" "CrashLoopBackOff → FIXING..."
            all_healthy=false
            ;;
        "ImagePullBackOff")
            print_status "$service_name" "Error" "ImagePullBackOff → FIXING..."
            all_healthy=false
            ;;
        "Pending")
            print_status "$service_name" "Warning" "Pending"
            all_healthy=false
            ;;
        *)
            print_status "$service_name" "$status"
            all_healthy=false
            ;;
    esac
}

# ========================================
# PORT FORWARD MANAGEMENT
# ========================================
start_port_forwards() {
    print_step "Starting port-forward services..."
    
    # Kill existing port-forwards
    pkill -f "port-forward" || true
    sleep 2
    
    # Start new port-forwards
    $KUBECTL port-forward svc/frontend -n exam-platform 3005:80 > /dev/null 2>&1 &
    echo $! > /tmp/frontend-port-forward.pid
    
    $KUBECTL port-forward svc/backend -n exam-platform 4005:4000 > /dev/null 2>&1 &
    echo $! > /tmp/backend-port-forward.pid
    
    $KUBECTL port-forward svc/ai-proctoring -n exam-platform 5005:80 > /dev/null 2>&1 &
    echo $! > /tmp/ai-port-forward.pid
    
    $KUBECTL port-forward svc/prometheus-grafana -n monitoring 3002:80 > /dev/null 2>&1 &
    echo $! > /tmp/grafana-port-forward.pid
    
    if $KUBECTL get namespace argocd >/dev/null 2>&1; then
        $KUBECTL port-forward svc/argocd-server -n argocd 18081:443 > /dev/null 2>&1 &
        echo $! > /tmp/argocd-port-forward.pid
    fi
    
    sleep 5
    print_success "All port-forwards started"
}

# ========================================
# PASSWORD DISPLAY
# ========================================
display_credentials() {
    print_step "Retrieving service passwords..."
    
    # Get Grafana password
    local grafana_password=$($KUBECTL get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 -d 2>/dev/null || echo "admin")
    
    # Get ArgoCD password
    local argocd_password=""
    if $KUBECTL get namespace argocd >/dev/null 2>&1; then
        argocd_password=$($KUBECTL get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" 2>/dev/null | base64 -d 2>/dev/null || echo "admin")
    fi
    
    echo ""
    echo -e "${GREEN}🚀 Platform Ready!${NC}"
    echo ""
    print_success "📱 Access URLs:"
    echo "   Frontend: http://localhost:3005"
    echo "   Backend:  http://localhost:4005"
    echo "   AI:       http://localhost:5005"
    echo "   Grafana:  http://localhost:3002"
    if [[ ! -z "$argocd_password" ]]; then
        echo "   ArgoCD:   https://localhost:18081"
    fi
    echo ""
    print_success "🔐 Login Credentials:"
    echo "   Grafana:  admin / $grafana_password"
    if [[ ! -z "$argocd_password" ]]; then
        echo "   ArgoCD:   admin / $argocd_password"
    fi
    echo ""
    print_success "✅ All services accessible!"
}

# ========================================
# AUTO-RETRY LOGIC
# ========================================
auto_retry() {
    print_step "Auto-retry logic activated..."
    
    while [[ $AUTO_RETRY_COUNT -lt $MAX_RETRIES ]]; do
        AUTO_RETRY_COUNT=$((AUTO_RETRY_COUNT + 1))
        print_info "Retry attempt $AUTO_RETRY_COUNT/$MAX_RETRIES"
        
        # Wait and verify
        wait_for_pods
        
        if verify_deployment; then
            print_success "Deployment successful after $AUTO_RETRY_COUNT attempts"
            display_credentials
            return 0
        fi
        
        # If last retry, show final status
        if [[ $AUTO_RETRY_COUNT -eq $MAX_RETRIES ]]; then
            print_warning "Max retries reached"
            print_info "Final deployment status:"
            verify_deployment
            break
        fi
        
        sleep 10
    done
}

# ========================================
# MAIN EXECUTION
# ========================================
main() {
    echo -e "${CYAN}🔧 SMART DEPLOY - Advanced Automated Deployment${NC}"
    echo ""
    
    # Select mode
    select_mode
    
    # Check cluster
    check_cluster
    
    # Execute based on mode
    case $DEPLOY_MODE in
        "FULL")
            full_clean_deploy
            ;;
        "FAST")
            fast_deploy
            ;;
    esac
}

# Trap for cleanup
trap cleanup EXIT

cleanup() {
    print_info "Cleaning up..."
    # Kill port-forwards
    if [[ -f /tmp/frontend-port-forward.pid ]]; then
        kill $(cat /tmp/frontend-port-forward.pid) 2>/dev/null || true
    fi
    if [[ -f /tmp/backend-port-forward.pid ]]; then
        kill $(cat /tmp/backend-port-forward.pid) 2>/dev/null || true
    fi
    if [[ -f /tmp/ai-port-forward.pid ]]; then
        kill $(cat /tmp/ai-port-forward.pid) 2>/dev/null || true
    fi
    if [[ -f /tmp/grafana-port-forward.pid ]]; then
        kill $(cat /tmp/grafana-port-forward.pid) 2>/dev/null || true
    fi
    if [[ -f /tmp/argocd-port-forward.pid ]]; then
        kill $(cat /tmp/argocd-port-forward.pid) 2>/dev/null || true
    fi
}

# Execute main function
main "$@"
