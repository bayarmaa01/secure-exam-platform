import { pool } from '../db'

// Auto-update exam status based on time
export async function updateExamStatuses() {
  console.log(`[${new Date().toISOString()}] Updating exam statuses...`)
  
  try {
    // Update exams that should be ongoing
    const ongoingResult = await pool.query(
      `UPDATE exams 
       SET status = 'ongoing' 
       WHERE status = 'published' 
       AND start_time <= NOW() 
       AND end_time > NOW()`
    )
    
    // Update exams that should be completed
    const completedResult = await pool.query(
      `UPDATE exams 
       SET status = 'completed' 
       WHERE status IN ('published', 'ongoing') 
       AND end_time <= NOW()`
    )
    
    // Auto-submit any in-progress attempts for completed exams
    const autoSubmitResult = await pool.query(
      `UPDATE exam_attempts 
       SET submitted_at = NOW(), 
           status = 'submitted'
       FROM exams 
       WHERE exam_attempts.exam_id = exams.id 
       AND exam_attempts.status = 'in_progress' 
       AND exams.end_time <= NOW()
       RETURNING exam_attempts.id, exam_attempts.user_id, exam_attempts.exam_id`
    )
    
    // Calculate scores for auto-submitted attempts
    for (const attempt of autoSubmitResult.rows) {
      await calculateAndSaveScore(attempt.id, attempt.user_id, attempt.exam_id)
    }
    
    console.log(`Updated ${ongoingResult.rowCount} exams to ongoing`)
    console.log(`Updated ${completedResult.rowCount} exams to completed`)
    console.log(`Auto-submitted ${autoSubmitResult.rowCount} attempts`)
    
  } catch (error) {
    console.error('Error updating exam statuses:', error)
  }
}

// Calculate and save score for an attempt
async function calculateAndSaveScore(attemptId: string, userId: string, examId: string) {
  try {
    // Get all answers for this attempt
    const answersResult = await pool.query(
      `SELECT a.question_id, a.answer, q.correct_answer, q.points
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.attempt_id = $1`,
      [attemptId]
    )
    
    let totalPoints = 0
    let earnedPoints = 0
    
    for (const answer of answersResult.rows) {
      totalPoints += answer.points
      if (answer.answer === answer.correct_answer) {
        earnedPoints += answer.points
      }
    }
    
    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
    
    // Update attempt with score
    await pool.query(
      `UPDATE exam_attempts 
       SET score = $1, 
           total_points = $2, 
           percentage = $3,
           answers = COALESCE(answers, '{}'::jsonb)
       WHERE id = $4`,
      [earnedPoints, totalPoints, percentage, attemptId]
    )
    
    // Create result record
    await pool.query(
      `INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (attempt_id) DO UPDATE SET
         score = EXCLUDED.score,
         total_points = EXCLUDED.total_points,
         percentage = EXCLUDED.percentage,
         status = EXCLUDED.status,
         graded_at = NOW()`,
      [userId, examId, attemptId, earnedPoints, totalPoints, percentage, percentage >= 50 ? 'passed' : 'failed']
    )
    
    console.log(`Auto-submitted attempt ${attemptId}: ${earnedPoints}/${totalPoints} (${percentage.toFixed(2)}%)`)
    
  } catch (error) {
    console.error(`Error calculating score for attempt ${attemptId}:`, error)
  }
}

// Schedule the job to run every minute
export function startExamStatusUpdater() {
  console.log('Starting exam status updater (runs every minute)')
  
  // Run immediately
  updateExamStatuses()
  
  // Then run every minute
  setInterval(updateExamStatuses, 60000)
}
