#!/bin/bash

echo "=== Fixing nginx Configuration Error ==="
echo ""

echo "1. Testing nginx configuration..."
docker exec nginx-proxy nginx -t 2>/dev/null && echo "nginx config OK" || echo "nginx config FAILED"

echo ""
echo "2. Restarting nginx to apply fix..."
docker restart nginx-proxy

echo "3. Waiting for nginx to start..."
sleep 15

echo ""
echo "4. Checking nginx status..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep nginx-proxy

echo ""
echo "5. Testing external access..."
echo "Main site:"
curl -I https://secure-exam.duckdns.org/ 2>/dev/null | head -3 || echo "FAILED: Main site not accessible"

echo ""
echo "Grafana:"
curl -I https://secure-exam.duckdns.org/grafana/ 2>/dev/null | head -3 || echo "FAILED: Grafana not accessible"

echo ""
echo "Prometheus:"
curl -I https://secure-exam.duckdns.org/prometheus/ 2>/dev/null | head -3 || echo "FAILED: Prometheus not accessible"

echo ""
echo "6. Testing Prometheus UI content..."
curl -s https://secure-exam.duckdns.org/prometheus/ | grep -q "<title>Prometheus" && echo "SUCCESS: Prometheus UI loaded" || echo "FAILED: Prometheus UI not loaded"

echo ""
echo "=== nginx Fix Complete ==="
echo ""
echo "If all tests pass, services should be working at:"
echo "- Main app: https://secure-exam.duckdns.org/"
echo "- Grafana: https://secure-exam.duckdns.org/grafana (admin / SecureGrafanaAdmin2024!)"
echo "- Prometheus: https://secure-exam.duckdns.org/prometheus"
