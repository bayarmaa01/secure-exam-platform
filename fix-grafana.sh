#!/bin/bash

echo "=== FIXING GRAFANA DEPLOYMENT ==="

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

# Function to clean existing Grafana installation
clean_grafana() {
    print_step "Cleaning existing Grafana installation"
    
    # Kill any existing port-forward
    if [ -f /tmp/grafana-port-forward.pid ]; then
        kill $(cat /tmp/grafana-port-forward.pid) 2>/dev/null || true
        rm -f /tmp/grafana-port-forward.pid
    fi
    
    # Uninstall existing Prometheus stack if it exists
    helm uninstall prometheus -n monitoring --ignore-not-found=true >/dev/null 2>&1 || true
    
    # Delete monitoring namespace
    kubectl delete namespace monitoring --ignore-not-found=true --grace-period=0 --wait=false >/dev/null 2>&1 || true
    
    # Wait for namespace to be deleted
    print_step "Waiting for monitoring namespace deletion..."
    kubectl wait --for=delete namespace/monitoring --timeout=60s >/dev/null 2>&1 || true
    
    print_success "Grafana cleanup completed"
}

# Function to install Grafana with proper configuration
install_grafana_fixed() {
    print_step "Installing Grafana with fixed configuration"
    
    # Create namespace
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    # Install Prometheus stack with Grafana overrides
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    cat <<EOF > grafana-values.yaml
prometheus:
  enabled: true

alertmanager:
  enabled: true

grafana:
  enabled: true
  image:
    repository: grafana/grafana
    tag: "10.2.0"
    pullPolicy: IfNotPresent
  
  # Security context fixes for non-root policy compliance
  securityContext:
    runAsUser: 472
    runAsGroup: 472
    fsGroup: 472
  
  # Init container security context
  initChownData:
    enabled: true
    securityContext:
      runAsUser: 0
      runAsGroup: 0
  
  # Admin user configuration
  adminUser: admin
  adminPassword: admin123
  
  # Service configuration
  service:
    type: ClusterIP
    port: 3000
    targetPort: 3000
  
  # Ingress (disabled for local deployment)
  ingress:
    enabled: false
  
  # Persistence
  persistence:
    enabled: true
    type: pvc
    accessModes:
      - ReadWriteOnce
    size: 2Gi
    storageClassName: standard
  
  # Data sources
  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
        - name: Prometheus
          type: prometheus
          url: http://prometheus-server.monitoring.svc.cluster.local
          access: proxy
          isDefault: true
        - name: Alertmanager
          type: alertmanager
          url: http://alertmanager.monitoring.svc.cluster.local
          access: proxy
  
  # Dashboard providers
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
        - name: 'default'
          orgId: 1
          folder: ''
          type: file
          disableDeletion: false
          editable: true
          options:
            path: /var/lib/grafana/dashboards/default
  
  # Dashboards
  dashboards:
    default:
      # Kubernetes overview dashboard
      kubernetes-overview:
        gnetId: 15757
        revision: 1
        datasource: Prometheus
      # Node exporter dashboard
      node-exporter:
        gnetId: 1860
        revision: 21
        datasource: Prometheus
  
  # Resources
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "500m"
  
  # Readiness and liveness probes
  readinessProbe:
    httpGet:
      path: /api/health
      port: 3000
    initialDelaySeconds: 30
    periodSeconds: 10
    timeoutSeconds: 5
    failureThreshold: 3
  
  livenessProbe:
    httpGet:
      path: /api/health
      port: 3000
    initialDelaySeconds: 60
    periodSeconds: 30
    timeoutSeconds: 10
    failureThreshold: 3
  
  # Environment variables
  env:
    - name: GF_SECURITY_ADMIN_USER
      value: "admin"
    - name: GF_SECURITY_ADMIN_PASSWORD
      value: "admin123"
    - name: GF_INSTALL_PLUGINS
      value: "grafana-piechart-panel,grafana-worldmap-panel"
    - name: GF_PATHS_PLUGINS
      value: "/var/lib/grafana/plugins"
    - name: GF_PATHS_PROVISIONING
      value: "/etc/grafana/provisioning"

# Prometheus configuration
prometheus:
  prometheusSpec:
    retention: 30d
    resources:
      requests:
        memory: "400Mi"
        cpu: "200m"
      limits:
        memory: "800Mi"
        cpu: "500m"
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: standard
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 4Gi

# Node Exporter
nodeExporter:
  enabled: true
  resources:
    requests:
      memory: "64Mi"
      cpu: "50m"
    limits:
      memory: "128Mi"
      cpu: "100m"

# AlertManager
alertmanager:
  enabled: true
  resources:
    requests:
      memory: "64Mi"
      cpu: "50m"
    limits:
      memory: "128Mi"
      cpu: "100m"
EOF

    # Install with custom values
    helm install prometheus prometheus-community/kube-prometheus-stack \
        -n monitoring \
        --create-namespace \
        --values grafana-values.yaml \
        --timeout 10m
    
    print_success "Grafana installation completed"
}

# Function to wait for Grafana to be ready
wait_grafana_ready() {
    print_step "Waiting for Grafana to be ready"
    
    # Wait for Grafana deployment to be ready
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "Checking Grafana status... (Attempt $attempt/$max_attempts)"
        
        # Check if grafana deployment is ready
        if kubectl rollout status deployment/prometheus-grafana -n monitoring --timeout=30s >/dev/null 2>&1; then
            print_success "Grafana is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "Grafana failed to become ready"
            echo "Current pod status:"
            kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana
            echo "Pod events:"
            kubectl describe pods -n monitoring -l app.kubernetes.io/name=grafana
            return 1
        fi
        
        sleep 10
        attempt=$((attempt + 1))
    done
    
    # Check pod status
    print_step "Checking Grafana pod status"
    kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana
    
    # Check service status
    print_step "Checking Grafana service status"
    kubectl get svc -n monitoring -l app.kubernetes.io/name=grafana
    
    print_success "Grafana is ready"
}

# Function to expose Grafana with proper port forwarding
expose_grafana_fixed() {
    print_step "Exposing Grafana UI with fixed port forwarding"
    
    # Kill any existing port-forward
    if [ -f /tmp/grafana-port-forward.pid ]; then
        kill $(cat /tmp/grafana-port-forward.pid) 2>/dev/null || true
        rm -f /tmp/grafana-port-forward.pid
    fi
    
    # Wait a moment for cleanup
    sleep 2
    
    # Start port-forward to Grafana service
    kubectl port-forward svc/prometheus-grafana -n monitoring 3002:3000 >/dev/null 2>&1 &
    GRAFANA_PID=$!
    echo $GRAFANA_PID > /tmp/grafana-port-forward.pid
    
    # Wait for port-forward to establish
    sleep 5
    
    # Test if port-forward is working
    if curl -s http://localhost:3002/api/health >/dev/null 2>&1; then
        print_success "Grafana UI exposed on http://localhost:3002"
    else
        print_error "Port-forward test failed"
        print_warning "You may need to manually run: kubectl port-forward svc/prometheus-grafana -n monitoring 3002:3000"
    fi
}

# Function to get Grafana credentials
get_grafana_credentials() {
    print_step "Retrieving Grafana credentials"
    
    # Get admin password from secret
    local password=$(kubectl -n monitoring get secret prometheus-grafana -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 -d)
    
    if [ -n "$password" ]; then
        print_success "Grafana credentials retrieved"
        echo -e "${GREEN}URL: http://localhost:3002${NC}"
        echo -e "${GREEN}Username: admin${NC}"
        echo -e "${GREEN}Password: $password${NC}"
    else
        print_warning "Could not retrieve Grafana password from secret"
        echo "Using default password from values file: admin123"
        echo -e "${GREEN}URL: http://localhost:3002${NC}"
        echo -e "${GREEN}Username: admin${NC}"
        echo -e "${GREEN}Password: admin123${NC}"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}=== GRAFANA DEPLOYMENT FIX ===${NC}"
    
    # Check prerequisites
    if ! check_kubectl; then
        print_error "Cannot proceed without kubectl access"
        exit 1
    fi
    
    # Check if helm is available
    if ! command -v helm >/dev/null 2>&1; then
        print_error "helm is required but not installed"
        exit 1
    fi
    
    # Execute fixes
    clean_grafana
    install_grafana_fixed
    wait_grafana_ready
    expose_grafana_fixed
    get_grafana_credentials
    
    print_success "Grafana deployment fix completed!"
    echo ""
    echo "Next steps:"
    echo "1. Access Grafana at http://localhost:3002"
    echo "2. Login with admin credentials"
    echo "3. Explore pre-configured dashboards"
}

# Run main function
main "$@"
