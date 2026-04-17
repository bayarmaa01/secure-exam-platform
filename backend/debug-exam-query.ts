import { pool } from './src/db'

async function debugExamQuery() {
  try {
    console.log('=== DEBUGGING EXAM QUERY CONDITIONS ===\n')
    
    // Get all published exams with their details
    console.log('1. ALL PUBLISHED EXAMS:')
    const allExams = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.status,
        e.start_time,
        e.end_time,
        c.name as course_name,
        c.id as course_id
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      WHERE e.status = 'published'
      ORDER BY e.start_time
    `)
    console.table(allExams.rows)
    
    // Get current time
    console.log('\n2. CURRENT TIME:', new Date().toISOString())
    
    // Check each exam against query conditions
    console.log('\n3. EXAM CONDITION CHECK:')
    for (const exam of allExams.rows) {
      const startTime = new Date(exam.start_time)
      const endTime = new Date(exam.end_time)
      const now = new Date()
      
      console.log(`\nExam: ${exam.title}`)
      console.log(`  Status: ${exam.status} ${exam.status === 'published' ? 'PASS' : 'FAIL'}`)
      console.log(`  Start Time: ${exam.start_time} (${startTime <= now ? 'PASS' : 'FAIL'})`)
      console.log(`  End Time: ${exam.end_time} (${endTime >= now ? 'PASS' : 'FAIL'})`)
      console.log(`  Overall: ${exam.status === 'published' && startTime <= now && endTime >= now ? 'PASS' : 'FAIL'}`)
    }
    
    // Test the actual student query without time filters
    console.log('\n4. STUDENT EXAMS QUERY (WITHOUT TIME FILTERS):')
    const studentId = 'b9e88661-12ee-468b-a2d2-6f38be15b43b'
    const examsWithoutTime = await pool.query(`
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
    `, [studentId])
    console.table(examsWithoutTime.rows)
    
  } catch (error) {
    console.error('Debug error:', error)
  } finally {
    await pool.end()
  }
}

debugExamQuery()
