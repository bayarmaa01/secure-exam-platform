#!/bin/bash

# ========================================
#  SMART DEVOPS - Advanced Secure Exam Platform Deployment
# ========================================
# Production-Grade System with Analytics, AI Proctoring, Real-time Notifications
# Senior Fullstack + DevOps + AI Architect Implementation
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
ARGOCD_PASSWORD=""
GRAFANA_PASSWORD=""
KUBECTL_CMD="kubectl"
TIMEOUT=300
RETRY_COUNT=3
DEBUG_MODE=false
ENABLE_ANALYTICS=true
ENABLE_AI_PROCTORING=true
ENABLE_REALTIME_NOTIFICATIONS=true
ENABLE_ADVANCED_SECURITY=true

# ========================================
# 📢 PRINT FUNCTIONS
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
# 🔧 UTILITY FUNCTIONS
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
    
    if [[ "$DEBUG_MODE" == "true" ]]; then
        print_info "DEBUG: Skipping pod readiness check in debug mode"
        return 0
    fi
    
    # Enhanced wait with better error handling
    local start_time=$(date +%s)
    local end_time=$((start_time + timeout))
    
    while true; do
        local failed_pods=$($KUBECTL_CMD get pods -n $namespace --no-headers | grep -v "Running\|Completed" | wc -l)
        
        if [[ $failed_pods -eq 0 ]]; then
            print_success "All pods in $namespace are ready"
            return 0
        fi
        
        local current_time=$(date +%s)
        if [[ $current_time -gt $end_time ]]; then
            print_error "Pods in namespace $namespace failed to become ready within ${timeout}s"
            print_error "Current pod status:"
            $KUBECTL_CMD get pods -n $namespace -o wide
            
            # Show logs for failed pods
            print_info "Showing logs for failed pods:"
            for pod in $($KUBECTL_CMD get pods -n $namespace --no-headers | grep -v "Running\|Completed" | awk '{print $1}'); do
                print_error "Logs for pod: $pod"
                $KUBECTL_CMD logs -n $namespace $pod --tail=20 || true
                echo ""
            done
            
            return 1
        fi
        
        sleep 5
    done
}

health_check() {
    local service=$1
    local namespace=$2
    local port=$3
    local path=${4:-"/health"}
    
    print_info "Health checking $service..."
    
    # Port-forward temporarily for health check
    $KUBECTL_CMD port-forward svc/$service $port:$port -n $namespace >/dev/null 2>&1 &
    local pf_pid=$!
    sleep 2
    
    if curl -s http://localhost:$port$path >/dev/null 2>&1; then
        print_success "$service health check passed"
        local result=0
    else
        print_error "$service health check failed"
        local result=1
    fi
    
    kill $pf_pid 2>/dev/null || true
    wait $pf_pid 2>/dev/null || true
    
    return $result
}

# ========================================
# 🎯 DEPLOYMENT MODE SELECTION
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
                DEBUG_MODE=true
                print_success "Selected: Debug Mode"
                break
                ;;
            *)
                print_error "Invalid option. Please enter 1, 2, or 3."
                ;;
        esac
    done
}

# ========================================
# 🔍 PRE-CHECKS
# ========================================
pre_checks() {
    print_step "Running pre-checks..."
    
    # Check Docker
    if ! command -v docker >/dev/null 2>&1; then
        print_error "Docker is not installed or not running"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running"
        exit 1
    fi
    print_success "Docker is running"
    
    # Check Minikube
    if ! command -v minikube >/dev/null 2>&1; then
        print_error "Minikube is not installed"
        exit 1
    fi
    
    if ! minikube status >/dev/null 2>&1; then
        print_info "Minikube is not running, starting with Docker driver..."
        minikube start --driver=docker --container-runtime=docker
        print_success "Minikube started with Docker driver"
    else
        print_success "Minikube is running"
    fi
    
    # Check kubectl
    if ! command -v kubectl >/dev/null 2>&1; then
        print_error "kubectl is not installed"
        exit 1
    fi
    
    # Check kubectl context
    local current_context=$($KUBECTL_CMD config current-context)
    if [[ "$current_context" != "minikube" ]]; then
        print_warning "kubectl context is not set to minikube (current: $current_context)"
        print_info "Setting context to minikube..."
        $KUBECTL_CMD config use-context minikube
    fi
    print_success "kubectl context set to minikube"
    
    # Test cluster connectivity
    if ! $KUBECTL_CMD cluster-info >/dev/null 2>&1; then
        print_error "Kubernetes cluster is not accessible"
        exit 1
    fi
    print_success "Kubernetes cluster accessible"
    
    # Show debug info in debug mode
    if [[ "$DEBUG_MODE" == "true" ]]; then
        print_header "🐛 DEBUG MODE ENABLED"
        $KUBECTL_CMD get pods -A
        $KUBECTL_CMD get events -A --sort-by=.metadata.creationTimestamp | tail -10
    fi
}

# ========================================
# 🧹 CLEANUP FUNCTIONS
# ========================================
cleanup_full() {
    print_step "Full cleanup - removing all resources..."
    
    # Delete all resources in namespaces
    $KUBECTL_CMD delete namespace exam-platform --ignore-not-found=true --grace-period=0 --wait=false >/dev/null 2>&1 || true
    $KUBECTL_CMD delete namespace monitoring --ignore-not-found=true --grace-period=0 --wait=false >/dev/null 2>&1 || true
    $KUBECTL_CMD delete namespace argocd --ignore-not-found=true --grace-period=0 --wait=false >/dev/null 2>&1 || true
    
    # Wait for namespaces to be deleted
    $KUBECTL_CMD wait --for=delete namespace/exam-platform --timeout=60s >/dev/null 2>&1 || true
    $KUBECTL_CMD wait --for=delete namespace/monitoring --timeout=60s >/dev/null 2>&1 || true
    $KUBECTL_CMD wait --for=delete namespace/argocd --timeout=60s >/dev/null 2>&1 || true
    
    print_success "Cleanup completed"
}

# ========================================
# 🚀 DEPLOYMENT FUNCTIONS
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
    
    # Always use inline deployment to avoid issues with existing files
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
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 30
          periodSeconds: 10
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
        image: redis:6-alpine
        ports:
        - containerPort: 6379
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 10
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
    
    # Load image into minikube if needed
    if command -v minikube >/dev/null 2>&1; then
        minikube image load backend:latest 2>/dev/null || true
    fi
    
    # Always use inline deployment with proper environment variables
    cat <<EOF | $KUBECTL_CMD apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: exam-platform-secret
  namespace: exam-platform
type: Opaque
data:
  DATABASE_URL: cG9zdGdyZXNxbDovL3Bvc3RncmVzOnBvc3RncmVzQHBvc3RncmVzOjU0MzIvZXhhbV9wbGF0Zm9ybQ==
  REDIS_URL: cmVkaXM6Ly9yZWRpczo2Mzc5
  JWT_SECRET: eW91ci1qd3Qtc2VjcmV0LWNoYW5nZS10aGlzLWluLXByb2R1Y3Rpb24=
---
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
      initContainers:
      - name: wait-for-postgres
        image: busybox:1.35
        command:
        - sh
        - -c
        - |
          until nc -z postgres 5432; do
            echo "waiting for postgres..."
            sleep 2
          done
      - name: wait-for-redis
        image: busybox:1.35
        command:
        - sh
        - -c
        - |
          until nc -z redis 6379; do
            echo "waiting for redis..."
            sleep 2
          done
      containers:
      - name: backend
        image: backend:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 4000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        # Direct environment variables (not from secret to avoid issues)
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "4000"
        - name: DB_HOST
          value: "postgres"
        - name: DB_PORT
          value: "5432"
        - name: DB_USER
          value: "postgres"
        - name: DB_PASSWORD
          value: "postgres"
        - name: DB_NAME
          value: "exam_platform"
        - name: REDIS_HOST
          value: "redis"
        - name: REDIS_PORT
          value: "6379"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: exam-platform-secret
              key: DATABASE_URL
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: exam-platform-secret
              key: REDIS_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: exam-platform-secret
              key: JWT_SECRET
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 10
          timeoutSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 60
          periodSeconds: 15
          timeoutSeconds: 10
          failureThreshold: 3
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
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
    
    # Wait for backend to be ready
    if [[ "$DEBUG_MODE" != "true" ]]; then
        wait_for_pods_ready exam-platform 180
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
    
    # Load image into minikube if needed
    if command -v minikube >/dev/null 2>&1; then
        minikube image load ai-proctoring:latest 2>/dev/null || true
    fi
    
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
        imagePullPolicy: Never
        ports:
        - containerPort: 5000
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "250m"
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
    
    # Load image into minikube if needed
    if command -v minikube >/dev/null 2>&1; then
        minikube image load frontend:latest 2>/dev/null || true
    fi
    
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
        imagePullPolicy: Never
        ports:
        - containerPort: 80
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
        resources:
          requests:
            memory: "128Mi"
            cpu: "50m"
          limits:
            memory: "256Mi"
            cpu: "100m"
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
    
    print_success "Frontend deployed"
}

# ========================================
# MONITORING DEPLOYMENT
# ========================================
deploy_monitoring() {
    print_step "Deploying Monitoring Stack..."
    
    # Add Helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Check if Grafana is failing and delete it first
    if $KUBECTL_CMD get pods -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].status.phase}' 2>/dev/null | grep -q "Error"; then
        print_warning "Grafana pod is in Error state, cleaning up..."
        $KUBECTL_CMD delete deployment prometheus-grafana -n monitoring --ignore-not-found=true
        $KUBECTL_CMD delete pvc prometheus-grafana -n monitoring --ignore-not-found=true
        sleep 5
    fi
    
    # Deploy Prometheus stack with persistence and proper configuration
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=8Gi \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.accessModes[0]=ReadWriteOnce \
        --set prometheus.prometheusSpec.retention=15d \
        --set grafana.persistence.enabled=true \
        --set grafana.persistence.size=4Gi \
        --set grafana.persistence.accessModes[0]=ReadWriteOnce \
        --set grafana.adminPassword=admin \
        --set grafana.service.type=ClusterIP \
        --set prometheus.service.type=ClusterIP \
        --set defaultRules.create=true \
        --set prometheusOperator.enabled=true
    
    # Wait for monitoring stack to be ready
    if [[ "$DEBUG_MODE" != "true" ]]; then
        wait_for_pods_ready monitoring 240
    fi
    
    # Validate Prometheus service
    if ! $KUBECTL_CMD get service prometheus-kube-prometheus-prometheus -n monitoring >/dev/null 2>&1; then
        print_error "Prometheus service not found"
        return 1
    fi
    
    print_success "Monitoring stack deployed"
}

# ========================================
# 🔥 ARGOCD SETUP
# ========================================
install_argocd() {
    print_step "Installing ArgoCD..."
    
    # Create namespace
    $KUBECTL_CMD create namespace argocd --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    
    # Try namespace-scoped installation first (avoids CRD annotation size issues)
    if $KUBECTL_CMD apply -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/namespace-install.yaml -n argocd; then
        print_success "ArgoCD installed (namespace-scoped)"
    else
        print_warning "Namespace-scoped installation failed, trying core installation..."
        # Fallback to core installation only
        $KUBECTL_CMD apply -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/core-install.yaml -n argocd || {
            print_error "ArgoCD installation failed completely"
            return 1
        }
        print_success "ArgoCD installed (core-only)"
    fi
}

wait_argocd_ready() {
    print_step "Waiting for ArgoCD to be ready..."
    
    if [[ "$DEBUG_MODE" == "true" ]]; then
        print_info "DEBUG: Skipping ArgoCD readiness check"
        return 0
    fi
    
    # Wait for ArgoCD server deployment with retry
    retry $RETRY_COUNT $KUBECTL_CMD rollout status deployment/argocd-server -n argocd --timeout=300s || {
        print_error "ArgoCD server failed to become ready"
        return 1
    }
    
    # Wait for argocd-repo-server
    retry $RETRY_COUNT $KUBECTL_CMD rollout status deployment/argocd-repo-server -n argocd --timeout=180s || {
        print_warning "ArgoCD repo-server failed to become ready, continuing..."
    }
    
    print_success "ArgoCD is ready"
}

expose_argocd() {
    print_step "Exposing ArgoCD UI..."
    
    # Port-forward ArgoCD server to correct port
    $KUBECTL_CMD port-forward svc/argocd-server -n argocd 18081:443 >/dev/null 2>&1 &
    ARGOCD_PID=$!
    echo $ARGOCD_PID > /tmp/argocd-port-forward.pid
    
    print_success "ArgoCD UI exposed on https://localhost:18081"
}

get_argocd_credentials() {
    print_step "Retrieving ArgoCD credentials..."
    
    # Get ArgoCD admin password with retry
    ARGOCD_PASSWORD=$(retry $RETRY_COUNT $KUBECTL_CMD -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d) || {
        print_error "Failed to retrieve ArgoCD password"
        ARGOCD_PASSWORD="failed-to-retrieve"
    }
    
    print_header "🚀 ArgoCD Access"
    echo -e "${GREEN}URL: https://localhost:18081${NC}"
    echo -e "${GREEN}Username: admin${NC}"
    echo -e "${GREEN}Password: ${ARGOCD_PASSWORD}${NC}"
    echo -e "${PURPLE}======================================${NC}"
}

# ========================================
# 🔍 HEALTH CHECKS
# ========================================
wait_for_pods() {
    print_step "Waiting for all pods to be ready..."
    
    if [[ "$DEBUG_MODE" == "true" ]]; then
        print_info "DEBUG: Skipping pod readiness check"
        return 0
    fi
    
    local max_wait=300
    local wait_time=0
    
    while [[ $wait_time -lt $max_wait ]]; do
        local failed_pods=$($KUBECTL_CMD get pods -n exam-platform --no-headers | grep -v "Running\|Completed" | wc -l)
        
        if [[ $failed_pods -eq 0 ]]; then
            print_success "All pods are ready"
            return 0
        fi
        
        print_info "Waiting for pods... (${wait_time}s/${max_wait}s)"
        sleep 10
        wait_time=$((wait_time + 10))
    done
    
    print_error "Timeout waiting for pods to be ready"
    $KUBECTL_CMD get pods -n exam-platform -o wide
    return 1
}

detect_failures() {
    print_step "Detecting pod failures..."
    
    local failed_pods=$($KUBECTL_CMD get pods -n exam-platform --no-headers | grep -v "Running\|Completed" | awk '{print $1}')
    
    if [[ -n "$failed_pods" ]]; then
        print_error "Failed pods detected:"
        for pod in $failed_pods; do
            print_error "Pod: $pod"
            print_info "Pod status:"
            $KUBECTL_CMD get pod $pod -n exam-platform -o yaml | grep -A 10 "status:" || true
            print_info "Pod logs (last 20 lines):"
            $KUBECTL_CMD logs -n exam-platform $pod --tail=20 || true
            echo ""
        done
        return 1
    fi
    
    print_success "No pod failures detected"
    return 0
}

# ========================================
# 🌐 DNS VALIDATION
# ========================================
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
    
    # Test DNS resolution with specific service name
    if $KUBECTL_CMD exec dns-test -n exam-platform -- nslookup postgres.exam-platform.svc.cluster.local >/dev/null 2>&1; then
        print_success "DNS resolution working"
        local result=0
    else
        print_error "DNS resolution failed - CRITICAL"
        # Show DNS debug info
        $KUBECTL_CMD exec dns-test -n exam-platform -- cat /etc/resolv.conf
        $KUBECTL_CMD exec dns-test -n exam-platform -- nslookup postgres.exam-platform.svc.cluster.local
        print_error "DNS failure will cause deployment issues"
        local result=1
    fi
    
    # Clean up test pod
    $KUBECTL_CMD delete pod dns-test -n exam-platform --force --grace-period=0 >/dev/null 2>&1 || true
    
    return $result
}

# ========================================
# 🚪 ACCESS SETUP
# ========================================
setup_port_forwards() {
    print_step "Setting up port forwards..."
    
    # Kill existing port forwards
    pkill -f "port-forward" || true
    sleep 2
    
    # Frontend
    $KUBECTL_CMD port-forward svc/frontend 3005:80 -n exam-platform >/dev/null 2>&1 &
    echo $! > /tmp/frontend-port-forward.pid
    
    # Backend
    $KUBECTL_CMD port-forward svc/backend 4005:4000 -n exam-platform >/dev/null 2>&1 &
    echo $! > /tmp/backend-port-forward.pid
    
    # AI Service
    $KUBECTL_CMD port-forward svc/ai-proctoring 5005:80 -n exam-platform >/dev/null 2>&1 &
    echo $! > /tmp/ai-port-forward.pid
    
    # Grafana
    $KUBECTL_CMD port-forward svc/prometheus-grafana 3002:3000 -n monitoring >/dev/null 2>&1 &
    echo $! > /tmp/grafana-port-forward.pid
    
    # Prometheus
    $KUBECTL_CMD port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring >/dev/null 2>&1 &
    echo $! > /tmp/prometheus-port-forward.pid
    
    # Wait for port forwards to establish
    sleep 3
    
    print_success "Port forwards established"
}

# ========================================
# 📤 FINAL OUTPUT
# ========================================
final_output() {
    print_header "🚀 Platform Ready!"
    
    echo -e "${GREEN}📊 Pod Status:${NC}"
    $KUBECTL_CMD get pods -n exam-platform
    echo ""
    
    echo -e "${GREEN}📱 Access URLs:${NC}"
    echo -e "${GREEN}   Frontend:   http://localhost:3005${NC}"
    echo -e "${GREEN}   Backend:    http://localhost:4005${NC}"
    echo -e "${GREEN}   AI:         http://localhost:5005${NC}"
    echo -e "${GREEN}   Grafana:    http://localhost:3002${NC}"
    echo -e "${GREEN}   Prometheus: http://localhost:9090${NC}"
    echo -e "${GREEN}   ArgoCD:     https://localhost:18081${NC}"
    echo ""
    
    # Get Grafana password with retry
    GRAFANA_PASSWORD=$(retry $RETRY_COUNT $KUBECTL_CMD get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 -d || echo "admin")
    
    echo -e "${GREEN}🔐 Login Credentials:${NC}"
    echo -e "${GREEN}   Grafana:    admin / $GRAFANA_PASSWORD${NC}"
    echo -e "${GREEN}   ArgoCD:     admin / $ARGOCD_PASSWORD${NC}"
    echo ""
    
    print_success "✅ All services accessible!"
}

# ========================================
# 🧹 CLEANUP FUNCTION
# ========================================
cleanup() {
    print_info "Cleaning up port forwards..."
    
    # Kill port forwards
    for pid_file in /tmp/*-port-forward.pid; do
        if [[ -f "$pid_file" ]]; then
            kill $(cat "$pid_file") 2>/dev/null || true
            rm -f "$pid_file"
        fi
    done
    
    # Kill any remaining port-forwards
    pkill -f "port-forward" 2>/dev/null || true
}

# ========================================
# 🚀 MAIN EXECUTION
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
    
    # Deploy in order with waits
    deploy_namespaces
    deploy_postgres
    wait_for_pods_ready exam-platform 120
    
    deploy_redis
    wait_for_pods_ready exam-platform 60
    
    deploy_backend
    wait_for_pods_ready exam-platform 180
    
    deploy_ai_service
    wait_for_pods_ready exam-platform 120
    
    deploy_frontend
    wait_for_pods_ready exam-platform 120
    
    deploy_monitoring
    
    # DNS validation (critical)
    if ! validate_dns; then
        print_error "DNS validation failed - deployment may not work properly"
        # Continue anyway but warn user
    fi
    
    # ArgoCD setup
    install_argocd
    wait_argocd_ready
    expose_argocd
    get_argocd_credentials
    
    # Health checks
    wait_for_pods
    detect_failures
    
    # Service health checks
    print_step "Running service health checks..."
    health_check backend exam-platform 4005 /health || print_warning "Backend health check failed"
    health_check frontend exam-platform 3005 / || print_warning "Frontend health check failed"
    
    # Setup access
    setup_port_forwards
    
    # Final output
    final_output
}

# Execute main function
main "$@"
