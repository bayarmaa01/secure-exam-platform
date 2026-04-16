import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:4000'

async function testAllAPIs() {
  console.log('=== COMPREHENSIVE API TESTING ===\n')
  
  // Test teacher login
  console.log('1. Testing teacher login...')
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-teacher@example.com',
      password: 'Password123!'
    })
  })
  const teacherLogin = await loginResponse.json()
  console.log('✅ Teacher Login successful')
  
  const teacherToken = teacherLogin.accessToken
  
  // Test teacher courses
  console.log('\n2. Testing GET /api/teacher/courses...')
  const coursesResponse = await fetch(`${BASE_URL}/api/teacher/courses`, {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  })
  const courses = await coursesResponse.json()
  console.log('Teacher Courses:', JSON.stringify(courses, null, 2))
  
  // Test all exams
  console.log('\n3. Testing GET /api/exams...')
  const examsResponse = await fetch(`${BASE_URL}/api/exams`, {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  })
  const exams = await examsResponse.json()
  console.log('All Exams:', JSON.stringify(exams, null, 2))
  
  // Test teacher stats
  console.log('\n4. Testing GET /api/teacher/stats...')
  const statsResponse = await fetch(`${BASE_URL}/api/teacher/stats`, {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  })
  const stats = await statsResponse.json()
  console.log('Teacher Stats:', JSON.stringify(stats, null, 2))
  
  // Test student login
  console.log('\n5. Testing student login...')
  const studentLoginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'Password123!'
    })
  })
  const studentLogin = await studentLoginResponse.json()
  console.log('Student Login Response:', JSON.stringify(studentLogin, null, 2))
  
  if (studentLogin.accessToken) {
    const studentToken = studentLogin.accessToken
    
    // Test student courses
    console.log('\n6. Testing GET /api/student/courses...')
    const studentCoursesResponse = await fetch(`${BASE_URL}/api/student/courses`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    })
    const studentCourses = await studentCoursesResponse.json()
    console.log('Student Courses:', JSON.stringify(studentCourses, null, 2))
    
    // Test student exams
    console.log('\n7. Testing GET /api/student/exams...')
    const studentExamsResponse = await fetch(`${BASE_URL}/api/student/exams`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    })
    const studentExams = await studentExamsResponse.json()
    console.log('Student Exams:', JSON.stringify(studentExams, null, 2))
    
    // Test notifications
    console.log('\n8. Testing GET /api/notifications...')
    const notificationsResponse = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    })
    const notifications = await notificationsResponse.json()
    console.log('Student Notifications:', JSON.stringify(notifications, null, 2))
  }
}

testAllAPIs().catch(console.error)
