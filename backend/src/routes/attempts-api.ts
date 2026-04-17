import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { Counter, Histogram } from 'prom-client'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent } from '../middleware/auth'

const router = Router()

// Prometheus metrics for attempts
const attemptsTotal = new Counter({
  name: 'attempts_total',
  help: 'Total number of exam attempts',
  labelNames: ['status', 'exam_id']
})

const submissionsTotal = new Counter({
  name: 'submissions_total',
  help: 'Total number of exam submissions',
  labelNames: ['exam_id']
})

const attemptDuration = new Histogram({
  name: 'attempt_duration_seconds',
  help: 'Duration of exam attempts in seconds',
  labelNames: ['exam_id']
})

// POST /api/attempts/start - Start a new exam attempt
router.post('/attempts/start',
  auth,
  requireStudent,
  [
    body('examId').notEmpty().withMessage('Exam ID is required')
  ],
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/attempts/start - User: ${req.user?.id}, Exam: ${req.body.examId}`)
    
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array())
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        })
      }

      const { examId } = req.body
      const studentId = req.user!.id

      // Check if student is enrolled in the course
      const enrollmentCheck = await pool.query(
        `SELECT 1 FROM enrollments en
         JOIN exams e ON en.course_id = e.course_id
         WHERE e.id = $1 AND en.student_id = $2`,
        [examId, studentId]
      )

      if (enrollmentCheck.rows.length === 0) {
        console.log(`Student ${studentId} not enrolled in exam ${examId}`)
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied - not enrolled in course' 
        })
      }

      // Check exam details and timing
      const examCheck = await pool.query(
        'SELECT start_time, end_time, status FROM exams WHERE id = $1',
        [examId]
      )

      if (examCheck.rows.length === 0) {
        console.log(`Exam ${examId} not found`)
        return res.status(404).json({ 
          success: false, 
          message: 'Exam not found' 
        })
      }

      const exam = examCheck.rows[0]
      const now = new Date()

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

      // Check if student already has an active attempt
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
      
      // Record metrics
      attemptsTotal.labels('started', examId).inc()
      console.log(`Attempt started: ${attempt.id} for user ${studentId}`)

      res.json({
        success: true,
        data: {
          attemptId: attempt.id,
          examId: attempt.exam_id,
          userId: attempt.user_id,
          status: attempt.status,
          startedAt: attempt.started_at,
          startTime: exam.start_time,
          endTime: exam.end_time
        }
      })

    } catch (error) {
      console.error(`[${new Date().toISOString()}] POST /api/attempts/start - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

// POST /api/attempts/submit - Submit exam answers
router.post('/api/attempts/submit',
  auth,
  requireStudent,
  [
    body('attemptId').notEmpty().withMessage('Attempt ID is required'),
    body('answers').isArray().withMessage('Answers must be an array'),
    body('answers.*.questionId').notEmpty().withMessage('Question ID is required'),
    body('answers.*.answer').notEmpty().withMessage('Answer is required')
  ],
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/attempts/submit - User: ${req.user?.id}, Attempt: ${req.body.attemptId}`)
    
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

      // Verify attempt belongs to student and is in progress
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
          [answer.questionId, attempt.exam_id]
        )

        if (questionQuery.rows.length === 0) {
          console.log(`Question ${answer.questionId} not found for exam ${attempt.exam_id}`)
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
      await pool.query(
        `INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [studentId, attempt.exam_id, attemptId, earnedPoints, totalPoints, percentage, percentage >= 50 ? 'passed' : 'failed']
      )

      // Calculate attempt duration
      const duration = Math.floor((new Date().getTime() - new Date(attempt.started_at).getTime()) / 1000)
      attemptDuration.labels(attempt.exam_id).observe(duration)

      // Record metrics
      submissionsTotal.labels(attempt.exam_id).inc()
      attemptsTotal.labels('submitted', attempt.exam_id).inc()

      console.log(`Attempt ${attemptId} submitted successfully. Score: ${earnedPoints}/${totalPoints} (${percentage.toFixed(2)}%)`)

      res.json({
        success: true,
        data: {
          attemptId,
          score: earnedPoints,
          totalPoints,
          percentage: Math.round(percentage * 100) / 100,
          status: percentage >= 50 ? 'passed' : 'failed',
          submittedAt: new Date().toISOString(),
          answers: processedAnswers,
          duration
        }
      })

    } catch (error) {
      console.error(`[${new Date().toISOString()}] POST /api/attempts/submit - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

export { router as attemptsApiRoutes }
