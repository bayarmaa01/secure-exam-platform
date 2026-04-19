#!/bin/bash

echo "=== Applying Final Fixes for nginx/Grafana/Prometheus ==="
echo ""

echo "1. Stopping affected services..."
docker stop nginx-proxy secure-exam-platform_grafana_1 secure-exam-platform_prometheus_1 2>/dev/null || true

echo "2. Removing containers to force recreation with new config..."
docker rm nginx-proxy secure-exam-platform_grafana_1 secure-exam-platform_prometheus_1 2>/dev/null || true

echo "3. Starting services with updated configuration..."
docker-compose up -d nginx grafana prometheus

echo "4. Waiting for services to initialize..."
sleep 30

echo "5. Checking service health..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(nginx|grafana|prometheus)"

echo ""
echo "6. Testing nginx configuration..."
docker exec nginx-proxy nginx -t

echo ""
echo "7. Testing external access..."
echo "Main site:"
curl -I https://secure-exam.duckdns.org/ 2>/dev/null | head -3
echo ""
echo "Grafana:"
curl -I https://secure-exam.duckdns.org/grafana/ 2>/dev/null | head -3
echo ""
echo "Prometheus:"
curl -I https://secure-exam.duckdns.org/prometheus/ 2>/dev/null | head -3

echo ""
echo "8. Testing Grafana static asset path..."
curl -I https://secure-exam.duckdns.org/grafana/public/build/grafana.dark.css 2>/dev/null | head -3

echo ""
echo "9. Testing Prometheus UI..."
curl -s https://secure-exam.duckdns.org/prometheus/targets | grep -q "prometheus" && echo "Prometheus UI accessible" || echo "Prometheus UI failed"

echo ""
echo "=== Fix Complete ==="
echo "Services should now be working at:"
echo "- Grafana: https://secure-exam.duckdns.org/grafana (admin / SecureGrafanaAdmin2024!)"
echo "- Prometheus: https://secure-exam.duckdns.org/prometheus"
echo ""
echo "If issues persist:"
echo "- Check nginx logs: docker logs nginx-proxy"
echo "- Check Grafana logs: docker logs secure-exam-platform_grafana_1"
echo "- Check Prometheus logs: docker logs secure-exam-platform_prometheus_1"
