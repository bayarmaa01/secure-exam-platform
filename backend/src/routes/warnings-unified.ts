import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { auth, AuthRequest, requireTeacher } from '../middleware/auth'
import { Counter, register } from 'prom-client'
import { pool } from '../db'

const router = Router()

// Prometheus metrics for warnings
const warningsTotal = new Counter({
  name: 'warnings_total',
  help: 'Total warnings triggered during exams',
  labelNames: ['warning_type'],
  registers: [register]
})

const suspiciousStudentsTotal = new Counter({
  name: 'suspicious_students_total',
  help: 'Total students marked as suspicious',
  registers: [register]
})

const cheatingDetectedTotal = new Counter({
  name: 'cheating_detected_total',
  help: 'Total cheating incidents detected',
  labelNames: ['type'],
  registers: [register]
})

// POST /api/warnings - Create warning from proctoring system
router.post('/warnings',
  auth,
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('examId').notEmpty().withMessage('Exam ID is required'),
    body('type').isIn(['tab_switch', 'no_face', 'multiple_faces', 'fullscreen_exit', 'looking_away', 'talking']).withMessage('Invalid warning type'),
    body('message').optional().isString().withMessage('Message must be a string')
  ],
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/warnings - User: ${req.user?.id}`)
    
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array())
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        })
      }

      const { userId, examId, type, message } = req.body

      // Store warning in database
      await pool.query(
        'INSERT INTO warnings (user_id, exam_id, type, message) VALUES ($1, $2, $3, $4)',
        [userId, examId, type, message]
      )

      // Update metrics
      warningsTotal.labels(type).inc()

      // Check if user should be marked as suspicious (3 warnings in 1 hour)
      const recentWarnings = await pool.query(
        'SELECT COUNT(*) as count FROM warnings WHERE user_id = $1 AND exam_id = $2 AND created_at > NOW() - INTERVAL \'1 hour\'',
        [userId, examId]
      )

      const warningCount = parseInt(recentWarnings.rows[0].count)
      
      if (warningCount >= 3) {
        suspiciousStudentsTotal.inc()
        console.log(`⚠️ User ${userId} marked as suspicious (${warningCount} warnings in 1 hour)`)
      }

      // Check if user should be auto-submitted (5 total warnings)
      const totalWarnings = await pool.query(
        'SELECT COUNT(*) as count FROM warnings WHERE user_id = $1 AND exam_id = $2',
        [userId, examId]
      )

      const totalWarningCount = parseInt(totalWarnings.rows[0].count)
      
      if (totalWarningCount >= 5) {
        cheatingDetectedTotal.labels('excessive_warnings').inc()
        
        // Auto-submit the exam
        await pool.query(
          `UPDATE exam_attempts 
           SET status = 'completed', 
               submitted_at = NOW(), 
               risk_score = 100
           WHERE user_id = $1 AND exam_id = $2 AND status = 'in_progress'`,
          [userId, examId]
        )

        console.log(`🚨 User ${userId} auto-submitted due to excessive warnings (${totalWarningCount} total)`)

        return res.json({
          success: true,
          warning: {
            type,
            message,
            count: warningCount,
            totalCount: totalWarningCount
          },
          suspicious: true,
          autoSubmitted: true,
          cheating: true
        })
      }

      console.log(`✅ Warning created: ${type} for user ${userId} in exam ${examId}`)

      res.json({
        success: true,
        warning: {
          type,
          message,
          count: warningCount,
          totalCount: totalWarningCount
        },
        suspicious: warningCount >= 3
      })

    } catch (error) {
      console.error(`[${new Date().toISOString()}] POST /api/warnings - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

// GET /api/warnings - Get warnings for a user/exam
router.get('/warnings',
  auth,
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/warnings - User: ${req.user?.id}`)
    
    try {
      const { userId, examId } = req.query
      
      let query = 'SELECT * FROM warnings WHERE 1=1'
      const params = []
      
      if (userId) {
        query += ' AND user_id = $' + (params.length + 1)
        params.push(userId)
      }
      
      if (examId) {
        query += ' AND exam_id = $' + (params.length + 1)
        params.push(examId)
      }
      
      query += ' ORDER BY created_at DESC'
      
      const result = await pool.query(query, params)
      
      res.json({
        success: true,
        data: result.rows
      })

    } catch (error) {
      console.error(`[${new Date().toISOString()}] GET /api/warnings - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

// GET /api/warnings/stats - Get warning statistics
router.get('/warnings/stats',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/warnings/stats - User: ${req.user?.id}`)
    
    try {
      const teacherId = req.user!.id

      const stats = await pool.query(
        `SELECT 
           w.type,
           COUNT(*) as count,
           COUNT(DISTINCT w.user_id) as unique_users
         FROM warnings w
         JOIN exams e ON w.exam_id = e.id
         WHERE e.teacher_id = $1
         GROUP BY w.type`,
        [teacherId]
      )

      const totalSuspicious = await pool.query(
        `SELECT COUNT(DISTINCT w.user_id) as count
         FROM warnings w
         JOIN exams e ON w.exam_id = e.id
         WHERE e.teacher_id = $1
         AND w.created_at > NOW() - INTERVAL '24 hours'`,
        [teacherId]
      )

      res.json({
        success: true,
        data: {
          byType: stats.rows,
          totalSuspiciousStudents: parseInt(totalSuspicious.rows[0].count),
          period: '24 hours'
        }
      })

    } catch (error) {
      console.error(`[${new Date().toISOString()}] GET /api/warnings/stats - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

export { router as warningsUnifiedRoutes }
