import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:4000'

async function testCompleteSystem() {
  try {
    console.log('=== COMPLETE SYSTEM END-TO-END TEST ===\n')
    
    // Step 1: Login as student
    console.log('1. STUDENT LOGIN...')
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
    
    // Step 2: Test all student endpoints
    console.log('\n2. TESTING ALL STUDENT ENDPOINTS...')
    
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
    
    // Step 3: Verify data integrity
    console.log('\n3. DATA INTEGRITY CHECKS...')
    
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
    
    // Check notifications have required data
    let notificationsValid = true
    for (const notification of notifications) {
      if (!notification.title || !notification.message) {
        console.error(`Notification ${notification.id} missing required data`)
        notificationsValid = false
      }
    }
    console.log(`Notifications data integrity: ${notificationsValid ? 'PASS' : 'FAIL'}`)
    
    // Step 4: Verify relationships
    console.log('\n4. RELATIONSHIP VERIFICATION...')
    
    // Each exam should belong to a course the student is enrolled in
    let relationshipsValid = true
    for (const exam of exams) {
      const matchingCourse = courses.find(c => c.name === exam.courseName)
      if (!matchingCourse) {
        console.error(`Exam "${exam.title}" references course "${exam.courseName}" but student not enrolled`)
        relationshipsValid = false
      }
    }
    console.log(`Course-Exam relationships: ${relationshipsValid ? 'PASS' : 'FAIL'}`)
    
    // Step 5: Summary
    console.log('\n5. SYSTEM SUMMARY...')
    console.log(`Student: ${loginData.user.name} (${loginData.user.email})`)
    console.log(`Enrolled Courses: ${courses.length}`)
    console.log(`Available Exams: ${exams.length}`)
    console.log(`Unread Notifications: ${notifications.filter(n => !n.read).length}`)
    
    // Show course details
    console.log('\nCOURSE DETAILS:')
    courses.forEach((course, i) => {
      console.log(`  ${i+1}. ${course.name} - Teacher: ${course.teacher_name}`)
    })
    
    // Show exam details
    console.log('\nEXAM DETAILS:')
    exams.forEach((exam, i) => {
      console.log(`  ${i+1}. ${exam.title}`)
      console.log(`     Course: ${exam.courseName}`)
      console.log(`     Questions: ${exam.questionCount}`)
      console.log(`     Duration: ${exam.durationMinutes} min`)
      console.log(`     Status: ${exam.status}`)
    })
    
    // Show notification details
    console.log('\nNOTIFICATION DETAILS:')
    notifications.forEach((notif, i) => {
      console.log(`  ${i+1}. ${notif.title} - ${notif.read ? 'Read' : 'Unread'}`)
    })
    
    // Final verdict
    const allValid = coursesValid && examsValid && notificationsValid && relationshipsValid
    console.log(`\n=== FINAL RESULT: ${allValid ? 'SYSTEM WORKING! ALL TESTS PASS!' : 'SYSTEM HAS ISSUES!'} ===`)
    
    if (allValid) {
      console.log('\nStudent should now see:')
      console.log('- Courses in dashboard')
      console.log('- Exams in dashboard')
      console.log('- Notifications in dashboard')
      console.log('- All data properly linked and displayed')
    }
    
  } catch (error) {
    console.error('System test error:', error)
  }
}

testCompleteSystem()
