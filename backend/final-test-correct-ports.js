const http = require('http');

async function finalTest() {
  console.log('=== FINAL SYSTEM TEST ON CORRECT PORTS ===\n');
  console.log('Backend: http://localhost:4005');
  console.log('Frontend: http://localhost:3006');
  console.log('\nTesting complete system...\n');
  
  try {
    // Test 1: Backend health
    console.log('1. Backend Health Check...');
    const healthResponse = await makeRequest('GET', 'localhost:4005', '/api/health');
    console.log('   Backend health:', JSON.parse(healthResponse).status);
    
    // Test 2: Create/update student with known password
    console.log('\n2. Setting up test credentials...');
    const { Pool } = require('pg');
    const bcrypt = require('bcrypt');
    
    const pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'exam_platform',
      user: 'postgres',
      password: 'postgres',
    });
    
    // Ensure student exists with correct password
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    await pool.query(`
      INSERT INTO users (id, email, name, role, registration_number, password_hash) 
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET 
        password_hash = EXCLUDED.password_hash
    `, [
      'b9e88661-12ee-468b-a2d2-6f38be15b43b',
      'test@example.com',
      'Test User',
      'student',
      'REG2026001',
      hashedPassword
    ]);
    
    console.log('   Student credentials configured');
    await pool.end();
    
    // Test 3: Student login
    console.log('\n3. Student Login...');
    const loginResponse = await makeRequest('POST', 'localhost:4005', '/api/auth/login', {
      email: 'test@example.com',
      password: 'Test123!'
    });
    
    const loginData = JSON.parse(loginResponse);
    console.log('   Login successful! User:', loginData.user.name);
    const token = loginData.accessToken;
    
    // Test 4: Student endpoints
    console.log('\n4. Testing Student Endpoints...');
    
    const coursesResponse = await makeRequest('GET', 'localhost:4005', '/api/student/courses', null, token);
    const courses = JSON.parse(coursesResponse);
    console.log(`   Courses: ${courses.length} found`);
    courses.forEach((course, i) => {
      console.log(`     ${i+1}. ${course.name} - Teacher: ${course.teacher_name}`);
    });
    
    const examsResponse = await makeRequest('GET', 'localhost:4005', '/api/exams', null, token);
    const exams = JSON.parse(examsResponse);
    console.log(`   Exams: ${exams.length} found`);
    exams.forEach((exam, i) => {
      console.log(`     ${i+1}. ${exam.title}`);
      console.log(`        Course: ${exam.courseName}`);
      console.log(`        Questions: ${exam.questionCount}`);
      console.log(`        Duration: ${exam.durationMinutes} min`);
      console.log(`        Status: ${exam.status}`);
    });
    
    const notificationsResponse = await makeRequest('GET', 'localhost:4005', '/api/notifications', null, token);
    const notifications = JSON.parse(notificationsResponse);
    console.log(`   Notifications: ${notifications.length} found`);
    notifications.forEach((notif, i) => {
      console.log(`     ${i+1}. ${notif.title} - ${notif.read ? 'Read' : 'Unread'}`);
    });
    
    // Test 5: Data integrity verification
    console.log('\n5. Data Integrity Verification...');
    
    let allValid = true;
    
    // Check course data
    for (const course of courses) {
      if (!course.name || !course.teacher_name) {
        console.log(`   ERROR: Course missing data`);
        allValid = false;
      }
    }
    
    // Check exam data
    for (const exam of exams) {
      if (!exam.title || !exam.courseName || !exam.questionCount) {
        console.log(`   ERROR: Exam ${exam.title} missing data`);
        allValid = false;
      }
    }
    
    // Check notification data
    for (const notification of notifications) {
      if (!notification.title || !notification.message) {
        console.log(`   ERROR: Notification missing data`);
        allValid = false;
      }
    }
    
    console.log(`   Data integrity: ${allValid ? 'PASS' : 'FAIL'}`);
    
    // Final result
    console.log('\n=== FINAL RESULT ===');
    if (allValid && courses.length > 0 && exams.length > 0) {
      console.log('SYSTEM FULLY WORKING ON CORRECT PORTS!');
      console.log('\nAccess Information:');
      console.log('Frontend URL: http://localhost:3006');
      console.log('Backend URL: http://localhost:4005');
      console.log('\nLogin Credentials:');
      console.log('Email: test@example.com');
      console.log('Password: Test123!');
      console.log('\nStudent Dashboard will show:');
      console.log(`- ${courses.length} enrolled courses`);
      console.log(`- ${exams.length} available exams`);
      console.log(`- ${notifications.length} notifications`);
      console.log('\nAll data relationships working correctly!');
    } else {
      console.log('SYSTEM HAS ISSUES - CHECK LOGS ABOVE');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

function makeRequest(method, host, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4005,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

finalTest();
