#!/bin/bash

echo "=== Testing Prometheus Routing Fix ==="
echo ""

echo "1. Restarting nginx to apply Prometheus location block changes..."
docker restart nginx-proxy

echo "2. Waiting for nginx to be ready..."
sleep 10

echo "3. Testing Prometheus routing..."
echo ""
echo "Testing /prometheus (without trailing slash):"
curl -I https://secure-exam.duckdns.org/prometheus 2>/dev/null | head -3

echo ""
echo "Testing /prometheus/ (with trailing slash):"
curl -I https://secure-exam.duckdns.org/prometheus/ 2>/dev/null | head -3

echo ""
echo "4. Testing Prometheus UI content (should contain Prometheus title):"
curl -s https://secure-exam.duckdns.org/prometheus/ | grep -q "<title>Prometheus" && echo "SUCCESS: Prometheus UI loaded" || echo "FAILED: Still redirecting to main app"

echo ""
echo "5. Testing Prometheus API endpoint:"
curl -I https://secure-exam.duckdns.org/prometheus/api/v1/query?query=up 2>/dev/null | head -3

echo ""
echo "6. Testing Prometheus targets page:"
curl -I https://secure-exam.duckdns.org/prometheus/targets 2>/dev/null | head -3

echo ""
echo "7. Checking nginx configuration test:"
docker exec nginx-proxy nginx -t

echo ""
echo "8. Testing direct container access (baseline):"
docker exec secure-exam-platform_prometheus_1 curl -I http://localhost:9090/ 2>/dev/null | head -3

echo ""
echo "=== Prometheus Routing Test Complete ==="
echo ""
echo "Expected results:"
echo "- /prometheus: HTTP/2 200 (or 302 redirect to /prometheus/)"
echo "- /prometheus/: HTTP/2 200"
echo "- Prometheus UI content: SUCCESS"
echo "- Prometheus API: HTTP/2 200"
echo "- Prometheus targets: HTTP/2 200"
echo ""
echo "If tests pass, Prometheus should be accessible at:"
echo "https://secure-exam.duckdns.org/prometheus"
