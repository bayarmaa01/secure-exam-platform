const http = require('http');

async function testSystem() {
  console.log('=== TESTING SYSTEM ON CORRECT PORTS ===\n');
  
  // Test backend health
  console.log('1. Testing backend on port 4005...');
  try {
    const healthResponse = await makeRequest('GET', 'localhost:4005', '/api/health');
    console.log('Backend health:', healthResponse);
  } catch (error) {
    console.error('Backend test failed:', error.message);
    return;
  }
  
  // Test student login
  console.log('\n2. Testing student login...');
  try {
    const loginResponse = await makeRequest('POST', 'localhost:4005', '/api/auth/login', {
      email: 'test@example.com',
      password: 'Password123!'
    });
    console.log('Login successful:', JSON.parse(loginResponse).user.name);
    
    const token = JSON.parse(loginResponse).accessToken;
    
    // Test student endpoints
    console.log('\n3. Testing student endpoints...');
    
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

testSystem();
