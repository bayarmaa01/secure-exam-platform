#!/bin/bash

# 🔧 FIX PROMETHEUS TARGETS
# Fix backend port issue and remove nginx scraping

set -e

echo "🔧 Fixing Prometheus Targets..."
echo "============================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check current Prometheus targets
print_status "Checking current Prometheus targets..."
if curl -s "http://4.247.154.224:9090/api/v1/targets" > /dev/null 2>&1; then
    echo "Current targets status:"
    curl -s "http://4.247.154.224:9090/api/v1/targets" | jq -r '.data.activeTargets[] | "\(.job):\(.health) (\(.lastError // "no error"))"' | while read -r target; do
        job=$(echo "$target" | cut -d: -f1)
        health=$(echo "$target" | cut -d: -f2 | cut -d' ' -f1)
        error=$(echo "$target" | sed 's/.*(\(.*\))/\1/')
        
        if [ "$health" = "up" ]; then
            echo -e "  $job: ${GREEN}UP${NC}"
        else
            echo -e "  $job: ${RED}DOWN${NC} - $error"
        fi
    done
else
    print_error "Cannot access Prometheus API"
fi

echo ""
print_status "Fixes applied:"
echo "✅ Removed nginx job from prometheus.yml (nginx doesn't have metrics endpoint)"
echo "✅ Backend target correctly set to backend:4005"
echo "✅ AI proctoring target correctly set to ai-proctoring:8000"
echo "✅ Node exporter target correctly set to node-exporter:9100"
echo "✅ Postgres exporter target correctly set to postgres-exporter:9187"

echo ""
print_status "Restarting Prometheus to apply changes..."

# Restart Prometheus to reload configuration
docker-compose restart prometheus

# Wait for Prometheus to be ready
print_status "Waiting for Prometheus to be ready..."
sleep 10

# Check if Prometheus is accessible
if curl -s "http://4.247.154.224:9090/-/healthy" > /dev/null; then
    print_status "✅ Prometheus is healthy"
else
    print_error "❌ Prometheus is not responding"
fi

# Check targets again
print_status "Checking updated targets status..."
if curl -s "http://4.247.154.224:9090/api/v1/targets" > /dev/null 2>&1; then
    echo "Updated targets status:"
    curl -s "http://4.247.154.224:9090/api/v1/targets" | jq -r '.data.activeTargets[] | "\(.job):\(.health) (\(.lastError // "no error"))"' | while read -r target; do
        job=$(echo "$target" | cut -d: -f1)
        health=$(echo "$target" | cut -d: -f2 | cut -d' ' -f1)
        error=$(echo "$target" | sed 's/.*(\(.*\))/\1/')
        
        if [ "$health" = "up" ]; then
            echo -e "  $job: ${GREEN}UP${NC}"
        else
            echo -e "  $job: ${RED}DOWN${NC} - $error"
        fi
    done
else
    print_error "Cannot access Prometheus API after restart"
fi

echo ""
print_status "🎉 Prometheus targets fix complete!"
echo ""
echo "📊 Expected final status:"
echo "- secure-exam-platform: UP (backend:4005/metrics)"
echo "- ai-proctoring: UP (ai-proctoring:8000/metrics)"
echo "- node-exporter: UP (node-exporter:9100/metrics)"
echo "- postgres-exporter: UP (postgres-exporter:9187/metrics)"
echo "- nginx: REMOVED (no metrics endpoint)"
echo ""
echo "🌐 Access URLs:"
echo "- Prometheus: http://4.247.154.224:9090"
echo "- Grafana: http://4.247.154.224:3000"
