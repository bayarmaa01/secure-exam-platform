#!/bin/bash

# # DEBUG BACKEND PORT 4005 ISSUES
# Investigate why health and metrics endpoints fail

set -e

echo "Debugging Backend Port 4005 Issues..."
echo "===================================="

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

print_status "Backend is listening on port 4005 but endpoints failing"
echo ""

print_status "1. Checking backend application logs..."

# Get backend logs
print_status "Recent backend logs:"
docker logs --tail 30 secure-exam-platform_backend_1

echo ""
print_status "2. Checking what port backend is actually running on..."

# Check what port the Node.js app is listening on
print_status "Checking process listening ports:"
docker exec secure-exam-platform_backend_1 netstat -tlnp || echo "Could not check netstat"

print_status "Checking if Node.js process is running:"
docker exec secure-exam-platform_backend_1 ps aux | grep node || echo "No Node.js process found"

echo ""
print_status "3. Testing endpoints inside container..."

# Test health endpoint inside container
print_status "Testing /health endpoint inside container..."
HEALTH_INSIDE=$(docker exec secure-exam-platform_backend_1 curl -s http://localhost:4005/health || echo "FAILED")
if echo "$HEALTH_INSIDE" | grep -q "ok"; then
    print_status "Health endpoint works inside container"
else
    print_error "Health endpoint fails inside container: $HEALTH_INSIDE"
fi

# Test metrics endpoint inside container
print_status "Testing /metrics endpoint inside container..."
METRICS_INSIDE=$(docker exec secure-exam-platform_backend_1 curl -s http://localhost:4005/metrics || echo "FAILED")
if echo "$METRICS_INSIDE" | grep -q "HELP"; then
    print_status "Metrics endpoint works inside container"
else
    print_error "Metrics endpoint fails inside container: $METRICS_INSIDE"
fi

echo ""
print_status "4. Checking backend application startup..."

# Check if backend is actually starting properly
print_status "Checking if backend is responding to any port..."
for port in 3000 4000 4005 5000; do
    if docker exec secure-exam-platform_backend_1 curl -s http://localhost:$port/health > /dev/null 2>&1; then
        print_status "Backend responding on port $port"
    fi
done

echo ""
print_status "5. Checking backend environment variables..."

# Check backend environment
print_status "Backend environment variables:"
docker exec secure-exam-platform_backend_1 env | grep -E "(PORT|NODE_ENV)" || echo "No port env vars found"

echo ""
print_status "6. Testing backend with direct connection..."

# Try to connect directly to the container
print_status "Getting container IP..."
CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' secure-exam-platform_backend_1)
print_status "Container IP: $CONTAINER_IP"

# Test connection to container IP
if curl -s http://$CONTAINER_IP:4005/health > /dev/null 2>&1; then
    print_status "Backend accessible via container IP"
else
    print_error "Backend not accessible via container IP"
fi

echo ""
print_status "7. Checking if backend needs to be restarted with correct port..."

# Check backend source code for port configuration
print_status "Checking backend source code for port configuration..."
if docker exec secure-exam-platform_backend_1 grep -r "PORT\|4005\|4000" /app/dist/ 2>/dev/null; then
    print_status "Found port configuration in compiled code"
else
    print_status "No port configuration found in compiled code"
fi

echo ""
print_status "8. Restarting backend with explicit port..."

# Stop and restart backend
docker-compose stop backend
sleep 5

# Start backend with explicit port
print_status "Starting backend with PORT=4005..."
docker-compose up -d backend

# Wait for startup
sleep 15

# Test again
print_status "Testing health endpoint after restart..."
if curl -s http://localhost:4005/health | grep -q "ok"; then
    print_status "Health endpoint working after restart"
else
    print_error "Health endpoint still failing after restart"
fi

echo ""
print_status "Debug complete!"
echo ""
echo "Summary:"
echo "- Backend container is running"
echo "- Backend is listening on port 4005"
echo "- But endpoints may not be responding properly"
echo ""
echo "Possible solutions:"
echo "1. Check if backend app is configured to use port 4005"
echo "2. Verify environment variables are set correctly"
echo "3. Check for application startup errors in logs"
echo "4. May need to update backend source code to use port 4005"
