import { pool } from './src/db'

async function createTestExam() {
  const client = await pool.connect()
  try {
    console.log('=== CREATING TEST EXAM ===\n')
    
    // Get test-teacher's course
    const courseResult = await client.query(
      'SELECT id, name FROM courses WHERE teacher_id = $1',
      ['bab06ada-9739-4c73-891e-2ced107ed61a'] // test-teacher ID
    )
    
    if (courseResult.rows.length === 0) {
      console.log('❌ No course found for test-teacher')
      return
    }
    
    const course = courseResult.rows[0]
    console.log('Found course:', course)
    
    // Create exam
    const examResult = await client.query(
      `INSERT INTO exams (title, description, duration_minutes, start_time, end_time, 
                         course_id, teacher_id, is_published, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        'Test Exam for Student API',
        'A test exam to verify student can see published exams',
        60, // 60 minutes
        new Date(), // start now
        new Date(Date.now() + 2 * 60 * 60 * 1000), // end in 2 hours
        course.id,
        'bab06ada-9739-4c73-891e-2ced107ed61a', // test-teacher ID
        true, // published
        'published' // status
      ]
    )
    
    const exam = examResult.rows[0]
    console.log('✅ Created exam:', exam)
    
    // Add a question
    const questionResult = await client.query(
      `INSERT INTO questions (exam_id, question_text, options, correct_answer, type, points)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        exam.id,
        'What is 2 + 2?',
        JSON.stringify(['3', '4', '5', '6']),
        '4',
        'mcq',
        1
      ]
    )
    
    console.log('✅ Created question:', questionResult.rows[0])
    
    // Enroll student in the course
    const studentResult = await client.query(
      'SELECT id FROM users WHERE email = $1',
      ['test@example.com']
    )
    
    if (studentResult.rows.length > 0) {
      const studentId = studentResult.rows[0].id
      
      // Check if already enrolled
      const existingEnrollment = await client.query(
        'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2',
        [course.id, studentId]
      )
      
      if (existingEnrollment.rows.length === 0) {
        await client.query(
          'INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2)',
          [course.id, studentId]
        )
        console.log('✅ Enrolled student in course')
      } else {
        console.log('ℹ️ Student already enrolled in course')
      }
    }
    
    console.log('\n=== TEST EXAM CREATION COMPLETE ===')
    console.log('Student should now be able to see this exam via /api/exams')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

createTestExam()
