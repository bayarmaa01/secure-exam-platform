#!/bin/bash

echo "=== Testing nginx Routing Fixes ==="
echo ""

echo "1. Restarting nginx to apply location block reordering..."
docker restart nginx-proxy

echo "2. Waiting for nginx to be ready..."
sleep 10

echo "3. Testing external access..."
echo ""
echo "Main site:"
curl -I https://secure-exam.duckdns.org/ 2>/dev/null | head -3
echo ""
echo "Grafana:"
curl -I https://secure-exam.duckdns.org/grafana/ 2>/dev/null | head -3
echo ""
echo "Prometheus:"
curl -I https://secure-exam.duckdns.org/prometheus/ 2>/dev/null | head -3

echo ""
echo "4. Testing Grafana login page (should return 200):"
curl -I https://secure-exam.duckdns.org/grafana/login 2>/dev/null | head -3

echo ""
echo "5. Testing Prometheus targets page (should return 200):"
curl -I https://secure-exam.duckdns.org/prometheus/targets 2>/dev/null | head -3

echo ""
echo "6. Testing Grafana static asset (should return 200):"
curl -I https://secure-exam.duckdns.org/grafana/public/build/grafana.dark.css 2>/dev/null | head -3

echo ""
echo "7. Checking nginx configuration test:"
docker exec nginx-proxy nginx -t

echo ""
echo "=== Routing Fix Test Complete ==="
echo ""
echo "Expected results:"
echo "- Main site: HTTP/2 200"
echo "- Grafana: HTTP/2 200 (not 302)"
echo "- Prometheus: HTTP/2 200 (not 405/404)"
echo "- Grafana login: HTTP/2 200"
echo "- Prometheus targets: HTTP/2 200"
echo "- Grafana static assets: HTTP/2 200"
echo ""
echo "If all tests pass, the routing is fixed!"
