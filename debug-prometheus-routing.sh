#!/bin/bash

echo "=== Debugging Prometheus Routing Issue ==="
echo ""

echo "1. Testing direct Prometheus container access..."
echo "Prometheus container health:"
docker exec secure-exam-platform_prometheus_1 curl -I http://localhost:9090/ 2>/dev/null | head -3 || echo "FAILED: Direct container access failed"

echo ""
echo "2. Testing Prometheus UI from container..."
docker exec secure-exam-platform_prometheus_1 curl -s http://localhost:9090/ | grep -q "<title>Prometheus" && echo "Prometheus UI accessible from container" || echo "FAILED: Prometheus UI not accessible"

echo ""
echo "3. Testing nginx to Prometheus connectivity..."
echo "From nginx to Prometheus:"
docker exec nginx-proxy curl -I http://prometheus:9090/ 2>/dev/null | head -3 || echo "FAILED: nginx cannot reach Prometheus"

echo ""
echo "4. Testing current nginx configuration..."
docker exec nginx-proxy nginx -t

echo ""
echo "5. Checking nginx location block order..."
echo "Current nginx config for Prometheus:"
docker exec nginx-proxy grep -A 10 -B 2 "location /prometheus/" /etc/nginx/nginx.conf

echo ""
echo "6. Testing external access patterns..."
echo "Testing /prometheus/ (with trailing slash):"
curl -I https://secure-exam.duckdns.org/prometheus/ 2>/dev/null | head -3

echo ""
echo "Testing /prometheus (without trailing slash):"
curl -I https://secure-exam.duckdns.org/prometheus 2>/dev/null | head -3

echo ""
echo "7. Checking nginx access logs for Prometheus requests..."
docker logs nginx-proxy 2>&1 | grep "prometheus" | tail -5

echo ""
echo "8. Testing if frontend is catching /prometheus requests..."
echo "Frontend container logs for recent requests:"
docker logs secure-exam-platform_frontend_1 2>&1 | tail -3

echo ""
echo "=== Debug Complete ==="
echo ""
echo "If Prometheus redirects to main app, the issue is likely:"
echo "1. nginx location block order (should be fixed already)"
echo "2. regex location blocks overriding /prometheus/"
echo "3. frontend catching requests before nginx"
