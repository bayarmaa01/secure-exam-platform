const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function debugDatabase() {
  console.log('=== DATABASE DEBUG START ===');
  
  try {
    const client = await pool.connect();
    
    // Check users
    console.log('\n--- USERS ---');
    const users = await client.query('SELECT id, name, email, role, registration_number, student_id FROM users ORDER BY created_at DESC LIMIT 10');
    console.log('Users:', JSON.stringify(users.rows, null, 2));
    
    // Check courses
    console.log('\n--- COURSES ---');
    const courses = await client.query('SELECT id, name, teacher_id FROM courses ORDER BY created_at DESC LIMIT 10');
    console.log('Courses:', JSON.stringify(courses.rows, null, 2));
    
    // Check enrollments
    console.log('\n--- ENROLLMENTS ---');
    const enrollments = await client.query(`
      SELECT en.*, u.name as student_name, u.email as student_email, c.name as course_name 
      FROM enrollments en 
      JOIN users u ON en.student_id = u.id 
      JOIN courses c ON en.course_id = c.id 
      ORDER BY en.enrolled_at DESC LIMIT 10
    `);
    console.log('Enrollments:', JSON.stringify(enrollments.rows, null, 2));
    
    // Check exams
    console.log('\n--- EXAMS ---');
    const exams = await client.query(`
      SELECT e.id, e.title, e.course_id, e.teacher_id, e.duration_minutes, e.start_time, c.name as course_name
      FROM exams e 
      LEFT JOIN courses c ON e.course_id = c.id 
      ORDER BY e.created_at DESC LIMIT 10
    `);
    console.log('Exams:', JSON.stringify(exams.rows, null, 2));
    
    // Check questions
    console.log('\n--- QUESTIONS ---');
    const questions = await client.query(`
      SELECT q.id, q.exam_id, q.question_text, e.title as exam_title
      FROM questions q 
      LEFT JOIN exams e ON q.exam_id = e.id 
      ORDER BY q.created_at DESC LIMIT 10
    `);
    console.log('Questions:', JSON.stringify(questions.rows, null, 2));
    
    // Check course student counts
    console.log('\n--- COURSE STUDENT COUNTS ---');
    const courseCounts = await client.query(`
      SELECT c.id, c.name, COUNT(en.student_id) as student_count
      FROM courses c
      LEFT JOIN enrollments en ON c.id = en.course_id
      GROUP BY c.id, c.name
      ORDER BY c.created_at DESC
    `);
    console.log('Course student counts:', JSON.stringify(courseCounts.rows, null, 2));
    
    client.release();
  } catch (error) {
    console.error('Database error:', error);
  }
  
  console.log('\n=== DATABASE DEBUG END ===');
  await pool.end();
}

debugDatabase();
