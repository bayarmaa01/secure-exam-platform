import { Router } from 'express'
import { body } from 'express-validator'
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

// Teacher: Get dashboard statistics
router.get('/monitoring/dashboard-stats',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const teacherId = req.user!.id

      // Get active exams count
      const activeExamsResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM exams 
        WHERE teacher_id = $1 
        AND status = 'ongoing'
      `, [teacherId])

      // Get total submissions today
      const submissionsResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        WHERE e.teacher_id = $1 
        AND DATE(ea.submitted_at) = CURRENT_DATE
      `, [teacherId])

      // Get warnings rate (warnings per 100 submissions in last 24h)
      const warningsResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM warnings w
        JOIN exams e ON w.exam_id = e.id
        WHERE e.teacher_id = $1 
        AND w.created_at >= NOW() - INTERVAL '24 hours'
      `, [teacherId])

      const totalSubmissions24h = await pool.query(`
        SELECT COUNT(*) as count 
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        WHERE e.teacher_id = $1 
        AND ea.submitted_at >= NOW() - INTERVAL '24 hours'
      `, [teacherId])

      const warningsRate = totalSubmissions24h.rows[0].count > 0 
        ? (warningsResult.rows[0].count / totalSubmissions24h.rows[0].count) * 100 
        : 0

      // Get cheating incidents (high risk violations)
      const cheatingResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM warnings w
        JOIN exams e ON w.exam_id = e.id
        WHERE e.teacher_id = $1 
        AND w.type IN ('tab_switch', 'face_not_detected', 'multiple_faces')
        AND w.created_at >= NOW() - INTERVAL '24 hours'
      `, [teacherId])

      // Get suspicious students (students with multiple violations)
      const suspiciousStudentsResult = await pool.query(`
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        JOIN warnings w ON u.id = w.user_id
        JOIN exams e ON w.exam_id = e.id
        WHERE e.teacher_id = $1 
        AND w.created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY u.id
        HAVING COUNT(w.id) >= 3
      `, [teacherId])

      // Get average score
      const avgScoreResult = await pool.query(`
        SELECT AVG(ea.percentage) as avg_score
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        WHERE e.teacher_id = $1 
        AND ea.percentage IS NOT NULL
        AND ea.submitted_at >= NOW() - INTERVAL '7 days'
      `, [teacherId])

      res.json({
        activeExams: parseInt(activeExamsResult.rows[0].count),
        totalSubmissions: parseInt(submissionsResult.rows[0].count),
        warningsRate: Math.round(warningsRate * 100) / 100,
        cheatingIncidents: parseInt(cheatingResult.rows[0].count),
        suspiciousStudents: parseInt(suspiciousStudentsResult.rows[0].count || 0),
        averageScore: Math.round((parseFloat(avgScoreResult.rows[0].avg_score) || 0) * 100) / 100
      })
    } catch (error) {
      console.error('GET /monitoring/dashboard-stats - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get exam analytics
router.get('/monitoring/exam-analytics',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const teacherId = req.user!.id

      const exams = await pool.query(`
        SELECT 
          e.id,
          e.title,
          e.status,
          e.start_time,
          e.end_time,
          COUNT(ea.id) as attempt_count,
          AVG(ea.percentage) as avg_score,
          MAX(ea.submitted_at) as last_submission
        FROM exams e
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
        WHERE e.teacher_id = $1
        GROUP BY e.id, e.title, e.status, e.start_time, e.end_time
        ORDER BY e.created_at DESC
      `, [teacherId])

      res.json({
        exams: exams.rows.map(exam => ({
          id: exam.id,
          title: exam.title,
          status: exam.status,
          startTime: exam.start_time,
          endTime: exam.end_time,
          attemptCount: parseInt(exam.attempt_count),
          avgScore: Math.round((parseFloat(exam.avg_score) || 0) * 100) / 100,
          lastSubmission: exam.last_submission
        }))
      })
    } catch (error) {
      console.error('GET /monitoring/exam-analytics - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get student performance data
router.get('/monitoring/student-performance',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const teacherId = req.user!.id
      const { examId } = req.query

      let whereClause = 'WHERE e.teacher_id = $1'
      const params = [teacherId]

      if (examId) {
        whereClause += ' AND e.id = $2'
        params.push(examId as string)
      }

      const students = await pool.query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.student_id,
          COUNT(ea.id) as attempts_count,
          AVG(ea.percentage) as avg_score,
          MAX(ea.submitted_at) as last_attempt,
          COUNT(w.id) as warnings_count
        FROM users u
        LEFT JOIN exam_attempts ea ON u.id = ea.user_id
        LEFT JOIN exams e ON ea.exam_id = e.id
        LEFT JOIN warnings w ON u.id = w.user_id AND ea.exam_id = w.exam_id
        ${whereClause}
        AND u.role = 'student'
        GROUP BY u.id, u.name, u.email, u.student_id
        ORDER BY avg_score DESC NULLS LAST
      `, params)

      res.json({
        students: students.rows.map(student => ({
          id: student.id,
          name: student.name,
          email: student.email,
          studentId: student.student_id,
          attemptsCount: parseInt(student.attempts_count),
          avgScore: Math.round((parseFloat(student.avg_score) || 0) * 100) / 100,
          lastAttempt: student.last_attempt,
          warningsCount: parseInt(student.warnings_count)
        }))
      })
    } catch (error) {
      console.error('GET /monitoring/student-performance - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

export { router as monitoringRoutes }
