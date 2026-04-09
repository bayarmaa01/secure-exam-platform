#!/bin/bash

# ========================================
# ArgoCD Installation Script
# ========================================
# This script installs and configures ArgoCD for the secure exam platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}i  $1${NC}"
}

print_success() {
    echo -e "${GREEN} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}  $1${NC}"
}

print_error() {
    echo -e "${RED}  $1${NC}"
}

print_header() {
    echo -e "${GREEN}"
    echo "======================================"
    echo "$1"
    echo "======================================"
    echo -e "${NC}"
}

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    print_success "kubectl is available and cluster is accessible"
}

# Function to create argocd namespace
create_argocd_namespace() {
    print_info "Creating argocd namespace..."
    
    if kubectl get namespace argocd &> /dev/null; then
        print_warning "argocd namespace already exists"
    else
        kubectl create namespace argocd
        print_success "argocd namespace created"
    fi
}

# Function to install ArgoCD
install_argocd() {
    print_header "Installing ArgoCD"
    
    print_info "Installing ArgoCD from official manifest..."
    
    # Install ArgoCD
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
    
    print_info "Waiting for ArgoCD pods to be ready..."
    
    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-repo-server -n argocd --timeout=300s
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-application-controller -n argocd --timeout=300s
    
    print_success "ArgoCD installation completed"
}

# Function to get ArgoCD admin password
get_argocd_password() {
    print_info "Getting ArgoCD admin password..."
    
    local password=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
    
    print_success "ArgoCD admin password: $password"
    echo "ArgoCD admin password: $password" > /tmp/argocd-password.txt
    print_info "Password saved to /tmp/argocd-password.txt"
    
    echo "$password"
}

# Function to configure ArgoCD ingress (optional)
configure_argocd_ingress() {
    print_info "Creating ArgoCD ingress configuration..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-ingress
  namespace: argocd
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
spec:
  rules:
  - host: argocd.exam-platform.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              number: 443
EOF
    
    print_success "ArgoCD ingress configured"
}

# Function to create ArgoCD application for secure exam platform
create_argocd_app() {
    print_info "Creating ArgoCD application for secure exam platform..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: secure-exam-platform
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-username/secure-exam-platform.git
    targetRevision: HEAD
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: exam-platform
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
EOF
    
    print_success "ArgoCD application created"
}

# Function to display access information
show_access_info() {
    print_header "ArgoCD Access Information"
    
    local password=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
    
    echo -e "${GREEN}ArgoCD URL:${NC}"
    echo -e "  Port Forward: ${BLUE}kubectl port-forward -n argocd svc/argocd-server 18081:80${NC}"
    echo -e "  Then access: ${BLUE}https://localhost:18081${NC}"
    echo -e ""
    echo -e "${GREEN}Login Credentials:${NC}"
    echo -e "  Username: ${BLUE}admin${NC}"
    echo -e "  Password: ${BLUE}$password${NC}"
    echo -e ""
    echo -e "${GREEN}CLI Access:${NC}"
    echo -e "  Install CLI: ${BLUE}curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64${NC}"
    echo -e "  Make executable: ${BLUE}chmod +x argocd && sudo mv argocd /usr/local/bin/${NC}"
    echo -e "  Login: ${BLUE}argocd login localhost:18081 --username admin --password $password --insecure${NC}"
}

# Main execution
main() {
    print_header "ArgoCD Installation and Configuration"
    
    # Check prerequisites
    check_kubectl
    
    # Create namespace
    create_argocd_namespace
    
    # Install ArgoCD
    install_argocd
    
    # Get password
    get_argocd_password
    
    # Optional: Configure ingress
    read -p "Do you want to configure ArgoCD ingress? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        configure_argocd_ingress
    fi
    
    # Optional: Create application
    read -p "Do you want to create ArgoCD application for secure exam platform? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_argocd_app
    fi
    
    # Show access information
    show_access_info
    
    print_success "ArgoCD installation completed successfully!"
}

# Run main function
main "$@"
