#!/bin/bash

echo "=========================================="
echo "Debug Teacher Login Issue"
echo "=========================================="

API_URL="http://localhost:4005/api"

echo ""
echo "1. Testing current teacher login (failing)..."
teacher_response=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@teacher.com",
        "password": "Test123!@#"
    }')

echo "Response: $teacher_response"

if echo "$teacher_response" | grep -q "500"; then
    echo "❌ Teacher login still failing with 500 error"
    echo ""
    echo "2. Creating fresh teacher account..."
    
    # Create new teacher account
    new_teacher_response=$(curl -s -X POST "$API_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "debug@teacher.com",
            "password": "Test123!@#",
            "name": "Debug Teacher",
            "role": "teacher",
            "teacher_id": "teacher_debug_001"
        }')
    
    echo "New teacher registration: $new_teacher_response"
    
    if echo "$new_teacher_response" | grep -q "accessToken"; then
        echo "✅ New teacher account created"
        
        echo ""
        echo "3. Testing fresh teacher login..."
        fresh_login_response=$(curl -s -X POST "$API_URL/auth/login" \
            -H "Content-Type: application/json" \
            -d '{
                "email": "debug@teacher.com",
                "password": "Test123!@#"
            }')
        
        echo "Fresh teacher login: $fresh_login_response"
        
        if echo "$fresh_login_response" | grep -q "500"; then
            echo "❌ Fresh teacher login also fails - Backend issue confirmed"
            echo ""
            echo "🔧 ISSUE: Backend login endpoint has bug for teacher role"
            echo "📋 NEXT STEPS:"
            echo "1. Check backend logs: docker compose logs backend"
            echo "2. Look for error details in enhanced logging"
            echo "3. Fix the backend code issue"
            echo "4. Test again"
        else
            echo "✅ Fresh teacher login works - Issue is with existing teacher data"
            echo ""
            echo "🔧 ISSUE: Existing teacher account data is corrupted"
            echo "📋 NEXT STEPS:"
            echo "1. Check database for teacher record corruption"
            echo "2. Update existing teacher records if needed"
    else
        echo "❌ New teacher registration failed"
        echo "🔧 ISSUE: Backend registration or database issue"
    fi
else
    echo "✅ Teacher login now working!"
fi

echo ""
echo "=========================================="
echo "DEBUG COMPLETE"
echo "=========================================="
echo ""
echo "Backend logs command: docker compose logs backend -f"
echo "Frontend test: http://localhost:3005/login"
