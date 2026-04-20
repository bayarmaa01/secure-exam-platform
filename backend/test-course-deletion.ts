import { pool } from './src/db'

async function testCourseDeletion() {
  console.log('🧪 Testing Course Deletion...')
  
  const client = await pool.connect()
  
  try {
    // 1. Find a course to test with
    const courseResult = await client.query(`
      SELECT c.id, c.name, c.teacher_id, u.email as teacher_email
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LIMIT 1
    `)
    
    if (courseResult.rows.length === 0) {
      console.log('❌ No courses found to test with')
      return
    }
    
    const course = courseResult.rows[0]
    console.log(`📚 Testing deletion of course: ${course.name} (${course.id})`)
    console.log(`👨‍🏫 Teacher: ${course.teacher_email}`)
    
    // 2. Check what's linked to this course
    const examsResult = await client.query(`
      SELECT id, title FROM exams WHERE course_id = $1
    `, [course.id])
    
    const enrollmentsResult = await client.query(`
      SELECT COUNT(*) as count FROM enrollments WHERE course_id = $1
    `, [course.id])
    
    console.log(`📝 Exams linked: ${examsResult.rows.length}`)
    console.log(`👥 Enrollments: ${enrollmentsResult.rows[0].count}`)
    
    // 3. Check exam-related data
    for (const exam of examsResult.rows) {
      const questionsCount = await client.query(`
        SELECT COUNT(*) as count FROM questions WHERE exam_id = $1
      `, [exam.id])
      
      const attemptsCount = await client.query(`
        SELECT COUNT(*) as count FROM exam_attempts WHERE exam_id = $1
      `, [exam.id])
      
      console.log(`  📋 Exam "${exam.title}": ${questionsCount.rows[0].count} questions, ${attemptsCount.rows[0].count} attempts`)
    }
    
    // 4. Test the actual deletion (simulate the route logic)
    console.log('\n🔄 Testing deletion process...')
    
    await client.query('BEGIN')
    
    try {
      // Delete related records in correct order (same as route)
      for (const exam of examsResult.rows) {
        await client.query('DELETE FROM exam_violations WHERE exam_id = $1', [exam.id])
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
      
    } catch (error) {
      await client.query('ROLLBACK')
      console.error(`\n❌ Course deletion failed:`, error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        where: error.where
      })
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the test
testCourseDeletion().catch(console.error)
