import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:4000'

async function testNotification() {
  console.log('=== TESTING NOTIFICATION SYSTEM ===\n')
  
  // Login as teacher
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-teacher@example.com',
      password: 'Password123!'
    })
  })
  
  const teacherLogin = await loginResponse.json()
  const teacherToken = teacherLogin.accessToken
  
  // Create a new exam to trigger notification
  console.log('Creating new exam to test notifications...')
  const examResponse = await fetch(`${BASE_URL}/api/exams`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacherToken}`
    },
    body: JSON.stringify({
      title: 'Notification Test Exam',
      description: 'This exam should trigger a notification',
      course_id: 'f3f4e9fa-39a5-4fd3-8ccd-da1ceb2c75ef', // test-teacher's course
      duration_minutes: 30,
      start_time: new Date().toISOString(),
      is_published: true
    })
  })
  
  const examResult = await examResponse.json()
  console.log('Exam creation response:', JSON.stringify(examResult, null, 2))
  
  // Login as student and check notifications
  console.log('\nChecking student notifications...')
  const studentLoginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'Password123!'
    })
  })
  
  const studentLogin = await studentLoginResponse.json()
  const studentToken = studentLogin.accessToken
  
  const notificationsResponse = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  })
  
  const notifications = await notificationsResponse.json()
  console.log('Student notifications:', JSON.stringify(notifications, null, 2))
}

testNotification().catch(console.error)
