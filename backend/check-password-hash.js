const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'exam_platform',
  user: 'postgres',
  password: 'postgres',
});

async function checkPasswordHash() {
  try {
    console.log('=== CHECKING PASSWORD HASH ===\n');
    
    const result = await pool.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      ['test@example.com']
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('User found:', user.email);
      console.log('Password hash exists:', !!user.password_hash);
      console.log('Hash length:', user.password_hash?.length || 0);
      
      // Test different passwords against the hash
      const passwords = ['Password123!', 'password123', 'test123', 'Test@123'];
      
      for (const pwd of passwords) {
        try {
          const isMatch = await bcrypt.compare(pwd, user.password_hash);
          console.log(`Password "${pwd}": ${isMatch ? 'MATCH' : 'NO MATCH'}`);
          
          if (isMatch) {
            console.log(`\nFOUND CORRECT PASSWORD: "${pwd}"`);
            
            // Test login with correct password
            try {
              const loginResult = await makeRequest('POST', 'localhost:4005', '/api/auth/login', {
                email: 'test@example.com',
                password: pwd
              });
              
              const loginData = JSON.parse(loginResult);
              console.log('Login successful with correct password!');
              console.log('User:', loginData.user.name);
              
              // Now test the student endpoints
              const token = loginData.accessToken;
              
              console.log('\nTesting student endpoints on port 4005...');
              
              const coursesResponse = await makeRequest('GET', 'localhost:4005', '/api/student/courses', null, token);
              const courses = JSON.parse(coursesResponse);
              console.log(`Courses: ${courses.length} found`);
              courses.forEach((course, i) => {
                console.log(`  ${i+1}. ${course.name} - ${course.teacher_name}`);
              });
              
              const examsResponse = await makeRequest('GET', 'localhost:4005', '/api/exams', null, token);
              const exams = JSON.parse(examsResponse);
              console.log(`Exams: ${exams.length} found`);
              exams.forEach((exam, i) => {
                console.log(`  ${i+1}. ${exam.title} - ${exam.courseName} (${exam.questionCount} questions)`);
              });
              
              const notificationsResponse = await makeRequest('GET', 'localhost:4005', '/api/notifications', null, token);
              const notifications = JSON.parse(notificationsResponse);
              console.log(`Notifications: ${notifications.length} found`);
              notifications.forEach((notif, i) => {
                console.log(`  ${i+1}. ${notif.title} - ${notif.read ? 'Read' : 'Unread'}`);
              });
              
              console.log('\n=== SYSTEM FULLY WORKING ON CORRECT PORTS! ===');
              console.log('Backend: http://localhost:4005');
              console.log('Frontend: http://localhost:3006');
              console.log(`Student login credentials: email=test@example.com, password="${pwd}"`);
              
              return;
            } catch (loginError) {
              console.log('Login test failed:', loginError.message);
            }
          }
        } catch (error) {
          console.log(`Password "${pwd}": ERROR - ${error.message}`);
        }
      }
      
      // If no password matches, let's create/update the user with a known password
      console.log('\nNo password matches found. Creating user with known password...');
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [hashedPassword, 'test@example.com']
      );
      
      console.log('Updated password hash for test@example.com');
      console.log('Try again with password: "Password123!"');
      
    } else {
      console.log('Student user not found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
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

checkPasswordHash();
