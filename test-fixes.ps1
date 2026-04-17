# PowerShell script to test LMS fixes
$BASE_URL = "http://localhost:4005"

Write-Host "=== TESTING LMS FIXES ===" -ForegroundColor Green
Write-Host "Backend URL: $BASE_URL"
Write-Host ""

# Test 1: Teacher Registration
Write-Host "1. Testing teacher registration..." -ForegroundColor Yellow
$teacherReg = @{
    email = "teacher@test.com"
    password = "Password123!"
    name = "Test Teacher"
    role = "teacher"
    registration_number = "REG2024001"
} | ConvertTo-Json

try {
    $teacherResponse = Invoke-RestMethod -Uri "$BASE_URL/api/auth/register" -Method Post -ContentType "application/json" -Body $teacherReg
    Write-Host "Teacher registration SUCCESS" -ForegroundColor Green
    $teacherToken = $teacherResponse.accessToken
    $teacherId = $teacherResponse.user.id
    Write-Host "Teacher ID: $teacherId"
    Write-Host "Teacher Registration Number: $($teacherResponse.user.registration_number)"
} catch {
    Write-Host "Teacher registration FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Student Registration
Write-Host "2. Testing student registration..." -ForegroundColor Yellow
$studentReg = @{
    email = "student@test.com"
    password = "Password123!"
    name = "Test Student"
    role = "student"
    registration_number = "REG2024002"
} | ConvertTo-Json

try {
    $studentResponse = Invoke-RestMethod -Uri "$BASE_URL/api/auth/register" -Method Post -ContentType "application/json" -Body $studentReg
    Write-Host "Student registration SUCCESS" -ForegroundColor Green
    $studentToken = $studentResponse.accessToken
    $studentId = $studentResponse.user.id
    Write-Host "Student ID: $studentId"
    Write-Host "Student Registration Number: $($studentResponse.user.registration_number)"
} catch {
    Write-Host "Student registration FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Teacher Login
Write-Host "3. Testing teacher login..." -ForegroundColor Yellow
$teacherLogin = @{
    email = "teacher@test.com"
    password = "Password123!"
} | ConvertTo-Json

try {
    $teacherLoginResponse = Invoke-RestMethod -Uri "$BASE_URL/api/auth/login" -Method Post -ContentType "application/json" -Body $teacherLogin
    $teacherToken = $teacherLoginResponse.accessToken
    Write-Host "Teacher login SUCCESS" -ForegroundColor Green
} catch {
    Write-Host "Teacher login FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Student Login
Write-Host "4. Testing student login..." -ForegroundColor Yellow
$studentLogin = @{
    email = "student@test.com"
    password = "Password123!"
} | ConvertTo-Json

try {
    $studentLoginResponse = Invoke-RestMethod -Uri "$BASE_URL/api/auth/login" -Method Post -ContentType "application/json" -Body $studentLogin
    $studentToken = $studentLoginResponse.accessToken
    Write-Host "Student login SUCCESS" -ForegroundColor Green
} catch {
    Write-Host "Student login FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Create Course
Write-Host "5. Testing teacher creates course..." -ForegroundColor Yellow
if ($teacherToken) {
    $courseData = @{
        name = "Test Course"
        description = "A test course for LMS verification"
    } | ConvertTo-Json

    try {
        $courseResponse = Invoke-RestMethod -Uri "$BASE_URL/api/courses" -Method Post -ContentType "application/json" -Body $courseData -Headers @{Authorization="Bearer $teacherToken"}
        Write-Host "Course creation SUCCESS" -ForegroundColor Green
        $courseId = $courseResponse.id
        Write-Host "Course ID: $courseId"
    } catch {
        Write-Host "Course creation FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 6: Enroll Student
Write-Host "6. Testing teacher enrolls student..." -ForegroundColor Yellow
if ($teacherToken -and $courseId) {
    $enrollData = @{
        registration_number = "REG2024002"
    } | ConvertTo-Json

    try {
        $enrollResponse = Invoke-RestMethod -Uri "$BASE_URL/api/courses/$courseId/enroll" -Method Post -ContentType "application/json" -Body $enrollData -Headers @{Authorization="Bearer $teacherToken"}
        Write-Host "Student enrollment SUCCESS" -ForegroundColor Green
        Write-Host "Enrollment response: $($enrollResponse | ConvertTo-Json -Depth 3)"
    } catch {
        Write-Host "Student enrollment FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 7: Create Exam
Write-Host "7. Testing teacher creates exam..." -ForegroundColor Yellow
if ($teacherToken -and $courseId) {
    $examData = @{
        title = "Test Exam"
        description = "A test exam for LMS verification"
        course_id = $courseId
        type = "mcq"
        duration_minutes = 60
        difficulty = "medium"
        total_marks = 100
        passing_marks = 50
        start_time = (Get-Date).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        fullscreen_required = $false
        tab_switch_detection = $false
        copy_paste_blocked = $false
        camera_required = $false
        face_detection_enabled = $false
        shuffle_questions = $false
        shuffle_options = $false
        assign_to_all = $true
        assigned_groups = @()
    } | ConvertTo-Json -Depth 10

    try {
        $examResponse = Invoke-RestMethod -Uri "$BASE_URL/api/exams" -Method Post -ContentType "application/json" -Body $examData -Headers @{Authorization="Bearer $teacherToken"}
        Write-Host "Exam creation SUCCESS" -ForegroundColor Green
        $examId = $examResponse.id
        Write-Host "Exam ID: $examId"
    } catch {
        Write-Host "Exam creation FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 8: Publish Exam
Write-Host "8. Testing teacher publishes exam..." -ForegroundColor Yellow
if ($teacherToken -and $examId) {
    try {
        $publishResponse = Invoke-RestMethod -Uri "$BASE_URL/api/exams/$examId/publish" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $teacherToken"}
        Write-Host "Exam publish SUCCESS" -ForegroundColor Green
        Write-Host "Published exam status: $($publishResponse.status)"
    } catch {
        Write-Host "Exam publish FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 9: Student Dashboard
Write-Host "9. Testing student dashboard..." -ForegroundColor Yellow
if ($studentToken) {
    try {
        $dashboardResponse = Invoke-RestMethod -Uri "$BASE_URL/api/student/dashboard" -Method Get -Headers @{Authorization="Bearer $studentToken"}
        Write-Host "Student dashboard SUCCESS" -ForegroundColor Green
        Write-Host "Enrolled Courses: $($dashboardResponse.enrolledCourses.Count)"
        Write-Host "Available Exams: $($dashboardResponse.availableExams.Count)"
        Write-Host "Notifications: $($dashboardResponse.notifications.Count)"
        Write-Host "Stats: $($dashboardResponse.stats | ConvertTo-Json)"
    } catch {
        Write-Host "Student dashboard FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 10: Teacher Student List
Write-Host "10. Testing teacher student list..." -ForegroundColor Yellow
if ($teacherToken) {
    try {
        $studentsResponse = Invoke-RestMethod -Uri "$BASE_URL/api/teacher/students" -Method Get -Headers @{Authorization="Bearer $teacherToken"}
        Write-Host "Teacher student list SUCCESS" -ForegroundColor Green
        Write-Host "Number of students: $($studentsResponse.Count)"
        $studentsResponse | ForEach-Object {
            Write-Host "  - $($_.name) ($($_.email)) - Reg#: $($_.registrationNumber)"
        }
    } catch {
        Write-Host "Teacher student list FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 11: Teacher Stats
Write-Host "11. Testing teacher dashboard stats..." -ForegroundColor Yellow
if ($teacherToken) {
    try {
        $statsResponse = Invoke-RestMethod -Uri "$BASE_URL/api/teacher/stats" -Method Get -Headers @{Authorization="Bearer $teacherToken"}
        Write-Host "Teacher stats SUCCESS" -ForegroundColor Green
        Write-Host "Stats: $($statsResponse | ConvertTo-Json)"
    } catch {
        Write-Host "Teacher stats FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 12: Teacher Exams List
Write-Host "12. Testing teacher exams list..." -ForegroundColor Yellow
if ($teacherToken) {
    try {
        $examsResponse = Invoke-RestMethod -Uri "$BASE_URL/api/teacher/exams" -Method Get -Headers @{Authorization="Bearer $teacherToken"}
        Write-Host "Teacher exams list SUCCESS" -ForegroundColor Green
        Write-Host "Number of exams: $($examsResponse.Count)"
        $examsResponse | ForEach-Object {
            Write-Host "  - $($_.title) - Status: $($_.status) - Course: $($_.courseName) - Duration: $($_.durationMinutes)min"
        }
    } catch {
        Write-Host "Teacher exams list FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== TEST COMPLETE ===" -ForegroundColor Green
Write-Host "Check above results to verify all fixes are working!"
