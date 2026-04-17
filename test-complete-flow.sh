#!/bin/bash

echo "=== TESTING COMPLETE LMS FLOW ==="
echo "Backend server should be running on http://localhost:4005"
echo ""

# Base URL
BASE_URL="http://localhost:4005"

# Test variables
TEACHER_TOKEN=""
STUDENT_TOKEN=""
TEACHER_ID=""
STUDENT_ID=""
COURSE_ID=""
EXAM_ID=""

echo "1. Testing teacher registration..."
TEACHER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@test.com",
    "password": "Password123!",
    "name": "Test Teacher",
    "role": "teacher",
    "registration_number": "REG2024001"
  }')

echo "Teacher registration response:"
echo "$TEACHER_RESPONSE" | jq . 2>/dev/null || echo "$TEACHER_RESPONSE"
echo ""

# Get teacher token
TEACHER_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@test.com",
    "password": "Password123!"
  }')

TEACHER_TOKEN=$(echo "$TEACHER_LOGIN_RESPONSE" | jq -r '.token // empty')
echo "Teacher token: $TEACHER_TOKEN"
echo ""

echo "2. Testing student registration..."
STUDENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@test.com",
    "password": "Password123!",
    "name": "Test Student",
    "role": "student",
    "registration_number": "REG2024002"
  }')

echo "Student registration response:"
echo "$STUDENT_RESPONSE" | jq . 2>/dev/null || echo "$STUDENT_RESPONSE"
echo ""

# Get student token
STUDENT_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@test.com",
    "password": "Password123!"
  }')

STUDENT_TOKEN=$(echo "$STUDENT_LOGIN_RESPONSE" | jq -r '.token // empty')
echo "Student token: $STUDENT_TOKEN"
echo ""

echo "3. Testing teacher creates course..."
COURSE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/courses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -d '{
    "name": "Test Course",
    "description": "A test course for LMS verification"
  }')

echo "Course creation response:"
echo "$COURSE_RESPONSE" | jq . 2>/dev/null || echo "$COURSE_RESPONSE"
COURSE_ID=$(echo "$COURSE_RESPONSE" | jq -r '.id // empty')
echo "Course ID: $COURSE_ID"
echo ""

echo "4. Testing teacher enrolls student..."
if [ ! -z "$COURSE_ID" ]; then
  ENROLL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/courses/$COURSE_ID/enroll" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TEACHER_TOKEN" \
    -d '{
      "registration_number": "REG2024002"
    }')

  echo "Student enrollment response:"
  echo "$ENROLL_RESPONSE" | jq . 2>/dev/null || echo "$ENROLL_RESPONSE"
  echo ""
fi

echo "5. Testing teacher creates exam..."
if [ ! -z "$COURSE_ID" ]; then
  EXAM_RESPONSE=$(curl -s -X POST "$BASE_URL/api/exams" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TEACHER_TOKEN" \
    -d '{
    "title": "Test Exam",
    "description": "A test exam for LMS verification",
    "course_id": "'$COURSE_ID'",
    "type": "mcq",
    "duration_minutes": 60,
    "difficulty": "medium",
    "total_marks": 100,
    "passing_marks": 50,
    "start_time": "'$(date -d "+1 hour" -Iseconds)'",
    "fullscreen_required": false,
    "tab_switch_detection": false,
    "copy_paste_blocked": false,
    "camera_required": false,
    "face_detection_enabled": false,
    "shuffle_questions": false,
    "shuffle_options": false,
    "assign_to_all": true,
    "assigned_groups": []
  }')

  echo "Exam creation response:"
  echo "$EXAM_RESPONSE" | jq . 2>/dev/null || echo "$EXAM_RESPONSE"
  EXAM_ID=$(echo "$EXAM_RESPONSE" | jq -r '.id // empty')
  echo "Exam ID: $EXAM_ID"
  echo ""
fi

echo "6. Testing teacher publishes exam..."
if [ ! -z "$EXAM_ID" ]; then
  PUBLISH_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/exams/$EXAM_ID/publish" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TEACHER_TOKEN")

  echo "Exam publish response:"
  echo "$PUBLISH_RESPONSE" | jq . 2>/dev/null || echo "$PUBLISH_RESPONSE"
  echo ""
fi

echo "7. Testing teacher adds questions to exam..."
if [ ! -z "$EXAM_ID" ]; then
  QUESTION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/exams/$EXAM_ID/questions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TEACHER_TOKEN" \
    -d '{
    "question_text": "What is 2 + 2?",
    "type": "mcq",
    "options": ["3", "4", "5", "6"],
    "correct_answer": "4",
    "points": 10
  }')

  echo "Question addition response:"
  echo "$QUESTION_RESPONSE" | jq . 2>/dev/null || echo "$QUESTION_RESPONSE"
  echo ""
fi

echo "8. Testing student dashboard..."
if [ ! -z "$STUDENT_TOKEN" ]; then
  STUDENT_DASHBOARD_RESPONSE=$(curl -s -X GET "$BASE_URL/api/student/dashboard" \
    -H "Authorization: Bearer $STUDENT_TOKEN")

  echo "Student dashboard response:"
  echo "$STUDENT_DASHBOARD_RESPONSE" | jq . 2>/dev/null || echo "$STUDENT_DASHBOARD_RESPONSE"
  echo ""
fi

echo "9. Testing student courses..."
if [ ! -z "$STUDENT_TOKEN" ]; then
  STUDENT_COURSES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/student/courses" \
    -H "Authorization: Bearer $STUDENT_TOKEN")

  echo "Student courses response:"
  echo "$STUDENT_COURSES_RESPONSE" | jq . 2>/dev/null || echo "$STUDENT_COURSES_RESPONSE"
  echo ""
fi

echo "10. Testing student exams..."
if [ ! -z "$STUDENT_TOKEN" ]; then
  STUDENT_EXAMS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/student/exams" \
    -H "Authorization: Bearer $STUDENT_TOKEN")

  echo "Student exams response:"
  echo "$STUDENT_EXAMS_RESPONSE" | jq . 2>/dev/null || echo "$STUDENT_EXAMS_RESPONSE"
  echo ""
fi

echo "11. Testing student notifications..."
if [ ! -z "$STUDENT_TOKEN" ]; then
  STUDENT_NOTIFICATIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/student/notifications" \
    -H "Authorization: Bearer $STUDENT_TOKEN")

  echo "Student notifications response:"
  echo "$STUDENT_NOTIFICATIONS_RESPONSE" | jq . 2>/dev/null || echo "$STUDENT_NOTIFICATIONS_RESPONSE"
  echo ""
fi

echo "12. Testing teacher dashboard stats..."
if [ ! -z "$TEACHER_TOKEN" ]; then
  TEACHER_STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/teacher/stats" \
    -H "Authorization: Bearer $TEACHER_TOKEN")

  echo "Teacher stats response:"
  echo "$TEACHER_STATS_RESPONSE" | jq . 2>/dev/null || echo "$TEACHER_STATS_RESPONSE"
  echo ""
fi

echo "13. Testing teacher student list..."
if [ ! -z "$TEACHER_TOKEN" ]; then
  TEACHER_STUDENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/teacher/students" \
    -H "Authorization: Bearer $TEACHER_TOKEN")

  echo "Teacher students response:"
  echo "$TEACHER_STUDENTS_RESPONSE" | jq . 2>/dev/null || echo "$TEACHER_STUDENTS_RESPONSE"
  echo ""
fi

echo "14. Testing teacher exams list..."
if [ ! -z "$TEACHER_TOKEN" ]; then
  TEACHER_EXAMS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/teacher/exams" \
    -H "Authorization: Bearer $TEACHER_TOKEN")

  echo "Teacher exams response:"
  echo "$TEACHER_EXAMS_RESPONSE" | jq . 2>/dev/null || echo "$TEACHER_EXAMS_RESPONSE"
  echo ""
fi

echo "=== TEST COMPLETE ==="
echo "Check above responses to verify all fixes are working correctly!"
