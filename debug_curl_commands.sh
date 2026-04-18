#!/bin/bash

# DEBUG CURL COMMANDS FOR SECURE EXAM PLATFORM
# Use these to isolate the 400 Bad Request issue

# STEP 1: Get Access Token (Login as student)
echo "=== STEP 1: Login to get access token ==="
curl -X POST http://localhost:4005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "password123"
  }' | jq -r '.accessToken'

# STEP 2: Test POST /api/attempts/start with token
echo "=== STEP 2: Test exam attempt start ==="
ACCESS_TOKEN="YOUR_ACCESS_TOKEN_HERE"

curl -X POST http://localhost:4005/api/attempts/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "examId": "7b68f85b-6b6a-4ef9-87de-8d3e5714f0bf"
  }' \
  -v

# STEP 3: Test with invalid examId (should return 400)
echo "=== STEP 3: Test with invalid examId ==="
curl -X POST http://localhost:4005/api/attempts/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "examId": ""
  }' \
  -v

# STEP 4: Test with missing examId (should return 400)
echo "=== STEP 4: Test with missing examId ==="
curl -X POST http://localhost:4005/api/attempts/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{}' \
  -v

# STEP 5: Test without auth (should return 401)
echo "=== STEP 5: Test without authorization ==="
curl -X POST http://localhost:4005/api/attempts/start \
  -H "Content-Type: application/json" \
  -d '{
    "examId": "7b68f85b-6b6a-4ef9-87de-8d3e5714f0bf"
  }' \
  -v
