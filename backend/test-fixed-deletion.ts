import { pool } from './src/db'

async function testFixedCourseDeletion() {
  console.log('🧪 Testing FIXED Course Deletion...')
  
  const client = await pool.connect()
  
  try {
    // 1. Create a test course with exam
    console.log('📝 Creating test course and exam...')
    
    // Create test user (teacher)
    const teacherResult = await client.query(`
      INSERT INTO users (email, name, role, registration_number)
      VALUES ('test-teacher@example.com', 'Test Teacher', 'teacher', 'TCH001')
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `)
    
    let teacherId = teacherResult.rows[0]?.id
    if (!teacherId) {
      const existingTeacher = await client.query(
        'SELECT id FROM users WHERE email = $1', ['test-teacher@example.com']
      )
      teacherId = existingTeacher.rows[0].id
    }
    
    // Create test course
    const courseResult = await client.query(`
      INSERT INTO courses (name, description, teacher_id)
      VALUES ('Test Course for Deletion', 'This will be deleted', $1)
      RETURNING *
    `, [teacherId])
    
    const course = courseResult.rows[0]
    console.log(`📚 Created course: ${course.name} (${course.id})`)
    
    // Create test exam
    const examResult = await client.query(`
      INSERT INTO exams (title, description, duration_minutes, start_time, end_time, course_id, teacher_id)
      VALUES (
        'Test Exam for Deletion',
        'This exam will be deleted',
        60,
        NOW() - INTERVAL '1 hour',
        NOW() + INTERVAL '1 hour',
        $1, $2
      )
      RETURNING *
    `, [course.id, teacherId])
    
    const exam = examResult.rows[0]
    console.log(`📝 Created exam: ${exam.title} (${exam.id})`)
    
    // Create test question
    await client.query(`
      INSERT INTO questions (exam_id, question_text, type, points, correct_answer, options)
      VALUES ($1, 'What is 2+2?', 'mcq', 10, '2', '["1", "2", "3", "4"]')
    `, [exam.id])
    console.log(`📋 Created question for exam`)
    
    // Create test enrollment
    const studentResult = await client.query(`
      INSERT INTO users (email, name, role, registration_number)
      VALUES ('test-student@example.com', 'Test Student', 'student', 'STU001')
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `)
    
    let studentId = studentResult.rows[0]?.id
    if (!studentId) {
      const existingStudent = await client.query(
        'SELECT id FROM users WHERE email = $1', ['test-student@example.com']
      )
      studentId = existingStudent.rows[0].id
    }
    
    await client.query(`
      INSERT INTO enrollments (course_id, student_id)
      VALUES ($1, $2)
      ON CONFLICT (course_id, student_id) DO NOTHING
    `, [course.id, studentId])
    console.log(`👥 Created enrollment`)
    
    // 2. Verify data exists
    const verifyResult = await client.query(`
      SELECT 
        c.id as course_id,
        COUNT(DISTINCT e.id) as exam_count,
        COUNT(DISTINCT q.id) as question_count,
        COUNT(DISTINCT en.id) as enrollment_count
      FROM courses c
      LEFT JOIN exams e ON c.id = e.course_id
      LEFT JOIN questions q ON e.id = q.exam_id
      LEFT JOIN enrollments en ON c.id = en.course_id
      WHERE c.id = $1
      GROUP BY c.id
    `, [course.id])
    
    const verify = verifyResult.rows[0]
    console.log(`\n📊 Verification before deletion:`)
    console.log(`  - Exams: ${verify.exam_count}`)
    console.log(`  - Questions: ${verify.question_count}`)
    console.log(`  - Enrollments: ${verify.enrollment_count}`)
    
    // 3. Test deletion using fixed route logic
    console.log(`\n🔄 Testing deletion process...`)
    
    await client.query('BEGIN')
    
    try {
      // Get all exams in this course
      const examsInCourse = await client.query(
        'SELECT id, title FROM exams WHERE course_id = $1',
        [course.id]
      )
      
      // Delete related records in correct order (FIXED VERSION)
      for (const exam of examsInCourse.rows) {
        // Note: exam_violations table doesn't exist in current schema
        await client.query('DELETE FROM exam_sessions WHERE exam_id = $1', [exam.id])
        await client.query('DELETE FROM exam_attempts WHERE exam_id = $1', [exam.id])
        await client.query('DELETE FROM results WHERE exam_id = $1', [exam.id])
        await client.query('DELETE FROM questions WHERE exam_id = $1', [exam.id])
        console.log(`  ✅ Deleted exam data for: ${exam.title}`)
      }
      
      // Delete exams
      await client.query('DELETE FROM exams WHERE course_id = $1', [course.id])
      console.log(`  ✅ Deleted exams`)
      
      // Delete enrollments
      const enrollmentDelete = await client.query('DELETE FROM enrollments WHERE course_id = $1', [course.id])
      console.log(`  ✅ Deleted ${enrollmentDelete.rowCount} enrollments`)
      
      // Delete notifications
      await client.query('DELETE FROM notifications WHERE course_id = $1', [course.id])
      console.log(`  ✅ Deleted notifications`)
      
      // Delete course
      const courseDelete = await client.query('DELETE FROM courses WHERE id = $1', [course.id])
      
      if (courseDelete.rowCount === 0) {
        throw new Error('Course not found during deletion')
      }
      
      await client.query('COMMIT')
      console.log(`\n✅ Course deletion successful!`)
      
      // 4. Verify deletion
      const afterDeleteCheck = await client.query(
        'SELECT COUNT(*) as count FROM courses WHERE id = $1',
        [course.id]
      )
      
      if (afterDeleteCheck.rows[0].count == 0) {
        console.log(`✅ Course successfully deleted from database`)
      } else {
        console.log(`❌ Course still exists in database`)
      }
      
    } catch (error) {
      await client.query('ROLLBACK')
      console.error(`\n❌ Course deletion failed:`, error)
      throw error
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

// Run test
testFixedCourseDeletion().catch(console.error)
