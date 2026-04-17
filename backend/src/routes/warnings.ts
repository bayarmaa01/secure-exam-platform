import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { Counter } from 'prom-client'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent } from '../middleware/auth'

// Import Prometheus metrics (will be available via app.get('io'))
let warningsTotal: Counter<string> | null = null
let tabSwitchTotal: Counter<string> | null = null
let faceNotDetectedTotal: Counter<string> | null = null

const router = Router()

// Student: Report warning (tab switch, fullscreen exit, etc.)
router.post('/warnings',
  auth,
  requireStudent,
  [
    body('exam_id').notEmpty().withMessage('Exam ID is required'),
    body('type').notEmpty().withMessage('Warning type is required'),
    body('message').optional()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { exam_id, type, message } = req.body
      const studentId = req.user!.id

      // Get Prometheus metrics from app
      const metrics = req.app.get('metrics') as {
        warningsTotal?: { inc: (labels?: Record<string, string>) => void },
        tabSwitchTotal?: { inc: (labels?: Record<string, string>) => void },
        faceNotDetectedTotal?: { inc: (labels?: Record<string, string>) => void }
      }
      
      if (metrics.warningsTotal) warningsTotal = metrics.warningsTotal
      if (metrics.tabSwitchTotal) tabSwitchTotal = metrics.tabSwitchTotal
      if (metrics.faceNotDetectedTotal) faceNotDetectedTotal = metrics.faceNotDetectedTotal

      // Verify student is enrolled in exam
      const enrollmentCheck = await pool.query(
        'SELECT 1 FROM enrollments en JOIN exams e ON en.course_id = e.course_id WHERE e.id = $1 AND en.student_id = $2',
        [exam_id, studentId]
      )

      if (enrollmentCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Not enrolled in this exam' })
      }

      // Store warning
      await pool.query(
        'INSERT INTO warnings (user_id, exam_id, type, message) VALUES ($1, $2, $3, $4)',
        [studentId, exam_id, type, message || `${type} detected`]
      )

      // Increment Prometheus metrics
      if (warningsTotal) warningsTotal.labels({ warning_type: type }).inc()
      if (tabSwitchTotal && type === 'tab_switch') tabSwitchTotal.inc()
      if (faceNotDetectedTotal && type === 'face_not_detected') faceNotDetectedTotal.inc()

      // Check if this is the 3rd warning
      const recentWarnings = await pool.query(
        'SELECT COUNT(*) as count FROM warnings WHERE user_id = $1 AND exam_id = $2 AND created_at > NOW() - INTERVAL \'1 hour\'',
        [studentId, exam_id]
      )

      const warningCount = parseInt(recentWarnings.rows[0].count)
      
      // Auto-submit exam after 3 warnings
      if (warningCount >= 3) {
        await pool.query(
          'UPDATE exam_attempts SET status = \'completed\', submitted_at = NOW() WHERE user_id = $1 AND exam_id = $2 AND status = \'in_progress\'',
          [studentId, exam_id]
        )

        return res.json({
          message: 'Warning recorded and exam auto-submitted due to multiple violations',
          warningCount,
          autoSubmitted: true
        })
      }

      res.json({
        message: 'Warning recorded successfully',
        warningCount,
        autoSubmitted: false
      })
    } catch (error) {
      console.error('POST /api/warnings - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student: Get warnings for an exam
router.get('/warnings/:examId',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      const examId = req.params.examId
      const studentId = req.user!.id

      const warnings = await pool.query(
        'SELECT type, message, created_at FROM warnings WHERE user_id = $1 AND exam_id = $2 ORDER BY created_at DESC',
        [studentId, examId]
      )

      res.json({
        warnings: warnings.rows,
        count: warnings.rows.length
      })
    } catch (error) {
      console.error('GET /api/warnings/:examId - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

export { router as warningRoutes }
