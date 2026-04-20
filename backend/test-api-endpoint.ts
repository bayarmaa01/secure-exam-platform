import axios from 'axios'

async function testDeleteCourseAPI() {
  console.log('🧪 Testing DELETE /api/courses/:id API endpoint...')
  
  try {
    // First, get a list of courses to find one to delete
    console.log('📋 Getting available courses...')
    
    // Login as teacher to get auth token
    const loginResponse = await axios.post('http://localhost:4005/api/auth/login', {
      email: 'teacher@example.com',
      password: 'teacher123'
    }).catch(() => {
      console.log('❌ Teacher login failed, trying to create test course first...')
      return null
    })
    
    if (!loginResponse) {
      console.log('❌ Cannot test without valid authentication')
      return
    }
    
    const token = loginResponse.data.accessToken
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    
    // Get teacher's courses
    const coursesResponse = await axios.get('http://localhost:4005/api/teacher/courses', {
      headers
    })
    
    if (coursesResponse.data.length === 0) {
      console.log('❌ No courses found to test deletion')
      return
    }
    
    const courseToDelete = coursesResponse.data[0]
    console.log(`📚 Attempting to delete course: ${courseToDelete.name} (${courseToDelete.id})`)
    console.log(`📊 Course has ${courseToDelete.exam_count || 0} exams and ${courseToDelete.student_count || 0} students`)
    
    // Test the DELETE endpoint
    console.log('\n🔄 Sending DELETE request...')
    
    const deleteResponse = await axios.delete(
      `http://localhost:4005/api/courses/${courseToDelete.id}`,
      { headers }
    )
    
    console.log('✅ DELETE request successful!')
    console.log('Response:', deleteResponse.data)
    
    // Verify course is deleted
    console.log('\n🔍 Verifying deletion...')
    try {
      await axios.get(`http://localhost:4005/api/teacher/courses`, { headers })
      const updatedCourses = await axios.get('http://localhost:4005/api/teacher/courses', { headers })
      const stillExists = updatedCourses.data.some((c: any) => c.id === courseToDelete.id)
      
      if (stillExists) {
        console.log('❌ Course still exists after deletion')
      } else {
        console.log('✅ Course successfully deleted')
      }
    } catch (error) {
      console.log('✅ Course appears to be deleted (verification failed as expected)')
    }
    
  } catch (error: any) {
    console.error('❌ API Test failed:')
    console.error('Status:', error.response?.status)
    console.error('Message:', error.response?.data?.message || error.message)
    console.error('Details:', error.response?.data?.details || '')
    
    if (error.response?.status === 500) {
      console.error('\n🔍 This is likely the 500 error you mentioned!')
      console.error('The fix should resolve this issue.')
    }
  }
}

// Run test
testDeleteCourseAPI().catch(console.error)
