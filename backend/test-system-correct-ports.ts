import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:4005'

async function testSystemCorrectPorts() {
  try {
    console.log('=== TESTING SYSTEM ON CORRECT PORTS (4005/3006) ===\n')
    
    // Step 1: Test backend health
    console.log('1. TESTING BACKEND HEALTH ON PORT 4005...')
    const healthResponse = await fetch(`${BASE_URL}/api/health`)
    if (healthResponse.ok) {
      const health = await healthResponse.json()
      console.log('Backend health:', health)
    } else {
      console.error('Backend health check failed:', await healthResponse.text())
      return
    }
    
    // Step 2: Login as student
    console.log('\n2. STUDENT LOGIN...')
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Password123!'
      })
    })
    
    if (!loginResponse.ok) {
      console.error('Login failed:', await loginResponse.text())
      return
    }
    
    const loginData = await loginResponse.json()
    const token = loginData.accessToken
    console.log('Login successful! Student:', loginData.user.name)
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    
    // Step 3: Test all student endpoints
    console.log('\n3. TESTING ALL STUDENT ENDPOINTS ON PORT 4005...')
    
    // Get courses
    const coursesResponse = await fetch(`${BASE_URL}/api/student/courses`, { headers })
    const courses = await coursesResponse.json()
    console.log(`Courses: ${courses.length} found`)
    
    // Get exams
    const examsResponse = await fetch(`${BASE_URL}/api/exams`, { headers })
    const exams = await examsResponse.json()
    console.log(`Exams: ${exams.length} found`)
    
    // Get notifications
    const notificationsResponse = await fetch(`${BASE_URL}/api/notifications`, { headers })
    const notifications = await notificationsResponse.json()
    console.log(`Notifications: ${notifications.length} found`)
    
    // Step 4: Verify data integrity
    console.log('\n4. DATA INTEGRITY CHECKS...')
    
    // Check courses have required data
    let coursesValid = true
    for (const course of courses) {
      if (!course.name || !course.teacher_name) {
        console.error(`Course ${course.id} missing required data`)
        coursesValid = false
      }
    }
    console.log(`Courses data integrity: ${coursesValid ? 'PASS' : 'FAIL'}`)
    
    // Check exams have required data
    let examsValid = true
    for (const exam of exams) {
      if (!exam.title || !exam.courseName || !exam.questionCount) {
        console.error(`Exam ${exam.id} missing required data`)
        examsValid = false
      }
    }
    console.log(`Exams data integrity: ${examsValid ? 'PASS' : 'FAIL'}`)
    
    // Step 5: Show actual data
    console.log('\n5. ACTUAL DATA RECEIVED...')
    
    console.log('\nCOURSES:')
    courses.forEach((course, i) => {
      console.log(`  ${i+1}. ${course.name} - Teacher: ${course.teacher_name}`)
    })
    
    console.log('\nEXAMS:')
    exams.forEach((exam, i) => {
      console.log(`  ${i+1}. ${exam.title}`)
      console.log(`     Course: ${exam.courseName}`)
      console.log(`     Questions: ${exam.questionCount}`)
      console.log(`     Duration: ${exam.durationMinutes} min`)
      console.log(`     Status: ${exam.status}`)
    })
    
    console.log('\nNOTIFICATIONS:')
    notifications.forEach((notif, i) => {
      console.log(`  ${i+1}. ${notif.title} - ${notif.read ? 'Read' : 'Unread'}`)
    })
    
    // Step 6: Final verification
    const allValid = coursesValid && examsValid
    console.log(`\n=== SYSTEM STATUS: ${allValid ? 'WORKING!' : 'HAS ISSUES!'} ===`)
    
    console.log('\nFRONTEND URL: http://localhost:3006')
    console.log('BACKEND URL: http://localhost:4005')
    console.log('\nStudent should be able to:')
    console.log('- Login at http://localhost:3006')
    console.log('- See courses in dashboard')
    console.log('- See exams in dashboard')
    console.log('- See notifications in dashboard')
    
  } catch (error) {
    console.error('System test error:', error)
  }
}

testSystemCorrectPorts()
