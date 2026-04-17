#!/bin/bash

echo "=== Secure Exam Platform System Health Check ==="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running"
    exit 1
else
    echo "✅ Docker is running"
fi

# Check if containers are running
echo ""
echo "=== Container Status ==="
containers=("frontend" "backend" "ai-proctoring" "postgres" "redis" "prometheus" "grafana")

for container in "${containers[@]}"; do
    if docker ps --format "table {{.Names}}" | grep -q "$container"; then
        echo "✅ $container is running"
    else
        echo "❌ $container is not running"
    fi
done

# Check service health endpoints
echo ""
echo "=== Service Health Checks ==="

# Backend health check
echo "Checking backend (port 4005)..."
if curl -s -f http://localhost:4005/health > /dev/null 2>&1; then
    echo "✅ Backend health endpoint responding"
else
    echo "❌ Backend health endpoint not responding"
fi

# Frontend health check
echo "Checking frontend (port 3005)..."
if curl -s -f http://localhost:3005 > /dev/null 2>&1; then
    echo "✅ Frontend is responding"
else
    echo "❌ Frontend is not responding"
fi

# AI Proctoring health check
echo "Checking AI proctoring (port 5005)..."
if curl -s -f http://localhost:5005/health > /dev/null 2>&1; then
    echo "✅ AI proctoring health endpoint responding"
else
    echo "❌ AI proctoring health endpoint not responding"
fi

# Prometheus health check
echo "Checking Prometheus (port 9092)..."
if curl -s -f http://localhost:9092/-/healthy > /dev/null 2>&1; then
    echo "✅ Prometheus is healthy"
else
    echo "❌ Prometheus is not healthy"
fi

# Grafana health check
echo "Checking Grafana (port 3002)..."
if curl -s -f http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "✅ Grafana is healthy"
else
    echo "❌ Grafana is not healthy"
fi

# Check API endpoints
echo ""
echo "=== API Endpoint Tests ==="

# Test teacher stats endpoint
echo "Testing /api/teacher/stats endpoint..."
if curl -s -f -H "Content-Type: application/json" http://localhost:4005/api/teacher/stats > /dev/null 2>&1; then
    echo "✅ Teacher stats endpoint accessible (may require auth)"
else
    echo "❌ Teacher stats endpoint not accessible"
fi

# Test teacher exams endpoint
echo "Testing /api/teacher/exams endpoint..."
if curl -s -f -H "Content-Type: application/json" http://localhost:4005/api/teacher/exams > /dev/null 2>&1; then
    echo "✅ Teacher exams endpoint accessible (may require auth)"
else
    echo "❌ Teacher exams endpoint not accessible"
fi

# Check Prometheus targets
echo ""
echo "=== Prometheus Targets Status ==="
if curl -s http://localhost:9092/api/v1/targets | grep -q '"health":"up"'; then
    echo "✅ Prometheus has healthy targets"
else
    echo "❌ Prometheus targets are not healthy"
fi

echo ""
echo "=== System Health Check Complete ==="
echo ""
echo "Next steps:"
echo "1. If any services are down, run: docker-compose up -d"
echo "2. If API endpoints fail, check backend logs: docker-compose logs backend"
echo "3. Access services at:"
echo "   - Frontend: http://localhost:3005"
echo "   - Backend API: http://localhost:4005"
echo "   - Prometheus: http://localhost:9092"
echo "   - Grafana: http://localhost:3002 (admin/admin123)"
