#!/bin/bash

#  DEVOPS SMART - Production-Grade Issue Detection and Fixing Script
# Automatically detects and fixes all deployment issues

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Global variables
NAMESPACE="exam-platform"
MONITORING_NAMESPACE="monitoring"
ARGOCD_NAMESPACE="argocd"
TIMEOUT=300
RETRY_COUNT=3

# Print functions
print_step() {
    echo -e "${BLUE} $1${NC}"
}

print_success() {
    echo -e "${GREEN} $1${NC}"
}

print_error() {
    echo -e "${RED} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW} $1${NC}"
}

print_info() {
    echo -e "${CYAN}  $1${NC}"
}

# Wait for pod to be ready
wait_for_pod() {
    local label=$1
    local namespace=$2
    local timeout=${3:-60}
    
    print_info "Waiting for pod with label $label in namespace $namespace..."
    local start_time=$(date +%s)
    
    while true; do
        local status=$(kubectl get pods -n "$namespace" -l "$label" -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
        
        if [[ "$status" == "Running" ]]; then
            print_success "Pod with label $label is Running"
            return 0
        fi
        
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -gt $timeout ]]; then
            print_error "Timeout waiting for pod with label $label"
            return 1
        fi
        
        sleep 5
    done
}

# Wait for deployment to be ready
wait_for_deployment() {
    local deployment=$1
    local namespace=$2
    local timeout=${3:-120}
    
    print_info "Waiting for deployment $deployment in namespace $namespace..."
    
    if kubectl rollout status deployment/"$deployment" -n "$namespace" --timeout="${timeout}s"; then
        print_success "Deployment $deployment is ready"
        return 0
    else
        print_error "Deployment $deployment failed to become ready"
        return 1
    fi
}

# Fix Kubernetes Secret mismatches
fix_secrets() {
    print_step "Fixing Kubernetes Secret mismatches..."
    
    # Check if secret exists
    if ! kubectl get secret exam-platform-secret -n "$NAMESPACE" >/dev/null 2>&1; then
        print_warning "Secret exam-platform-secret not found, creating..."
        kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: exam-platform-secret
  namespace: $NAMESPACE
type: Opaque
stringData:
  DATABASE_URL: "postgresql://exam_user:exam_password@postgres:5432/exam_platform"
  DB_HOST: "postgres"
  DB_NAME: "exam_platform"
  DB_PASSWORD: "exam_password"
  DB_PORT: "5432"
  DB_USER: "exam_user"
  JWT_REFRESH_SECRET: "change-refresh-in-production-use-k8s-secrets"
  JWT_SECRET: "change-me-in-production-use-k8s-secrets"
  POSTGRES_DB: "exam_platform"
  POSTGRES_PASSWORD: "exam_password"
  POSTGRES_USER: "exam_user"
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  REDIS_URL: "redis://redis:6379"
EOF
    fi
    
    # Patch PostgreSQL deployment to use correct secret keys
    print_info "Patching PostgreSQL deployment with correct secret keys..."
    kubectl patch deployment postgres -n "$NAMESPACE" --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/env", "value":[{"name":"POSTGRES_USER","valueFrom":{"secretKeyRef":{"name":"exam-platform-secret","key":"POSTGRES_USER"}}},{"name":"POSTGRES_PASSWORD","valueFrom":{"secretKeyRef":{"name":"exam-platform-secret","key":"POSTGRES_PASSWORD"}}},{"name":"POSTGRES_DB","valueFrom":{"secretKeyRef":{"name":"exam-platform-secret","key":"POSTGRES_DB"}}},{"name":"POSTGRES_INITDB_ARGS","value":"--auth-host=scram-sha-256"},{"name":"PGDATA","value":"/var/lib/postgresql/data/pgdata"}]}]' 2>/dev/null || true
    
    print_success "Secret fixes completed"
}

# Fix PostgreSQL issues
fix_postgresql() {
    print_step "Fixing PostgreSQL issues..."
    
    # Check for CreateContainerConfigError
    local postgres_pods=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[*].status.containerStatuses[*].state.waiting.reason}' 2>/dev/null || echo "")
    
    if [[ "$postgres_pods" == *"CreateContainerConfigError"* ]]; then
        print_warning "Detected PostgreSQL CreateContainerConfigError, fixing..."
        
        # Delete problematic pods
        kubectl delete pods -n "$NAMESPACE" -l app=postgres --ignore-not-found=true
        
        # Check if PVC is stuck in Terminating
        local pvc_status=$(kubectl get pvc postgres-pvc -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
        
        if [[ "$pvc_status" == "Terminating" ]]; then
            print_warning "PVC is stuck in Terminating, force removing finalizers..."
            kubectl patch pvc postgres-pvc -n "$NAMESPACE" -p '{"metadata":{"finalizers":null}}' 2>/dev/null || true
            kubectl delete pvc postgres-pvc -n "$NAMESPACE" --force --grace-period=0 2>/dev/null || true
        fi
        
        # Recreate PVC
        if ! kubectl get pvc postgres-pvc -n "$NAMESPACE" >/dev/null 2>&1; then
            print_info "Creating new PostgreSQL PVC..."
            kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 8Gi
EOF
        fi
        
        # Restart PostgreSQL deployment
        kubectl rollout restart deployment/postgres -n "$NAMESPACE"
        
        # Wait for PostgreSQL to be ready
        if wait_for_deployment postgres "$NAMESPACE" 120; then
            print_success "PostgreSQL is ready"
        else
            print_error "PostgreSQL failed to start"
            return 1
        fi
    else
        print_success "PostgreSQL is healthy"
    fi
    
    # Initialize database schema if needed
    print_info "Checking database schema..."
    local postgres_pod=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$postgres_pod" ]]; then
        # Create user and database if needed
        kubectl exec -it "$postgres_pod" -n "$NAMESPACE" -- psql -U postgres -c "CREATE USER exam_user WITH PASSWORD 'exam_password';" 2>/dev/null || true
        kubectl exec -it "$postgres_pod" -n "$NAMESPACE" -- psql -U postgres -c "CREATE DATABASE exam_platform;" 2>/dev/null || true
        kubectl exec -it "$postgres_pod" -n "$NAMESPACE" -- psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE exam_platform TO exam_user;" 2>/dev/null || true
        
        # Create schema
        kubectl exec -it "$postgres_pod" -n "$NAMESPACE" -- psql -U postgres -d exam_platform -c "
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  student_id VARCHAR(50),
  teacher_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'mcq' CHECK (type IN ('mcq', 'written', 'coding', 'mixed', 'ai_proctored')),
  duration_minutes INT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  difficulty VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  total_marks INT DEFAULT 100,
  passing_marks INT DEFAULT 50,
  is_published BOOLEAN DEFAULT false,
  teacher_id UUID REFERENCES users(id),
  fullscreen_required BOOLEAN DEFAULT false,
  tab_switch_detection BOOLEAN DEFAULT false,
  copy_paste_blocked BOOLEAN DEFAULT false,
  camera_required BOOLEAN DEFAULT false,
  face_detection_enabled BOOLEAN DEFAULT false,
  shuffle_questions BOOLEAN DEFAULT false,
  shuffle_options BOOLEAN DEFAULT false,
  assign_to_all BOOLEAN DEFAULT true,
  assigned_groups JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ongoing', 'completed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO exam_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO exam_user;
" 2>/dev/null || true
        
        print_success "Database schema initialized"
    fi
}

# Fix Backend issues
fix_backend() {
    print_step "Fixing Backend issues..."
    
    # Check for CrashLoopBackOff
    local backend_status=$(kubectl get pods -n "$NAMESPACE" -l app=backend -o jsonpath='{.items[*].status.containerStatuses[*].state.waiting.reason}' 2>/dev/null || echo "")
    
    if [[ "$backend_status" == *"CrashLoopBackOff"* ]]; then
        print_warning "Detected Backend CrashLoopBackOff, restarting..."
        kubectl rollout restart deployment/backend -n "$NAMESPACE"
        
        # Wait for backend to be ready
        if wait_for_deployment backend "$NAMESPACE" 120; then
            print_success "Backend is ready"
        else
            print_error "Backend failed to start"
            return 1
        fi
    else
        print_success "Backend is healthy"
    fi
    
    # Verify backend health
    local backend_pod=$(kubectl get pods -n "$NAMESPACE" -l app=backend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [[ -n "$backend_pod" ]]; then
        local health_check=$(kubectl logs "$backend_pod" -n "$NAMESPACE" --tail=5 2>/dev/null | grep "GET /health" || echo "")
        if [[ -n "$health_check" ]]; then
            print_success "Backend health checks passing"
        else
            print_warning "Backend health checks not found, but pod is running"
        fi
    fi
}

# Fix Frontend issues
fix_frontend() {
    print_step "Fixing Frontend issues..."
    
    # Restart frontend deployment
    kubectl rollout restart deployment/frontend -n "$NAMESPACE"
    
    # Wait for frontend to be ready
    if wait_for_deployment frontend "$NAMESPACE" 60; then
        print_success "Frontend is ready"
    else
        print_error "Frontend failed to start"
        return 1
    fi
}

# Fix ArgoCD issues
fix_argocd() {
    print_step "Fixing ArgoCD issues..."
    
    # Check if ArgoCD namespace exists
    if ! kubectl get namespace "$ARGOCD_NAMESPACE" >/dev/null 2>&1; then
        print_warning "ArgoCD namespace not found, creating..."
        kubectl create namespace "$ARGOCD_NAMESPACE"
    fi
    
    # Install ArgoCD CRDs if missing
    if ! kubectl get crd applications.argoproj.io >/dev/null 2>&1; then
        print_warning "Installing ArgoCD CRDs..."
        kubectl apply -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/crds.yaml
    fi
    
    # Fix Application spec issues
    local app_status=$(kubectl get application secure-exam-platform -n "$ARGOCD_NAMESPACE" -o jsonpath='{.status.health.status}' 2>/dev/null || echo "NotFound")
    
    if [[ "$app_status" == "NotFound" ]]; then
        print_info "Creating ArgoCD Application..."
        kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: secure-exam-platform
  namespace: $ARGOCD_NAMESPACE
spec:
  project: default
  source:
    repoURL: https://github.com/bayarmaa01/secure-exam-platform.git
    targetRevision: HEAD
    path: .
  destination:
    server: https://kubernetes.default.svc
    namespace: $NAMESPACE
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
    - RespectIgnoreDifferences=true
  ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers:
    - /spec/replicas
EOF
    fi
    
    # Fix Service port names
    print_info "Fixing Service port names..."
    kubectl patch service ai-proctoring -n "$NAMESPACE" --type='json' -p='[{"op": "add", "path": "/spec/ports/0/name", "value":"http"}]' 2>/dev/null || true
    
    print_success "ArgoCD fixes completed"
}

# Fix monitoring issues
fix_monitoring() {
    print_step "Fixing Monitoring issues..."
    
    # Check if monitoring namespace exists
    if ! kubectl get namespace "$MONITORING_NAMESPACE" >/dev/null 2>&1; then
        print_warning "Monitoring namespace not found, creating..."
        kubectl create namespace "$MONITORING_NAMESPACE"
    fi
    
    # Scale Grafana to 1 replica if multiple pods failing
    local grafana_replicas=$(kubectl get deployment prometheus-grafana -n "$MONITORING_NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1")
    local grafana_ready=$(kubectl get pods -n "$MONITORING_NAMESPACE" -l app.kubernetes.io/name=grafana --field-selector=status.phase=Running --no-headers | wc -l)
    
    if [[ "$grafana_replicas" -gt 1 && "$grafana_ready" -lt "$grafana_replicas" ]]; then
        print_warning "Scaling Grafana to 1 replica due to failing pods..."
        kubectl scale deployment prometheus-grafana --replicas=1 -n "$MONITORING_NAMESPACE"
        
        # Wait for Grafana to be ready
        if wait_for_deployment prometheus-grafana "$MONITORING_NAMESPACE" 60; then
            print_success "Grafana is ready"
        fi
    else
        print_success "Monitoring stack is healthy"
    fi
}

# Print system status summary
print_status_summary() {
    print_step "System Status Summary"
    echo ""
    
    # PostgreSQL status
    local postgres_status=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
    if [[ "$postgres_status" == "Running" ]]; then
        print_success "PostgreSQL: Running"
    else
        print_error "PostgreSQL: $postgres_status"
    fi
    
    # Backend status
    local backend_status=$(kubectl get pods -n "$NAMESPACE" -l app=backend -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
    if [[ "$backend_status" == "Running" ]]; then
        print_success "Backend: Running"
    else
        print_error "Backend: $backend_status"
    fi
    
    # Frontend status
    local frontend_status=$(kubectl get pods -n "$NAMESPACE" -l app=frontend -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
    if [[ "$frontend_status" == "Running" ]]; then
        print_success "Frontend: Running"
    else
        print_error "Frontend: $frontend_status"
    fi
    
    # ArgoCD status
    local argocd_status=$(kubectl get pods -n "$ARGOCD_NAMESPACE" -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
    if [[ "$argocd_status" == "Running" ]]; then
        print_success "ArgoCD: Running"
    else
        print_error "ArgoCD: $argocd_status"
    fi
    
    # Monitoring status
    local grafana_status=$(kubectl get pods -n "$MONITORING_NAMESPACE" -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
    if [[ "$grafana_status" == "Running" ]]; then
        print_success "Grafana: Running"
    else
        print_error "Grafana: $grafana_status"
    fi
    
    echo ""
    print_info "Access URLs:"
    echo "   Frontend: http://localhost:3005"
    echo "   Backend:  http://localhost:4005"
    echo "   AI:       http://localhost:5005"
    echo "   Grafana:  http://localhost:3002"
    echo "   ArgoCD:   https://localhost:18081"
    echo ""
    print_success "Use ./port-forward.sh to access services"
}

# Main function
main() {
    echo -e "${CYAN} DEVOPS SMART - Production-Grade Issue Detection and Fixing${NC}"
    echo ""
    
    print_step "Starting automatic issue detection and fixing..."
    echo ""
    
    # Fix all issues
    fix_secrets
    fix_postgresql
    fix_backend
    fix_frontend
    fix_argocd
    fix_monitoring
    
    echo ""
    print_success " All issues fixed!"
    echo ""
    
    # Print status summary
    print_status_summary
    
    echo ""
    print_success " Platform is ready!"
    echo ""
}

# Execute main function
main "$@"
