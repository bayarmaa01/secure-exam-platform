import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:4000'

async function debugExamsAPI() {
  try {
    console.log('=== DEBUGGING EXAMS API RESPONSE ===\n')
    
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
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    
    // Get exams with detailed response
    console.log('Fetching exams from /api/exams...')
    const examsResponse = await fetch(`${BASE_URL}/api/exams`, {
      headers
    })
    
    console.log('Response status:', examsResponse.status)
    console.log('Response headers:', Object.fromEntries(examsResponse.headers))
    
    if (examsResponse.ok) {
      const rawText = await examsResponse.text()
      console.log('Raw response length:', rawText.length)
      console.log('Raw response (first 500 chars):', rawText.substring(0, 500))
      
      try {
        const exams = JSON.parse(rawText)
        console.log('\nParsed exams count:', exams.length)
        
        if (exams.length > 0) {
          console.log('\nFirst exam raw object:')
          console.log(JSON.stringify(exams[0], null, 2))
          
          console.log('\nFirst exam field names:', Object.keys(exams[0]))
          
          // Check if course_name exists in raw response
          console.log('\nChecking for course_name field:')
          console.log('course_name in first exam:', 'course_name' in exams[0])
          console.log('courseName in first exam:', 'courseName' in exams[0])
          
          if ('course_name' in exams[0]) {
            console.log('course_name value:', exams[0].course_name)
          }
        }
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError)
      }
    } else {
      console.error('API call failed:', await examsResponse.text())
    }
    
  } catch (error) {
    console.error('Debug error:', error)
  }
}

debugExamsAPI()
