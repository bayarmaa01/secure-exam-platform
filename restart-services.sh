#!/bin/bash

echo "=== Secure Exam Platform Service Restart ==="
echo ""

# Stop all services
echo "Stopping all services..."
docker-compose down

# Clean up any hanging containers
echo "Cleaning up hanging containers..."
docker system prune -f

# Rebuild and start services
echo "Rebuilding and starting services..."
docker-compose up -d --build

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 30

# Check service status
echo ""
echo "=== Service Status ==="
docker-compose ps

echo ""
echo "=== Access URLs ==="
echo "Frontend: http://localhost:3005"
echo "Backend API: http://localhost:4005"
echo "AI Proctoring: http://localhost:5005"
echo "Prometheus: http://localhost:9092"
echo "Grafana: http://localhost:3002 (admin/admin123)"

echo ""
echo "=== Testing API Endpoints ==="
echo "Testing backend health..."
curl -f http://localhost:4005/health && echo " ✅ Backend healthy" || echo " ❌ Backend not responding"

echo "Testing frontend..."
curl -f http://localhost:3005 > /dev/null 2>&1 && echo " ✅ Frontend responding" || echo " ❌ Frontend not responding"

echo "Testing AI proctoring..."
curl -f http://localhost:5005/health && echo " ✅ AI Proctoring healthy" || echo " ❌ AI Proctoring not responding"

echo "Testing Prometheus..."
curl -f http://localhost:9092/-/healthy && echo " ✅ Prometheus healthy" || echo " ❌ Prometheus not responding"

echo "Testing Grafana..."
curl -f http://localhost:3002/api/health > /dev/null 2>&1 && echo " ✅ Grafana healthy" || echo " ❌ Grafana not responding (may still be starting)"

echo ""
echo "=== Restart Complete ==="
echo "If Grafana is still starting, wait another 30 seconds and test again."
