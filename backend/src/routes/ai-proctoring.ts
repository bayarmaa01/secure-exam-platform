import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent } from '../middleware/auth'

const router = Router()

// Student: Send frame for AI analysis
router.post('/analyze-frame',
  auth,
  requireStudent,
  [
    body('attemptId').notEmpty().withMessage('Attempt ID is required'),
    body('frame').notEmpty().withMessage('Frame data is required'),
    body('timestamp').isInt().withMessage('Timestamp must be an integer')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { attemptId, frame, timestamp } = req.body
      const studentId = req.user!.id

      // Verify attempt belongs to student
      const attemptCheck = await pool.query(
        'SELECT id, exam_id FROM exam_attempts WHERE id = $1 AND user_id = $2 AND status = $3',
        [attemptId, studentId, 'in_progress']
      )

      if (attemptCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Attempt not found or not active' })
      }

      const examId = attemptCheck.rows[0].exam_id

      // Simulate AI analysis (in production, this would call actual AI service)
      // For now, we'll do basic checks and randomly detect issues for demo
      const analysisResult = await analyzeFrame(frame, timestamp)

      // Log the analysis
      await pool.query(
        `INSERT INTO proctoring_logs (attempt_id, event_type, event_data, risk_score, timestamp, session_id)
         VALUES ($1, $2, $3, $4, to_timestamp($5/1000), $6)`,
        [
          attemptId,
          'frame_analysis',
          JSON.stringify(analysisResult),
          analysisResult.riskScore,
          timestamp,
          `session_${attemptId}`
        ]
      )

      // If high risk detected, create warning
      if (analysisResult.riskScore >= 70) {
        await pool.query(
          'INSERT INTO warnings (user_id, exam_id, type, message) VALUES ($1, $2, $3, $4)',
          [studentId, examId, analysisResult.violationType, analysisResult.message]
        )

        // Check warning count in last hour
        const warningCount = await pool.query(
          'SELECT COUNT(*) as count FROM warnings WHERE user_id = $1 AND exam_id = $2 AND created_at > NOW() - INTERVAL \'1 hour\'',
          [studentId, examId]
        )

        // Check total warnings for this exam
        const totalWarningsCount = await pool.query(
          'SELECT COUNT(*) as total_count FROM warnings WHERE user_id = $1 AND exam_id = $2',
          [studentId, examId]
        )

        const count = parseInt(warningCount.rows[0].count)
        const totalCount = parseInt(totalWarningsCount.rows[0].total_count)
        
        // 3 warnings in 1 hour = suspicious
        if (count >= 3) {
          // Mark as suspicious but don't auto-submit
          await pool.query(
            'UPDATE exam_attempts SET risk_score = 80 WHERE id = $1',
            [attemptId]
          )

          return res.json({
            success: true,
            analysis: analysisResult,
            warningCount: count,
            totalWarningCount: totalCount,
            suspicious: true,
            message: 'Marked as suspicious due to multiple violations'
          })
        }
        
        // 5 total warnings = cheating + auto-submit
        if (totalCount >= 5) {
          // Auto-submit exam
          await pool.query(
            'UPDATE exam_attempts SET status = \'completed\', submitted_at = NOW(), risk_score = 100 WHERE id = $1',
            [attemptId]
          )

          // Calculate and save score
          const scoreResult = await pool.query(
            `SELECT 
               SUM(points_earned) as total_earned,
               SUM(q.points) as total_points
             FROM answers a
             JOIN questions q ON a.question_id = q.id
             WHERE a.attempt_id = $1`,
            [attemptId]
          )

          const scoreData = scoreResult.rows[0]
          const totalPoints = scoreData.total_points || 0
          const totalEarned = scoreData.total_earned || 0
          const percentage = totalPoints > 0 ? (totalEarned / totalPoints) * 100 : 0

          await pool.query(
            `UPDATE exam_attempts 
             SET score = $1, total_points = $2, percentage = $3
             WHERE id = $4`,
            [totalEarned, totalPoints, percentage, attemptId]
          )

          // Create result record
          await pool.query(
            `INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [studentId, examId, attemptId, totalEarned, totalPoints, percentage, percentage >= 50 ? 'passed' : 'failed']
          )

          return res.json({
            success: true,
            analysis: analysisResult,
            warningCount: count,
            totalWarningCount: totalCount,
            autoSubmitted: true,
            cheating: true,
            message: 'Exam auto-submitted due to excessive violations (cheating detected)'
          })
        }

        return res.json({
          success: true,
          analysis: analysisResult,
          warningCount: count,
          totalWarningCount: totalCount,
          warning: {
            type: analysisResult.violationType,
            message: analysisResult.message,
            count,
            totalCount
          }
        })
      }

      res.json({
        success: true,
        analysis: analysisResult,
        warningCount: 0
      })
    } catch (error) {
      console.error('POST /ai/analyze-frame - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student: Report cheating alert
router.post('/cheating-alert',
  auth,
  requireStudent,
  [
    body('attemptId').notEmpty().withMessage('Attempt ID is required'),
    body('reason').notEmpty().withMessage('Reason is required'),
    body('timestamp').isInt().withMessage('Timestamp must be an integer')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { attemptId, reason, timestamp } = req.body
      const studentId = req.user!.id

      // Verify attempt belongs to student
      const attemptCheck = await pool.query(
        'SELECT id, exam_id FROM exam_attempts WHERE id = $1 AND user_id = $2',
        [attemptId, studentId]
      )

      if (attemptCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Attempt not found' })
      }

      const examId = attemptCheck.rows[0].exam_id

      // Log the cheating alert
      await pool.query(
        `INSERT INTO proctoring_logs (attempt_id, event_type, event_data, risk_score, timestamp, session_id)
         VALUES ($1, $2, $3, $4, to_timestamp($5/1000), $6)`,
        [
          attemptId,
          'cheating_alert',
          JSON.stringify({ reason, timestamp }),
          80, // High risk score for cheating alerts
          timestamp,
          `session_${attemptId}`
        ]
      )

      // Create warning
      await pool.query(
        'INSERT INTO warnings (user_id, exam_id, type, message) VALUES ($1, $2, $3, $4)',
        [studentId, examId, 'cheating_detected', reason]
      )

      res.json({
        success: true,
        message: 'Cheating alert recorded'
      })
    } catch (error) {
      console.error('POST /ai/cheating-alert - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Helper function to analyze frame (simulated AI analysis)
async function analyzeFrame(_frame: string, _timestamp: number): Promise<{
  riskScore: number
  violationType?: string
  message?: string
  faceDetected: boolean
  multipleFaces: boolean
  lookingAway: boolean
}> {
  // In production, this would call actual AI/ML service
  // For now, we'll simulate basic analysis
  
  const random = Math.random()
  let riskScore = 0
  let violationType: string | undefined
  let message: string | undefined

  // Simulate face detection issues
  if (random < 0.1) { // 10% chance of no face detected
    riskScore = 80
    violationType = 'no_face'
    message = 'No face detected in camera feed'
  } else if (random < 0.15) { // 5% chance of multiple faces
    riskScore = 90
    violationType = 'multiple_faces'
    message = 'Multiple faces detected in camera feed'
  } else if (random < 0.2) { // 5% chance of looking away
    riskScore = 60
    violationType = 'looking_away'
    message = 'Student appears to be looking away from screen'
  } else if (random < 0.25) { // 5% chance of talking
    riskScore = 50
    violationType = 'talking'
    message = 'Talking detected during exam'
  }

  return {
    riskScore,
    violationType,
    message,
    faceDetected: violationType !== 'no_face',
    multipleFaces: violationType === 'multiple_faces',
    lookingAway: violationType === 'looking_away'
  }
}

export { router as aiProctoringRoutes }
