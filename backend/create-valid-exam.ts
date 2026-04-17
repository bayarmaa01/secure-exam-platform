import { pool } from './src/db'

async function createValidExam() {
  try {
    console.log('=== CREATING VALID EXAM FOR TESTING ===\n')
    
    // Get existing course and teacher
    const courseResult = await pool.query(`
      SELECT c.id, c.name, u.id as teacher_id, u.email 
      FROM courses c 
      JOIN users u ON c.teacher_id = u.id 
      WHERE c.name LIKE '%Teacher API%'
      LIMIT 1
    `)
    
    if (courseResult.rows.length === 0) {
      console.error('No suitable course found!')
      return
    }
    
    const course = courseResult.rows[0]
    console.log('Using course:', course)
    
    // Create exam with future dates (2 hours from now)
    const startTime = new Date()
    startTime.setHours(startTime.getHours() + 1) // Start in 1 hour
    
    const endTime = new Date(startTime)
    endTime.setHours(endTime.getHours() + 2) // Duration: 2 hours
    
    const examResult = await pool.query(`
      INSERT INTO exams (
        title, 
        description, 
        type, 
        duration_minutes, 
        start_time, 
        end_time, 
        difficulty, 
        total_marks, 
        passing_marks, 
        is_published, 
        course_id, 
        teacher_id, 
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *
    `, [
      'Active Test Exam for Student Dashboard',
      'This exam should appear in student dashboard',
      'mcq',
      120, // 2 hours
      startTime.toISOString(),
      endTime.toISOString(),
      'medium',
      100,
      50,
      true,
      course.id,
      course.teacher_id,
      'published'
    ])
    
    const exam = examResult.rows[0]
    console.log('Created exam:', exam)
    
    // Add a question to the exam
    const questionResult = await pool.query(`
      INSERT INTO questions (
        exam_id, 
        question_text, 
        options, 
        correct_answer, 
        type, 
        points
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      ) RETURNING *
    `, [
      exam.id,
      'What is 2 + 2?',
      JSON.stringify(['3', '4', '5', '6']),
      '4',
      'mcq',
      1
    ])
    
    console.log('Added question:', questionResult.rows[0])
    
    // Create notification for the student
    const studentResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['test@example.com']
    )
    
    if (studentResult.rows.length > 0) {
      await pool.query(`
        INSERT INTO notifications (
          user_id, 
          title, 
          message, 
          type, 
          data
        ) VALUES (
          $1, $2, $3, $4, $5
        )
      `, [
        studentResult.rows[0].id,
        'New Exam Available',
        `New exam "${exam.title}" is now available in your course "${course.name}".`,
        'exam_created',
        JSON.stringify({ examId: exam.id, courseId: course.id })
      ])
      
      console.log('Created notification for student')
    }
    
    console.log('\n=== VALID EXAM CREATION COMPLETED ===')
    console.log('Exam start time:', startTime.toISOString())
    console.log('Exam end time:', endTime.toISOString())
    console.log('Current time:', new Date().toISOString())
    
  } catch (error) {
    console.error('Error creating exam:', error)
  } finally {
    await pool.end()
  }
}

createValidExam()
