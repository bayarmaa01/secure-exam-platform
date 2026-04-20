#!/bin/bash

# # FIX PROMETHEUS SCRAPE FAILURES
# Resolve backend port issue and nginx metrics problems

set -e

echo "Fixing Prometheus Scrape Failures..."
echo "=================================="

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

print_status "Current Issues:"
echo "1. Backend target DOWN - scraping port 4000 instead of 4005"
echo "2. Nginx target DOWN - returns HTML instead of metrics"
echo ""

print_status "1. Checking current Prometheus configuration..."

# Show current scrape targets
echo "Current scrape targets in prometheus.yml:"
grep -A 2 "job_name:" ./monitoring/prometheus/prometheus.yml | grep -E "job_name|targets" | sed 's/^[[:space:]]*//'

echo ""
print_status "2. Verifying backend metrics endpoint..."

# Test backend metrics endpoint
if curl -s http://localhost:4005/metrics | grep -q "HELP"; then
    print_status "Backend metrics endpoint working on port 4005"
else
    print_error "Backend metrics endpoint not working on port 4005"
    echo "Testing if backend is accessible at all..."
    if curl -s http://localhost:4005/health | grep -q "ok"; then
        print_status "Backend health endpoint works, but metrics endpoint fails"
    else
        print_error "Backend not accessible on port 4005"
    fi
fi

echo ""
print_status "3. Checking AI proctoring metrics endpoint..."

if curl -s http://localhost:8000/metrics | grep -q "HELP"; then
    print_status "AI proctoring metrics endpoint working"
else
    print_error "AI proctoring metrics endpoint not working"
fi

echo ""
print_status "4. Checking node-exporter metrics endpoint..."

if curl -s http://localhost:9100/metrics | grep -q "HELP"; then
    print_status "Node exporter metrics endpoint working"
else
    print_error "Node exporter metrics endpoint not working"
fi

echo ""
print_status "5. Restarting Prometheus to apply configuration changes..."

# Restart Prometheus
docker-compose restart prometheus

# Wait for Prometheus to be ready
print_status "Waiting for Prometheus to be ready..."
sleep 10

# Check Prometheus health
if curl -s http://localhost:9090/-/healthy | grep -q "Prometheus"; then
    print_status "Prometheus is healthy"
else
    print_error "Prometheus is not healthy"
fi

echo ""
print_status "6. Verifying Prometheus targets status..."

# Check Prometheus targets
print_status "Current target status:"
TARGETS_RESPONSE=$(curl -s http://localhost:9090/api/v1/targets)

if echo "$TARGETS_RESPONSE" | jq -r '.data.activeTargets[] | "\(.job):\(.health) (\(.lastError // "no error"))"' | while read -r target; do
    job=$(echo "$target" | cut -d: -f1)
    health=$(echo "$target" | cut -d: -f2 | cut -d' ' -f1)
    error=$(echo "$target" | sed 's/.*(\(.*\))/\1/')
    
    if [ "$health" = "up" ]; then
        echo -e "  $job: ${GREEN}UP${NC}"
    else
        echo -e "  $job: ${RED}DOWN${NC} - $error"
    fi
done; then
    print_status "Targets status checked"
else
    print_warning "Could not parse targets response"
fi

echo ""
print_status "7. Testing individual endpoints for debugging..."

# Test each service endpoint
print_status "Testing backend:4005/metrics..."
BACKEND_METRICS=$(curl -s -w "%{http_code}" http://localhost:4005/metrics)
HTTP_CODE=${BACKEND_METRICS: -3}
if [ "$HTTP_CODE" = "200" ]; then
    print_status "Backend metrics endpoint returns 200 OK"
else
    print_error "Backend metrics endpoint returns $HTTP_CODE"
fi

print_status "Testing ai-proctoring:8000/metrics..."
AI_METRICS=$(curl -s -w "%{http_code}" http://localhost:8000/metrics)
HTTP_CODE=${AI_METRICS: -3}
if [ "$HTTP_CODE" = "200" ]; then
    print_status "AI proctoring metrics endpoint returns 200 OK"
else
    print_error "AI proctoring metrics endpoint returns $HTTP_CODE"
fi

print_status "Testing node-exporter:9100/metrics..."
NODE_METRICS=$(curl -s -w "%{http_code}" http://localhost:9100/metrics)
HTTP_CODE=${NODE_METRICS: -3}
if [ "$HTTP_CODE" = "200" ]; then
    print_status "Node exporter metrics endpoint returns 200 OK"
else
    print_error "Node exporter metrics endpoint returns $HTTP_CODE"
fi

echo ""
print_status "8. Checking if backend needs to be rebuilt..."

# Check if backend container is using correct port
print_status "Checking backend container port configuration..."
if docker exec secure-exam-platform_backend_1 netstat -tlnp | grep -q ":4005"; then
    print_status "Backend is listening on port 4005"
else
    print_error "Backend is not listening on port 4005"
    echo "Backend listening ports:"
    docker exec secure-exam-platform_backend_1 netstat -tlnp || echo "Could not check ports"
fi

echo ""
print_status "9. Final validation..."

# Check Prometheus targets one more time
print_status "Final target validation:"
TARGETS_FINAL=$(curl -s http://localhost:9090/api/v1/targets)

echo ""
echo "Final Status:"
echo "============"

if echo "$TARGETS_FINAL" | jq -r '.data.activeTargets[] | "\(.job):\(.health)"' | while read -r target; do
    job=$(echo "$target" | cut -d: -f1)
    health=$(echo "$target" | cut -d: -f2)
    
    case $job in
        "backend")
            if [ "$health" = "up" ]; then
                echo -e "Backend: ${GREEN}UP${NC} (port 4005) - FIXED"
            else
                echo -e "Backend: ${RED}DOWN${NC} - still needs attention"
            fi
            ;;
        "ai-proctoring")
            if [ "$health" = "up" ]; then
                echo -e "AI Proctoring: ${GREEN}UP${NC} - OK"
            else
                echo -e "AI Proctoring: ${RED}DOWN${NC} - needs attention"
            fi
            ;;
        "node-exporter")
            if [ "$health" = "up" ]; then
                echo -e "Node Exporter: ${GREEN}UP${NC} - OK"
            else
                echo -e "Node Exporter: ${RED}DOWN${NC} - needs attention"
            fi
            ;;
        "postgres-exporter")
            if [ "$health" = "up" ]; then
                echo -e "Postgres Exporter: ${GREEN}UP${NC} - OK"
            else
                echo -e "Postgres Exporter: ${RED}DOWN${NC} - needs attention"
            fi
            ;;
        *)
            echo -e "$job: ${YELLOW}UNKNOWN${NC}"
            ;;
    esac
done; then
    print_status "Final validation complete"
else
    print_warning "Could not validate final status"
fi

echo ""
print_status "Prometheus Scrape Fix Complete!"
echo ""
echo "Summary of changes made:"
echo "1. Updated prometheus.yml to use backend:4005 (correct port)"
echo "2. Removed nginx scraping (nginx doesn't have proper metrics)"
echo "3. Restarted Prometheus to apply configuration"
echo "4. Verified all service endpoints"
echo ""
echo "Access URLs:"
echo "- Prometheus: http://4.247.154.224:9090/targets"
echo "- Grafana: http://4.247.154.224:3000"
echo ""
echo "Expected final status:"
echo "- backend: UP (port 4005)"
echo "- ai-proctoring: UP"
echo "- node-exporter: UP"
echo "- postgres-exporter: UP"
echo "- nginx: REMOVED (no metrics)"
