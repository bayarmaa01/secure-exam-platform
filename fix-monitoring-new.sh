#!/bin/bash

echo "🔧 Fixing Grafana and Prometheus access issues..."

# Restart Prometheus to fix health issue
echo "📝 Restarting Prometheus with fixed configuration..."
docker-compose restart prometheus

# Wait for Prometheus to be ready
echo "⏳ Waiting for Prometheus to be ready..."
sleep 15

# Restart nginx to apply configuration changes
echo "📝 Restarting Nginx with new configuration..."
docker-compose restart nginx

# Wait for nginx to be ready
echo "⏳ Waiting for Nginx to be ready..."
sleep 10

# Test Grafana access
echo "🔍 Testing Grafana access..."
curl -I -s https://secure-exam.duckdns.org/grafana/ | head -5

# Test Prometheus access  
echo "🔍 Testing Prometheus access..."
curl -I -s https://secure-exam.duckdns.org/prometheus/ | head -5

# Test Prometheus metrics endpoint directly
echo "🔍 Testing Prometheus metrics endpoint..."
curl -s https://secure-exam.duckdns.org/prometheus/metrics | head -5

# Test Grafana API
echo "🔍 Testing Grafana API..."
curl -s -u admin:SecureGrafanaAdmin2024! https://secure-exam.duckdns.org/grafana/api/health | head -5

# Check container status
echo "📊 Checking container status..."
docker-compose ps

echo "✅ Monitoring fix complete!"
echo "🌐 Grafana should be available at: https://secure-exam.duckdns.org/grafana/"
echo "📈 Prometheus should be available at: https://secure-exam.duckdns.org/prometheus/"
