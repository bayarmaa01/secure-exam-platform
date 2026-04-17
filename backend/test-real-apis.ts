import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:4000'

async function testRealAPIs() {
  try {
    console.log('=== TESTING REAL API ENDPOINTS ===\n')
    
    // Step 1: Login as student
    console.log('1. LOGIN AS STUDENT...')
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Password123!'
      })
    })
    
    if (!loginResponse.ok) {
      const error = await loginResponse.text()
      console.error('Login failed:', error)
      return
    }
    
    const loginData = await loginResponse.json()
    const token = loginData.accessToken
    console.log('Login successful! Token:', token.substring(0, 50) + '...')
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    
    // Step 2: Test student courses
    console.log('\n2. TESTING STUDENT COURSES...')
    const coursesResponse = await fetch(`${BASE_URL}/api/student/courses`, {
      headers
    })
    
    if (coursesResponse.ok) {
      const courses = await coursesResponse.json()
      console.log(`Student courses: Found ${courses.length} courses`)
      console.table(courses.map(c => ({
        id: c.id?.substring(0, 8) + '...',
        name: c.name,
        teacher_name: c.teacher_name,
        exam_count: c.exam_count
      })))
    } else {
      console.error('Courses failed:', await coursesResponse.text())
    }
    
    // Step 3: Test student exams
    console.log('\n3. TESTING STUDENT EXAMS...')
    const examsResponse = await fetch(`${BASE_URL}/api/exams`, {
      headers
    })
    
    if (examsResponse.ok) {
      const exams = await examsResponse.json()
      console.log(`Student exams: Found ${exams.length} exams`)
      console.table(exams.map(e => ({
        id: e.id?.substring(0, 8) + '...',
        title: e.title,
        courseName: e.courseName,
        questionCount: e.questionCount,
        status: e.status,
        startTime: e.startTime
      })))
    } else {
      console.error('Exams failed:', await examsResponse.text())
    }
    
    // Step 4: Test notifications
    console.log('\n4. TESTING NOTIFICATIONS...')
    const notificationsResponse = await fetch(`${BASE_URL}/api/notifications`, {
      headers
    })
    
    if (notificationsResponse.ok) {
      const notifications = await notificationsResponse.json()
      console.log(`Notifications: Found ${notifications.length} notifications`)
      console.table(notifications.map(n => ({
        id: n.id?.substring(0, 8) + '...',
        title: n.title,
        type: n.type,
        read: n.read
      })))
    } else {
      console.error('Notifications failed:', await notificationsResponse.text())
    }
    
    console.log('\n=== API TESTING COMPLETED ===')
    
  } catch (error) {
    console.error('Test error:', error)
  }
}

testRealAPIs()
