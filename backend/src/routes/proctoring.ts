import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent, requireTeacher } from '../middleware/auth'

const router = Router()

// Student: Report proctoring violation
router.post('/proctoring/track',
  auth,
  requireStudent,
  [
    body('type').isIn(['tab_switch', 'fullscreen_exit', 'camera_off', 'window_blur', 'copy_paste_attempt']).withMessage('Invalid violation type'),
    body('examId').notEmpty().withMessage('Exam ID is required'),
    body('sessionId').optional().isString(),
    body('message').optional().isString()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { type, examId, sessionId, message } = req.body
      const studentId = req.user!.id

      // Verify student has an active attempt for this exam
      const attemptCheck = await pool.query(
        'SELECT id FROM exam_attempts WHERE exam_id = $1 AND user_id = $2 AND status = $3',
        [examId, studentId, 'in_progress']
      )

      if (attemptCheck.rows.length === 0) {
        return res.status(403).json({ message: 'No active exam attempt found' })
      }

      const attemptId = attemptCheck.rows[0].id

      // Store violation in database
      await pool.query(
        `INSERT INTO proctoring_violations (attempt_id, student_id, exam_id, violation_type, session_id, message, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [attemptId, studentId, examId, type, sessionId || null, message || null]
      )

      // Update violation count in attempt
      await pool.query(
        'UPDATE exam_attempts SET violations_count = violations_count + 1 WHERE id = $1',
        [attemptId]
      )

      // Send real-time notification to teachers
      const io = require('../utils/socketHelper').getIO()
      io.emit('proctoring_violation', {
        attemptId,
        studentId,
        examId,
        type,
        timestamp: new Date(),
        studentName: req.user!.name
      })

      res.json({ 
        success: true, 
        message: 'Violation recorded',
        violationCount: (await pool.query('SELECT violations_count FROM exam_attempts WHERE id = $1', [attemptId])).rows[0].violations_count
      })
    } catch (error) {
      console.error('POST /api/proctoring/track - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get violations for an exam
router.get('/proctoring/exams/:examId/violations',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const examId = req.params.examId
      const teacherId = req.user!.id

      // Verify exam belongs to teacher
      const examCheck = await pool.query(
        'SELECT id FROM exams WHERE id = $1 AND teacher_id = $2',
        [examId, teacherId]
      )

      if (examCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied' })
      }

      const violationsResult = await pool.query(
        `SELECT pv.*, u.name as student_name, u.email
         FROM proctoring_violations pv
         JOIN users u ON pv.student_id = u.id
         WHERE pv.exam_id = $1
         ORDER BY pv.timestamp DESC`,
        [examId]
      )

      res.json(violationsResult.rows)
    } catch (error) {
      console.error('GET /api/proctoring/exams/:examId/violations - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student: Get violation count for current attempt
router.get('/proctoring/attempts/:attemptId/violations',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      const attemptId = req.params.attemptId
      const studentId = req.user!.id

      // Verify attempt belongs to student
      const attemptCheck = await pool.query(
        'SELECT id, violations_count FROM exam_attempts WHERE id = $1 AND user_id = $2',
        [attemptId, studentId]
      )

      if (attemptCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Attempt not found' })
      }

      const violationsResult = await pool.query(
        `SELECT violation_type, message, timestamp
         FROM proctoring_violations
         WHERE attempt_id = $1
         ORDER BY timestamp DESC`,
        [attemptId]
      )

      res.json({
        violations_count: attemptCheck.rows[0].violations_count || 0,
        violations: violationsResult.rows
      })
    } catch (error) {
      console.error('GET /api/proctoring/attempts/:attemptId/violations - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

export default router
