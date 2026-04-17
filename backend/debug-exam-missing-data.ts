import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:4000'

async function debugExamMissingData() {
  try {
    console.log('=== DEBUGGING EXAM MISSING DATA ===\n')
    
    // Login
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Password123!'
      })
    })
    
    const loginData = await loginResponse.json()
    const token = loginData.accessToken
    const headers = { 'Authorization': `Bearer ${token}` }
    
    // Get exams and check each one
    const examsResponse = await fetch(`${BASE_URL}/api/exams`, { headers })
    const exams = await examsResponse.json()
    
    console.log('Checking each exam for required fields:')
    
    for (let i = 0; i < exams.length; i++) {
      const exam = exams[i]
      console.log(`\nExam ${i+1}: ${exam.title}`)
      console.log('Raw exam object:', JSON.stringify(exam, null, 2))
      
      const requiredFields = ['id', 'title', 'description', 'durationMinutes', 'startTime', 'endTime', 'status', 'courseName', 'courseDescription', 'questionCount']
      const missingFields = requiredFields.filter(field => !(field in exam) || exam[field] === undefined || exam[field] === null)
      
      if (missingFields.length > 0) {
        console.log(`Missing fields: ${missingFields.join(', ')}`)
      } else {
        console.log('All required fields present')
      }
      
      console.log('Field values:')
      requiredFields.forEach(field => {
        console.log(`  ${field}: ${exam[field]}`)
      })
    }
    
  } catch (error) {
    console.error('Debug error:', error)
  }
}

debugExamMissingData()
