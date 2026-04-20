#!/bin/bash

# 🔧 FIX PORT CONFLICT
# Frontend was using port 3000, now Grafana needs it

set -e

echo "🔧 Fixing Port Conflict..."
echo "========================"

echo "📊 Port Allocation:"
echo "- Grafana: 3000 (direct access)"
echo "- Frontend: 3001 (via nginx)"
echo "- Prometheus: 9090 (direct access)"
echo "- Backend: 4005 (via nginx)"
echo ""

echo "🔄 Restarting services with fixed ports..."

# Stop all services
docker-compose down

# Start services again
docker-compose up -d

echo ""
echo "✅ Port conflict fixed!"
echo ""
echo "🌐 Access URLs:"
echo "- Main App: https://secure-exam.duckdns.org"
echo "- Grafana: http://4.247.154.224:3000"
echo "- Prometheus: http://4.247.154.224:9090"
echo ""
echo "📋 Port Mapping:"
echo "- 3000:3000 (Grafana)"
echo "- 3001:80 (Frontend, via nginx)"
echo "- 9090:9090 (Prometheus)"
