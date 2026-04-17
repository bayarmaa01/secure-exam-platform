import { pool } from './src/db'

async function debugExamTimeFilters() {
  try {
    console.log('=== DEBUGGING EXAM TIME FILTERS ===\n')
    
    const studentId = 'b9e88661-12ee-468b-a2d2-6f38be15b43b'
    const now = new Date()
    
    console.log('Current time:', now.toISOString())
    
    // Check the new exam details
    const newExam = await pool.query(`
      SELECT 
        e.*,
        c.name as course_name
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      WHERE e.title LIKE '%Active Test Exam%'
    `)
    
    console.log('\nNew exam details:')
    console.table(newExam.rows)
    
    if (newExam.rows.length > 0) {
      const exam = newExam.rows[0]
      const startTime = new Date(exam.start_time)
      const endTime = new Date(exam.end_time)
      
      console.log('\nTime filter checks:')
      console.log(`Start time: ${exam.start_time} (${startTime <= now ? 'PASS' : 'FAIL'})`)
      console.log(`End time: ${exam.end_time} (${endTime >= now ? 'PASS' : 'FAIL'})`)
      console.log(`Status: ${exam.status} (${exam.status === 'published' ? 'PASS' : 'FAIL'})`)
      
      // Test enrollment
      const enrollmentCheck = await pool.query(`
        SELECT * FROM enrollments 
        WHERE student_id = $1 AND course_id = $2
      `, [studentId, exam.course_id])
      
      console.log('\nEnrollment check:', enrollmentCheck.rows.length > 0 ? 'PASS' : 'FAIL')
      if (enrollmentCheck.rows.length > 0) {
        console.table(enrollmentCheck.rows)
      }
    }
    
    // Test the query step by step
    console.log('\n=== STEP BY STEP QUERY DEBUG ===')
    
    // Step 1: Basic join
    const step1 = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.start_time,
        e.end_time,
        e.status,
        c.name as course_name
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      JOIN enrollments enrollment ON c.id = enrollment.course_id
      WHERE enrollment.student_id = $1
    `, [studentId])
    
    console.log('\nStep 1 - Basic join (student enrolled courses):')
    console.table(step1.rows)
    
    // Step 2: Add published filter
    const step2 = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.start_time,
        e.end_time,
        e.status,
        c.name as course_name
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      JOIN enrollments enrollment ON c.id = enrollment.course_id
      WHERE enrollment.student_id = $1
        AND e.status = 'published'
    `, [studentId])
    
    console.log('\nStep 2 - Add published filter:')
    console.table(step2.rows)
    
    // Step 3: Add start time filter
    const step3 = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.start_time,
        e.end_time,
        e.status,
        c.name as course_name
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      JOIN enrollments enrollment ON c.id = enrollment.course_id
      WHERE enrollment.student_id = $1
        AND e.status = 'published'
        AND e.start_time <= NOW()
    `, [studentId])
    
    console.log('\nStep 3 - Add start time filter:')
    console.table(step3.rows)
    
    // Step 4: Add end time filter
    const step4 = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.start_time,
        e.end_time,
        e.status,
        c.name as course_name
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      JOIN enrollments enrollment ON c.id = enrollment.course_id
      WHERE enrollment.student_id = $1
        AND e.status = 'published'
        AND e.start_time <= NOW()
        AND e.end_time >= NOW()
    `, [studentId])
    
    console.log('\nStep 4 - Add end time filter (FINAL):')
    console.table(step4.rows)
    
  } catch (error) {
    console.error('Debug error:', error)
  } finally {
    await pool.end()
  }
}

debugExamTimeFilters()
