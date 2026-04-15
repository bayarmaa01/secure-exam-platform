#!/bin/bash

echo "=========================================="
echo "Simple Teacher Login Test"
echo "=========================================="

API_URL="http://localhost:4005/api"

echo ""
echo "1. Test existing teacher login..."
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@teacher.com",
        "password": "Test123!@#"
    }')

echo "Response: $response"

# Extract HTTP code
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
response_body=$(echo "$response" | sed 's/HTTP_CODE:.*//')

echo "HTTP Status: $http_code"
echo "Response Body: $response_body"

if [ "$http_code" = "200" ]; then
    echo "Login successful"
elif [ "$http_code" = "500" ]; then
    echo "500 Internal Server Error - Check backend logs"
elif [ "$http_code" = "401" ]; then
    echo "401 Unauthorized - Invalid credentials"
elif [ "$http_code" = "400" ]; then
    echo "400 Bad Request - Validation error"
else
    echo "Unexpected status code: $http_code"
fi

echo ""
echo "2. Test student login for comparison..."
student_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@student.com",
        "password": "Test123!@#"
    }')

student_http_code=$(echo "$student_response" | grep "HTTP_CODE:" | cut -d: -f2)
echo "Student login HTTP Status: $student_http_code"

if [ "$student_http_code" = "200" ]; then
    echo "Student login works"
else
    echo "Student login also has issues"
fi

echo ""
echo "=========================================="
echo "NEXT STEPS:"
echo "If teacher login fails but student works:"
echo "1. Check teacher record in database"
echo "2. Verify teacher password hash"
echo "3. Check backend logs: docker compose logs backend -f"
echo ""
echo "If both fail:"
echo "1. Backend service issue"
echo "2. Database connection issue"
echo "3. JWT token generation issue"
