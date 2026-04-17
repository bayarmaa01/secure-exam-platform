import { Router } from 'express'
import { auth, AuthRequest, requireTeacher } from '../middleware/auth'
import { pool } from '../db'

const router = Router()

// Teacher: Get monitoring data
router.get('/monitoring/warnings',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const teacherId = req.user!.id

      const warnings = await pool.query(`
        SELECT 
          w.id,
          w.type,
          w.message,
          w.created_at,
          u.name as student_name,
          u.email as student_email,
          e.title as exam_title,
          e.id as exam_id
        FROM warnings w
        JOIN users u ON w.user_id = u.id
        JOIN exams e ON w.exam_id = e.id
        WHERE e.teacher_id = $1
        ORDER BY w.created_at DESC
        LIMIT 100
      `, [teacherId])

      res.json({
        warnings: warnings.rows,
        total: warnings.rows.length
      })
    } catch (error) {
      console.error('GET /monitoring/warnings - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get active exam sessions
router.get('/monitoring/sessions',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const teacherId = req.user!.id

      const sessions = await pool.query(`
        SELECT 
          ea.id,
          ea.started_at,
          ea.status,
          u.name as student_name,
          u.email as student_email,
          e.title as exam_title,
          e.id as exam_id
        FROM exam_attempts ea
        JOIN users u ON ea.user_id = u.id
        JOIN exams e ON ea.exam_id = e.id
        WHERE e.teacher_id = $1 AND ea.status = 'in_progress'
        ORDER BY ea.started_at DESC
      `, [teacherId])

      const activeSessions = sessions.rows.map(session => ({
        id: session.id,
        studentName: session.student_name,
        studentEmail: session.student_email,
        examTitle: session.exam_title,
        examId: session.exam_id,
        status: session.status,
        startedAt: session.started_at,
        duration: Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000)
      }))

      res.json({
        sessions: activeSessions,
        total: activeSessions.length
      })
    } catch (error) {
      console.error('GET /monitoring/sessions - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Send notification to student
router.post('/monitoring/notify',
  auth,
  requireTeacher,
  [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('message').notEmpty().withMessage('Message is required')
  ],
  async (req: AuthRequest, res) => {
    try {
      const { studentId, message } = req.body
      const teacherId = req.user!.id

      // Verify student exists and teacher has access
      const studentCheck = await pool.query(
        'SELECT u.id, u.name FROM users u JOIN enrollments en ON u.id = en.student_id JOIN exams e ON en.course_id = e.course_id WHERE e.teacher_id = $1 AND u.id = $1',
        [teacherId, studentId]
      )

      if (studentCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Student not found or no access' })
      }

      // Create notification
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [studentId, 'Teacher Notification', message, 'teacher_alert', new Date()]
      )

      res.json({
        message: 'Notification sent successfully'
      })
    } catch (error) {
      console.error('POST /monitoring/notify - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

export { router as monitoringRoutes }
