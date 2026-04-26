// Test script to verify the new monitoring API endpoints
const axios = require('axios');

const API_BASE_URL = 'http://localhost:4005/api';

// Test token (you'll need to get a fresh token from the frontend)
const TEACHER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4MzAzNTIxNy1lMWNiLTQyZmItYjgzZC03YjY0NmU5MmIyZjkiLCJlbWFpbCI6IlRlYWNoZXJAdGVzdC5jb20iLCJyb2xlIjoidGVhY2hlciIsImlhdCI6MTc3NzE4OTAyMCwiZXhwIjoxNzc3MTg5OTIwfQ.Y2Sil2QxUxCUeke7HgqaREcACCsBvdTljSev0IWbtqw';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEACHER_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testMonitoringAPI() {
  try {
    console.log('🧪 Testing New Monitoring API Endpoints...\n');

    // Test 1: Dashboard Statistics
    console.log('1. Testing GET /monitoring/dashboard-stats...');
    try {
      const statsResponse = await api.get('/monitoring/dashboard-stats');
      console.log('✅ GET /monitoring/dashboard-stats - SUCCESS');
      console.log('   Response:', JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ GET /monitoring/dashboard-stats - FAILED');
      console.log('   Error:', error.response?.data || error.message);
    }

    // Test 2: Exam Analytics
    console.log('\n2. Testing GET /monitoring/exam-analytics...');
    try {
      const analyticsResponse = await api.get('/monitoring/exam-analytics');
      console.log('✅ GET /monitoring/exam-analytics - SUCCESS');
      console.log(`   Found ${analyticsResponse.data.exams?.length || 0} exams`);
    } catch (error) {
      console.log('❌ GET /monitoring/exam-analytics - FAILED');
      console.log('   Error:', error.response?.data || error.message);
    }

    // Test 3: Student Performance
    console.log('\n3. Testing GET /monitoring/student-performance...');
    try {
      const performanceResponse = await api.get('/monitoring/student-performance');
      console.log('✅ GET /monitoring/student-performance - SUCCESS');
      console.log(`   Found ${performanceResponse.data.students?.length || 0} students`);
    } catch (error) {
      console.log('❌ GET /monitoring/student-performance - FAILED');
      console.log('   Error:', error.response?.data || error.message);
    }

    // Test 4: Active Sessions
    console.log('\n4. Testing GET /monitoring/sessions...');
    try {
      const sessionsResponse = await api.get('/monitoring/sessions');
      console.log('✅ GET /monitoring/sessions - SUCCESS');
      console.log(`   Found ${sessionsResponse.data.sessions?.length || 0} active sessions`);
    } catch (error) {
      console.log('❌ GET /monitoring/sessions - FAILED');
      console.log('   Error:', error.response?.data || error.message);
    }

    // Test 5: Warnings
    console.log('\n5. Testing GET /monitoring/warnings...');
    try {
      const warningsResponse = await api.get('/monitoring/warnings');
      console.log('✅ GET /monitoring/warnings - SUCCESS');
      console.log(`   Found ${warningsResponse.data.warnings?.length || 0} warnings`);
    } catch (error) {
      console.log('❌ GET /monitoring/warnings - FAILED');
      console.log('   Error:', error.response?.data || error.message);
    }

    console.log('\n🎉 Monitoring API test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMonitoringAPI();
