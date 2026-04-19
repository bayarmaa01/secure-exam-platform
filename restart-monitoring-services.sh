#!/bin/bash

# Restart monitoring services with new configuration
echo "Restarting monitoring services with updated configuration..."

# Stop monitoring services
echo "Stopping Grafana and Prometheus..."
docker stop secure-exam-platform_grafana_1 secure-exam-platform_prometheus_1 2>/dev/null || true

# Remove containers to force recreation with new env vars
echo "Removing containers to apply new configuration..."
docker rm secure-exam-platform_grafana_1 secure-exam-platform_prometheus_1 2>/dev/null || true

# Restart nginx to apply new configuration
echo "Restarting nginx proxy..."
docker restart nginx-proxy

# Start services with new configuration
echo "Starting Grafana and Prometheus with new configuration..."
docker-compose up -d grafana prometheus

echo "Waiting for services to be healthy..."
sleep 30

# Check service status
echo "Checking service status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Testing endpoints..."
echo "Grafana: https://secure-exam.duckdns.org/grafana"
echo "Prometheus: https://secure-exam.duckdns.org/prometheus"
echo ""
echo "Grafana credentials: admin / SecureGrafanaAdmin2024!"
