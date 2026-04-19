#!/bin/bash

echo "Final fix for monitoring services configuration..."
echo "Issues being fixed:"
echo "1. Nginx upstream and proxy_pass mismatch"
echo "2. Ensure proper service communication"
echo ""

# Stop nginx to apply configuration
echo "Stopping nginx..."
docker-compose stop nginx

# Force remove nginx container to ensure clean restart
echo "Removing nginx container..."
docker-compose rm -f nginx

# Wait a moment
sleep 3

# Start nginx with fresh container and updated config
echo "Starting nginx with corrected configuration..."
docker-compose up -d nginx

# Wait for nginx to be ready
echo "Waiting for nginx to start..."
sleep 15

# Check nginx status
echo "Checking nginx status..."
docker-compose ps nginx

# Test nginx health
echo "Testing nginx health..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "Nginx is healthy!"
else
    echo "Nginx health check failed, checking logs..."
    docker-compose logs --tail=10 nginx
fi

echo ""
echo "Testing direct container access..."
echo "=================================="

# Test Grafana directly
echo "Testing Grafana container health..."
docker exec secure-exam-platform_grafana_1 wget -qO- http://localhost:3000/api/health || echo "Grafana container health failed"

# Test Prometheus directly  
echo "Testing Prometheus container health..."
docker exec secure-exam-platform_prometheus_1 wget -qO- http://localhost:9090/-/healthy || echo "Prometheus container health failed"

echo ""
echo "Testing service-to-service communication..."
echo "=========================================="

# Test nginx to Grafana
echo "Testing nginx -> Grafana communication..."
docker exec nginx-proxy wget -qO- http://grafana:3000/api/health || echo "Nginx to Grafana failed"

# Test nginx to Prometheus
echo "Testing nginx -> Prometheus communication..."
docker exec nginx-proxy wget -qO- http://prometheus:9090/-/healthy || echo "Nginx to Prometheus failed"

echo ""
echo "Final service status:"
echo "===================="
docker-compose ps

echo ""
echo "If nginx is healthy, try accessing:"
echo "- Main app: https://secure-exam.duckdns.org"
echo "- Grafana: https://secure-exam.duckdns.org/grafana"
echo "- Prometheus: https://secure-exam.duckdns.org/prometheus"
echo ""
echo "Grafana credentials: admin / SecureGrafanaAdmin2024!"
