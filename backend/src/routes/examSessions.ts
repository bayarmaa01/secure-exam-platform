import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent } from '../middleware/auth'
import { 
  activeExamSessions, 
  examStartedTotal, 
  examSubmittedTotal, 
  examForceSubmittedTotal, 
  examViolationsTotal,
  incrementExamStarted,
  incrementExamSubmitted,
  incrementExamForceSubmitted,
  incrementExamViolations,
  setActiveExamSessions
} from '../metrics/examMetrics'

const router = Router()

// Start exam session
router.post('/sessions',
  auth,
  requireStudent,
  [
    body('exam_id').notEmpty().withMessage('Exam ID is required'),
    body('course_id').notEmpty().withMessage('Course ID is required')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { exam_id, course_id } = req.body
      const userId = req.user!.id

      // Check if user already has an active session
      const existingSession = await pool.query(
        'SELECT id FROM exam_sessions WHERE user_id = $1 AND end_time IS NULL',
        [userId]
      )

      if (existingSession.rows.length > 0) {
        return res.status(409).json({ message: 'User already has an active exam session' })
      }

      // Get exam details
      const examResult = await pool.query(
        'SELECT * FROM exams WHERE id = $1 AND status = $2',
        [exam_id, 'published']
      )

      if (examResult.rows.length === 0) {
        return res.status(404).json({ message: 'Exam not found or not available' })
      }

      const exam = examResult.rows[0]
      const now = new Date()
      const endTime = new Date(now.getTime() + exam.duration_minutes * 60 * 1000)

      // Create exam session
      const sessionResult = await pool.query(
        `INSERT INTO exam_sessions 
         (exam_id, user_id, course_id, start_time, end_time, server_time, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
         RETURNING *`,
        [exam_id, userId, course_id, now, endTime, now]
      )

      const session = sessionResult.rows[0]

      // Track metrics
      incrementExamStarted(examId, courseId)
      setActiveExamSessions(1, examId, courseId)

      // Get exam questions
      const questionsResult = await pool.query(
        'SELECT * FROM questions WHERE exam_id = $1 ORDER BY id',
        [exam_id]
      )

      // Emit real-time event
      const io = getIO()
      io.emit('exam_started', {
        session_id: session.id,
        exam_id,
        user_id: userId,
        start_time: session.start_time,
        end_time: session.end_time,
        questions: questionsResult.rows
      })

      res.json({
        session_id: session.id,
        exam_id,
        start_time: session.start_time,
        end_time: session.end_time,
        server_time: session.server_time,
        questions: questionsResult.rows,
        duration_minutes: exam.duration_minutes
      })
    } catch (error) {
      console.error('Failed to start exam session:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Get current session status
router.get('/sessions/:sessionId',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params
      const userId = req.user!.id

      const sessionResult = await pool.query(
        `SELECT es.*, e.title as exam_title, e.duration_minutes
         FROM exam_sessions es
         JOIN exams e ON es.exam_id = e.id
         WHERE es.id = $1 AND es.user_id = $2`,
        [sessionId, userId]
      )

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ message: 'Session not found' })
      }

      const session = sessionResult.rows[0]
      const now = new Date()
      const endTime = new Date(session.end_time)
      const remainingTime = Math.max(0, endTime.getTime() - now.getTime())

      res.json({
        session_id: session.id,
        exam_id: session.exam_id,
        exam_title: session.exam_title,
        start_time: session.start_time,
        end_time: session.end_time,
        remaining_time_ms: remainingTime,
        status: session.status,
        server_time: session.server_time
      })
    } catch (error) {
      console.error('Failed to get session status:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Submit exam
router.post('/sessions/:sessionId/submit',
  auth,
  requireStudent,
  [
    body('answers').isArray().withMessage('Answers array is required'),
    body('violation_count').optional().isInt().withMessage('Violation count must be integer')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { sessionId } = req.params
      const { answers, violation_count = 0 } = req.body
      const userId = req.user!.id

      // Get session details
      const sessionResult = await pool.query(
        'SELECT * FROM exam_sessions WHERE id = $1 AND user_id = $2 AND end_time IS NULL',
        [sessionId, userId]
      )

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ message: 'Session not found or already submitted' })
      }

      const session = sessionResult.rows[0]

      // Calculate score
      let score = 0
      let totalPoints = 0

      for (const answer of answers) {
        const questionResult = await pool.query(
          'SELECT * FROM questions WHERE id = $1',
          [answer.question_id]
        )

        if (questionResult.rows.length > 0) {
          const question = questionResult.rows[0]
          totalPoints += question.points || 1

          if (answer.selected_answer === question.correct_answer) {
            score += question.points || 1
          }
        }
      }

      const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0

      // Update session
      await pool.query(
        `UPDATE exam_sessions 
         SET end_time = NOW(), 
             status = 'submitted',
             answers = $1,
             score = $2,
             percentage = $3,
             violation_count = $4,
             submitted_at = NOW()
         WHERE id = $5`,
        [JSON.stringify(answers), score, percentage, violation_count, sessionId]
      )

      // Track metrics
      incrementExamSubmitted(session.exam_id, session.course_id, userId)
      setActiveExamSessions(-1, session.exam_id, session.course_id)

      // Emit real-time event
      const io = getIO()
      io.emit('exam_submitted', {
        session_id: sessionId,
        exam_id: session.exam_id,
        user_id: userId,
        score,
        percentage,
        violation_count,
        submitted_at: new Date()
      })

      res.json({
        message: 'Exam submitted successfully',
        score,
        percentage,
        violation_count
      })
    } catch (error) {
      console.error('Failed to submit exam:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Force submit (teacher action)
router.post('/sessions/:sessionId/force-submit',
  auth,
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params
      const userId = req.user!.id

      // Verify teacher owns the exam
      const sessionResult = await pool.query(
        `SELECT es.*, e.teacher_id
         FROM exam_sessions es
         JOIN exams e ON es.exam_id = e.id
         WHERE es.id = $1`,
        [sessionId]
      )

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ message: 'Session not found' })
      }

      const session = sessionResult.rows[0]

      // Only teacher who created the exam can force submit
      if (session.teacher_id !== userId) {
        return res.status(403).json({ message: 'Not authorized to force submit this exam' })
      }

      // Force submit with current answers (auto-score 0)
      await pool.query(
        `UPDATE exam_sessions 
         SET end_time = NOW(), 
             status = 'force_submitted',
             score = 0,
             percentage = 0,
             submitted_at = NOW()
         WHERE id = $1`,
        [sessionId]
      )

      // Track metrics
      incrementExamForceSubmitted(session.exam_id, session.course_id, userId)
      setActiveExamSessions(-1, session.exam_id, session.course_id)

      // Emit real-time event
      const io = getIO()
      io.emit('force_submit', {
        session_id: sessionId,
        exam_id: session.exam_id,
        user_id: session.user_id,
        reason: 'Teacher forced submission'
      })

      res.json({ message: 'Exam force submitted successfully' })
    } catch (error) {
      console.error('Failed to force submit exam:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Record violation
router.post('/sessions/:sessionId/violations',
  auth,
  requireStudent,
  [
    body('type').isIn(['tab_switch', 'fullscreen_exit', 'copy_paste', 'right_click']).withMessage('Invalid violation type'),
    body('details').optional().isString().withMessage('Details must be string'),
    body('timestamp').isISO8601().withMessage('Timestamp must be valid ISO8601')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { sessionId } = req.params
      const { type, details, timestamp } = req.body
      const userId = req.user!.id

      // Verify session belongs to user
      const sessionResult = await pool.query(
        'SELECT * FROM exam_sessions WHERE id = $1 AND user_id = $2 AND end_time IS NULL',
        [sessionId, userId]
      )

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ message: 'Session not found' })
      }

      // Record violation
      await pool.query(
        `INSERT INTO exam_violations (session_id, user_id, type, details, timestamp, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [sessionId, userId, type, details, timestamp]
      )

      // Update session violation count
      await pool.query(
        'UPDATE exam_sessions SET violation_count = violation_count + 1 WHERE id = $1',
        [sessionId]
      )

      // Track metrics
      incrementExamViolations(type, sessionResult.rows[0].exam_id, sessionResult.rows[0].course_id, userId)

      // Emit real-time event
      const io = getIO()
      io.emit('violation_detected', {
        session_id: sessionId,
        user_id: userId,
        type,
        details,
        timestamp
      })

      res.json({ message: 'Violation recorded successfully' })
    } catch (error) {
      console.error('Failed to record violation:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Get active sessions for monitoring
router.get('/sessions/active',
  auth,
  async (req: AuthRequest, res) => {
    try {
      const activeSessions = await pool.query(
        `SELECT es.*, e.title as exam_title, u.name as student_name, u.email as student_email
         FROM exam_sessions es
         JOIN exams e ON es.exam_id = e.id
         JOIN users u ON es.user_id = u.id
         WHERE es.end_time IS NULL
         ORDER BY es.start_time DESC`,
        []
      )

      res.json(activeSessions.rows)
    } catch (error) {
      console.error('Failed to get active sessions:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

export { router as examSessionRoutes }
