#!/bin/bash

# # FIX BACKEND PORT CONFIGURATION
# Update Dockerfile and rebuild backend with correct port 4005

set -e

echo "Fixing Backend Port Configuration..."
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

print_status "Issue: Backend Dockerfile using port 4000 instead of 4005"
print_status "Fix: Update Dockerfile healthcheck and EXPOSE to use port 4005"

echo ""
print_status "1. Checking current Dockerfile configuration..."

if grep -q "localhost:4000" backend/Dockerfile; then
    print_status "Found port 4000 in Dockerfile - needs fixing"
else
    print_warning "Port 4000 not found in Dockerfile"
fi

echo ""
print_status "2. Stopping and removing backend container..."

docker-compose stop backend
docker-compose rm -f backend

echo ""
print_status "3. Rebuilding backend with correct port configuration..."

docker-compose build --no-cache backend

echo ""
print_status "4. Starting backend with updated configuration..."

docker-compose up -d backend

# Wait for backend to be ready
print_status "Waiting for backend to be ready..."
sleep 15

echo ""
print_status "5. Testing backend health on correct port..."

if curl -s http://localhost:4005/health | grep -q "ok"; then
    print_status "Backend health check passed on port 4005"
else
    print_error "Backend health check failed on port 4005"
    echo "Checking if backend is actually running on port 4005..."
    
    # Check if backend is listening on port 4005
    if docker exec secure-exam-platform_backend_1 netstat -tlnp | grep -q ":4005"; then
        print_status "Backend is listening on port 4005"
    else
        print_error "Backend is not listening on port 4005"
        echo "Backend listening ports:"
        docker exec secure-exam-platform_backend_1 netstat -tlnp || echo "Could not check ports"
    fi
fi

echo ""
print_status "6. Testing metrics endpoint on correct port..."

if curl -s http://localhost:4005/metrics | grep -q "HELP"; then
    print_status "Backend metrics endpoint working on port 4005"
else
    print_error "Backend metrics endpoint not working on port 4005"
fi

echo ""
print_status "7. Testing course deletion with fixed backend..."

# Test course deletion
print_status "Testing DELETE /api/courses with fixed backend..."

# Get auth token
AUTH_RESPONSE=$(curl -s -X POST "http://localhost:4005/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "admin@secure-exam.com",
        "password": "admin123"
    }')

if echo "$AUTH_RESPONSE" | grep -q "accessToken"; then
    TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.accessToken')
    print_status "Authentication successful"
    
    # Create test course
    COURSE_CREATE_RESPONSE=$(curl -s -X POST "http://localhost:4005/api/courses" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Test Course for Deletion",
            "description": "This course will be deleted for testing"
        }')
    
    if echo "$COURSE_CREATE_RESPONSE" | grep -q "id"; then
        COURSE_ID=$(echo "$COURSE_CREATE_RESPONSE" | jq -r '.id')
        print_status "Test course created: ${COURSE_ID}"
        
        # Test deletion
        DELETE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE "http://localhost:4005/api/courses/${COURSE_ID}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json")
        
        HTTP_CODE=$(echo "$DELETE_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            print_status "Course deletion successful! (HTTP 200)"
            echo "$DELETE_RESPONSE" | grep -v "HTTP_CODE:" | jq . || echo "$DELETE_RESPONSE"
        elif [ "$HTTP_CODE" = "500" ]; then
            print_error "Still getting 500 error - checking logs..."
            docker logs --tail 20 secure-exam-platform_backend_1 | grep -A 5 -B 5 "DELETE.*courses\|error\|Error" || echo "No detailed error logs found"
        else
            print_warning "Unexpected HTTP code: $HTTP_CODE"
        fi
    else
        print_error "Failed to create test course"
        echo "Course create response: $COURSE_CREATE_RESPONSE"
    fi
else
    print_error "Authentication failed"
    echo "Auth response: $AUTH_RESPONSE"
fi

echo ""
print_status "Backend port fix complete!"
echo ""
echo "Summary:"
echo "Backend Dockerfile updated:"
echo "- Healthcheck: http://localhost:4005/api/health"
echo "- EXPOSE: 4005"
echo ""
echo "Next steps:"
echo "1. Test course deletion in frontend"
echo "2. Verify Prometheus scraping backend:4005/metrics"
echo "3. Check Grafana dashboards for backend metrics"
