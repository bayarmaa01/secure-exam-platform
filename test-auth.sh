#!/bin/bash

# Test script to verify authentication header is working
# Usage: ./test-auth.sh <token>

TOKEN="$1"

if [ -z "$TOKEN" ]; then
    echo "Usage: $0 <jwt_token>"
    echo "Get token from browser localStorage.getItem('accessToken')"
    exit 1
fi

echo "Testing authentication with token: ${TOKEN:0:50}..."
echo ""

# Test the auth/me endpoint
echo "🔍 Testing GET /api/auth/me..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "https://secure-exam.duckdns.org/api/auth/me")

echo "Response:"
echo "$RESPONSE"
echo ""

# Extract status code
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:.*//')

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ SUCCESS: /api/auth/me returned 200"
    echo "User data: $RESPONSE_BODY"
else
    echo "❌ FAILED: /api/auth/me returned $HTTP_STATUS"
    echo "Error: $RESPONSE_BODY"
fi

echo ""
echo "🔍 Testing POST /api/debug/publish-exam/test-id..."
PUBLISH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}' \
    "https://secure-exam.duckdns.org/api/debug/publish-exam/c2c791e7-224f-4627-acb6-cee9ca9ab5b5")

echo "Publish Response:"
echo "$PUBLISH_RESPONSE"
echo ""

PUBLISH_STATUS=$(echo "$PUBLISH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
PUBLISH_BODY=$(echo "$PUBLISH_RESPONSE" | sed 's/HTTP_STATUS:.*//')

if [ "$PUBLISH_STATUS" = "200" ]; then
    echo "✅ SUCCESS: Debug publish endpoint works"
else
    echo "❌ FAILED: Debug publish endpoint returned $PUBLISH_STATUS"
fi
