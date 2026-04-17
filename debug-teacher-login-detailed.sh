#!/bin/bash

echo "=========================================="
echo "Debug Teacher Login Issue - Detailed"
echo "=========================================="

API_URL="http://localhost:4005/api"

echo ""
echo "1. Testing if backend is running..."
if curl -f -s "$API_URL/health" >/dev/null; then
    echo "Backend is running"
else
    echo "Backend is not running - please start it first"
    exit 1
fi

echo ""
echo "2. Creating fresh teacher account..."
teacher_email="debug$(date +%s)@teacher.com"
teacher_password="Test123!@#"

register_response=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$teacher_email\",
        \"password\": \"$teacher_password\",
        \"name\": \"Debug Teacher\",
        \"role\": \"teacher\",
        \"teacher_id\": \"teacher_debug_$(date +%s)\"
    }")

echo "Registration response: $register_response"

if echo "$register_response" | grep -q "accessToken"; then
    echo "Registration successful"
    
    # Extract tokens for verification
    access_token=$(echo "$register_response" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    echo "Access token received: ${access_token:0:20}..."
    
    echo ""
    echo "3. Testing immediate login with same credentials..."
    login_response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$teacher_email\",
            \"password\": \"$teacher_password\"
        }")
    
    echo "Login response: $login_response"
    
    if echo "$login_response" | grep -q "accessToken"; then
        echo "Login successful - teacher can login"
    else
        echo "Login failed - investigating further..."
        
        # Check if it's a 500 error
        if echo "$login_response" | grep -q "500"; then
            echo "500 Internal Server Error detected"
            echo "Check backend logs: docker compose logs backend -f"
        elif echo "$login_response" | grep -q "401"; then
            echo "401 Unauthorized - credentials issue"
        elif echo "$login_response" | grep -q "400"; then
            echo "400 Bad Request - validation issue"
        else
            echo "Unknown error - response: $login_response"
        fi
    fi
    
    echo ""
    echo "4. Testing with existing teacher account..."
    existing_login=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test@teacher.com",
            "password": "Test123!@#"
        }')
    
    echo "Existing teacher login: $existing_login"
    
    if echo "$existing_login" | grep -q "accessToken"; then
        echo "Existing teacher login works"
    else
        echo "Existing teacher login also fails"
    fi
    
else
    echo "Registration failed - cannot proceed with login test"
fi

echo ""
echo "=========================================="
echo "DEBUG COMPLETE"
echo "=========================================="
echo ""
echo "If teacher login fails:"
echo "1. Check backend logs: docker compose logs backend -f"
echo "2. Check database for teacher records"
echo "3. Verify password hashing consistency"
echo "4. Check JWT token generation"
