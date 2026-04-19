#!/bin/bash

# 🔄 PRODUCTION SYSTEM RESTART SCRIPT
# Clean restart of all services with proper ordering

set -e

echo "🔄 Restarting Production System..."
echo "================================="

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

# Clean up unused networks
print_status "Cleaning up unused networks..."
docker network prune -f

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

# Start monitoring services
print_status "Starting monitoring services..."
docker-compose up -d prometheus grafana node-exporter postgres-exporter

# Wait for monitoring services
print_status "Waiting for monitoring services..."
sleep 10

# Start reverse proxy last
print_status "Starting reverse proxy..."
docker-compose up -d nginx

# Final wait
print_status "Waiting for all services to be fully ready..."
sleep 15

# Check service status
print_status "Checking service status..."
docker-compose ps

# Run validation script
print_status "Running system validation..."
if [ -f "./validate-production-system.sh" ]; then
    chmod +x validate-production-system.sh
    ./validate-production-system.sh
else
    print_warning "Validation script not found, skipping validation"
fi

echo ""
print_status "🎉 Production system restart complete!"
echo ""
echo "📊 Access URLs:"
echo "- Main Application: https://secure-exam.duckdns.org"
echo "- Grafana: https://secure-exam.duckdns.org/grafana"
echo "- Prometheus: https://secure-exam.duckdns.org/prometheus"
echo ""
echo "🔧 Useful Commands:"
echo "- View logs: docker-compose logs -f [service-name]"
echo "- Check status: docker-compose ps"
echo "- Restart specific service: docker-compose restart [service-name]"
echo "- Run validation: ./validate-production-system.sh"
