#!/bin/bash

echo "Fixing monitoring services configuration..."

# Stop and restart nginx to apply new configuration
echo "Restarting nginx with updated configuration..."
docker-compose stop nginx
docker-compose up -d nginx

# Wait for nginx to be ready
echo "Waiting for nginx to be ready..."
sleep 10

# Restart Grafana to fix potential startup issues
echo "Restarting Grafana..."
docker-compose restart grafana

# Restart Prometheus to ensure proper routing
echo "Restarting Prometheus..."
docker-compose restart prometheus

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Check service status
echo "Checking service status..."
docker-compose ps

echo ""
echo "Testing endpoints..."
echo "===================="

# Test Grafana health
echo "Testing Grafana health..."
curl -f http://localhost:3000/api/health || echo "Grafana health check failed"

# Test Prometheus health  
echo "Testing Prometheus health..."
curl -f http://localhost:9090/-/healthy || echo "Prometheus health check failed"

echo ""
echo "Service logs (last 20 lines each):"
echo "==================================="

echo "Grafana logs:"
docker-compose logs --tail=20 grafana

echo ""
echo "Prometheus logs:"
docker-compose logs --tail=20 prometheus

echo ""
echo "Nginx logs:"
docker-compose logs --tail=20 nginx

echo ""
echo "Fix completed! Try accessing:"
echo "- Grafana: https://secure-exam.duckdns.org/grafana"
echo "- Prometheus: https://secure-exam.duckdns.org/prometheus"
