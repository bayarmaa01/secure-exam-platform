#!/bin/bash

# 🔒 Secure Exam Platform - Production Deployment Script
# Azure VM: 4.247.154.224 | Domain: secure-exam.duckdns.org

set -e

echo "🚀 Starting Secure Exam Platform Production Deployment..."

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down --remove-orphans || true

# Remove old images to ensure fresh build
echo "🗑️ Removing old images..."
docker system prune -f

# Build and start all services
echo "🔨 Building and starting all services..."
docker-compose up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
for service in postgres redis backend ai-proctoring frontend nginx prometheus grafana node-exporter; do
    echo "Checking $service..."
    docker-compose ps $service
done

# Wait a bit more for full initialization
echo "⏳ Waiting for full initialization..."
sleep 60

# Test endpoints
echo "🧪 Testing endpoints..."

echo "Testing Frontend (via nginx):"
curl -f http://localhost/health || echo "❌ Frontend health check failed"

echo "Testing Backend API:"
curl -f http://localhost/api/health || echo "❌ Backend health check failed"

echo "Testing Prometheus:"
curl -f http://localhost:9092/-/healthy || echo "❌ Prometheus health check failed"

echo "Testing Grafana:"
curl -f http://localhost:3002/api/health || echo "❌ Grafana health check failed"

# Display URLs
echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🌐 Application URLs:"
echo "   Main App:        http://secure-exam.duckdns.org"
echo "   Direct IP:       http://4.247.154.224"
echo "   Frontend Direct: http://4.247.154.224:3005"
echo "   Backend API:     http://4.247.154.224:4005/api"
echo "   AI Proctoring:   http://4.247.154.224:5005"
echo ""
echo "📊 Monitoring URLs:"
echo "   Grafana:         http://4.247.154.224:3002"
echo "   Prometheus:      http://4.247.154.224:9092"
echo ""
echo "🔐 Grafana Credentials:"
echo "   Username: admin"
echo "   Password: SecureGrafanaAdmin2024!"
echo ""
echo "🗄️ Database Info:"
echo "   Host: postgres"
echo "   Port: 5432"
echo "   Database: exam_platform"
echo "   Username: postgres"
echo "   Password: SecureExamPlatform2024!"
echo ""
echo "📝 To view logs:"
echo "   docker-compose logs -f [service-name]"
echo ""
echo "🛑 To stop all services:"
echo "   docker-compose down"
echo ""
echo "🔄 To restart all services:"
echo "   docker-compose restart"
echo ""

# Show running containers
echo "📦 Running containers:"
docker-compose ps
