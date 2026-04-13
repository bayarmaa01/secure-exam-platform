#!/bin/bash

echo "=== FIXING ARGOCD DEPLOYMENT ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Function to check if kubectl is working
check_kubectl() {
    if ! kubectl cluster-info >/dev/null 2>&1; then
        print_error "kubectl cannot connect to cluster"
        return 1
    fi
    return 0
}

# Function to clean existing ArgoCD installation
clean_argocd() {
    print_step "Cleaning existing ArgoCD installation"
    
    # Kill any existing port-forward
    if [ -f /tmp/argocd-port-forward.pid ]; then
        kill $(cat /tmp/argocd-port-forward.pid) 2>/dev/null || true
        rm -f /tmp/argocd-port-forward.pid
    fi
    
    # Delete ArgoCD namespace and all resources
    kubectl delete namespace argocd --ignore-not-found=true --grace-period=0 --wait=false >/dev/null 2>&1 || true
    
    # Wait for namespace to be deleted
    print_step "Waiting for argocd namespace deletion..."
    kubectl wait --for=delete namespace/argocd --timeout=60s >/dev/null 2>&1 || true
    
    print_success "ArgoCD cleanup completed"
}

# Function to install ArgoCD with proper configuration
install_argocd_fixed() {
    print_step "Installing ArgoCD with fixed configuration"
    
    # Create namespace
    kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
    
    # Install ArgoCD with custom configuration to fix port issues
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cmd-params-cm
  namespace: argocd
  labels:
    app.kubernetes.io/name: argocd-cmd-params-cm
    app.kubernetes.io/part-of: argocd
data:
  server.insecure: "true"
  server.baseurl: "https://argocd-server"
  server.disable.auth: "false"
  server.staticassets.builtins: "true"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: argocd-server
  namespace: argocd
  labels:
    app.kubernetes.io/name: argocd-server
    app.kubernetes.io/part-of: argocd
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: argocd-server
  template:
    metadata:
      labels:
        app.kubernetes.io/name: argocd-server
        app.kubernetes.io/part-of: argocd
    spec:
      containers:
      - name: argocd-server
        image: quay.io/argoproj/argocd:v2.8.3
        command:
        - argocd-server
        - --insecure
        - --port=8080
        - --repo-server=argocd-repo-server:8081
        - --redis=argocd-redis:6379
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 8083
          name: https
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        env:
        - name: ARGOCD_SERVER_INSECURE
          value: "true"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: argocd-server
  namespace: argocd
  labels:
    app.kubernetes.io/name: argocd-server
    app.kubernetes.io/part-of: argocd
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 8080
    targetPort: 8080
  - name: https
    port: 443
    targetPort: 8083
  selector:
    app.kubernetes.io/name: argocd-server
EOF

    # Apply the complete ArgoCD installation
    kubectl apply -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml -n argocd || {
        print_warning "Full installation failed, trying minimal installation"
        # Apply core components only
        kubectl apply -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/core-install.yaml -n argocd
    }
    
    print_success "ArgoCD installation completed"
}

# Function to wait for ArgoCD to be ready
wait_argocd_ready() {
    print_step "Waiting for ArgoCD to be ready"
    
    # Wait for deployments to be ready
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "Checking ArgoCD status... (Attempt $attempt/$max_attempts)"
        
        # Check if argocd-server deployment is ready
        if kubectl rollout status deployment/argocd-server -n argocd --timeout=30s >/dev/null 2>&1; then
            print_success "ArgoCD server is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "ArgoCD failed to become ready"
            echo "Current pod status:"
            kubectl get pods -n argocd
            echo "Pod events:"
            kubectl describe pods -n argocd -l app.kubernetes.io/name=argocd-server
            return 1
        fi
        
        sleep 10
        attempt=$((attempt + 1))
    done
    
    # Check pod status
    print_step "Checking pod status"
    kubectl get pods -n argocd
    
    # Check service status
    print_step "Checking service status"
    kubectl get svc -n argocd
    
    print_success "ArgoCD is ready"
}

# Function to expose ArgoCD with proper port forwarding
expose_argocd_fixed() {
    print_step "Exposing ArgoCD UI with fixed port forwarding"
    
    # Kill any existing port-forward
    if [ -f /tmp/argocd-port-forward.pid ]; then
        kill $(cat /tmp/argocd-port-forward.pid) 2>/dev/null || true
        rm -f /tmp/argocd-port-forward.pid
    fi
    
    # Wait a moment for cleanup
    sleep 2
    
    # Start port-forward to HTTP port (8080) instead of HTTPS (443)
    kubectl port-forward svc/argocd-server -n argocd 18081:8080 >/dev/null 2>&1 &
    ARGOCD_PID=$!
    echo $ARGOCD_PID > /tmp/argocd-port-forward.pid
    
    # Wait for port-forward to establish
    sleep 5
    
    # Test if port-forward is working
    if curl -s http://localhost:18081/healthz >/dev/null 2>&1; then
        print_success "ArgoCD UI exposed on http://localhost:18081"
        print_success "Note: Using HTTP (not HTTPS) due to insecure configuration"
    else
        print_error "Port-forward test failed"
        print_warning "You may need to manually run: kubectl port-forward svc/argocd-server -n argocd 18081:8080"
    fi
}

# Function to get ArgoCD credentials
get_argocd_credentials() {
    print_step "Retrieving ArgoCD credentials"
    
    # Get initial admin password
    local password=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" 2>/dev/null | base64 -d)
    
    if [ -n "$password" ]; then
        print_success "ArgoCD credentials retrieved"
        echo -e "${GREEN}URL: http://localhost:18081${NC}"
        echo -e "${GREEN}Username: admin${NC}"
        echo -e "${GREEN}Password: $password${NC}"
    else
        print_warning "Could not retrieve initial admin password"
        echo "You may need to check the secret manually:"
        echo "kubectl -n argocd get secret argocd-initial-admin-secret -o yaml"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}=== ARGOCD DEPLOYMENT FIX ===${NC}"
    
    # Check prerequisites
    if ! check_kubectl; then
        print_error "Cannot proceed without kubectl access"
        exit 1
    fi
    
    # Execute fixes
    clean_argocd
    install_argocd_fixed
    wait_argocd_ready
    expose_argocd_fixed
    get_argocd_credentials
    
    print_success "ArgoCD deployment fix completed!"
    echo ""
    echo "Next steps:"
    echo "1. Access ArgoCD at http://localhost:18081"
    echo "2. Login with admin credentials"
    echo "3. Configure your GitOps repositories"
}

# Run main function
main "$@"
