#!/bin/bash

echo "Fixing monitoring services configuration v2..."

echo "Issues fixed:"
echo "1. Nginx upstream blocks - removed ports from upstream definitions"
echo "2. Grafana datasource - removed duplicate default datasource"
echo ""

# Stop all services to apply new configuration
echo "Stopping services..."
docker-compose stop nginx grafana prometheus

# Wait for services to stop
sleep 5

# Start services with new configuration
echo "Starting nginx with fixed configuration..."
docker-compose up -d nginx

echo "Starting Grafana with fixed datasource configuration..."
docker-compose up -d grafana

echo "Starting Prometheus..."
docker-compose up -d prometheus

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Check service status
echo "Checking service status..."
docker-compose ps

echo ""
echo "Testing service health..."
echo "========================"

# Test nginx health
echo "Testing nginx health..."
curl -f http://localhost/health || echo "Nginx health check failed"

# Test Grafana health (direct container access)
echo "Testing Grafana health..."
docker exec secure-exam-platform_grafana_1 curl -f http://localhost:3000/api/health || echo "Grafana health check failed"

# Test Prometheus health (direct container access)
echo "Testing Prometheus health..."
docker exec secure-exam-platform_prometheus_1 curl -f http://localhost:9090/-/healthy || echo "Prometheus health check failed"

echo ""
echo "Service logs (last 15 lines each):"
echo "==================================="

echo "Nginx logs:"
docker-compose logs --tail=15 nginx

echo ""
echo "Grafana logs:"
docker-compose logs --tail=15 grafana

echo ""
echo "Prometheus logs:"
docker-compose logs --tail=15 prometheus

echo ""
echo "Testing external access..."
echo "========================"

# Test external access (if nginx is healthy)
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "Nginx is healthy, testing external routes..."
    echo "Grafana route: https://secure-exam.duckdns.org/grafana"
    echo "Prometheus route: https://secure-exam.duckdns.org/prometheus"
else
    echo "Nginx is not healthy, please check logs above"
fi

echo ""
echo "Fix completed! If services are healthy, try accessing:"
echo "- Grafana: https://secure-exam.duckdns.org/grafana"
echo "- Prometheus: https://secure-exam.duckdns.org/prometheus"
echo ""
echo "Grafana credentials: admin / SecureGrafanaAdmin2024!"
