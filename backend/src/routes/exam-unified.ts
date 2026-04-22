import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent, requireTeacher } from '../middleware/auth'
import { register, Counter } from 'prom-client'
import { examSubmissionsTotal } from '../index'

const router = Router()

// Prometheus metrics for exam system
const examActiveTotal = new Counter({
  name: 'exam_active_total',
  help: 'Number of active exams currently running',
  registers: [register]
})

// examSubmissionsTotal metric is defined in index.ts to avoid conflicts

// Warnings metrics handled in warnings-unified.ts

// POST /api/exams/:id/start - Start exam attempt
router.post('/exams/:id/start',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/exams/${req.params.id}/start - User: ${req.user?.id}`)
    
    try {
      const examId = req.params.id
      const studentId = req.user!.id

      // Validate exam exists and is accessible
      const examCheck = await pool.query(
        `SELECT e.*, c.name as course_name
         FROM exams e
         JOIN courses c ON e.course_id = c.id
         JOIN enrollments en ON e.course_id = en.course_id
         WHERE e.id = $1 AND en.student_id = $2`,
        [examId, studentId]
      )

      if (examCheck.rows.length === 0) {
        console.log(`Exam ${examId} not found or student not enrolled`)
        return res.status(404).json({ 
          success: false, 
          message: 'Exam not found or access denied' 
        })
      }

      const exam = examCheck.rows[0]
      const now = new Date()

      // Check exam timing
      if (new Date(exam.start_time) > now) {
        return res.status(403).json({ 
          success: false, 
          message: 'Exam has not started yet' 
        })
      }

      if (new Date(exam.end_time) < now) {
        return res.status(403).json({ 
          success: false, 
          message: 'Exam has ended' 
        })
      }

      // Check if student already has an attempt
      const existingAttempt = await pool.query(
        'SELECT id, status FROM exam_attempts WHERE exam_id = $1 AND user_id = $2',
        [examId, studentId]
      )

      if (existingAttempt.rows.length > 0) {
        const attempt = existingAttempt.rows[0]
        if (attempt.status === 'in_progress') {
          return res.status(400).json({ 
            success: false, 
            message: 'You already have an active attempt',
            attemptId: attempt.id
          })
        } else if (attempt.status === 'submitted' || attempt.status === 'graded') {
          return res.status(403).json({ 
            success: false, 
            message: 'You have already completed this exam' 
          })
        }
      }

      // Create new attempt
      const attemptResult = await pool.query(
        `INSERT INTO exam_attempts (exam_id, user_id, status) 
         VALUES ($1, $2, 'in_progress') 
         RETURNING *`,
        [examId, studentId]
      )

      const attempt = attemptResult.rows[0]
      
      // Update active exam count
      examActiveTotal.inc({ exam_id: examId })

      console.log(`✅ Exam attempt started: ${attempt.id}`)

      res.json({
        success: true,
        data: {
          attemptId: attempt.id,
          examId: attempt.exam_id,
          userId: attempt.user_id,
          status: attempt.status,
          startedAt: attempt.started_at,
          exam: {
            id: exam.id,
            title: exam.title,
            description: exam.description,
            durationMinutes: exam.duration_minutes,
            startTime: exam.start_time,
            endTime: exam.end_time,
            courseName: exam.course_name,
            status: exam.status
          }
        }
      })

    } catch (error) {
      console.error(`[${new Date().toISOString()}] POST /api/exams/${req.params.id}/start - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

// POST /api/exams/:id/submit - Submit exam with answers
router.post('/exams/:id/submit',
  auth,
  requireStudent,
  [
    body('attemptId').notEmpty().withMessage('Attempt ID is required'),
    body('answers').isArray().withMessage('Answers must be an array'),
    body('answers.*.questionId').notEmpty().withMessage('Question ID is required'),
    body('answers.*.answer').notEmpty().withMessage('Answer is required')
  ],
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/exams/${req.params.id}/submit - User: ${req.user?.id}`)
    
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array())
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        })
      }

      const { attemptId, answers } = req.body
      const studentId = req.user!.id
      const examId = req.params.id

      // Verify attempt belongs to student and is active
      const attemptCheck = await pool.query(
        `SELECT a.*, e.title as exam_title, e.end_time
         FROM exam_attempts a
         JOIN exams e ON a.exam_id = e.id
         WHERE a.id = $1 AND a.user_id = $2`,
        [attemptId, studentId]
      )

      if (attemptCheck.rows.length === 0) {
        console.log(`Attempt ${attemptId} not found for user ${studentId}`)
        return res.status(404).json({ 
          success: false, 
          message: 'Attempt not found' 
        })
      }

      const attempt = attemptCheck.rows[0]

      if (attempt.status !== 'in_progress') {
        return res.status(400).json({ 
          success: false, 
          message: 'Attempt is not active or already submitted' 
        })
      }

      // Calculate score and save answers
      let totalPoints = 0
      let earnedPoints = 0
      const processedAnswers = []

      for (const answer of answers) {
        // Get question details
        const questionQuery = await pool.query(
          'SELECT id, correct_answer, points FROM questions WHERE id = $1 AND exam_id = $2',
          [answer.questionId, examId]
        )

        if (questionQuery.rows.length === 0) {
          console.log(`Question ${answer.questionId} not found for exam ${examId}`)
          continue
        }

        const question = questionQuery.rows[0]
        totalPoints += question.points

        // Check if answer is correct
        const isCorrect = question.correct_answer === answer.answer
        if (isCorrect) {
          earnedPoints += question.points
        }

        processedAnswers.push({
          questionId: question.id,
          answer: answer.answer,
          isCorrect,
          pointsEarned: isCorrect ? question.points : 0
        })

        // Save individual answer
        await pool.query(
          `INSERT INTO answers (attempt_id, question_id, answer, is_correct, points_earned)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (attempt_id, question_id) 
           DO UPDATE SET 
             answer = EXCLUDED.answer,
             is_correct = EXCLUDED.is_correct,
             points_earned = EXCLUDED.points_earned`,
          [attemptId, question.id, answer.answer, isCorrect, isCorrect ? question.points : 0]
        )
      }

      const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0

      // Update attempt with results
      await pool.query(
        `UPDATE exam_attempts 
         SET answers = $1,
             score = $2, 
             total_points = $3, 
             percentage = $4,
             submitted_at = NOW(),
             status = 'submitted'
         WHERE id = $5`,
        [JSON.stringify(answers), earnedPoints, totalPoints, percentage, attemptId]
      )

      // Create result record
      const resultStatus = percentage >= 50 ? 'passed' : 'failed'
      await pool.query(
        `INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [studentId, examId, attemptId, earnedPoints, totalPoints, percentage, resultStatus]
      )

      // Update metrics
      examSubmissionsTotal.labels(examId, resultStatus).inc()
      // Note: Counter doesn't support decrement, only increment

      console.log(`✅ Exam submitted: ${attemptId} - Score: ${earnedPoints}/${totalPoints} (${percentage.toFixed(2)}%)`)

      res.json({
        success: true,
        data: {
          attemptId,
          score: earnedPoints,
          totalPoints,
          percentage: Math.round(percentage * 100) / 100,
          status: resultStatus,
          submittedAt: new Date().toISOString(),
          answers: processedAnswers
        }
      })

    } catch (error) {
      console.error(`[${new Date().toISOString()}] POST /api/exams/${req.params.id}/submit - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

// GET /api/student/results - Get student's results
router.get('/student/results',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/student/results - User: ${req.user?.id}`)
    
    try {
      const studentId = req.user!.id

      const results = await pool.query(
        `SELECT 
           r.id,
           r.score,
           r.total_points,
           r.percentage,
           r.status,
           r.graded_at,
           e.title as exam_title,
           e.duration_minutes,
           c.name as course_name
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         JOIN courses c ON e.course_id = c.id
         WHERE r.student_id = $1
         ORDER BY r.graded_at DESC`,
        [studentId]
      )

      console.log(`Found ${results.rows.length} results for student ${studentId}`)

      res.json({
        success: true,
        data: results.rows.map(result => ({
          id: result.id,
          examTitle: result.exam_title,
          score: parseFloat(result.score),
          totalPoints: result.total_points,
          percentage: parseFloat(result.percentage),
          status: result.status,
          submittedAt: result.graded_at,
          courseName: result.course_name,
          durationMinutes: result.duration_minutes
        }))
      })

    } catch (error) {
      console.error(`[${new Date().toISOString()}] GET /api/student/results - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

// GET /api/teacher/results - Get all student results for teacher
router.get('/teacher/results',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/teacher/results - User: ${req.user?.id}`)
    
    try {
      const teacherId = req.user!.id

      const results = await pool.query(
        `SELECT 
           r.id,
           r.score,
           r.total_points,
           r.percentage,
           r.status,
           r.graded_at,
           u.name as student_name,
           u.email as student_email,
           e.title as exam_title,
           c.name as course_name
         FROM results r
         JOIN users u ON r.student_id = u.id
         JOIN exams e ON r.exam_id = e.id
         JOIN courses c ON e.course_id = c.id
         WHERE e.teacher_id = $1
         ORDER BY r.graded_at DESC`,
        [teacherId]
      )

      console.log(`Found ${results.rows.length} results for teacher ${teacherId}`)

      res.json({
        success: true,
        data: results.rows.map(result => ({
          id: result.id,
          studentName: result.student_name,
          studentEmail: result.student_email,
          examTitle: result.exam_title,
          courseName: result.course_name,
          score: parseFloat(result.score),
          totalPoints: result.total_points,
          percentage: parseFloat(result.percentage),
          status: result.status,
          submittedAt: result.graded_at
        }))
      })

    } catch (error) {
      console.error(`[${new Date().toISOString()}] GET /api/teacher/results - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

export { router as examUnifiedRoutes }
