#!/bin/bash

echo "=========================================="
echo "Testing Registration System"
echo "=========================================="

API_URL="http://localhost:4005/api"

echo ""
echo "1. Testing Student Registration..."
student_response=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@student.com",
        "password": "Test123!@#",
        "name": "Test Student",
        "role": "student"
    }')

if echo "$student_response" | grep -q "accessToken"; then
    echo "✅ Student registration: SUCCESS"
    student_token=$(echo "$student_response" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    echo "   Token received: ${student_token:0:20}..."
else
    echo "❌ Student registration: FAILED"
    echo "   Response: $student_response"
fi

echo ""
echo "2. Testing Teacher Registration..."
teacher_response=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@teacher.com",
        "password": "Test123!@#",
        "name": "Test Teacher",
        "role": "teacher"
    }')

if echo "$teacher_response" | grep -q "accessToken"; then
    echo "✅ Teacher registration: SUCCESS"
    teacher_token=$(echo "$teacher_response" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    echo "   Token received: ${teacher_token:0:20}..."
else
    echo "❌ Teacher registration: FAILED"
    echo "   Response: $teacher_response"
fi

echo ""
echo "3. Testing Invalid Email..."
invalid_email_response=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "invalid-email",
        "password": "Test123!@#",
        "name": "Test User",
        "role": "student"
    }')

if echo "$invalid_email_response" | grep -q "Please provide a valid email address"; then
    echo "✅ Invalid email validation: SUCCESS"
else
    echo "❌ Invalid email validation: FAILED"
    echo "   Response: $invalid_email_response"
fi

echo ""
echo "4. Testing Weak Password..."
weak_password_response=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@student.com",
        "password": "weak",
        "name": "Test User",
        "role": "student"
    }')

if echo "$weak_password_response" | grep -q "Password must contain"; then
    echo "✅ Weak password validation: SUCCESS"
else
    echo "❌ Weak password validation: FAILED"
    echo "   Response: $weak_password_response"
fi

echo ""
echo "5. Testing Duplicate Email..."
duplicate_response=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@student.com",
        "password": "Test123!@#",
        "name": "Another Student",
        "role": "student"
    }')

if echo "$duplicate_response" | grep -q "Email already registered"; then
    echo "✅ Duplicate email validation: SUCCESS"
else
    echo "❌ Duplicate email validation: FAILED"
    echo "   Response: $duplicate_response"
fi

echo ""
echo "6. Testing Student Login..."
if [ ! -z "$student_token" ]; then
    echo "ℹ️  Skipping login test - student registration failed"
else
    login_response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test@student.com",
            "password": "Test123!@#"
        }')
    
    if echo "$login_response" | grep -q "accessToken"; then
        echo "✅ Student login: SUCCESS"
    else
        echo "❌ Student login: FAILED"
        echo "   Response: $login_response"
    fi
fi

echo ""
echo "7. Testing Teacher Login..."
if [ ! -z "$teacher_token" ]; then
    echo "ℹ️  Skipping login test - teacher registration failed"
else
    teacher_login_response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test@teacher.com",
            "password": "Test123!@#"
        }')
    
    if echo "$teacher_login_response" | grep -q "accessToken"; then
        echo "✅ Teacher login: SUCCESS"
    else
        echo "❌ Teacher login: FAILED"
        echo "   Response: $teacher_login_response"
    fi
fi

echo ""
echo "=========================================="
echo "REGISTRATION TEST COMPLETE"
echo "=========================================="
echo ""
echo "Frontend Test URLs:"
echo "  Registration: http://localhost:3005/register"
echo "  Login: http://localhost:3005/login"
echo ""
echo "Test Credentials:"
echo "  Student: test@student.com / Test123!@#"
echo "  Teacher: test@teacher.com / Test123!@#"
