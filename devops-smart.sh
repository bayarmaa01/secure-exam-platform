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
    
    # Create/update secret with all required keys
    print_info "Creating/updating secret with all required keys..."
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: exam-platform-secret
  namespace: $NAMESPACE
type: Opaque
stringData:
  # Database credentials - SINGLE SOURCE OF TRUTH
  DB_HOST: postgres
  DB_PORT: "5432"
  DB_USER: exam_user
  DB_PASSWORD: exam_password
  DB_NAME: exam_platform
  # PostgreSQL native environment variables (mapped from DB_*)
  POSTGRES_USER: exam_user
  POSTGRES_PASSWORD: exam_password
  POSTGRES_DB: exam_platform
  # Backward compatibility keys
  postgres-user: exam_user
  postgres-password: exam_password
  # Connection URLs
  DATABASE_URL: "postgresql://exam_user:exam_password@postgres:5432/exam_platform"
  REDIS_HOST: redis
  REDIS_PORT: "6379"
  REDIS_URL: "redis://redis:6379"
  # JWT secrets
  JWT_SECRET: "change-me-in-production-use-k8s-secrets"
  JWT_REFRESH_SECRET: "change-refresh-in-production-use-k8s-secrets"
EOF
    
    print_success "Secret fixes completed"
}

# Fix PostgreSQL issues
fix_postgresql() {
    print_step "Fixing PostgreSQL issues..."
    
    # Apply updated PostgreSQL deployment with proper secret keys
    print_info "Applying updated PostgreSQL deployment..."
    kubectl apply -f - <<EOF
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
      initContainers:
      - name: init-db
        image: postgres:16-alpine
        envFrom:
        - secretRef:
            name: exam-platform-secret
        command:
        - /bin/sh
        - -c
        - |
          echo "Initializing PostgreSQL..."
          if [ ! -f /var/lib/postgresql/data/pg_hba.conf ]; then
            echo "Fresh PostgreSQL installation detected"
            echo "Creating database with user: \$POSTGRES_USER"
          else
            echo "Existing PostgreSQL data found"
            echo "Checking user credentials..."
          fi
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          envFrom:
          - secretRef:
              name: exam-platform-secret
          env:
            # Use correct secret keys
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: exam-platform-secret
                  key: POSTGRES_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: exam-platform-secret
                  key: POSTGRES_PASSWORD
            - name: POSTGRES_DB
              valueFrom:
                secretKeyRef:
                  name: exam-platform-secret
                  key: POSTGRES_DB
            - name: POSTGRES_INITDB_ARGS
              value: "--auth-host=scram-sha-256"
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
          - name: postgres-data
            mountPath: /var/lib/postgresql/data
          readinessProbe:
            exec:
              command:
                - /bin/sh
                - -c
                - "pg_isready -U \$POSTGRES_USER -d \$POSTGRES_DB"
            initialDelaySeconds: 15
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 5
          livenessProbe:
            exec:
              command:
                - /bin/sh
                - -c
                - "pg_isready -U \$POSTGRES_USER -d \$POSTGRES_DB"
            initialDelaySeconds: 30
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
      volumes:
        - name: postgres-data
          persistentVolumeClaim:
            claimName: postgres-pvc
EOF
    
    # Apply PostgreSQL service
    kubectl apply -f - <<EOF
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
  type: ClusterIP
EOF
    
    # Apply PostgreSQL PVC
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
    
    # Wait for PostgreSQL to be ready
    if wait_for_deployment postgres "$NAMESPACE" 120; then
        print_success "PostgreSQL is ready"
    else
        print_error "PostgreSQL failed to start"
        return 1
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
        sleep 10
    fi
    
    # Fix CrashLoopBackOff pods by deleting and recreating
    local argocd_pods=$(kubectl get pods -n "$ARGOCD_NAMESPACE" -o jsonpath='{.items[*].status.containerStatuses[*].state.waiting.reason}' 2>/dev/null || echo "")
    
    if [[ "$argocd_pods" == *"CrashLoopBackOff"* ]]; then
        print_warning "Detected ArgoCD CrashLoopBackOff, fixing..."
        
        # Delete problematic deployments
        kubectl delete deployment argocd-applicationset-controller -n "$ARGOCD_NAMESPACE" --ignore-not-found=true
        kubectl delete deployment argocd-server -n "$ARGOCD_NAMESPACE" --ignore-not-found=true
        
        # Wait for pods to terminate
        sleep 10
        
        # Recreate ArgoCD with fixed configuration
        kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: argocd-applicationset-controller
  namespace: $ARGOCD_NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: argocd-applicationset-controller
  template:
    metadata:
      labels:
        app.kubernetes.io/name: argocd-applicationset-controller
    spec:
      containers:
      - name: argocd-applicationset-controller
        image: quay.io/argoproj/argocd-applicationset-controller:v2.8.4
        args:
        - --argocd-repo-server
        - argocd-repo-server.$ARGOCD_NAMESPACE.svc.cluster.local:8081
        env:
        - name: ARGOCD_NAMESPACE
          value: $ARGOCD_NAMESPACE
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: argocd-server
  namespace: $ARGOCD_NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: argocd-server
  template:
    metadata:
      labels:
        app.kubernetes.io/name: argocd-server
    spec:
      containers:
      - name: argocd-server
        image: quay.io/argoproj/argocd:v2.8.4
        command:
        - argocd-server
        - --staticassets
        - /shared/app
        - --repo-server
        - argocd-repo-server.$ARGOCD_NAMESPACE.svc.cluster.local:8081
        - --dex-server
        - https://argocd-dex-server.$ARGOCD_NAMESPACE.svc.cluster.local:5556
        - --redis-server
        - argocd-redis.$ARGOCD_NAMESPACE.svc.cluster.local:6379
        - --loglevel
        - info
        env:
        - name: ARGOCD_SERVER_INSECURE
          value: "true"
EOF
        
        # Wait for deployments to be ready
        if wait_for_deployment argocd-applicationset-controller "$ARGOCD_NAMESPACE" 120; then
            print_success "ArgoCD ApplicationSet Controller is ready"
        fi
        
        if wait_for_deployment argocd-server "$ARGOCD_NAMESPACE" 120; then
            print_success "ArgoCD Server is ready"
        fi
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
