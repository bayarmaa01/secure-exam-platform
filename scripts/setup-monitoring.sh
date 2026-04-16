#!/bin/bash

# Secure Exam Platform - Monitoring Setup Script
# This script sets up the complete monitoring stack with Prometheus, Grafana, and AlertManager

set -e

echo "🚀 Setting up Secure Exam Platform Monitoring Stack..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Check if Docker is running
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

# Check if Docker Compose is running
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed or not in PATH"
    exit 1
fi

# Create necessary directories
print_header "Creating Directories"
mkdir -p monitoring/prometheus
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/provisioning/datasources
mkdir -p monitoring/nginx
mkdir -p monitoring/grafana/data
mkdir -p monitoring/alertmanager

# Generate htpasswd for Prometheus authentication
print_header "Setting up Authentication"
if [ ! -f monitoring/nginx/.htpasswd ]; then
    print_status "Creating Prometheus authentication..."
    echo "admin:$(openssl rand -base64 32 | tr -d '/')" | sudo tee monitoring/nginx/.htpasswd
fi

# Generate SSL certificates for HTTPS (self-signed for development)
if [ ! -f monitoring/ssl/cert.pem ]; then
    print_status "Generating SSL certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout monitoring/ssl/key.pem \
        -out monitoring/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
        2>/dev/null
fi

# Set proper permissions
chmod 600 monitoring/ssl/key.pem
chmod 644 monitoring/ssl/cert.pem

# Create environment file for monitoring
print_header "Creating Environment Configuration"
cat > monitoring/.env << EOF
# Prometheus Configuration
PROMETHEUS_RETENTION=30d
PROMETHEUS_STORAGE_SIZE=10GB
PROMETHEUS_TOKEN=prometheus-secure-token-$(openssl rand -hex 16)

# Grafana Configuration
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=admin123
GF_INSTALL_PLUGINS=grafana-piechart-panel,grafana-worldmap-panel
GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD=live-exam-monitoring
GF_USERS_ALLOW_SIGN_UP=false
GF_SMTP_ENABLED=false
GF_LOG_LEVEL=info

# AlertManager Configuration
ALERTMANAGER_URL=http://alertmanager:9093
EOF

print_status "Environment configuration created"

# Create AlertManager configuration
print_header "Setting up AlertManager"
cat > monitoring/alertmanager.yml << 'EOF'
global:
  smtp_smarthost: localhost
  smtp_from: alerts@secure-exam-platform.com
  smtp_auth_username: alerts@secure-exam-platform.com
  smtp_auth_password: your-smtp-password

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: http://backend:4000/api/alerts
        send_resolved: true
        send_wait_for: true
EOF

print_status "AlertManager configuration created"

# Start monitoring stack
print_header "Starting Monitoring Stack"

# Stop existing containers if running
docker-compose -f docker-compose.monitoring.yml down 2>/dev/null || true

# Start new containers
print_status "Starting monitoring containers..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check service health
check_service_health() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null; then
            print_status "$service is healthy!"
            return 0
        fi
        
        print_warning "Waiting for $service to be ready... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service failed to start after $max_attempts attempts"
    return 1
}

# Check each service
check_service_health "Prometheus" "http://localhost:9090/-/healthy"
check_service_health "Grafana" "http://localhost:3001/api/health"
check_service_health "AlertManager" "http://localhost:9093/-/healthy"

print_header "🎉 Monitoring Stack Setup Complete!"
print_status "Services are now running:"
echo ""
echo -e "${GREEN}• Prometheus:${NC}        http://localhost:9090"
echo -e "${GREEN}• Grafana:${NC}          http://localhost:3001"
echo -e "${GREEN}• AlertManager:${NC}     http://localhost:9093"
echo -e "${GREEN}• Nginx Proxy:${NC}      http://localhost (HTTP) / https://localhost (HTTPS)"
echo ""
echo -e "${BLUE}Access Credentials:${NC}"
echo -e "${YELLOW}• Grafana Admin:${NC}     admin / admin123"
echo -e "${YELLOW}• Prometheus:${NC}       admin / (check .htpasswd)"
echo ""
echo -e "${BLUE}Monitoring Dashboard:${NC} http://localhost:3001/d/live-exam-monitoring"
echo ""
print_status "📊 Metrics are now being collected at http://localhost:9090/metrics"
print_status "📈 Grafana dashboards are auto-provisioned and ready"
print_status "🚨 AlertManager is configured and ready to receive alerts"
echo ""
print_status "📋 Next Steps:"
echo "1. Open Grafana dashboard: http://localhost:3001"
echo "2. Login with admin/admin123"
echo "3. Navigate to the 'Live Exam Monitoring' dashboard"
echo "4. Start monitoring your live exams!"
echo ""
print_status "🔧 To stop monitoring stack: docker-compose -f docker-compose.monitoring.yml down"
print_status "🔄 To restart monitoring stack: docker-compose -f docker-compose.monitoring.yml restart"
