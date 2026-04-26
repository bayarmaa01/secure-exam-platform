// Test script to verify the grading API fix
const axios = require('axios');

const API_BASE_URL = 'http://localhost:4005/api';

// Test token from the user's logs (teacher token)
const TEACHER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4MzAzNTIxNy1lMWNiLTQyZmItYjgzZC03YjY0NmU5MmIyZjkiLCJlbWFpbCI6IlRlYWNoZXJAdGVzdC5jb20iLCJyb2xlIjoidGVhY2hlciIsImlhdCI6MTc3NzE4OTAyMCwiZXhwIjoxNzc3MTg5OTIwfQ.Y2Sil2QxUxCUeke7HgqaREcACCsBvdTljSev0IWbtqw';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEACHER_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testGradingAPI() {
  try {
    console.log('🧪 Testing Grading API Fix...\n');

    // Test 1: Get pending grading attempts
    console.log('1. Testing GET /grading/pending...');
    try {
      const pendingResponse = await api.get('/grading/pending');
      console.log('✅ GET /grading/pending - SUCCESS');
      console.log(`   Found ${pendingResponse.data.pendingAttempts?.length || 0} pending attempts`);
      
      if (pendingResponse.data.pendingAttempts && pendingResponse.data.pendingAttempts.length > 0) {
        const firstAttempt = pendingResponse.data.pendingAttempts[0];
        console.log(`   First attempt ID: ${firstAttempt.attempt_id}`);
        
        // Test 2: Get specific attempt details
        console.log('\n2. Testing GET /grading/attempts/{attemptId}...');
        try {
          const attemptResponse = await api.get(`/grading/attempts/${firstAttempt.attempt_id}`);
          console.log('✅ GET /grading/attempts/{attemptId} - SUCCESS');
          console.log(`   Attempt details for: ${attemptResponse.data.attempt?.exam_title}`);
          console.log(`   Student: ${attemptResponse.data.attempt?.student_name}`);
          console.log(`   Questions: ${attemptResponse.data.attempt?.questions?.length || 0}`);
        } catch (error) {
          console.log('❌ GET /grading/attempts/{attemptId} - FAILED');
          console.log('   Error:', error.response?.data || error.message);
        }
      } else {
        console.log('   No pending attempts found to test individual attempt endpoint');
      }
    } catch (error) {
      console.log('❌ GET /grading/pending - FAILED');
      console.log('   Error:', error.response?.data || error.message);
    }

    // Test 3: Get teacher exams to check results dashboard
    console.log('\n3. Testing GET /teacher/exams...');
    try {
      const examsResponse = await api.get('/teacher/exams');
      console.log('✅ GET /teacher/exams - SUCCESS');
      console.log(`   Found ${examsResponse.data?.length || 0} exams`);
      
      if (examsResponse.data && examsResponse.data.length > 0) {
        const latestExam = examsResponse.data[0];
        console.log(`   Latest exam: "${latestExam.title}" (Status: ${latestExam.status})`);
        console.log(`   Created: ${new Date(latestExam.createdAt).toLocaleString()}`);
        console.log(`   Attempts: ${latestExam.attemptCount || 0}`);
      }
    } catch (error) {
      console.log('❌ GET /teacher/exams - FAILED');
      console.log('   Error:', error.response?.data || error.message);
    }

    console.log('\n🎉 Grading API test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testGradingAPI();
