import { pool } from './src/db'

async function checkTeacherCourses() {
  const client = await pool.connect()
  try {
    console.log('=== CHECKING TEACHER COURSES ===\n')
    
    // Get test-teacher user ID
    const teacherResult = await client.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      ['test-teacher@example.com']
    )
    
    if (teacherResult.rows.length === 0) {
      console.log('❌ Test teacher not found')
      return
    }
    
    const teacherId = teacherResult.rows[0].id
    console.log('Teacher:', teacherResult.rows[0])
    console.log('Teacher ID:', teacherId)
    
    // Check all courses
    const allCoursesResult = await client.query(`
      SELECT c.*, u.email as teacher_email, u.name as teacher_name
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
    `)
    
    console.log('\nAll courses in database:')
    console.table(allCoursesResult.rows)
    
    // Check courses for this specific teacher
    const teacherCoursesResult = await client.query(
      'SELECT * FROM courses WHERE teacher_id = $1',
      [teacherId]
    )
    
    console.log('\nCourses for test-teacher@example.com:')
    console.table(teacherCoursesResult.rows)
    
    // If teacher has no courses, create one for testing
    if (teacherCoursesResult.rows.length === 0) {
      console.log('\n❌ Test teacher has no courses. Creating a test course...')
      
      const insertResult = await client.query(
        'INSERT INTO courses (name, description, teacher_id) VALUES ($1, $2, $3) RETURNING *',
        ['Test Course for Teacher API', 'A test course for debugging teacher APIs', teacherId]
      )
      
      console.log('✅ Created test course:')
      console.table(insertResult.rows)
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkTeacherCourses()
