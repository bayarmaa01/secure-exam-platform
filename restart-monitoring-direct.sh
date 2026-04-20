#!/bin/bash

# 🔄 RESTART MONITORING WITH DIRECT PORT ACCESS
# Expose Grafana and Prometheus directly instead of via Nginx subpaths

set -e

echo "🔄 Restarting Monitoring Services with Direct Port Access..."
echo "======================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Stop all services
print_status "Stopping all services..."
docker-compose down

# Clean up any orphaned containers
print_status "Cleaning up orphaned containers..."
docker container prune -f

# Pull latest images
print_status "Pulling latest images..."
docker-compose pull

# Build services with latest code
print_status "Building services..."
docker-compose build --no-cache

# Start core services first (database, cache)
print_status "Starting core services (postgres, redis)..."
docker-compose up -d postgres redis

# Wait for database to be ready
print_status "Waiting for database to be ready..."
sleep 10
while ! docker exec postgres pg_isready -U postgres -d exam_platform; do
    print_warning "Waiting for postgres..."
    sleep 2
done

# Start application services
print_status "Starting application services..."
docker-compose up -d backend ai-proctoring frontend

# Wait for backend to be ready
print_status "Waiting for backend to be ready..."
sleep 10
while ! curl -s http://localhost:4005/health > /dev/null; do
    print_warning "Waiting for backend..."
    sleep 2
done

# Start monitoring services (now with direct port access)
print_status "Starting monitoring services with direct port access..."
docker-compose up -d prometheus grafana node-exporter postgres-exporter

# Wait for monitoring services
print_status "Waiting for monitoring services..."
sleep 10

# Start reverse proxy last (without monitoring routes)
print_status "Starting reverse proxy (without monitoring routes)..."
docker-compose up -d nginx

# Final wait
print_status "Waiting for all services to be fully ready..."
sleep 15

# Check service status
print_status "Checking service status..."
docker-compose ps

echo ""
print_status "🎉 Monitoring services restarted with direct port access!"
echo ""
echo "📊 Direct Access URLs:"
echo "- Grafana: http://4.247.154.224:3000"
echo "- Prometheus: http://4.247.154.224:9090"
echo "- Main App: https://secure-exam.duckdns.org"
echo ""
echo "🔧 Grafana Login:"
echo "- Username: admin"
echo "- Password: SecureGrafanaAdmin2024!"
echo ""
echo "📈 Prometheus Targets:"
echo "- Backend: http://backend:4005/metrics"
echo "- AI Proctoring: http://ai-proctoring:8000/metrics"
echo "- Node Exporter: http://node-exporter:9100/metrics"
echo "- Postgres Exporter: http://postgres-exporter:9187/metrics"

echo ""
echo "🧪 Validation Commands:"
echo "- Check Grafana: curl -I http://4.247.154.224:3000"
echo "- Check Prometheus: curl -I http://4.247.154.224:9090"
echo "- Check Prometheus targets: curl http://4.247.154.224:9090/api/v1/targets"

echo ""
echo "🔍 Useful Commands:"
echo "- View Grafana logs: docker-compose logs -f grafana"
echo "- View Prometheus logs: docker-compose logs -f prometheus"
echo "- Restart Grafana: docker-compose restart grafana"
echo "- Restart Prometheus: docker-compose restart prometheus"
