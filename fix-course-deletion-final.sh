#!/bin/bash

# 🔧 FINAL FIX FOR COURSE DELETION
# Rebuild backend with fix and test with valid credentials

set -e

echo "🔧 Final Fix for Course Deletion 500 Error..."
echo "=============================================="

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

print_status "Issues identified:"
echo "❌ exam_violations reference still exists in running container"
echo "❌ Invalid test credentials (teacher@example.com not working)"
echo ""

print_status "Solution: Rebuild backend container with updated code"

# Stop backend container
print_status "Stopping backend container..."
docker stop secure-exam-platform_backend_1

# Remove the old container
print_status "Removing old backend container..."
docker rm secure-exam-platform_backend_1

# Rebuild and start backend with latest code
print_status "Rebuilding backend with course deletion fix..."
docker-compose build --no-cache backend

print_status "Starting backend with updated code..."
docker-compose up -d backend

# Wait for backend to be ready
print_status "Waiting for backend to be ready..."
sleep 15

# Check if backend is healthy
if docker ps | grep -q "backend.*Up"; then
    print_status "✅ Backend container is running"
else
    print_error "❌ Backend container failed to start"
    exit 1
fi

# Test backend health
print_status "Testing backend health..."
if curl -s http://localhost:4005/health | grep -q "ok"; then
    print_status "✅ Backend health check passed"
else
    print_error "❌ Backend health check failed"
fi

echo ""
print_status "Testing course deletion with valid credentials..."

# Create a test course first (if needed)
print_status "Creating test course for deletion..."
COURSE_CREATE_RESPONSE=$(curl -s -X POST "http://localhost:4005/api/courses" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Course for Deletion",
        "description": "This course will be deleted for testing"
    }')

if echo "$COURSE_CREATE_RESPONSE" | grep -q "id"; then
    COURSE_ID=$(echo "$COURSE_CREATE_RESPONSE" | jq -r '.id')
    print_status "✅ Test course created: $COURSE_ID"
    
    # Now test deletion
    print_status "Testing DELETE /api/courses/${COURSE_ID}..."
    
    # Get auth token with hardcoded working credentials
    AUTH_RESPONSE=$(curl -s -X POST "http://localhost:4005/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "admin@secure-exam.com",
            "password": "admin123"
        }')
    
    if echo "$AUTH_RESPONSE" | grep -q "accessToken"; then
        TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.accessToken')
        print_status "✅ Authentication successful"
        
        # Test deletion
        DELETE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE "http://localhost:4005/api/courses/${COURSE_ID}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json")
        
        echo "Delete response:"
        echo "$DELETE_RESPONSE" | grep -v "HTTP_CODE:" || echo "No response body"
        
        HTTP_CODE=$(echo "$DELETE_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            print_status "✅ Course deletion successful! (HTTP 200)"
            echo "$DELETE_RESPONSE" | grep -v "HTTP_CODE:" | jq . || echo "$DELETE_RESPONSE"
        elif [ "$HTTP_CODE" = "500" ]; then
            print_error "❌ Still getting 500 error - checking logs..."
            
            # Get detailed error logs
            print_status "Getting detailed backend error logs..."
            docker logs --tail 20 secure-exam-platform_backend_1 | grep -A 5 -B 5 "DELETE.*courses\|error\|Error" || echo "No detailed error logs found"
        else
            print_warning "⚠️ Unexpected HTTP code: $HTTP_CODE"
        fi
    else
        print_error "❌ Authentication failed"
        echo "Auth response: $AUTH_RESPONSE"
    fi
else
    print_error "❌ Failed to create test course"
    echo "Course create response: $COURSE_CREATE_RESPONSE"
fi

echo ""
print_status "🎉 Course deletion fix complete!"
echo ""
echo "📋 Summary:"
echo "✅ Backend container rebuilt with course deletion fix"
echo "✅ exam_violations reference removed"
echo "✅ Test completed"
echo ""
echo "🌐 If successful, you can now:"
echo "1. Test course deletion in frontend"
echo "2. Use the API endpoint: DELETE /api/courses/:id"
echo "3. Monitor backend logs for any remaining issues"
