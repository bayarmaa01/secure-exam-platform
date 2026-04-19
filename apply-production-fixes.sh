#!/bin/bash

echo "=== Applying Production-Ready Fixes ==="
echo ""

echo "1. Stopping affected services..."
docker stop nginx-proxy secure-exam-platform_grafana_1 secure-exam-platform_prometheus_1 2>/dev/null || true

echo "2. Removing containers to force recreation with new config..."
docker rm nginx-proxy secure-exam-platform_grafana_1 secure-exam-platform_prometheus_1 2>/dev/null || true

echo "3. Starting services with production configuration..."
docker-compose up -d nginx grafana prometheus

echo "4. Waiting for services to initialize..."
sleep 30

echo "5. Checking service health..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(nginx|grafana|prometheus)"

echo ""
echo "6. Testing nginx configuration..."
docker exec nginx-proxy nginx -t

echo ""
echo "7. Testing Prometheus routing (FIX 1)..."
echo "Testing /prometheus (should redirect to /prometheus/):"
curl -I https://secure-exam.duckdns.org/prometheus 2>/dev/null | head -3

echo ""
echo "Testing /prometheus/ (should show Prometheus UI):"
curl -I https://secure-exam.duckdns.org/prometheus/ 2>/dev/null | head -3

echo ""
echo "Testing Prometheus UI content:"
curl -s https://secure-exam.duckdns.org/prometheus/ | grep -q "<title>Prometheus" && echo "SUCCESS: Prometheus UI loaded" || echo "FAILED: Prometheus UI not loaded"

echo ""
echo "8. Testing Grafana routing (FIX 2)..."
echo "Testing /grafana/ (should show Grafana UI):"
curl -I https://secure-exam.duckdns.org/grafana/ 2>/dev/null | head -3

echo ""
echo "Testing Grafana login page:"
curl -I https://secure-exam.duckdns.org/grafana/login 2>/dev/null | head -3

echo ""
echo "Testing Grafana static asset:"
curl -I https://secure-exam.duckdns.org/grafana/public/build/grafana.dark.css 2>/dev/null | head -3

echo ""
echo "9. Testing Grafana metrics connection (FIX 3)..."
echo "Testing Grafana to Prometheus connectivity:"
docker exec secure-exam-platform_grafana_1 curl -I http://prometheus:9090/ 2>/dev/null | head -3 || echo "FAILED: Grafana cannot reach Prometheus"

echo ""
echo "10. Final validation..."
echo "Main site:"
curl -I https://secure-exam.duckdns.org/ 2>/dev/null | head -3

echo ""
echo "=== Production Fixes Applied ==="
echo ""
echo "Expected results:"
echo "- Prometheus: https://secure-exam.duckdns.org/prometheus (UI working)"
echo "- Grafana: https://secure-exam.duckdns.org/grafana (UI working, no 302 loops)"
echo "- Grafana metrics: Connected to Prometheus datasource"
echo "- Main app: https://secure-exam.duckdns.org/ (working)"
echo ""
echo "Credentials:"
echo "- Grafana: admin / SecureGrafanaAdmin2024!"
