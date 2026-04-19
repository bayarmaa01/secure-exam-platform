#!/bin/bash

echo "Diagnosing 502 Bad Gateway errors..."
echo "=================================="

echo "Testing direct access from nginx container to services:"
echo "======================================================"

# Test Grafana direct access
echo "1. Testing nginx -> Grafana (port 3000):"
docker exec nginx-proxy wget -qO- --timeout=5 http://grafana:3000/api/health 2>&1 | head -3 || echo "FAILED"

# Test Prometheus direct access  
echo "2. Testing nginx -> Prometheus (port 9090):"
docker exec nginx-proxy wget -qO- --timeout=5 http://prometheus:9090/-/healthy 2>&1 | head -3 || echo "FAILED"

echo ""
echo "Testing with upstream names (as configured in nginx):"
echo "====================================================="

# Test using upstream configuration
echo "3. Testing nginx -> grafana upstream:"
docker exec nginx-proxy wget -qO- --timeout=5 http://grafana/api/health 2>&1 | head -3 || echo "FAILED"

echo "4. Testing nginx -> prometheus upstream:"
docker exec nginx-proxy wget -qO- --timeout=5 http://prometheus/-/healthy 2>&1 | head -3 || echo "FAILED"

echo ""
echo "Checking Grafana and Prometheus service health directly:"
echo "======================================================"

# Check Grafana health directly
echo "5. Grafana container health:"
docker exec secure-exam-platform_grafana_1 wget -qO- --timeout=5 http://localhost:3000/api/health 2>&1 | head -3 || echo "FAILED"

# Check Prometheus health directly
echo "6. Prometheus container health:"
docker exec secure-exam-platform_prometheus_1 wget -qO- --timeout=5 http://localhost:9090/-/healthy 2>&1 | head -3 || echo "FAILED"

echo ""
echo "Nginx error logs (last 10 lines):"
echo "=================================="
docker-compose logs --tail=10 nginx | grep -E "(error|502|upstream)"

echo ""
echo "Network connectivity test:"
echo "=========================="
echo "Nginx container network info:"
docker exec nginx-proxy ip addr | grep -E "(inet|UP)"

echo ""
echo "Container network aliases:"
docker network inspect secure-exam-platform_exam-network | grep -A 20 -B 5 "Aliases"
