#!/bin/bash

# 🔍 DEBUG COURSE DELETION 500 ERROR
# Check backend logs and test endpoint directly

set -e

echo "🔍 Debugging Course Deletion 500 Error..."
echo "======================================"

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

COURSE_ID="550cb058-7036-41ff-b4d2-727b522073bd"
API_URL="https://secure-exam.duckdns.org"

print_status "Course ID causing 500 error: ${COURSE_ID}"

echo ""
print_status "1. Checking backend logs for course deletion errors..."

# Check if backend container is running
if docker ps | grep -q "backend"; then
    print_status "Backend container is running"
    
    # Get recent backend logs
    print_status "Recent backend logs:"
    docker logs --tail 50 secure-exam-platform_backend_1 | grep -E "(DELETE|course|error|ERROR)" || echo "No recent deletion/error logs found"
else
    print_error "Backend container is not running"
fi

echo ""
print_status "2. Verifying course deletion fix is applied..."

# Check if the fix is in the running container
print_status "Checking if exam_violations reference is removed..."
if docker exec secure-exam-platform_backend_1 grep -q "exam_violations" /app/dist/routes/courses.js 2>/dev/null; then
    print_error "❌ exam_violations reference still exists in container"
else
    print_status "✅ exam_violations reference removed from container"
fi

echo ""
print_status "3. Testing course deletion endpoint directly..."

# First, get auth token
print_status "Getting authentication token..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "teacher@example.com", "password": "teacher123"}')

if [ $? -eq 0 ] && echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
    print_status "✅ Authentication successful"
    
    echo ""
    print_status "Testing DELETE /api/courses/${COURSE_ID}..."
    
    # Test the deletion endpoint
    DELETE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE "${API_URL}/api/courses/${COURSE_ID}" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json")
    
    echo "Response:"
    echo "$DELETE_RESPONSE" | grep -v "HTTP_CODE:" || echo "No response body"
    
    HTTP_CODE=$(echo "$DELETE_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_status "✅ Course deletion successful (HTTP 200)"
    elif [ "$HTTP_CODE" = "404" ]; then
        print_warning "⚠️ Course not found (HTTP 404)"
    elif [ "$HTTP_CODE" = "403" ]; then
        print_warning "⚠️ Not authorized (HTTP 403)"
    elif [ "$HTTP_CODE" = "500" ]; then
        print_error "❌ Still getting 500 error - investigating further..."
        
        # Get more detailed logs
        print_status "Getting detailed backend logs..."
        docker logs --tail 100 secure-exam-platform_backend_1 | grep -A 10 -B 10 "DELETE.*courses" || echo "No detailed deletion logs found"
        
        # Check database connection
        print_status "Testing database connection..."
        DB_STATUS=$(docker exec secure-exam-platform_backend_1 node -e "
        const { pool } = require('./dist/db.js');
        pool.query('SELECT 1').then(() => console.log('DB_OK')).catch(e => console.log('DB_ERROR:', e.message));
        " 2>/dev/null || echo "DB test failed")
        
        if echo "$DB_STATUS" | grep -q "DB_OK"; then
            print_status "✅ Database connection working"
        else
            print_error "❌ Database connection issue"
        fi
    else
        print_error "❌ Unexpected HTTP code: $HTTP_CODE"
    fi
    
else
    print_error "❌ Authentication failed"
    echo "Login response: $LOGIN_RESPONSE"
fi

echo ""
print_status "4. Checking database schema for missing tables..."

# Check if exam_violations table exists (it shouldn't)
print_status "Checking if exam_violations table exists in database..."
EXAM_VIOLATIONS_CHECK=$(docker exec secure-exam-platform_postgres_1 psql -U postgres -d exam_platform -c "
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'exam_violations'
    );
" 2>/dev/null || echo "Schema check failed")

if echo "$EXAM_VIOLATIONS_CHECK" | grep -q "false"; then
    print_status "✅ exam_violations table does not exist (correct)"
elif echo "$EXAM_VIOLATIONS_CHECK" | grep -q "true"; then
    print_warning "⚠️ exam_violations table exists (shouldn't cause error though)"
else
    print_warning "⚠️ Could not determine exam_violations table status"
fi

echo ""
print_status "5. Container status check..."

# Check all container statuses
print_status "Container statuses:"
docker-compose ps

echo ""
print_status "🔍 Debug complete!"
echo ""
echo "📋 Next steps:"
echo "1. If still getting 500 error, check backend logs above"
echo "2. Restart backend container: docker-compose restart backend"
echo "3. Rebuild and redeploy: docker-compose up -d --build backend"
