#!/bin/bash

echo "=== Fixing Grafana Metrics Display ==="
echo ""

echo "1. Testing connectivity from Grafana to Prometheus..."
docker exec secure-exam-platform_grafana_1 curl -I http://prometheus:9090/ 2>/dev/null | head -3 || echo "FAILED: Grafana cannot reach Prometheus"

echo ""
echo "2. Testing Prometheus metrics endpoint..."
docker exec secure-exam-platform_grafana_1 curl -I http://prometheus:9090/metrics 2>/dev/null | head -3 || echo "FAILED: Prometheus metrics not accessible"

echo ""
echo "3. Restarting Grafana to apply new datasource configuration..."
docker restart secure-exam-platform_grafana_1

echo "4. Waiting for Grafana to initialize..."
sleep 20

echo ""
echo "5. Checking Grafana logs for datasource errors..."
docker logs secure-exam-platform_grafana_1 2>&1 | tail -10

echo ""
echo "6. Testing Grafana health..."
docker exec secure-exam-platform_grafana_1 curl -I http://localhost:3000/api/health 2>/dev/null | head -3

echo ""
echo "7. Testing external access to Grafana..."
curl -I https://secure-exam.duckdns.org/grafana/ 2>/dev/null | head -3

echo ""
echo "8. Testing Prometheus targets..."
curl -s https://secure-exam.duckdns.org/prometheus/targets | grep -q "UP" && echo "Prometheus targets are UP" || echo "Some Prometheus targets are DOWN"

echo ""
echo "=== Grafana Metrics Fix Complete ==="
echo ""
echo "Next steps:"
echo "1. Open Grafana: https://secure-exam.duckdns.org/grafana"
echo "2. Login with: admin / SecureGrafanaAdmin2024!"
echo "3. Go to Configuration -> Data Sources"
echo "4. Check if Prometheus datasource is connected"
echo "5. Go to Explore -> Prometheus to query metrics"
echo ""
echo "Available metrics should include:"
echo "- up (service status)"
echo "- nginx_http_requests_total"
echo "- node_memory_MemAvailable_bytes"
echo "- container_cpu_usage_seconds_total"
