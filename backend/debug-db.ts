import { pool } from './src/db'

async function debugDatabase() {
  const client = await pool.connect()
  try {
    console.log('=== DATABASE VERIFICATION ===\n')
    
    // Check users
    const usersResult = await client.query('SELECT id, email, name, role, registration_number, student_id FROM users')
    console.log('USERS:')
    console.table(usersResult.rows)
    
    // Check courses
    const coursesResult = await client.query('SELECT * FROM courses')
    console.log('\nCOURSES:')
    console.table(coursesResult.rows)
    
    // Check enrollments with user info
    const enrollmentsResult = await client.query(`
      SELECT e.id, e.course_id, e.student_id, c.name as course_name, 
             u.email as student_email, u.registration_number, u.name as student_name
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      JOIN users u ON e.student_id = u.id
    `)
    console.log('\nENROLLMENTS:')
    console.table(enrollmentsResult.rows)
    
    // Check exams with course info
    const examsResult = await client.query(`
      SELECT e.id, e.title, e.course_id, e.start_time, e.duration_minutes, e.status, e.is_published,
             c.name as course_name, u.email as teacher_email
      FROM exams e
      LEFT JOIN courses c ON e.course_id = c.id
      LEFT JOIN users u ON e.teacher_id = u.id
    `)
    console.log('\nEXAMS:')
    console.table(examsResult.rows)
    
    // Check questions
    const questionsResult = await client.query(`
      SELECT q.id, q.exam_id, q.question_text, q.points, q.type,
             e.title as exam_title
      FROM questions q
      LEFT JOIN exams e ON q.exam_id = e.id
    `)
    console.log('\nQUESTIONS:')
    console.table(questionsResult.rows)
    
    // Check notifications
    const notificationsResult = await client.query(`
      SELECT n.id, n.user_id, n.title, n.message, n.type, n.read, n.created_at,
             u.email as user_email, u.name as user_name
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC
    `)
    console.log('\nNOTIFICATIONS:')
    console.table(notificationsResult.rows)
    
  } catch (error) {
    console.error('Database error:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

debugDatabase()
