const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'exam_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testAPIEndpoints() {
  console.log('=== TESTING API ENDPOINTS ===');
  
  try {
    const client = await pool.connect();
    
    // Test 1: Teacher courses (should show 1 student)
    console.log('\n--- TEACHER COURSES API ---');
    const teacherId = '7409fc14-df27-4663-8285-2785bdb4ab59';
    const teacherCourses = await client.query(`
      SELECT c.*, 
              COUNT(DISTINCT e.id) as exam_count,
              COUNT(DISTINCT en.student_id) as student_count
       FROM courses c
       LEFT JOIN exams e ON c.id = e.course_id
       LEFT JOIN enrollments en ON c.id = en.course_id
       WHERE c.teacher_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC
    `, [teacherId]);
    
    console.log('Teacher courses API result:', JSON.stringify(teacherCourses.rows, null, 2));
    
    // Test 2: Student courses (should show 1 course)
    console.log('\n--- STUDENT COURSES API ---');
    const studentId = 'b9e88661-12ee-468b-a2d2-6f38be15b43b';
    const studentCourses = await client.query(`
      SELECT c.*, 
              u.name as teacher_name,
              COUNT(DISTINCT e.id) as exam_count
       FROM courses c
       JOIN enrollments en ON c.id = en.course_id
       JOIN users u ON c.teacher_id = u.id
       LEFT JOIN exams e ON c.id = e.course_id
       WHERE en.student_id = $1
       GROUP BY c.id, u.name
       ORDER BY c.created_at DESC
    `, [studentId]);
    
    console.log('Student courses API result:', JSON.stringify(studentCourses.rows, null, 2));
    
    // Test 3: Teacher exams (should show 1 exam with course name)
    console.log('\n--- TEACHER EXAMS API ---');
    const teacherExams = await client.query(`
      SELECT e.id, e.title, e.description, e.duration_minutes, e.start_time, e.status, e.created_at, e.course_id,
              c.name as course_name,
              (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count
       FROM exams e
       LEFT JOIN courses c ON e.course_id = c.id
       WHERE e.teacher_id = $1
       ORDER BY e.created_at DESC
    `, [teacherId]);
    
    const mappedExams = teacherExams.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      durationMinutes: row.duration_minutes,
      startTime: row.start_time,
      status: row.status,
      createdAt: row.created_at,
      courseId: row.course_id,
      courseName: row.course_name,
      questionCount: parseInt(row.question_count) || 0
    }));
    
    console.log('Teacher exams API result (mapped):', JSON.stringify(mappedExams, null, 2));
    
    // Test 4: Teacher students (should show student with registration_number)
    console.log('\n--- TEACHER STUDENTS API ---');
    const teacherStudents = await client.query(`
      SELECT id, name, email, registration_number, student_id, role, created_at
      FROM users 
      WHERE role = 'student' 
      ORDER BY created_at DESC
    `);
    
    console.log('Teacher students API result:', JSON.stringify(teacherStudents.rows, null, 2));
    
    client.release();
  } catch (error) {
    console.error('API test error:', error);
  }
  
  await pool.end();
}

testAPIEndpoints();
