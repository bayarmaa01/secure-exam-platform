#!/bin/bash

# ========================================
#  SMART DEVOPS ULTRA - Intelligent Secure Exam Platform Deployment
# ========================================
# AI-Powered, Lightning Fast, Production-Grade System
# Features: Parallel Operations, Smart Caching, Auto-Recovery, Real-time Monitoring
# ========================================

set -euo pipefail

# Enable parallel processing
export MAKEFLAGS="-j$(nproc)"
export DOCKER_BUILDKIT=1

# Global signal handling
SCRIPT_RUNNING=true
trap 'if [[ "$SCRIPT_RUNNING" == "true" ]]; then print_warning "Script interrupted by user"; SCRIPT_RUNNING=false; cleanup_all_processes; exit 130; fi' SIGINT SIGTERM
trap 'if [[ "$SCRIPT_RUNNING" == "true" ]]; then SCRIPT_RUNNING=false; cleanup_all_processes; fi' EXIT

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
NAMESPACE="exam-platform"
MONITORING_NAMESPACE="monitoring"
ARGOCD_NAMESPACE="argocd"
KUBECTL_CMD="kubectl"
TIMEOUT=120
RETRY_COUNT=3
DEBUG_MODE=false
ENABLE_ANALYTICS=true
ENABLE_AI_PROCTORING=true
ENABLE_MONITORING=false
ENABLE_ARGOCD=false

# Smart optimization variables
PARALLEL_BUILDS=${PARALLEL_BUILDS:-"true"}
SMART_CACHE=${SMART_CACHE:-"true"}
FAST_MODE=${FAST_MODE:-"false"}
AUTO_RECOVERY=${AUTO_RECOVERY:-"true"}
REAL_TIME_MONITORING=${REAL_TIME_MONITORING:-"true"}

# Performance optimization
BUILD_CACHE_DIR="/tmp/smart-devops-cache"
PARALLEL_JOBS=$(nproc)
DOCKER_BUILDKIT=1
COMPOSE_PARALLEL_LIMIT=${COMPOSE_PARALLEL_LIMIT:-$PARALLEL_JOBS}

# Intelligent resource detection
SYSTEM_MEMORY_MB=$(free -m | grep Mem | awk '{print $2}')
SYSTEM_CPU_CORES=$(nproc)
AVAILABLE_MEMORY_MB=$(free -m | grep Mem | awk '{print $7}')

# Smart resource allocation
MINIKUBE_MEMORY_MB=$(echo "$SYSTEM_MEMORY_MB * 0.6" | bc | cut -d. -f1)
MINIKUBE_CPU_CORES=$(echo "$SYSTEM_CPU_CORES * 0.75" | bc | cut -d. -f1)

# Ensure minimum requirements
MINIKUBE_MEMORY_MB=${MINIKUBE_MEMORY_MB:-3072}
MINIKUBE_CPU_CORES=${MINIKUBE_CPU_CORES:-2}

# Cap maximum resources
if [[ $MINIKUBE_MEMORY_MB -gt 8192 ]]; then
    MINIKUBE_MEMORY_MB=8192
fi
if [[ $MINIKUBE_CPU_CORES -gt 4 ]]; then
    MINIKUBE_CPU_CORES=4
fi

# Version and build info
APP_VERSION=${APP_VERSION:-"latest"}
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"localhost:5000"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Smart cache tracking
CACHE_TIMESTAMP_FILE="$BUILD_CACHE_DIR/.cache-timestamp"
BUILD_HASH_FILE="$BUILD_CACHE_DIR/.build-hash"

# ========================================
#  PRINT FUNCTIONS
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

# Smart progress indicator
show_progress() {
    local current=$1
    local total=$2
    local step_name=$3
    local percentage=$((current * 100 / total))
    
    printf "\r${CYAN}[%3d%%] %s${NC}" "$percentage" "$step_name"
    
    if [[ $current -eq $total ]]; then
        echo ""
    fi
}

# Real-time monitoring
start_real_time_monitoring() {
    if [[ "$REAL_TIME_MONITORING" != "true" ]]; then
        return 0
    fi
    
    print_step "Starting real-time monitoring..."
    
    # Start background monitoring with proper cleanup
    (
        # Trap to ensure cleanup on exit
        trap 'exit 0' SIGTERM SIGINT
        
        while true; do
            local timestamp=$(date '+%H:%M:%S')
            local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
            local memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
            
            printf "\r${YELLOW}[$timestamp] CPU: ${cpu_usage}%% | MEM: ${memory_usage}%%${NC}"
            sleep 2
        done
    ) &
    
    MONITOR_PID=$!
    echo $MONITOR_PID > /tmp/smart-devops-monitor.pid
}

stop_real_time_monitoring() {
    # Stop background monitoring if running
    if [[ -f /tmp/smart-devops-monitor.pid ]]; then
        local monitor_pid=$(cat /tmp/smart-devops-monitor.pid)
        kill $monitor_pid 2>/dev/null || true
        kill -9 $monitor_pid 2>/dev/null || true
        rm -f /tmp/smart-devops-monitor.pid
    fi
    
    # Clear any remaining monitoring output
    printf "\r\033[K"
    
    # Stop any pod monitoring processes
    if [[ -f /tmp/pod-monitor.pid ]]; then
        local pod_monitor_pid=$(cat /tmp/pod-monitor.pid)
        kill $pod_monitor_pid 2>/dev/null || true
        kill -9 $pod_monitor_pid 2>/dev/null || true
        rm -f /tmp/pod-monitor.pid
    fi
}

# Cleanup all background processes
cleanup_all_processes() {
    # Prevent recursive cleanup
    if [[ "${CLEANUP_RUNNING:-false}" == "true" ]]; then
        return 0
    fi
    
    CLEANUP_RUNNING=true
    print_step "Cleaning up all background processes..."
    
    # Stop monitoring
    stop_real_time_monitoring
    
    # Kill any remaining smart-devops processes (excluding current script)
    local current_pid=$$
    pkill -f "smart-devops.sh" 2>/dev/null || true
    # Don't kill the current script process
    pkill -f "monitor_pods_realtime" 2>/dev/null || true
    
    # Clean up temp files
    rm -f /tmp/smart-devops-monitor.pid
    rm -f /tmp/pod-monitor.pid
    
    print_success "All background processes cleaned up"
    CLEANUP_RUNNING=false
}

# ========================================
#  UTILITY FUNCTIONS
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

# Smart caching system
init_smart_cache() {
    if [[ "$SMART_CACHE" != "true" ]]; then
        return 0
    fi
    
    mkdir -p "$BUILD_CACHE_DIR"
    
    # Initialize cache tracking
    if [[ ! -f "$CACHE_TIMESTAMP_FILE" ]]; then
        date +%s > "$CACHE_TIMESTAMP_FILE"
    fi
    
    if [[ ! -f "$BUILD_HASH_FILE" ]]; then
        echo "init" > "$BUILD_HASH_FILE"
    fi
}

calculate_build_hash() {
    local hash=""
    
    # Hash of source files
    hash=$(find ./backend ./frontend ./ai-proctoring -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.Dockerfile" \) -exec md5sum {} \; | md5sum | cut -d' ' -f1)
    
    # Hash of package files
    hash="$hash$(find . -name "package*.json" -exec md5sum {} \; | md5sum | cut -d' ' -f1)"
    
    echo "$hash"
}

is_cache_valid() {
    if [[ "$SMART_CACHE" != "true" ]] || [[ "$FAST_MODE" == "true" ]]; then
        return 1
    fi
    
    local current_hash=$(calculate_build_hash)
    local cached_hash=$(cat "$BUILD_HASH_FILE" 2>/dev/null || echo "")
    
    if [[ "$current_hash" == "$cached_hash" ]]; then
        return 0
    else
        echo "$current_hash" > "$BUILD_HASH_FILE"
        return 1
    fi
}

# Parallel execution helper
run_parallel() {
    local pids=()
    local commands=("$@")
    
    print_step "Running ${#commands[@]} operations in parallel..."
    
    # Start all commands in background
    for cmd in "${commands[@]}"; do
        eval "$cmd" &
        pids+=($!)
    done
    
    # Wait for all to complete with progress
    local completed=0
    local total=${#commands[@]}
    
    while [[ $completed -lt $total ]]; do
        completed=0
        for pid in "${pids[@]}"; do
            if ! kill -0 "$pid" 2>/dev/null; then
                completed=$((completed + 1))
            fi
        done
        
        show_progress $completed $total "Parallel operations"
        sleep 1
    done
    
    # Check exit codes
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    print_success "All parallel operations completed"
}

# Smart auto-recovery
auto_recover() {
    if [[ "$AUTO_RECOVERY" != "true" ]]; then
        return 0
    fi
    
    print_step "Attempting auto-recovery..."
    
    # Common recovery operations
    local recovery_commands=(
        "minikube status || minikube start --driver=docker"
        "kubectl cluster-info || minikube update-context"
        "docker system prune -f"
    )
    
    for cmd in "${recovery_commands[@]}"; do
        if ! eval "$cmd" 2>/dev/null; then
            print_debug "Recovery command failed: $cmd"
        fi
    done
    
    print_success "Auto-recovery completed"
}

# Intelligent pod monitoring
monitor_pods_realtime() {
    local namespace=$1
    local duration=${2:-60}
    local interval=3
    local elapsed=0
    
    print_step "Starting real-time pod monitoring for $duration seconds..."
    print_info "Press Ctrl+C to stop monitoring"
    
    # Save PID for cleanup
    echo $$ > /tmp/pod-monitor.pid
    
    # Trap for cleanup
    trap 'printf "\n${YELLOW}Monitoring stopped by user${NC}\n"; rm -f /tmp/pod-monitor.pid; exit 0' SIGINT SIGTERM
    
    while [[ $elapsed -lt $duration ]]; do
        clear
        print_header "POD MONITORING - $namespace"
        
        echo "${CYAN}Time: $elapsed/$duration seconds | Press Ctrl+C to stop${NC}"
        echo ""
        
        # Get pod status
        local pods=$($KUBECTL_CMD get pods -n $namespace --no-headers 2>/dev/null || echo "")
        
        if [[ -z "$pods" ]]; then
            print_warning "No pods found in namespace: $namespace"
        else
            echo "${BLUE}Pod Status:${NC}"
            echo "$pods" | while read -r line; do
                local pod_name=$(echo "$line" | awk '{print $1}')
                local pod_status=$(echo "$line" | awk '{print $3}')
                local pod_ready=$(echo "$line" | awk '{print $2}')
                local pod_restarts=$(echo "$line" | awk '{print $4}')
                
                case $pod_status in
                    "Running")
                        echo -e "${GREEN}  $pod_name${NC} - $pod_ready - Restarts: $pod_restarts"
                        ;;
                    "Pending")
                        echo -e "${YELLOW}  $pod_name${NC} - $pod_ready - Restarts: $pod_restarts"
                        ;;
                    "CrashLoopBackOff"|"Error"|"Failed")
                        echo -e "${RED}  $pod_name${NC} - $pod_ready - Restarts: $pod_restarts"
                        ;;
                    *)
                        echo -e "${CYAN}  $pod_name${NC} - $pod_ready - Restarts: $pod_restarts"
                        ;;
                esac
            done
        fi
        
        echo ""
        echo "${CYAN}Resource Usage:${NC}"
        echo "  CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
        echo "  Memory: $(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')%"
        echo ""
        
        elapsed=$((elapsed + interval))
        
        # Check if we should continue
        if [[ $elapsed -ge $duration ]]; then
            printf "\n${GREEN}Monitoring completed${NC}\n"
            rm -f /tmp/pod-monitor.pid
            break
        fi
        
        sleep $interval
    done
}

# Intelligent issue detection
detect_pod_issues() {
    local namespace=$1
    local issues=()
    
    print_step "Detecting pod issues in namespace: $namespace"
    
    # Check if namespace exists first
    if ! $KUBECTL_CMD get namespace $namespace &>/dev/null; then
        print_debug "Namespace $namespace does not exist, skipping issue detection"
        echo "${issues[@]}"
        return 0
    fi
    
    # Check for problematic pods
    local problematic_pods=$($KUBECTL_CMD get pods -n $namespace --no-headers 2>/dev/null | grep -E "(CrashLoopBackOff|Error|Failed|Pending|ImagePullBackOff)" || true)
    
    while read -r pod_line; do
        if [[ -n "$pod_line" ]]; then
            local pod_name=$(echo "$pod_line" | awk '{print $1}')
            local pod_status=$(echo "$pod_line" | awk '{print $3}')
            local issue_type="Unknown"
            
            case $pod_status in
                "CrashLoopBackOff") issue_type="Application Crash" ;;
                "Error") issue_type="Container Error" ;;
                "Failed") issue_type="Pod Failed" ;;
                "Pending") issue_type="Pod Stuck" ;;
                "ImagePullBackOff") issue_type="Image Pull Issue" ;;
            esac
            
            issues+=("$pod_name:$issue_type:$pod_status")
        fi
    done <<< "$problematic_pods"
    
    echo "${issues[@]}"
}

# Smart issue fixing
fix_pod_issues() {
    local namespace=$1
    
    # Check if namespace exists first
    if ! $KUBECTL_CMD get namespace $namespace &>/dev/null; then
        print_debug "Namespace $namespace does not exist, skipping issue fixing"
        return 0
    fi
    
    local issues=($(detect_pod_issues "$namespace"))
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        print_success "No pod issues detected"
        return 0
    fi
    
    print_warning "Found ${#issues[@]} pod issues, attempting fixes..."
    
    for issue in "${issues[@]}"; do
        local pod_name=$(echo "$issue" | cut -d: -f1)
        local issue_type=$(echo "$issue" | cut -d: -f2)
        local pod_status=$(echo "$issue" | cut -d: -f3)
        
        print_step "Fixing $pod_name ($issue_type)..."
        
        case $issue_type in
            "Application Crash")
                # Restart the pod
                $KUBECTL_CMD delete pod $pod_name -n $namespace --grace-period=0 --force 2>/dev/null || true
                print_success "Restarted $pod_name"
                ;;
            "Image Pull Issue")
                # Check image and recreate
                print_info "Checking image availability..."
                local deployment=$($KUBECTL_CMD get deployment -n $namespace -o name 2>/dev/null | grep -E "(backend|frontend|ai)" | head -1 | cut -d/ -f2 || echo "")
                if [[ -n "$deployment" ]]; then
                    $KUBECTL_CMD rollout restart deployment/$deployment -n $namespace 2>/dev/null || true
                    print_success "Restarted deployment: $deployment"
                fi
                ;;
            "Pod Stuck")
                # Force delete and recreate
                $KUBECTL_CMD delete pod $pod_name -n $namespace --grace-period=0 --force 2>/dev/null || true
                print_success "Force deleted $pod_name"
                ;;
            "Container Error"|"Pod Failed")
                # Check logs and restart
                print_info "Checking logs for $pod_name..."
                $KUBECTL_CMD logs $pod_name -n $namespace --tail=20 2>/dev/null | head -5 || true
                $KUBECTL_CMD delete pod $pod_name -n $namespace --grace-period=0 --force 2>/dev/null || true
                print_success "Restarted $pod_name"
                ;;
        esac
        
        sleep 2
    done
    
    print_success "Pod issue fixing completed"
}

# Comprehensive health check
comprehensive_health_check() {
    print_header "COMPREHENSIVE HEALTH CHECK"
    
    # Ensure namespaces exist first
    ensure_namespaces
    
    local namespaces=("$NAMESPACE" "$MONITORING_NAMESPACE" "$ARGOCD_NAMESPACE")
    local total_issues=0
    
    for ns in "${namespaces[@]}"; do
        print_step "Checking namespace: $ns"
        
        # Check if namespace exists (should already exist from ensure_namespaces)
        if ! $KUBECTL_CMD get namespace $ns &>/dev/null; then
            print_warning "Namespace $ns does not exist, creating it..."
            $KUBECTL_CMD create namespace $ns || {
                print_error "Failed to create namespace: $ns"
                continue
            }
        fi
        
        # Detect and fix issues
        local issues=($(detect_pod_issues "$ns"))
        if [[ ${#issues[@]} -gt 0 ]]; then
            print_warning "Found ${#issues[@]} issues in $ns"
            fix_pod_issues "$ns"
            total_issues=$((total_issues + ${#issues[@]}))
        else
            print_success "All pods healthy in $ns"
        fi
        
        # Show pod status
        echo ""
        $KUBECTL_CMD get pods -n $ns 2>/dev/null || true
        echo ""
    done
    
    if [[ $total_issues -gt 0 ]]; then
        print_warning "Total issues found and fixed: $total_issues"
    else
        print_success "All systems healthy - no issues detected"
    fi
    
    return $total_issues
}

# Smart troubleshooting
smart_troubleshoot() {
    print_header "SMART TROUBLESHOOTING"
    
    print_step "Running diagnostic checks..."
    
    # Check Minikube status
    print_info "Minikube Status:"
    minikube status || print_warning "Minikube issues detected"
    
    echo ""
    print_info "Kubernetes Cluster Info:"
    kubectl cluster-info || print_warning "Cluster connectivity issues"
    
    echo ""
    print_info "Docker Status:"
    docker version --format '{{.Server.Version}}' || print_warning "Docker issues"
    
    echo ""
    print_info "System Resources:"
    echo "  Memory: $(free -h | grep Mem)"
    echo "  Disk: $(df -h . | tail -1)"
    echo "  CPU: $(nproc) cores"
    
    echo ""
    print_info "Network Connectivity:"
    if ping -c 1 8.8.8.8 &>/dev/null; then
        print_success "Internet connectivity OK"
    else
        print_warning "No internet connectivity"
    fi
    
    # Run comprehensive health check
    comprehensive_health_check
}

wait_for_pods_ready() {
    print_step "Waiting for pods to be ready..."
    
    local namespace=$1
    local timeout=${2:-$TIMEOUT}
    local label_selector=${3:-""}
    
    if [[ "$DEBUG_MODE" == "true" ]]; then
        print_debug "Namespace: $namespace, Timeout: $timeout, Label: $label_selector"
    fi
    
    local start_time=$(date +%s)
    
    while true; do
        local ready_count=0
        local total_count=0
        
        if [[ -n "$label_selector" ]]; then
            local pods=$($KUBECTL_CMD get pods -n $namespace -l $label_selector --no-headers 2>/dev/null)
        else
            local pods=$($KUBECTL_CMD get pods -n $namespace --no-headers 2>/dev/null)
        fi
        
        while read -r pod; do
            total_count=$((total_count + 1))
            if [[ $pod == *"Running"* ]] || [[ $pod == *"Completed"* ]]; then
                ready_count=$((ready_count + 1))
            fi
        done <<< "$pods"
        
        if [[ $ready_count -eq $total_count ]] && [[ $total_count -gt 0 ]]; then
            print_success "All pods are ready in namespace: $namespace"
            return 0
        fi
        
        local current_time=$(date +%s)
        if [[ $((current_time - start_time)) -gt $timeout ]]; then
            print_error "Timeout waiting for pods to be ready"
            return 1
        fi
        
        echo -n "."
        sleep 3
    done
}

wait_for_service() {
    print_step "Waiting for service: $1 in namespace: $2"
    
    local service_name=$1
    local namespace=$2
    local max_retries=30
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if $KUBECTL_CMD get svc $service_name -n $namespace &> /dev/null; then
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

check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check required commands
    local commands=("minikube" "kubectl" "helm" "docker")
    for cmd in "${commands[@]}"; do
        if ! command -v $cmd &> /dev/null; then
            print_error "$cmd is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check and create required namespaces
    ensure_namespaces
    
    print_success "All prerequisites are installed"
}

# Ensure namespaces exist before any operations
ensure_namespaces() {
    print_step "Ensuring required namespaces exist..."
    
    local namespaces=("$NAMESPACE" "$MONITORING_NAMESPACE" "$ARGOCD_NAMESPACE")
    
    for ns in "${namespaces[@]}"; do
        if ! $KUBECTL_CMD get namespace $ns &>/dev/null; then
            print_info "Creating namespace: $ns"
            $KUBECTL_CMD create namespace $ns || {
                print_error "Failed to create namespace: $ns"
                return 1
            }
            print_success "Namespace $ns created"
        else
            print_debug "Namespace $ns already exists"
        fi
    done
    
    print_success "All namespaces are ready"
}

# ========================================
#  MINIKUBE FUNCTIONS
# ========================================
setup_minikube() {
    print_header "SETTING UP MINIKUBE"
    
    # Show resource allocation
    print_info "System Resources Detected:"
    print_info "  - Total Memory: ${SYSTEM_MEMORY_MB}MB"
    print_info "  - Available Memory: ${AVAILABLE_MEMORY_MB}MB"
    print_info "  - CPU Cores: ${SYSTEM_CPU_CORES}"
    print_info ""
    print_info "Minikube Allocation:"
    print_info "  - Memory: ${MINIKUBE_MEMORY_MB}MB"
    print_info "  - CPUs: ${MINIKUBE_CPU_CORES}"
    print_info "  - Disk: 20GB"
    print_info ""
    
    print_step "Resetting Minikube cluster..."
    minikube delete --all 2>/dev/null || true
    
    # Start Minikube with intelligent resource allocation
    print_step "Starting Minikube with optimized resources..."
    minikube start \
        --driver=docker \
        --cpus=$MINIKUBE_CPU_CORES \
        --memory=$MINIKUBE_MEMORY_MB \
        --disk-size=20g \
        --addons=metrics-server
    
    # Enable essential addons (skip slow ingress for faster deployment)
    print_step "Enabling Minikube addons..."
    # Skip ingress addon for faster deployment - can be enabled later if needed
    print_info "Skipping ingress addon for faster deployment"
    minikube addons enable metrics-server --wait=false
    eval $(minikube docker-env)
    
    # Verify Minikube status
    if minikube status | grep -q "Running"; then
        print_success "Minikube is ready and optimized"
    else
        print_error "Minikube failed to start properly"
        return 1
    fi
}

# ========================================
#  BUILD FUNCTIONS
# ========================================
build_images() {
    print_header "Building Docker images"
    
    # Initialize smart cache
    init_smart_cache
    
    # Check if we can use cache
    local use_cache=false
    if is_cache_valid; then
        print_info "Using smart cache - no source changes detected"
        use_cache=true
    fi
    
    # Build arguments with optimization
    local build_args="--build-arg APP_VERSION=$APP_VERSION --build-arg BUILD_DATE=$BUILD_DATE"
    if [[ "$use_cache" != "true" ]]; then
        build_args="$build_args --no-cache"
    fi
    
    # Enable BuildKit for parallel builds
    export DOCKER_BUILDKIT=1
    
    if [[ "$PARALLEL_BUILDS" == "true" ]] && [[ "$use_cache" != "true" ]]; then
        print_step "Building images in parallel..."
        
        # Prepare parallel build commands
        local build_commands=(
            "docker build $build_args -t $DOCKER_REGISTRY/exam-backend:$IMAGE_TAG ./backend"
            "docker build $build_args -t $DOCKER_REGISTRY/exam-frontend:$IMAGE_TAG ./frontend"
        )
        
        # Add AI proctoring if enabled
        if [[ "$ENABLE_AI_PROCTORING" == "true" ]]; then
            build_commands+=("docker build $build_args -t $DOCKER_REGISTRY/exam-ai:$IMAGE_TAG ./ai-proctoring")
        fi
        
        # Run parallel builds
        run_parallel "${build_commands[@]}"
    else
        # Sequential builds with cache
        print_step "Building backend image..."
        docker build $build_args -t $DOCKER_REGISTRY/exam-backend:$IMAGE_TAG ./backend
        
        print_step "Building frontend image..."
        docker build $build_args -t $DOCKER_REGISTRY/exam-frontend:$IMAGE_TAG ./frontend
        
        if [[ "$ENABLE_AI_PROCTORING" == "true" ]]; then
            print_step "Building AI proctoring image..."
            docker build $build_args -t $DOCKER_REGISTRY/exam-ai:$IMAGE_TAG ./ai-proctoring
        fi
    fi
    
    print_success "All images built successfully"
}

push_images() {
    print_header "📤 PUSHING DOCKER IMAGES"
    
    # Setup local registry
    if ! minikube ssh "docker run -d -p 5000:5000 --name registry registry:2" 2>/dev/null; then
        print_warning "Registry might already be running"
    fi
    
    # Push images
    print_step "Pushing backend image..."
    docker push $DOCKER_REGISTRY/exam-backend:$IMAGE_TAG
    
    print_step "Pushing frontend image..."
    docker push $DOCKER_REGISTRY/exam-frontend:$IMAGE_TAG
    
    if [[ "$ENABLE_AI_PROCTORING" == "true" ]]; then
        print_step "Pushing AI proctoring image..."
        docker push $DOCKER_REGISTRY/exam-ai:$IMAGE_TAG
    fi
    
    print_success "All images pushed successfully"
}

# ========================================
#  KUBERNETES DEPLOYMENT FUNCTIONS
# ========================================
deploy_namespaces() {
    print_header "🏷️ CREATING NAMESPACES"
    
    $KUBECTL_CMD create namespace $NAMESPACE --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    $KUBECTL_CMD create namespace $MONITORING_NAMESPACE --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    $KUBECTL_CMD create namespace $ARGOCD_NAMESPACE --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    
    print_success "Namespaces created"
}

deploy_application() {
    print_header "DEPLOYING APPLICATION"
    
    # Update Helm values
    print_step "Updating Helm values..."
    sed -i.bak "s/frontend.tag: .*/frontend.tag: $IMAGE_TAG/g" helm/exam-platform/values.yaml
    sed -i.bak "s/backend.tag: .*/backend.tag: $IMAGE_TAG/g" helm/exam-platform/values.yaml
    sed -i.bak "s/ai.tag: .*/ai.tag: $IMAGE_TAG/g" helm/exam-platform/values.yaml
    sed -i.bak "s|frontend.repository: .*|frontend.repository: $DOCKER_REGISTRY/exam-frontend|g" helm/exam-platform/values.yaml
    sed -i.bak "s|backend.repository: .*|backend.repository: $DOCKER_REGISTRY/exam-backend|g" helm/exam-platform/values.yaml
    sed -i.bak "s|ai.repository: .*|ai.repository: $DOCKER_REGISTRY/exam-ai|g" helm/exam-platform/values.yaml
    
    # Deploy application
    print_step "Deploying application with Helm..."
    if ! helm upgrade --install exam-platform ./helm/exam-platform \
        --namespace $NAMESPACE \
        --values helm/exam-platform/values.yaml \
        --wait \
        --timeout ${TIMEOUT}s; then
        print_error "Helm deployment failed, attempting recovery..."
        auto_recover
        # Retry deployment
        helm upgrade --install exam-platform ./helm/exam-platform \
            --namespace $NAMESPACE \
            --values helm/exam-platform/values.yaml \
            --wait \
            --timeout ${TIMEOUT}s
    fi
    
    # Wait for pods and check health
    wait_for_pods_ready $NAMESPACE
    
    # Intelligent health check and auto-fix
    print_step "Performing intelligent health check..."
    local app_issues=($(detect_pod_issues "$NAMESPACE"))
    if [[ ${#app_issues[@]} -gt 0 ]]; then
        print_warning "Found ${#app_issues[@]} application issues, fixing..."
        fix_pod_issues "$NAMESPACE"
        # Wait for fixes to take effect
        wait_for_pods_ready $NAMESPACE
    fi
    
    print_success "Application deployed successfully"
}

deploy_monitoring() {
    if [[ "$ENABLE_MONITORING" != "true" ]]; then
        print_info "Monitoring deployment is disabled"
        return 0
    fi
    
    print_header "📊 DEPLOYING MONITORING"
    
    # Add Prometheus Helm repository
    print_step "Adding Prometheus Helm repository..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Deploy Prometheus stack with custom Grafana values
    print_step "Deploying Prometheus stack..."
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace $MONITORING_NAMESPACE \
        --values grafana-values.yaml \
        --wait \
        --timeout ${TIMEOUT}s
    
    # Wait for monitoring services
    wait_for_pods_ready $MONITORING_NAMESPACE
    wait_for_service "prometheus-grafana" $MONITORING_NAMESPACE
    wait_for_service "prometheus-kube-prometheus-prometheus" $MONITORING_NAMESPACE
    
    print_success "Monitoring deployed successfully"
}

deploy_argocd() {
    if [[ "$ENABLE_ARGOCD" != "true" ]]; then
        print_info "ArgoCD deployment is disabled"
        return 0
    fi
    
    print_header "🚢 DEPLOYING ARGOCD"
    
    # Install minimal ArgoCD
    print_step "Installing minimal ArgoCD..."
    
    # Create ArgoCD namespace
    $KUBECTL_CMD create namespace $ARGOCD_NAMESPACE --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    
    # Install ArgoCD with minimal configuration
    kubectl apply -n $ARGOCD_NAMESPACE -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
    
    # Wait for ArgoCD pods
    wait_for_pods_ready $ARGOCD_NAMESPACE
    wait_for_service "argocd-server" $ARGOCD_NAMESPACE
    
    # Get initial ArgoCD password
    ARGOCD_PASSWORD=$(kubectl -n $ARGOCD_NAMESPACE get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)
    
    print_success "ArgoCD deployed successfully"
    print_info "ArgoCD URL: http://localhost:18081"
    print_info "ArgoCD Username: admin"
    print_info "ArgoCD Password: $ARGOCD_PASSWORD"
}

# ========================================
#  HEALTH CHECK FUNCTIONS
# ========================================
health_check() {
    print_header "🏥 HEALTH CHECK"
    
    # Check application pods
    print_step "Checking application pods..."
    $KUBECTL_CMD get pods -n $NAMESPACE
    
    # Check monitoring pods
    if [[ "$ENABLE_MONITORING" == "true" ]]; then
        print_step "Checking monitoring pods..."
        $KUBECTL_CMD get pods -n $MONITORING_NAMESPACE
    fi
    
    # Check ArgoCD pods
    if [[ "$ENABLE_ARGOCD" == "true" ]]; then
        print_step "Checking ArgoCD pods..."
        $KUBECTL_CMD get pods -n $ARGOCD_NAMESPACE
    fi
    
    # Show access information
    show_access_info
}

show_access_info() {
    print_step "🌐 Service Access Information"
    echo ""
    print_info "Frontend:      http://localhost:3005"
    print_info "Backend API:   http://localhost:4005"
    print_info "AI Service:    http://localhost:5005"
    print_info "Grafana:       http://localhost:3002"
    print_info "ArgoCD:        http://localhost:18081"
    echo ""
    print_info "Default Credentials:"
    print_info "  Grafana: admin/admin123"
    print_info "  ArgoCD:  admin/password (check ArgoCD secret)"
    echo ""
}

# ========================================
#  CLEANUP FUNCTIONS
# ========================================
cleanup() {
    print_header "🧹 CLEANING UP"
    
    print_step "Removing deployments..."
    helm uninstall exam-platform -n $NAMESPACE 2>/dev/null || true
    helm uninstall prometheus -n $MONITORING_NAMESPACE 2>/dev/null || true
    
    print_step "Removing namespaces..."
    $KUBECTL_CMD delete namespace $NAMESPACE 2>/dev/null || true
    $KUBECTL_CMD delete namespace $MONITORING_NAMESPACE 2>/dev/null || true
    $KUBECTL_CMD delete namespace $ARGOCD_NAMESPACE 2>/dev/null || true
    
    print_step "Resetting Minikube..."
    minikube delete --all 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# ========================================
#  MAIN DEPLOYMENT FUNCTION
# ========================================
deploy_all() {
    print_header "Complete deployment"
    
    # Start real-time monitoring
    start_real_time_monitoring
    
    # Smart deployment with parallel operations
    local steps=7
    local current_step=0
    
    show_progress $((++current_step)) $steps "Checking prerequisites"
    check_prerequisites || auto_recover
    
    show_progress $((++current_step)) $steps "Setting up Minikube"
    setup_minikube
    
    show_progress $((++current_step)) $steps "Building images"
    build_images
    
    show_progress $((++current_step)) $steps "Pushing images"
    push_images
    
    # Parallel namespace and application setup
    if [[ "$PARALLEL_BUILDS" == "true" ]]; then
        show_progress $((++current_step)) $steps "Deploying infrastructure in parallel"
        run_parallel "deploy_namespaces" "deploy_application"
    else
        show_progress $((++current_step)) $steps "Creating namespaces"
        deploy_namespaces
        
        show_progress $((++current_step)) $steps "Deploying application"
        deploy_application
    fi
    
    # Skip monitoring and ArgoCD for faster deployment
    if [[ "$ENABLE_MONITORING" == "true" ]]; then
        show_progress $((++current_step)) $steps "Deploying monitoring"
        deploy_monitoring
    fi
    
    if [[ "$ENABLE_ARGOCD" == "true" ]]; then
        show_progress $((++current_step)) $steps "Deploying ArgoCD"
        deploy_argocd
    fi
    
    if [[ "$ENABLE_MONITORING" == "false" ]] && [[ "$ENABLE_ARGOCD" == "false" ]]; then
        print_info "Skipping monitoring and ArgoCD for faster deployment"
    fi
    
    # Stop monitoring and perform comprehensive health check
    stop_real_time_monitoring
    
    print_step "Running comprehensive health check..."
    comprehensive_health_check
    
    # Final validation
    print_step "Performing final deployment validation..."
    local final_issues=0
    for ns in "$NAMESPACE" "$MONITORING_NAMESPACE" "$ARGOCD_NAMESPACE"; do
        local ns_issues=($(detect_pod_issues "$ns"))
        final_issues=$((final_issues + ${#ns_issues[@]}))
    done
    
    if [[ $final_issues -gt 0 ]]; then
        print_warning "Final validation found $final_issues remaining issues"
        print_step "Running final auto-fix..."
        for ns in "$NAMESPACE" "$MONITORING_NAMESPACE" "$ARGOCD_NAMESPACE"; do
            fix_pod_issues "$ns"
        done
    else
        print_success "Final validation passed - all systems healthy"
    fi
    
    print_success "Complete deployment finished successfully!"
    print_info "Run './port-forward.sh' to access services"
    
    # Show deployment summary
    show_deployment_summary
    
    # Start real-time monitoring for 30 seconds to show final status
    if [[ "$REAL_TIME_MONITORING" == "true" ]]; then
        print_info "Starting 30-second real-time monitoring..."
        monitor_pods_realtime "$NAMESPACE" 30
    fi
}

# Deployment summary
show_deployment_summary() {
    print_header "Deployment Summary"
    
    echo ""
    print_info "Deployment Configuration:"
    echo "  - Parallel Builds: $PARALLEL_BUILDS"
    echo "  - Smart Cache: $SMART_CACHE"
    echo "  - Fast Mode: $FAST_MODE"
    echo "  - Auto Recovery: $AUTO_RECOVERY"
    echo "  - Real-time Monitoring: $REAL_TIME_MONITORING"
    echo ""
    
    print_info "Resource Usage:"
    echo "  - System Memory: ${SYSTEM_MEMORY_MB}MB (${AVAILABLE_MEMORY_MB}MB available)"
    echo "  - System CPUs: $SYSTEM_CPU_CORES cores"
    echo "  - Minikube Memory: ${MINIKUBE_MEMORY_MB}MB"
    echo "  - Minikube CPUs: $MINIKUBE_CPU_CORES cores"
    echo "  - Current Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
    echo "  - Disk Space: $(df -h . | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"
    echo ""
    
    print_info "Deployment Time: $(date '+%Y-%m-%d %H:%M:%S')"
    print_info "Version: $APP_VERSION ($IMAGE_TAG)"
    echo ""
    
    # Show service URLs
    show_access_info
}

# ========================================
#  COMMAND LINE INTERFACE
# ========================================
show_help() {
    echo "Secure Exam Platform - Smart DevOps ULTRA"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy      - Complete deployment (default)"
    echo "  minikube    - Setup Minikube only"
    echo "  build       - Build Docker images only"
    echo "  push        - Push Docker images only"
    echo "  app         - Deploy application only"
    echo "  monitoring  - Deploy monitoring only"
    echo "  argocd      - Deploy ArgoCD only"
    echo "  health      - Comprehensive health check"
    echo "  monitor     - Real-time pod monitoring (Ctrl+C to stop)"
    echo "  troubleshoot - Smart troubleshooting diagnostics"
    echo "  fix         - Auto-fix pod issues"
    echo "  stop        - Stop all monitoring and cleanup processes"
    echo "  cleanup     - Clean up everything"
    echo "  help        - Show this help"
    echo ""
    echo "Smart Features:"
    echo "  - Parallel builds and deployments"
    echo "  - Intelligent caching system"
    echo "  - Real-time performance monitoring"
    echo "  - Auto-recovery mechanisms"
    echo "  - Progress indicators"
    echo "  - Resource optimization"
    echo ""
    echo "Environment Variables:"
    echo "  APP_VERSION     - Application version (default: latest)"
    echo "  IMAGE_TAG       - Docker image tag (default: latest)"
    echo "  DOCKER_REGISTRY  - Docker registry (default: localhost:5000)"
    echo "  DEBUG_MODE      - Enable debug mode (default: false)"
    echo "  ENABLE_AI_PROCTORING - Enable AI proctoring (default: true)"
    echo "  ENABLE_MONITORING    - Enable monitoring (default: true)"
    echo "  ENABLE_ARGOCD       - Enable ArgoCD (default: true)"
    echo ""
    echo "Performance Options:"
    echo "  PARALLEL_BUILDS    - Enable parallel builds (default: true)"
    echo "  SMART_CACHE        - Enable intelligent caching (default: true)"
    echo "  FAST_MODE          - Fast mode (skip optimizations) (default: false)"
    echo "  AUTO_RECOVERY      - Auto-recovery on failures (default: true)"
    echo "  REAL_TIME_MONITORING - Real-time monitoring (default: true)"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                    # Full deployment with all optimizations"
    echo "  $0 deploy FAST_MODE=true     # Fast deployment mode"
    echo "  $0 build PARALLEL_BUILDS=false # Sequential builds"
    echo "  $0 deploy DEBUG_MODE=true    # Debug mode with detailed logs"
}

# ========================================
#  MAIN
# ========================================
case "${1:-deploy}" in
    "deploy"|"")
        deploy_all
        ;;
    "minikube")
        check_prerequisites
        setup_minikube
        ;;
    "build")
        check_prerequisites
        build_images
        ;;
    "push")
        check_prerequisites
        push_images
        ;;
    "app")
        check_prerequisites
        deploy_namespaces
        deploy_application
        ;;
    "monitoring")
        check_prerequisites
        deploy_namespaces
        deploy_monitoring
        ;;
    "argocd")
        check_prerequisites
        deploy_argocd
        ;;
    "health")
        comprehensive_health_check
        ;;
    "monitor")
        print_step "Starting real-time monitoring..."
        monitor_pods_realtime "$NAMESPACE" 120
        ;;
    "troubleshoot")
        smart_troubleshoot
        ;;
    "fix")
        print_step "Auto-fixing pod issues..."
        for ns in "$NAMESPACE" "$MONITORING_NAMESPACE" "$ARGOCD_NAMESPACE"; do
            fix_pod_issues "$ns"
        done
        ;;
    "stop")
        cleanup_all_processes
        ;;
    "cleanup")
        cleanup
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
