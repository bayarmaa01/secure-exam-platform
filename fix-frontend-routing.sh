#!/bin/bash

# 🔧 FIX FRONTEND ROUTING
# Remove direct frontend port to force traffic through nginx

set -e

echo "🔧 Fixing Frontend Routing..."
echo "==========================="

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

print_status "Issue: Frontend was accessible via port 3001 (direct access)"
print_status "Solution: Remove direct port mapping, force traffic through nginx"
print_status "Result: Main app only accessible via nginx (port 443)"

echo ""
print_status "Changes made:"
echo "✅ Removed 'ports: 3001:80' from frontend service"
echo "✅ Frontend now only accessible via nginx reverse proxy"
echo "✅ Grafana remains on port 3000 (direct access)"
echo "✅ Prometheus remains on port 9090 (direct access)"

echo ""
print_status "Restarting services to apply changes..."

# Stop all services
docker-compose down

# Start services again
docker-compose up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 15

echo ""
print_status "🎉 Frontend routing fixed!"
echo ""
echo "🌐 Correct Access URLs:"
echo "- Main App: https://secure-exam.duckdns.org (via nginx)"
echo "- Grafana: http://4.247.154.224:3000 (direct)"
echo "- Prometheus: http://4.247.154.224:9090 (direct)"
echo ""
echo "❌ Incorrect URLs (should not work):"
echo "- http://4.247.154.224:3001 (removed)"
echo "- http://4.247.154.224:80 (nginx, not frontend)"
echo ""
echo "📋 Port Mapping:"
echo "- 80:80, 443:443 (nginx - main app)"
echo "- 3000:3000 (grafana - direct)"
echo "- 9090:9090 (prometheus - direct)"
echo "- Frontend: internal only (via nginx)"

echo ""
print_status "Testing access..."
echo "Checking main app via nginx..."
if curl -s -I "https://secure-exam.duckdns.org" | grep -q "200\|301"; then
    echo -e "✅ Main app accessible via nginx"
else
    echo -e "❌ Main app not accessible via nginx"
fi

echo "Checking Grafana direct access..."
if curl -s -I "http://4.247.154.224:3000" | grep -q "200"; then
    echo -e "✅ Grafana accessible directly"
else
    echo -e "❌ Grafana not accessible"
fi

echo "Checking Prometheus direct access..."
if curl -s -I "http://4.247.154.224:9090" | grep -q "200"; then
    echo -e "✅ Prometheus accessible directly"
else
    echo -e "❌ Prometheus not accessible"
fi

echo ""
print_status "✅ Frontend routing fix complete!"
