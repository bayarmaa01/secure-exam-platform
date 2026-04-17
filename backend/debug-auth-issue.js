const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'exam_platform',
  user: 'postgres',
  password: 'postgres',
});

async function debugAuth() {
  try {
    console.log('=== DEBUGGING AUTHENTICATION ISSUE ===\n');
    
    // Step 1: Check user exists and get current hash
    console.log('1. Checking user in database...');
    const userResult = await pool.query(
      'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
      ['test@example.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('User not found in database!');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('User found:', user.email);
    console.log('Password hash exists:', !!user.password_hash);
    console.log('Hash length:', user.password_hash.length);
    
    // Step 2: Test password comparison directly
    console.log('\n2. Testing password comparison...');
    const password = 'Test123!';
    
    try {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      console.log(`Password "${password}" comparison: ${isMatch ? 'MATCH' : 'NO MATCH'}`);
      
      if (!isMatch) {
        console.log('Password does not match hash. Creating new hash...');
        const newHash = await bcrypt.hash(password, 10);
        
        await pool.query(
          'UPDATE users SET password_hash = $1 WHERE email = $2',
          [newHash, 'test@example.com']
        );
        
        console.log('Updated password hash in database');
        
        // Test again
        const updatedUser = await pool.query(
          'SELECT password_hash FROM users WHERE email = $1',
          ['test@example.com']
        );
        
        const newMatch = await bcrypt.compare(password, updatedUser.rows[0].password_hash);
        console.log(`New password comparison: ${newMatch ? 'MATCH' : 'NO MATCH'}`);
      }
    } catch (error) {
      console.error('Password comparison error:', error.message);
    }
    
    // Step 3: Test login via direct API call with detailed logging
    console.log('\n3. Testing login API call...');
    try {
      const loginResponse = await makeRequest('POST', 'localhost:4005', '/api/auth/login', {
        email: 'test@example.com',
        password: password
      });
      
      const loginData = JSON.parse(loginResponse);
      console.log('Login successful!');
      console.log('User:', loginData.user.name);
      console.log('Token received:', !!loginData.accessToken);
      
      // Test student endpoints
      const token = loginData.accessToken;
      
      console.log('\n4. Testing student endpoints...');
      
      const coursesResponse = await makeRequest('GET', 'localhost:4005', '/api/student/courses', null, token);
      const courses = JSON.parse(coursesResponse);
      console.log(`Courses: ${courses.length} found`);
      
      const examsResponse = await makeRequest('GET', 'localhost:4005', '/api/exams', null, token);
      const exams = JSON.parse(examsResponse);
      console.log(`Exams: ${exams.length} found`);
      
      const notificationsResponse = await makeRequest('GET', 'localhost:4005', '/api/notifications', null, token);
      const notifications = JSON.parse(notificationsResponse);
      console.log(`Notifications: ${notifications.length} found`);
      
      console.log('\n=== SYSTEM WORKING ON CORRECT PORTS! ===');
      console.log('Backend: http://localhost:4005');
      console.log('Frontend: http://localhost:3006');
      console.log(`Login: email=test@example.com, password=${password}`);
      
    } catch (loginError) {
      console.error('Login API call failed:', loginError.message);
      
      // Try to get more details about the error
      if (loginError.message.includes('401')) {
        console.log('401 Unauthorized - checking backend logs...');
        console.log('The backend might be rejecting the login due to:');
        console.log('1. Password hash mismatch');
        console.log('2. User not found');
        console.log('3. Backend authentication logic issue');
        console.log('4. Request format issue');
      }
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await pool.end();
  }
}

function makeRequest(method, host, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    
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

debugAuth();
