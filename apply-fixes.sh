#!/bin/bash

echo "=== Applying Complete Fix for nginx/Grafana/Prometheus Issues ==="
echo ""

echo "1. Stopping affected services..."
docker stop nginx-proxy secure-exam-platform_grafana_1 secure-exam-platform_prometheus_1 2>/dev/null || true

echo "2. Removing containers to force recreation..."
docker rm nginx-proxy secure-exam-platform_grafana_1 secure-exam-platform_prometheus_1 2>/dev/null || true

echo "3. Starting services with new configuration..."
docker-compose up -d nginx grafana prometheus

echo "4. Waiting for services to initialize..."
sleep 30

echo "5. Checking service health..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(nginx|grafana|prometheus)"

echo ""
echo "6. Testing nginx configuration..."
docker exec nginx-proxy nginx -t

echo ""
echo "7. Testing connectivity from nginx to services..."
echo "Grafana connectivity:"
docker exec nginx-proxy curl -I http://grafana:3000/ 2>/dev/null | head -3 || echo "FAILED"
echo "Prometheus connectivity:"
docker exec nginx-proxy curl -I http://prometheus:9090/ 2>/dev/null | head -3 || echo "FAILED"

echo ""
echo "8. Testing external access..."
echo "Main site:"
curl -I https://secure-exam.duckdns.org/ 2>/dev/null | head -3
echo "Grafana:"
curl -I https://secure-exam.duckdns.org/grafana/ 2>/dev/null | head -3
echo "Prometheus:"
curl -I https://secure-exam.duckdns.org/prometheus/ 2>/dev/null | head -3

echo ""
echo "=== Fix Applied ==="
echo "Services should now be accessible at:"
echo "- Grafana: https://secure-exam.duckdns.org/grafana (admin / SecureGrafanaAdmin2024!)"
echo "- Prometheus: https://secure-exam.duckdns.org/prometheus"
echo ""
echo "If issues persist, check logs:"
echo "- nginx: docker logs nginx-proxy"
echo "- grafana: docker logs secure-exam-platform_grafana_1"
echo "- prometheus: docker logs secure-exam-platform_prometheus_1"
