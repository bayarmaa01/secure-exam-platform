import { Router } from 'express'
import { pool } from '../db'

const router = Router()

// Test endpoint to check current state of exam attempts
router.get('/test/attempts/:examId', async (req, res) => {
  try {
    const { examId } = req.params
    
    // Get all attempts for this exam
    const attemptsResult = await pool.query(`
      SELECT 
        ea.id,
        ea.user_id,
        ea.status,
        ea.score,
        ea.total_points,
        ea.percentage,
        ea.submitted_at,
        ea.started_at,
        u.name as student_name,
        u.email as student_email
      FROM exam_attempts ea
      JOIN users u ON u.id = ea.user_id
      WHERE ea.exam_id = $1
      ORDER BY ea.started_at DESC
    `, [examId])

    res.json({
      examId,
      totalAttempts: attemptsResult.rows.length,
      attempts: attemptsResult.rows
    })
  } catch (error) {
    console.error('Test attempts error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Test endpoint to force submit an attempt (for testing only)
router.post('/test/submit/:attemptId', async (req, res) => {
  try {
    const { attemptId } = req.params
    
    // Get attempt details
    const attemptResult = await pool.query(`
      SELECT * FROM exam_attempts WHERE id = $1
    `, [attemptId])

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ message: 'Attempt not found' })
    }

    const attempt = attemptResult.rows[0]
    
    // Update attempt to submitted status
    await pool.query(`
      UPDATE exam_attempts 
      SET status = 'submitted',
          submitted_at = NOW(),
          score = COALESCE(score, 0),
          total_points = COALESCE(total_points, 100),
          percentage = COALESCE(percentage, 0)
      WHERE id = $1
    `, [attemptId])

    // Create result record
    await pool.query(`
      INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      attempt.user_id,
      attempt.exam_id,
      attemptId,
      attempt.score || 0,
      attempt.total_points || 100,
      attempt.percentage || 0,
      (attempt.percentage || 0) >= 50 ? 'passed' : 'failed'
    ])

    res.json({
      success: true,
      message: 'Attempt submitted successfully',
      attemptId,
      previousStatus: attempt.status,
      newStatus: 'submitted'
    })
  } catch (error) {
    console.error('Test submit error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export default router
