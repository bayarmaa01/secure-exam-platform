const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'exam_platform',
  user: 'postgres',
  password: 'postgres',
});

async function checkCredentials() {
  try {
    console.log('=== CHECKING STUDENT CREDENTIALS ===\n');
    
    const result = await pool.query(
      'SELECT id, email, name, role, registration_number FROM users WHERE email = $1',
      ['test@example.com']
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('Student found:');
      console.table(user);
      
      // Test login with different passwords
      const passwords = ['Password123!', 'password123', 'test123', 'Test@123'];
      
      for (const pwd of passwords) {
        try {
          const loginResult = await makeRequest('POST', 'localhost:4005', '/api/auth/login', {
            email: 'test@example.com',
            password: pwd
          });
          
          const loginData = JSON.parse(loginResult);
          if (loginData.accessToken) {
            console.log(`\nSUCCESS! Password works: "${pwd}"`);
            console.log('User:', loginData.user.name);
            
            // Test student endpoints with correct token
            const token = loginData.accessToken;
            
            console.log('\nTesting student endpoints...');
            
            const coursesResponse = await makeRequest('GET', 'localhost:4005', '/api/student/courses', null, token);
            const courses = JSON.parse(coursesResponse);
            console.log(`Courses: ${courses.length} found`);
            
            const examsResponse = await makeRequest('GET', 'localhost:4005', '/api/exams', null, token);
            const exams = JSON.parse(examsResponse);
            console.log(`Exams: ${exams.length} found`);
            
            const notificationsResponse = await makeRequest('GET', 'localhost:4005', '/api/notifications', null, token);
            const notifications = JSON.parse(notificationsResponse);
            console.log(`Notifications: ${notifications.length} found`);
            
            console.log('\n=== SYSTEM FULLY WORKING ON CORRECT PORTS! ===');
            console.log('Backend: http://localhost:4005');
            console.log('Frontend: http://localhost:3006');
            console.log(`Student can login with password: "${pwd}"`);
            
            return;
          }
        } catch (error) {
          console.log(`Password "${pwd}": Failed - ${error.message}`);
        }
      }
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

checkCredentials();
