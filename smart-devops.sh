#!/bin/bash

# ========================================
#  SECURE EXAM PLATFORM - SMART DEVOPS
#  Production-Grade FAANG-Level Automation
# ========================================

set -euo pipefail

# ========================================
#  COLORS & LOGGING
# ========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ========================================
#  CONFIGURATION
# ========================================
MODE="auto"
FAST_MODE=false
FULL_MODE=false
NAMESPACE="exam-platform"
DOCKER_REGISTRY="bayarmaa"
TIMEOUT=60
RETRY_COUNT=3
PID_DIR="/tmp/exam-platform-pids"

# Services configuration
FRONTEND_PORT=3005
BACKEND_PORT=4005
AI_PORT=5005
GRAFANA_PORT=3002
PROMETHEUS_PORT=9092
ARGOCD_PORT=18081

# Docker images
FRONTEND_IMAGE="${DOCKER_REGISTRY}/exam-platform-frontend:latest"
BACKEND_IMAGE="${DOCKER_REGISTRY}/exam-platform-backend:latest"
AI_IMAGE="${DOCKER_REGISTRY}/exam-platform-ai-proctoring:latest"

# ========================================
#  UTILITY FUNCTIONS
# ========================================
show_usage() {
    echo "Usage: $0 [MODE] [OPTIONS]"
    echo ""
    echo "MODES:"
    echo "  auto      Auto-detect and deploy (default)"
    echo "  fast      Reuse cluster, skip builds"
    echo "  full      Clean rebuild everything"
    echo ""
    echo "OPTIONS:"
    echo "  --watch   Keep watching and restart on failure"
    echo "  --clean    Cleanup before deployment"
    echo ""
    echo "SERVICES:"
    echo "  Frontend:    http://localhost:${FRONTEND_PORT}"
    echo "  Backend:     http://localhost:${BACKEND_PORT}"
    echo "  AI:          http://localhost:${AI_PORT}"
    echo "  Grafana:      http://localhost:${GRAFANA_PORT}"
    echo "  Prometheus:   http://localhost:${PROMETHEUS_PORT}"
    echo "  ArgoCD:       https://localhost:${ARGOCD_PORT}"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        auto)
            MODE="auto"
            shift
            ;;
        fast)
            MODE="fast"
            FAST_MODE=true
            shift
            ;;
        full)
            MODE="full"
            FULL_MODE=true
            shift
            ;;
        --watch)
            WATCH_MODE=true
            shift
            ;;
        --clean)
            CLEAN_MODE=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# ========================================
#  DEPENDENCY CHECK FUNCTIONS
# ========================================
check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check for jq
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed. Installing jq..."
        install_jq || {
            log_error "Failed to install jq. Some features may not work."
            return 1
        }
    fi
    
    # Check for curl
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed. Please install curl first."
        return 1
    fi
    
    log_success "All dependencies are available"
}

install_jq() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y jq
        elif command -v yum &> /dev/null; then
            sudo yum install -y jq
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y jq
        else
            log_error "Cannot install jq automatically on this Linux distribution"
            return 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install jq
        else
            log_error "Please install Homebrew first: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            return 1
        fi
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        # Windows
        if command -v choco &> /dev/null; then
            choco install jq
        else
            log_error "Please install Chocolatey first and then: choco install jq"
            return 1
        fi
    else
        log_error "Unsupported operating system for automatic jq installation"
        return 1
    fi
}

# ========================================
#  SERVICE STARTUP FUNCTIONS
# ========================================
start_docker() {
    log_info "Checking Docker service..."
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_warning "Docker is not running, attempting to start..."
        
        # Try different methods to start Docker based on OS
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            if command -v systemctl &> /dev/null; then
                sudo systemctl start docker || {
                    log_error "Failed to start Docker with systemctl"
                    return 1
                }
            elif command -v service &> /dev/null; then
                sudo service docker start || {
                    log_error "Failed to start Docker with service"
                    return 1
                }
            else
                log_error "Cannot start Docker - no systemctl or service command found"
                return 1
            fi
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            open -a Docker || {
                log_error "Failed to start Docker Desktop on macOS"
                return 1
            }
            # Wait for Docker to start
            local retries=30
            while [[ $retries -gt 0 ]] && ! docker info &> /dev/null; do
                sleep 2
                ((retries--))
            done
        elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
            # Windows
            log_info "Please start Docker Desktop manually on Windows"
            read -p "Press Enter when Docker is running..."
        fi
        
        # Verify Docker is running
        if docker info &> /dev/null; then
            log_success "Docker is now running"
        else
            log_error "Docker failed to start"
            return 1
        fi
    else
        log_success "Docker is already running"
    fi
}

start_minikube() {
    log_info "Checking Minikube status..."
    
    local minikube_status=$(detect_minikube)
    
    case $minikube_status in
        "not_installed")
            log_error "Minikube is not installed. Please install Minikube first."
            log_info "Install from: https://minikube.sigs.k8s.io/docs/start/"
            return 1
            ;;
        "running")
            log_success "Minikube is already running"
            return 0
            ;;
        "stopped")
            log_warning "Minikube is stopped, starting it..."
            minikube start --cpus=4 --memory=8192 --disk-size=20g || {
                log_error "Failed to start Minikube"
                return 1
            }
            log_success "Minikube started successfully"
            ;;
    esac
    
    # Verify Minikube is running
    if minikube status | grep -q "Running"; then
        log_success "Minikube is ready"
        # Set Docker environment
        eval $(minikube docker-env)
        log_success "Docker environment configured for Minikube"
    else
        log_error "Minikube failed to start properly"
        return 1
    fi
}

# ========================================
#  DETECTION FUNCTIONS
# ========================================
detect_minikube() {
    if command -v minikube &> /dev/null; then
        if minikube status | grep -q "Running"; then
            echo "running"
        else
            echo "stopped"
        fi
    else
        echo "not_installed"
    fi
}

detect_docker_images() {
    local images_exist=true
    docker images | grep -q "exam-platform-frontend" || images_exist=false
    docker images | grep -q "exam-platform-backend" || images_exist=false
    docker images | grep -q "exam-platform-ai-proctoring" || images_exist=false
    
    if [[ "$images_exist" == "true" ]]; then
        echo "exist"
    else
        echo "missing"
    fi
}

detect_namespace() {
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        echo "exists"
    else
        echo "missing"
    fi
}

# ========================================
#  SMART MODE LOGIC
# ========================================
smart_detection() {
    log_info "Running smart detection..."
    
    local minikube_status=$(detect_minikube)
    local images_status=$(detect_docker_images)
    local namespace_status=$(detect_namespace)
    
    log_info "Minikube: $minikube_status"
    log_info "Images: $images_status"
    log_info "Namespace: $namespace_status"
    
    # Auto-determine best mode
    if [[ "$MODE" == "auto" ]]; then
        if [[ "$minikube_status" == "running" && "$images_status" == "exist" && "$namespace_status" == "exists" ]]; then
            MODE="fast"
            log_info "Auto-detected FAST mode - everything exists"
        elif [[ "$minikube_status" == "running" && "$images_status" == "missing" ]]; then
            MODE="build"
            log_info "Auto-detected BUILD mode - images missing"
        else
            MODE="full"
            log_info "Auto-detected FULL mode - fresh start"
        fi
    fi
}

# ========================================
#  BUILD FUNCTIONS
# ========================================
build_images() {
    if [[ "$FAST_MODE" == "true" ]]; then
        log_info "Fast mode - skipping builds"
        return 0
    fi
    
    log_info "Building Docker images..."
    
    # Build frontend
    docker build -t $FRONTEND_IMAGE ./frontend || {
        log_error "Frontend build failed"
        return 1
    }
    log_success "Frontend built"
    
    # Build backend
    docker build -t $BACKEND_IMAGE ./backend || {
        log_error "Backend build failed"
        return 1
    }
    log_success "Backend built"
    
    # Build AI
    docker build -t $AI_IMAGE ./ai-proctoring || {
        log_error "AI build failed"
        return 1
    }
    log_success "AI built"
    
    log_success "All images built successfully"
}

# ========================================
#  KUBERNETES FUNCTIONS
# ========================================
setup_namespace() {
    if [[ "$(detect_namespace)" == "exists" ]]; then
        log_info "Namespace already exists"
        return 0
    fi
    
    log_info "Creating namespace..."
    if [[ -f "k8s/namespace.yaml" ]]; then
        kubectl apply -f k8s/namespace.yaml || {
            log_error "Failed to create namespace"
            return 1
        }
    else
        log_warning "k8s/namespace.yaml not found, creating namespace directly"
        kubectl create namespace $NAMESPACE || {
            log_error "Failed to create namespace"
            return 1
        }
    fi
    log_success "Namespace created"
}

setup_monitoring_namespace() {
    if kubectl get namespace exam-monitoring &>/dev/null; then
        log_info "Exam-monitoring namespace already exists"
        return 0
    fi
    
    log_info "Creating exam-monitoring namespace..."
    kubectl create namespace exam-monitoring || {
        log_error "Failed to create exam-monitoring namespace"
        exit 1
    }
    
    log_success "Exam-monitoring namespace created"
}

setup_argocd_namespace() {
    if kubectl get namespace argocd &>/dev/null; then
        log_info "ArgoCD namespace already exists"
        return 0
    fi
    
    log_info "Creating ArgoCD namespace..."
    kubectl create namespace argocd || {
        log_error "Failed to create ArgoCD namespace"
        return 1
    }
    log_success "ArgoCD namespace created"
}

deploy_manifests() {
    log_info "Deploying Kubernetes manifests..."
    
    # Create k8s directory if it doesn't exist
    mkdir -p k8s
    
    # Deploy core services first
    if [[ -f "k8s/postgres.yaml" ]]; then
        kubectl apply -f k8s/postgres.yaml || {
            log_error "Failed to deploy postgres"
            return 1
        }
    else
        log_warning "k8s/postgres.yaml not found, creating basic postgres deployment"
        create_postgres_manifest
    fi
    
    if [[ -f "k8s/redis.yaml" ]]; then
        kubectl apply -f k8s/redis.yaml || {
            log_error "Failed to deploy redis"
            return 1
        }
    else
        log_warning "k8s/redis.yaml not found, creating basic redis deployment"
        create_redis_manifest
    fi
    
    # Wait for database
    log_info "Waiting for postgres to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=60s || {
        log_warning "Postgres not ready, continuing anyway"
    }
    
    # Deploy applications
    if [[ -f "k8s/backend.yaml" ]]; then
        kubectl apply -f k8s/backend.yaml || {
            log_error "Failed to deploy backend"
            return 1
        }
    else
        log_warning "k8s/backend.yaml not found, creating basic backend deployment"
        create_backend_manifest
    fi
    
    if [[ -f "k8s/frontend.yaml" ]]; then
        kubectl apply -f k8s/frontend.yaml || {
            log_error "Failed to deploy frontend"
            return 1
        }
    else
        log_warning "k8s/frontend.yaml not found, creating basic frontend deployment"
        create_frontend_manifest
    fi
    
    if [[ -f "k8s/ai-proctoring.yaml" ]]; then
        kubectl apply -f k8s/ai-proctoring.yaml || {
            log_error "Failed to deploy AI service"
            return 1
        }
    else
        log_warning "k8s/ai-proctoring.yaml not found, creating basic AI deployment"
        create_ai_manifest
    fi
    
    # Deploy monitoring (optional but recommended)
    if [[ -f "k8s/grafana.yaml" ]]; then
        kubectl apply -f k8s/grafana.yaml || {
            log_warning "Failed to deploy grafana, creating basic grafana deployment"
            create_grafana_manifest
        }
    else
        log_warning "k8s/grafana.yaml not found, creating basic grafana deployment"
        create_grafana_manifest
    fi
    
    if [[ -f "k8s/prometheus.yaml" ]]; then
        kubectl apply -f k8s/prometheus.yaml || {
            log_warning "Failed to deploy prometheus, creating basic prometheus deployment"
            create_prometheus_manifest
        }
    else
        log_warning "k8s/prometheus.yaml not found, creating basic prometheus deployment"
        create_prometheus_manifest
    fi
    
    # Deploy ArgoCD
    if [[ -f "k8s/argocd.yaml" ]]; then
        kubectl apply -f k8s/argocd.yaml || {
            log_warning "Failed to deploy argocd, creating basic argocd deployment"
            create_argocd_manifest
        }
    else
        log_warning "k8s/argocd.yaml not found, creating basic argocd deployment"
        create_argocd_manifest
    fi
    
    log_success "All manifests deployed"
}

# ========================================
#  MANIFEST CREATION FUNCTIONS
# ========================================
create_namespace_manifest() {
    cat > k8s/namespace.yaml << EOF
apiVersion: v1
kind: Namespace
metadata:
  name: $NAMESPACE
EOF
}

create_postgres_manifest() {
    cat > k8s/postgres.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: $NAMESPACE
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
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          value: postgres
        - name: POSTGRES_DB
          value: exam_platform
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: $NAMESPACE
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
EOF
    kubectl apply -f k8s/postgres.yaml
}

create_redis_manifest() {
    cat > k8s/redis.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: $NAMESPACE
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
  namespace: $NAMESPACE
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
EOF
    kubectl apply -f k8s/redis.yaml
}

create_backend_manifest() {
    cat > k8s/backend.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: $NAMESPACE
spec:
  replicas: 1
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
        image: $BACKEND_IMAGE
        env:
        - name: PORT
          value: "4000"
        - name: DB_HOST
          value: postgres
        - name: DB_PORT
          value: "5432"
        - name: DB_NAME
          value: exam_platform
        - name: DB_USER
          value: postgres
        - name: DB_PASSWORD
          value: postgres
        - name: JWT_SECRET
          value: change-me-in-production
        - name: REDIS_URL
          value: redis://redis:6379
        ports:
        - containerPort: 4000
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: $NAMESPACE
spec:
  selector:
    app: backend
  ports:
  - port: 4000
    targetPort: 4000
EOF
    kubectl apply -f k8s/backend.yaml
}

create_frontend_manifest() {
    cat > k8s/frontend.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: $NAMESPACE
spec:
  replicas: 1
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
        image: $FRONTEND_IMAGE
        env:
        - name: VITE_API_URL
          value: http://localhost:4005/api
        - name: VITE_AI_URL
          value: http://localhost:5005
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: $NAMESPACE
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
EOF
    kubectl apply -f k8s/frontend.yaml
}

create_ai_manifest() {
    cat > k8s/ai-proctoring.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-proctoring
  namespace: $NAMESPACE
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
        image: $AI_IMAGE
        env:
        - name: PORT
          value: "8000"
        - name: REDIS_URL
          value: redis://redis:6379
        ports:
        - containerPort: 8000
---
apiVersion: v1
kind: Service
metadata:
  name: ai-proctoring
  namespace: $NAMESPACE
spec:
  selector:
    app: ai-proctoring
  ports:
  - port: 8000
    targetPort: 8000
EOF
    kubectl apply -f k8s/ai-proctoring.yaml
}

create_grafana_manifest() {
    cat > k8s/grafana.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:10.2.0
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          value: admin123
        - name: GF_INSTALL_PLUGINS
          value: grafana-clock-panel,grafana-simple-json-datasource
        - name: GF_SECURITY_ADMIN_USER
          value: admin
        - name: GF_SERVER_ROOT_URL
          value: http://localhost:3002/
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: grafana-storage
          mountPath: /var/lib/grafana
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: grafana-storage
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: monitoring
spec:
  selector:
    app: grafana
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
EOF
    kubectl apply -f k8s/grafana.yaml
}

create_prometheus_manifest() {
    cat > k8s/prometheus.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        command:
        - '--config.file=/etc/prometheus/prometheus.yml'
        - '--storage.tsdb.path=/prometheus'
        - '--web.console.libraries=/etc/prometheus/console_libraries'
        - '--web.console.templates=/etc/prometheus/consoles'
        - '--storage.tsdb.retention.time=200h'
        - '--web.enable-lifecycle'
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: prometheus-config
          mountPath: /etc/prometheus
        - name: prometheus-storage
          mountPath: /prometheus
      volumes:
      - name: prometheus-config
        configMap:
          name: prometheus-config
      - name: prometheus-storage
        emptyDir: {}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    scrape_configs:
      - job_name: 'prometheus'
        static_configs:
          - targets: ['localhost:9090']
      - job_name: 'backend'
        static_configs:
          - targets: ['backend.exam-platform.svc.cluster.local:4000']
      - job_name: 'postgres'
        static_configs:
          - targets: ['postgres.exam-platform.svc.cluster.local:5432']
      - job_name: 'redis'
        static_configs:
          - targets: ['redis.exam-platform.svc.cluster.local:6379']
      - job_name: 'ai-proctoring'
        static_configs:
          - targets: ['ai-proctoring.exam-platform.svc.cluster.local:8000']
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: monitoring
spec:
  selector:
    app: prometheus
  ports:
  - port: 9090
    targetPort: 9090
EOF
    kubectl apply -f k8s/prometheus.yaml
}

create_argocd_manifest() {
    cat > k8s/argocd.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: argocd-server
  namespace: argocd
spec:
  replicas: 1
  selector:
    matchLabels:
      app: argocd-server
  template:
    metadata:
      labels:
        app: argocd-server
    spec:
      containers:
      - name: argocd-server
        image: argoproj/argocd:latest
        command:
        - argocd-server
        - --insecure
        env:
        - name: ARGOCD_SERVER_INSECURE
          value: "true"
        ports:
        - containerPort: 8080
        volumeMounts:
        - name: argocd-server-tls
          mountPath: /app/config/server/tls
      volumes:
      - name: argocd-server-tls
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: argocd-server
  namespace: argocd
spec:
  selector:
    app: argocd-server
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
---
apiVersion: v1
kind: Secret
metadata:
  name: argocd-initial-admin-secret
  namespace: argocd
type: Opaque
data:
  password: YWRtaW4= # admin
EOF
    kubectl apply -f k8s/argocd.yaml
}

# ========================================
#  AUTO-FIX FUNCTIONS
# ========================================
auto_fix_pods() {
    log_info "Running auto-fix on pods..."
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        log_warning "jq not available, using fallback auto-fix methods"
        auto_fix_pods_fallback
        return 0
    fi
    
    # Fix ImagePullBackOff
    local pull_pods=$(kubectl get pods -n $NAMESPACE -o json 2>/dev/null | jq -r '.items[] | select(.status.phase=="Pending") | select(.status.containerStatuses[].state.waiting.reason=="ImagePullBackOff") | .metadata.name' 2>/dev/null || echo "")
    for pod in $pull_pods; do
        if [[ -n "$pod" && "$pod" != "null" ]]; then
            log_warning "Fixing ImagePullBackOff: $pod"
            kubectl delete pod $pod -n $NAMESPACE --grace-period=0 || true
        fi
    done
    
    # Fix CrashLoopBackOff
    local crash_pods=$(kubectl get pods -n $NAMESPACE -o json 2>/dev/null | jq -r '.items[] | select(.status.phase=="CrashLoopBackOff") | .metadata.name' 2>/dev/null || echo "")
    for pod in $crash_pods; do
        if [[ -n "$pod" && "$pod" != "null" ]]; then
            log_warning "Fixing CrashLoopBackOff: $pod"
            kubectl delete pod $pod -n $NAMESPACE --grace-period=0 || true
        fi
    done
    
    # Restart failed deployments
    local failed_deployments=$(kubectl get deployments -n $NAMESPACE -o json 2>/dev/null | jq -r '.items[] | select(.status.readyReplicas==0) | .metadata.name' 2>/dev/null || echo "")
    for deployment in $failed_deployments; do
        if [[ -n "$deployment" && "$deployment" != "null" ]]; then
            log_warning "Restarting failed deployment: $deployment"
            kubectl rollout restart deployment/$deployment -n $NAMESPACE || true
        fi
    done
    
    log_success "Auto-fix completed"
}

auto_fix_pods_fallback() {
    log_info "Using fallback auto-fix without jq..."
    
    # Get all pods and check their status manually
    local pods=$(kubectl get pods -n $NAMESPACE --no-headers | awk '{print $1}')
    
    for pod in $pods; do
        if [[ -n "$pod" ]]; then
            local status=$(kubectl get pod $pod -n $NAMESPACE -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
            local reason=$(kubectl get pod $pod -n $NAMESPACE -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}' 2>/dev/null || echo "")
            
            if [[ "$status" == "Pending" && "$reason" == "ImagePullBackOff" ]]; then
                log_warning "Fixing ImagePullBackOff: $pod"
                kubectl delete pod $pod -n $NAMESPACE --grace-period=0 || true
            elif [[ "$status" == "CrashLoopBackOff" ]]; then
                log_warning "Fixing CrashLoopBackOff: $pod"
                kubectl delete pod $pod -n $NAMESPACE --grace-period=0 || true
            fi
        fi
    done
    
    # Check deployments
    local deployments=$(kubectl get deployments -n $NAMESPACE --no-headers | awk '{print $1}')
    for deployment in $deployments; do
        if [[ -n "$deployment" ]]; then
            local ready=$(kubectl get deployment $deployment -n $NAMESPACE -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            if [[ "$ready" == "0" ]]; then
                log_warning "Restarting failed deployment: $deployment"
                kubectl rollout restart deployment/$deployment -n $NAMESPACE || true
            fi
        fi
    done
    
    log_success "Fallback auto-fix completed"
}

# ========================================
#  PORT FORWARDING
# ========================================
cleanup_port_forwards() {
    log_info "Cleaning up existing port forwards..."
    
    # Kill existing port forwards
    pkill -f "kubectl port-forward" 2>/dev/null || true
    
    # Clean PID files
    rm -f $PID_DIR/*.pid 2>/dev/null || true
    mkdir -p $PID_DIR
}

start_port_forward() {
    local service=$1
    local port=$2
    local target_port=$3
    local namespace=${4:-$NAMESPACE}
    
    log_info "Starting port forward: $service -> $port"
    
    # Check if service exists and is ready
    if ! kubectl get svc $service -n $namespace &>/dev/null; then
        log_error "Service $service not found in namespace $namespace"
        return 1
    fi
    
    # Wait for service to be ready (shorter timeout for monitoring services)
    local max_retries=30
    if [[ "$service" == "grafana" || "$service" == "prometheus" ]]; then
        max_retries=15  # Shorter timeout for monitoring services
    fi
    
    local retries=$max_retries
    while [[ $retries -gt 0 ]]; do
        local endpoints=$(kubectl get endpoints $service -n $namespace -o jsonpath='{.subsets}' 2>/dev/null || echo "")
        if [[ -n "$endpoints" && "$endpoints" != "[]" ]]; then
            break
        fi
        log_warning "Waiting for $service endpoints to be ready..."
        sleep 2
        ((retries--))
    done
    
    if [[ $retries -eq 0 ]]; then
        log_warning "Service $service endpoints not ready after $((max_retries * 2)) seconds, continuing anyway"
        # Don't return error for monitoring services, just continue
        if [[ "$service" == "grafana" || "$service" == "prometheus" ]]; then
            return 0
        else
            return 1
        fi
    fi
    
    # Kill any existing port forward for this service
    pkill -f "kubectl port-forward.*$port:" 2>/dev/null || true
    
    # Start port forward in background with better error handling
    kubectl port-forward svc/$service $port:$target_port -n $namespace 2>/dev/null &
    local pid=$!
    
    # Wait a moment to ensure it starts
    sleep 3
    
    # Check if still running and port is accessible
    if kill -0 $pid 2>/dev/null; then
        echo $pid > $PID_DIR/${service}.pid
        log_success "$service port forward started (PID: $pid)"
        
        # Test if port is actually accessible
        sleep 2
        if netstat -ln 2>/dev/null | grep -q ":$port " || ss -ln 2>/dev/null | grep -q ":$port "; then
            log_success "$service port $port is accessible"
        else
            log_warning "$service port $port may not be accessible yet"
        fi
    else
        log_error "$service port forward failed to start"
        return 1
    fi
}

setup_port_forwards() {
    cleanup_port_forwards
    
    log_info "Setting up port forwards..."
    
    # Start all port forwards
    start_port_forward "frontend" $FRONTEND_PORT 80
    start_port_forward "backend" $BACKEND_PORT 4000
    start_port_forward "ai-proctoring" $AI_PORT 8000
    start_port_forward "grafana" $GRAFANA_PORT 3000 monitoring
    start_port_forward "prometheus" $PROMETHEUS_PORT 9090 monitoring
    start_port_forward "argocd-server" $ARGOCD_PORT 8080 argocd
    
    log_success "All port forwards started"
}

# ========================================
#  HEALTH CHECK SYSTEM
# ========================================
check_endpoint() {
    local url=$1
    local timeout=${2:-30}
    local retries=${3:-3}
    
    for ((i=1; i<=retries; i++)); do
        if curl -s --max-time $timeout $url &>/dev/null; then
            return 0
        fi
        log_warning "Health check $i/$retries failed for $url"
        sleep 2
    done
    
    log_error "Health check failed for $url"
    return 1
}

health_check() {
    log_info "Running health checks..."
    
    local all_healthy=true
    
    # Check frontend
    if ! check_endpoint "http://localhost:${FRONTEND_PORT}"; then
        all_healthy=false
    fi
    
    # Check backend
    if ! check_endpoint "http://localhost:${BACKEND_PORT}/api/health"; then
        all_healthy=false
    fi
    
    # Check AI
    if ! check_endpoint "http://localhost:${AI_PORT}/health"; then
        all_healthy=false
    fi
    
    # Check grafana
    if ! check_endpoint "http://localhost:${GRAFANA_PORT}/login"; then
        all_healthy=false
    fi
    
    # Check prometheus
    if ! check_endpoint "http://localhost:${PROMETHEUS_PORT}/-/healthy"; then
        all_healthy=false
    fi
    
    # Check argocd
    if ! check_endpoint "https://localhost:${ARGOCD_PORT}"; then
        all_healthy=false
    fi
    
    if [[ "$all_healthy" == "true" ]]; then
        log_success "All services are healthy"
        return 0
    else
        log_error "Some services are unhealthy"
        return 1
    fi
}

# ========================================
#  RESILIENCE & WATCH MODE
# ========================================
watch_services() {
    if [[ "${WATCH_MODE:-false}" != "true" ]]; then
        return 0
    fi
    
    log_info "Starting watch mode - will restart services on failure"
    
    while true; do
        if ! health_check; then
            log_warning "Services unhealthy - running auto-fix"
            auto_fix_pods
            sleep 10
            
            # Restart port forwards if needed
            setup_port_forwards
        fi
        
        sleep 30
    done
}

# ========================================
#  CLEANUP FUNCTIONS
# ========================================
cleanup() {
    log_info "Cleaning up..."
    
    # Kill port forwards
    cleanup_port_forwards
    
    # Remove namespace
    if [[ "$(detect_namespace)" == "exists" ]]; then
        kubectl delete namespace $NAMESPACE --grace-period=0 || true
    fi
    
    # Optional: delete minikube
    if [[ "$FULL_MODE" == "true" ]]; then
        minikube delete --all 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
}

# Cleanup on exit
cleanup_on_exit() {
    log_info "Received interrupt signal"
    cleanup_port_forwards
    exit 130
}

trap cleanup_on_exit INT TERM

# ========================================
#  MAIN DEPLOYMENT LOGIC
# ========================================
main() {
    echo "🚀 SECURE EXAM PLATFORM - SMART DEVOPS"
    echo "Mode: $MODE"
    echo ""
    
    # Create PID directory
    mkdir -p $PID_DIR
    
    # Check dependencies first
    check_dependencies || {
        log_error "Dependency check failed"
        exit 1
    }
    
    # Run smart detection
    smart_detection
    
    # Handle cleanup mode
    if [[ "${CLEAN_MODE:-false}" == "true" ]]; then
        cleanup
        return 0
    fi
    
    # Start Docker automatically
    start_docker || {
        log_error "Docker startup failed"
        exit 1
    }
    
    # Start Minikube automatically
    start_minikube || {
        log_error "Minikube startup failed"
        exit 1
    }
    
    # Build images if needed
    build_images
    
    # Setup namespace
    setup_namespace
    
    # Setup monitoring namespace
    setup_monitoring_namespace
    
    # Setup ArgoCD namespace
    setup_argocd_namespace
    
    # Deploy manifests
    deploy_manifests
    
    # Run auto-fix
    auto_fix_pods
    
    # Setup port forwards
    setup_port_forwards
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Health check
    if health_check; then
        # Get ArgoCD password (with fallback for missing jq)
        local argocd_password="admin"
        if kubectl get namespace argocd &>/dev/null; then
            if command -v jq &> /dev/null; then
                argocd_password=$(kubectl get secret argocd-initial-admin-secret -n argocd -o json 2>/dev/null | jq -r '.data.password' | base64 -d 2>/dev/null || echo "admin")
            else
                argocd_password=$(kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' 2>/dev/null | base64 -d || echo "admin")
            fi
        else
            argocd_password="ArgoCD not deployed"
        fi
        
        # Get Grafana password
        local grafana_password="admin123"
        if kubectl get secret grafana-admin-credentials -n exam-monitoring &>/dev/null; then
            if command -v jq &> /dev/null; then
                grafana_password=$(kubectl get secret grafana-admin-credentials -n exam-monitoring -o json 2>/dev/null | jq -r '.data.GF_SECURITY_ADMIN_PASSWORD' | base64 -d 2>/dev/null || echo "admin123")
            else
                grafana_password=$(kubectl get secret grafana-admin-credentials -n exam-monitoring -o jsonpath='{.data.GF_SECURITY_ADMIN_PASSWORD}' 2>/dev/null | base64 -d || echo "admin123")
            fi
        else
            grafana_password="admin123 (default)"
        fi
        
        # Final output
        echo ""
        echo "----------------------------------------"
        echo "----------------------------------------"
        echo ""
        echo "Frontend:    http://localhost:${FRONTEND_PORT}"
        echo "Backend:     http://localhost:${BACKEND_PORT}"
        echo "AI Service:  http://localhost:${AI_PORT}"
        echo ""
        echo "Grafana:     http://localhost:${GRAFANA_PORT}"
        echo "Username:    admin"
        echo "Password:    $grafana_password"
        echo ""
        echo "Prometheus:  http://localhost:${PROMETHEUS_PORT}"
        echo ""
        echo "ArgoCD:      https://localhost:${ARGOCD_PORT}"
        echo "Username:    admin"
        echo "Password:    $argocd_password"
        echo "----------------------------------------"
        echo ""
        echo "All services are running and accessible!"
        echo "Use Ctrl+C to stop port forwards"
        echo "----------------------------------------"
        echo ""
        
        # Start watch mode if enabled
        watch_services
        
    else
        log_error "Deployment failed - some services are unhealthy"
        exit 1
    fi
}

# Run main function
main
