const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testEnrollment() {
  console.log('=== TESTING ENROLLMENT API ===');
  
  try {
    const client = await pool.connect();
    
    // Test data from our database
    const courseId = '640a15b6-c467-437d-8438-407707e59afd'; // Test Course
    const registrationNumber = 'REG2026001'; // Test User (student)
    
    console.log(`Testing enrollment: Course ${courseId}, Registration ${registrationNumber}`);
    
    // Step 1: Find student by registration_number
    const studentCheck = await client.query(
      'SELECT id, name, email, role FROM users WHERE registration_number = $1 AND role = $2',
      [registrationNumber, 'student']
    );
    
    console.log('Student check result:', JSON.stringify(studentCheck.rows, null, 2));
    
    if (studentCheck.rows.length === 0) {
      console.log('ERROR: Student not found with registration number:', registrationNumber);
      return;
    }
    
    const studentUuid = studentCheck.rows[0].id;
    console.log('Found student UUID:', studentUuid);
    
    // Step 2: Check if already enrolled
    const existingEnrollment = await client.query(
      'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2',
      [courseId, studentUuid]
    );
    
    console.log('Existing enrollment check:', JSON.stringify(existingEnrollment.rows, null, 2));
    
    if (existingEnrollment.rows.length > 0) {
      console.log('Student already enrolled');
      return;
    }
    
    // Step 3: Perform enrollment
    console.log('Attempting to enroll student...');
    const enrollResult = await client.query(
      'INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2) RETURNING *',
      [courseId, studentUuid]
    );
    
    console.log('Enrollment successful:', JSON.stringify(enrollResult.rows[0], null, 2));
    
    // Step 4: Verify enrollment
    const verifyEnrollment = await client.query(`
      SELECT en.*, u.name as student_name, u.email as student_email, c.name as course_name 
      FROM enrollments en 
      JOIN users u ON en.student_id = u.id 
      JOIN courses c ON en.course_id = c.id 
      WHERE en.course_id = $1 AND en.student_id = $2
    `, [courseId, studentUuid]);
    
    console.log('Verification result:', JSON.stringify(verifyEnrollment.rows, null, 2));
    
    client.release();
  } catch (error) {
    console.error('Enrollment test error:', error);
  }
  
  await pool.end();
}

testEnrollment();
