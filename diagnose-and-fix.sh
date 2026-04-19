#!/bin/bash

echo "=== Diagnosing and Fixing nginx/Grafana/Prometheus Issues ==="
echo ""

# Check current service status
echo "1. Current service status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(nginx|grafana|prometheus)"
echo ""

# Test direct container access
echo "2. Testing direct container access:"
echo "Grafana container health:"
docker exec secure-exam-platform_grafana_1 curl -I http://localhost:3000/ 2>/dev/null || echo "Grafana container not accessible"
echo ""
echo "Prometheus container health:"
docker exec secure-exam-platform_prometheus_1 curl -I http://localhost:9090/ 2>/dev/null || echo "Prometheus container not accessible"
echo ""

# Test nginx upstream connectivity
echo "3. Testing nginx upstream connectivity:"
docker exec nginx-proxy wget -qO- http://grafana:3000/ | head -c 100 2>/dev/null && echo "Grafana upstream OK" || echo "Grafana upstream FAILED"
docker exec nginx-proxy wget -qO- http://prometheus:9090/ | head -c 100 2>/dev/null && echo "Prometheus upstream OK" || echo "Prometheus upstream FAILED"
echo ""

# Check nginx configuration
echo "4. Checking nginx configuration:"
docker exec nginx-proxy nginx -t 2>&1
echo ""

# Test external access
echo "5. Testing external access:"
echo "Testing main domain:"
curl -I https://secure-exam.duckdns.org/ 2>/dev/null | head -5
echo ""
echo "Testing Grafana subpath:"
curl -I https://secure-exam.duckdns.org/grafana/ 2>/dev/null | head -5
echo ""
echo "Testing Prometheus subpath:"
curl -I https://secure-exam.duckdns.org/prometheus/ 2>/dev/null | head -5
echo ""

echo "6. Applying fixes..."
echo ""

# Force recreate services with new configuration
echo "Recreating Grafana and Prometheus with new environment variables..."
docker-compose stop grafana prometheus
docker-compose rm -f grafana prometheus
docker-compose up -d grafana prometheus

echo ""
echo "Restarting nginx to apply configuration..."
docker restart nginx-proxy

echo ""
echo "Waiting for services to be healthy..."
sleep 20

echo ""
echo "7. Final status check:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(nginx|grafana|prometheus)"

echo ""
echo "8. Testing endpoints after fix:"
echo "Grafana: https://secure-exam.duckdns.org/grafana"
echo "Prometheus: https://secure-exam.duckdns.org/prometheus"
echo ""
echo "If issues persist, check nginx logs: docker logs nginx-proxy"
