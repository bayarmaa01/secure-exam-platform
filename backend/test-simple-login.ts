import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:3001'

async function testSimpleLogin() {
  console.log('=== TESTING SIMPLE LOGIN ===\n')
  
  // Test with a simple password that meets requirements
  const testPassword = 'Password123!'
  
  console.log('1. Testing teacher login with password:', testPassword)
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'teacher@example.com',
      password: testPassword
    })
  })
  
  console.log('Status:', loginResponse.status)
  const loginData = await loginResponse.json()
  console.log('Response:', JSON.stringify(loginData, null, 2))
  
  if (loginData.accessToken) {
    console.log('\n✅ Login successful! Testing APIs...')
    
    // Test teacher courses
    console.log('\n2. Testing GET /api/teacher/courses...')
    const coursesResponse = await fetch(`${BASE_URL}/api/teacher/courses`, {
      headers: { 'Authorization': `Bearer ${loginData.accessToken}` }
    })
    const courses = await coursesResponse.json()
    console.log('Teacher Courses:', JSON.stringify(courses, null, 2))
    
    // Test student login
    console.log('\n3. Testing student login...')
    const studentLoginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: testPassword
      })
    })
    const studentLogin = await studentLoginResponse.json()
    console.log('Student Login:', JSON.stringify(studentLogin, null, 2))
    
    if (studentLogin.accessToken) {
      // Test student courses
      console.log('\n4. Testing GET /api/student/courses...')
      const studentCoursesResponse = await fetch(`${BASE_URL}/api/student/courses`, {
        headers: { 'Authorization': `Bearer ${studentLogin.accessToken}` }
      })
      const studentCourses = await studentCoursesResponse.json()
      console.log('Student Courses:', JSON.stringify(studentCourses, null, 2))
      
      // Test student exams
      console.log('\n5. Testing GET /api/student/exams...')
      const studentExamsResponse = await fetch(`${BASE_URL}/api/student/exams`, {
        headers: { 'Authorization': `Bearer ${studentLogin.accessToken}` }
      })
      const studentExams = await studentExamsResponse.json()
      console.log('Student Exams:', JSON.stringify(studentExams, null, 2))
    }
  }
}

testSimpleLogin().catch(console.error)
