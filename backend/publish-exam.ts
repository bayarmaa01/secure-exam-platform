import { pool } from './src/db'

async function publishExam() {
  const client = await pool.connect()
  try {
    console.log('=== PUBLISHING EXAM FOR STUDENT VISIBILITY ===\n')
    
    // Update the most recent exam to be published
    const result = await client.query(
      `UPDATE exams 
       SET is_published = true, status = 'published'
       WHERE title = 'Notification Test Exam'
       RETURNING *`
    )
    
    if (result.rows.length > 0) {
      console.log('✅ Published exam:', result.rows[0].title)
      console.log('Status:', result.rows[0].status)
      console.log('Is Published:', result.rows[0].is_published)
    } else {
      console.log('❌ Exam not found')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

publishExam()
