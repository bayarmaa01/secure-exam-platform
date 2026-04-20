#!/bin/bash

# # ADD EXAMS TO STUDENT DASHBOARD
# Manually create and enroll students in exams for testing

set -e

echo "Adding Exams to Student Dashboard..."
echo "==================================="

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

# Default configuration
BACKEND_URL="http://localhost:4005"
STUDENT_EMAIL="student@example.com"
STUDENT_PASSWORD="student123"
TEACHER_EMAIL="teacher@example.com"
TEACHER_PASSWORD="teacher123"

print_status "Configuration:"
echo "- Backend URL: $BACKEND_URL"
echo "- Student: $STUDENT_EMAIL"
echo "- Teacher: $TEACHER_EMAIL"
echo ""

print_status "1. Testing backend connectivity..."

if curl -s $BACKEND_URL/health | grep -q "ok"; then
    print_status "Backend is accessible"
else
    print_error "Backend is not accessible"
    exit 1
fi

echo ""
print_status "2. Getting teacher authentication token..."

TEACHER_AUTH_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEACHER_EMAIL\",
        \"password\": \"$TEACHER_PASSWORD\"
    }")

if echo "$TEACHER_AUTH_RESPONSE" | jq -r '.accessToken' 2>/dev/null | grep -q "^[a-zA-Z0-9._-]"; then
    TEACHER_TOKEN=$(echo "$TEACHER_AUTH_RESPONSE" | jq -r '.accessToken')
    print_status "Teacher authentication successful"
else
    print_error "Teacher authentication failed"
    echo "Response: $TEACHER_AUTH_RESPONSE"
    exit 1
fi

echo ""
print_status "3. Getting student authentication token..."

STUDENT_AUTH_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$STUDENT_EMAIL\",
        \"password\": \"$STUDENT_PASSWORD\"
    }")

if echo "$STUDENT_AUTH_RESPONSE" | jq -r '.accessToken' 2>/dev/null | grep -q "^[a-zA-Z0-9._-]"; then
    STUDENT_TOKEN=$(echo "$STUDENT_AUTH_RESPONSE" | jq -r '.accessToken')
    print_status "Student authentication successful"
else
    print_error "Student authentication failed"
    echo "Response: $STUDENT_AUTH_RESPONSE"
    exit 1
fi

echo ""
print_status "4. Getting teacher and student IDs..."

TEACHER_INFO=$(curl -s -X GET "$BACKEND_URL/api/auth/me" \
    -H "Authorization: Bearer $TEACHER_TOKEN")

TEACHER_ID=$(echo "$TEACHER_INFO" | jq -r '.id')
print_status "Teacher ID: $TEACHER_ID"

STUDENT_INFO=$(curl -s -X GET "$BACKEND_URL/api/auth/me" \
    -H "Authorization: Bearer $STUDENT_TOKEN")

STUDENT_ID=$(echo "$STUDENT_INFO" | jq -r '.id')
print_status "Student ID: $STUDENT_ID"

echo ""
print_status "5. Creating test course..."

COURSE_CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/courses" \
    -H "Authorization: Bearer $TEACHER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Course for Student Dashboard",
        "description": "Course created for testing student exam dashboard"
    }')

if echo "$COURSE_CREATE_RESPONSE" | jq -r '.id' 2>/dev/null | grep -q "^[0-9a-f-]"; then
    COURSE_ID=$(echo "$COURSE_CREATE_RESPONSE" | jq -r '.id')
    print_status "Test course created: $COURSE_ID"
else
    print_error "Failed to create course"
    echo "Response: $COURSE_CREATE_RESPONSE"
    exit 1
fi

echo ""
print_status "6. Creating test exam..."

# Get current time and set exam for 1 hour from now
START_TIME=$(date -d '+1 hour' -u +%Y-%m-%dT%H:%M:%S.000Z)
END_TIME=$(date -d '+2 hours' -u +%Y-%m-%dT%H:%M:%S.000Z)

EXAM_CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/exams" \
    -H "Authorization: Bearer $TEACHER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"title\": \"Test Exam for Student Dashboard\",
        \"description\": \"Test exam created for student dashboard testing\",
        \"type\": \"mcq\",
        \"durationMinutes\": 60,
        \"startTime\": \"$START_TIME\",
        \"endTime\": \"$END_TIME\",
        \"difficulty\": \"medium\",
        \"totalMarks\": 100,
        \"passingMarks\": 50,
        \"courseId\": \"$COURSE_ID\",
        \"fullscreenRequired\": false,
        \"tabSwitchDetection\": false,
        \"copyPasteBlocked\": false,
        \"cameraRequired\": false,
        \"faceDetectionEnabled\": false,
        \"shuffleQuestions\": false,
        \"shuffleOptions\": false,
        \"assignToAll\": false,
        \"assignedGroups\": [],
        \"status\": \"published\"
    }")

if echo "$EXAM_CREATE_RESPONSE" | jq -r '.id' 2>/dev/null | grep -q "^[0-9a-f-]"; then
    EXAM_ID=$(echo "$EXAM_CREATE_RESPONSE" | jq -r '.id')
    print_status "Test exam created: $EXAM_ID"
else
    print_error "Failed to create exam"
    echo "Response: $EXAM_CREATE_RESPONSE"
    exit 1
fi

echo ""
print_status "7. Adding sample questions to exam..."

# Add sample questions
QUESTIONS='[
    {
        "questionText": "What is 2 + 2?",
        "questionType": "mcq",
        "options": ["3", "4", "5", "6"],
        "correctAnswer": "4",
        "marks": 10
    },
    {
        "questionText": "What is the capital of France?",
        "questionType": "mcq",
        "options": ["London", "Berlin", "Paris", "Madrid"],
        "correctAnswer": "Paris",
        "marks": 10
    },
    {
        "questionText": "Which programming language is used for web development?",
        "questionType": "mcq",
        "options": ["Python", "JavaScript", "C++", "Java"],
        "correctAnswer": "JavaScript",
        "marks": 10
    }
]'

QUESTIONS_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/exams/$EXAM_ID/questions" \
    -H "Authorization: Bearer $TEACHER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$QUESTIONS")

if echo "$QUESTIONS_RESPONSE" | grep -q "success\|created\|added"; then
    print_status "Sample questions added to exam"
else
    print_warning "Failed to add questions, but exam still exists"
    echo "Response: $QUESTIONS_RESPONSE"
fi

echo ""
print_status "8. Enrolling student in course..."

ENROLL_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/courses/$COURSE_ID/enroll" \
    -H "Authorization: Bearer $STUDENT_TOKEN" \
    -H "Content-Type: application/json")

if echo "$ENROLL_RESPONSE" | grep -q "success\|enrolled\|created"; then
    print_status "Student enrolled in course"
else
    print_warning "Student enrollment may have failed"
    echo "Response: $ENROLL_RESPONSE"
fi

echo ""
print_status "9. Verifying student can see exams..."

STUDENT_EXAMS_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/exams/student" \
    -H "Authorization: Bearer $STUDENT_TOKEN")

print_status "Student exams response:"
echo "$STUDENT_EXAMS_RESPONSE" | jq . 2>/dev/null || echo "$STUDENT_EXAMS_RESPONSE"

echo ""
print_status "10. Testing student exam access..."

if echo "$STUDENT_EXAMS_RESPONSE" | jq -r '.[] | .id' 2>/dev/null | grep -q "$EXAM_ID"; then
    print_status "Student can see the created exam"
    
    # Test exam details
    EXAM_DETAILS=$(curl -s -X GET "$BACKEND_URL/api/exams/$EXAM_ID" \
        -H "Authorization: Bearer $STUDENT_TOKEN")
    
    print_status "Exam details accessible to student:"
    echo "$EXAM_DETAILS" | jq .title 2>/dev/null || echo "$EXAM_DETAILS"
else
    print_warning "Student may not see the exam in their dashboard"
fi

echo ""
print_status "11. Creating additional test exams..."

# Create a few more exams for variety
EXAM_TITLES=("Math Quiz" "Science Test" "Programming Challenge")
EXAM_TYPES=("mcq" "written" "coding")

for i in "${!EXAM_TITLES[@]}"; do
    TITLE="${EXAM_TITLES[$i]}"
    TYPE="${EXAM_TYPES[$i]}"
    
    CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/exams" \
        -H "Authorization: Bearer $TEACHER_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"$TITLE\",
            \"description\": \"Test exam $TYPE for student dashboard\",
            \"type\": \"$TYPE\",
            \"durationMinutes\": 45,
            \"startTime\": \"$START_TIME\",
            \"endTime\": \"$END_TIME\",
            \"difficulty\": \"medium\",
            \"totalMarks\": 100,
            \"passingMarks\": 50,
            \"courseId\": \"$COURSE_ID\",
            \"fullscreenRequired\": false,
            \"tabSwitchDetection\": false,
            \"copyPasteBlocked\": false,
            \"cameraRequired\": false,
            \"faceDetectionEnabled\": false,
            \"shuffleQuestions\": false,
            \"shuffleOptions\": false,
            \"assignToAll\": false,
            \"assignedGroups\": [],
            \"status\": \"published\"
        }")
    
    if echo "$CREATE_RESPONSE" | jq -r '.id' 2>/dev/null | grep -q "^[0-9a-f-]"; then
        NEW_EXAM_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')
        print_status "Created additional exam: $TITLE ($NEW_EXAM_ID)"
    fi
done

echo ""
print_status "12. Final verification - Student dashboard contents..."

FINAL_EXAMS_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/exams/student" \
    -H "Authorization: Bearer $STUDENT_TOKEN")

print_status "Final student exam dashboard:"
echo "$FINAL_EXAMS_RESPONSE" | jq '.[] | {id: .id, title: .title, type: .type, startTime: .startTime, endTime: .endTime}' 2>/dev/null || echo "$FINAL_EXAMS_RESPONSE"

echo ""
print_status "Student Exam Dashboard Setup Complete!"
echo ""
echo "Summary:"
echo "- Created test course: $COURSE_ID"
echo "- Created main test exam: $EXAM_ID"
echo "- Enrolled student: $STUDENT_EMAIL"
echo "- Added sample questions"
echo "- Created additional test exams"
echo ""
echo "Student can now:"
echo "1. Log in to student dashboard"
echo "2. See available exams"
echo "3. Access exam details"
echo "4. Start exam attempts"
echo ""
echo "Debug info:"
echo "- Teacher token: ${TEACHER_TOKEN:0:20}..."
echo "- Student token: ${STUDENT_TOKEN:0:20}..."
echo "- Backend URL: $BACKEND_URL"
