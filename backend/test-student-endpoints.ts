import { pool } from './src/db'
import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET || 'dev-secret-change-in-prod'

async function testStudentEndpoints() {
  try {
    console.log('=== TESTING STUDENT ENDPOINTS ===\n')
    
    // Get student user directly from DB
    const studentResult = await pool.query(
      'SELECT id, email, name, role FROM users WHERE email = $1',
      ['test@example.com']
    )
    
    if (studentResult.rows.length === 0) {
      console.error('Student user not found!')
      return
    }
    
    const student = studentResult.rows[0]
    console.log('Found student user:')
    console.table(student)
    
    // Generate token manually
    const token = jwt.sign(
      { userId: student.id, email: student.email, role: student.role },
      secret,
      { expiresIn: '1h' }
    )
    
    console.log('\nGenerated JWT token:', token)
    
    // Test student courses endpoint directly
    console.log('\n=== TESTING STUDENT COURSES QUERY ===')
    const coursesQuery = `
      SELECT 
        c.*,
        e.enrolled_at,
        u.name as teacher_name
      FROM courses c
      JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE e.student_id = $1
      ORDER BY e.enrolled_at DESC
    `
    
    const coursesResult = await pool.query(coursesQuery, [student.id])
    console.log('Student courses query result:')
    console.table(coursesResult.rows)
    
    // Test student exams endpoint directly
    console.log('\n=== TESTING STUDENT EXAMS QUERY ===')
    const examsQuery = `
      SELECT 
        e.*,
        c.name as course_name,
        c.description as course_description,
        u.name as teacher_name,
        (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      JOIN enrollments enrollment ON c.id = enrollment.course_id
      LEFT JOIN users u ON e.teacher_id = u.id
      WHERE enrollment.student_id = $1
        AND e.status = 'published'
      ORDER BY e.start_time ASC
    `
    
    const examsResult = await pool.query(examsQuery, [student.id])
    console.log('Student exams query result:')
    console.table(examsResult.rows)
    
    // Test notifications endpoint directly
    console.log('\n=== TESTING NOTIFICATIONS QUERY ===')
    const notificationsQuery = `
      SELECT 
        n.*,
        u.email as user_email,
        u.name as user_name
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `
    
    const notificationsResult = await pool.query(notificationsQuery, [student.id])
    console.log('Student notifications query result:')
    console.table(notificationsResult.rows)
    
  } catch (error) {
    console.error('Test error:', error)
  } finally {
    await pool.end()
  }
}

testStudentEndpoints()
