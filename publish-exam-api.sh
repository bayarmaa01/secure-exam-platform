#!/bin/bash

# Publish exam using API endpoint
EXAM_ID="8b847ffe-f9c0-471f-93f3-d254c199b9da"
API_URL="http://localhost:3001/api/exams/${EXAM_ID}/publish"

# You'll need to get a valid JWT token from a teacher login
# For now, let's try without auth (might work for local development)
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEACHER_JWT_TOKEN" \
  -d '{}'
