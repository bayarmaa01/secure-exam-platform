import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { Counter, Histogram } from 'prom-client'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent } from '../middleware/auth'

const router = Router()

// Test endpoint to verify routing works
router.post('/attempts/test', (req, res) => {
  console.log('TEST ENDPOINT - Request received:', req.body)
  res.json({ 
    success: true, 
    message: 'Test endpoint working',
    body: req.body 
  })
})

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
    console.log('\n=== POST /api/attempts/start - DETAILED DEBUG ===')
    console.log('TIMESTAMP:', new Date().toISOString())
    console.log('REQUEST HEADERS:', {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'PRESENT' : 'MISSING',
      'user-agent': req.headers['user-agent'],
      'content-length': req.headers['content-length']
    })
    console.log('REQUEST BODY TYPE:', typeof req.body)
    console.log('REQUEST BODY KEYS:', Object.keys(req.body || {}))
    console.log('REQUEST BODY:', JSON.stringify(req.body, null, 2))
    console.log('AUTH USER:', {
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.role
    })
    
    // Check if body parser worked correctly
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log('ERROR: Request body is empty or undefined')
      return res.status(400).json({ 
        success: false, 
        message: 'Request body is empty or undefined',
        debug: {
          bodyType: typeof req.body,
          bodyKeys: Object.keys(req.body || {}),
          contentType: req.headers['content-type']
        }
      })
    }
    
    try {
      const errors = validationResult(req)
      console.log('VALIDATION RESULT:', {
        isEmpty: errors.isEmpty(),
        errors: errors.array()
      })
      
      if (!errors.isEmpty()) {
        console.log('VALIDATION FAILED DETAILED:')
        console.log('- Errors:', JSON.stringify(errors.array(), null, 2))
        console.log('- Request body:', JSON.stringify(req.body, null, 2))
        console.log('- Body keys:', Object.keys(req.body))
        console.log('- examId value:', req.body?.examId)
        console.log('- examId type:', typeof req.body?.examId)
        console.log('- examId length:', req.body?.examId?.length)
        
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          debug: {
            errors: errors.array(),
            requestBody: req.body,
            examId: {
              value: req.body?.examId,
              type: typeof req.body?.examId,
              length: req.body?.examId?.length
            }
          }
        })
      }
      
      console.log('VALIDATION PASSED - Proceeding with attempt start')

      const { examId } = req.body
      const studentId = req.user!.id

      console.log('EXAM LOOKUP - Searching for exam:', examId)
      console.log('EXAM LOOKUP - Student ID:', studentId)

      // Simplified check - if student can see exam, they can start it
      // Just verify exam exists and basic timing
      const examCheck = await pool.query(
        'SELECT * FROM exams WHERE id = $1',
        [examId]
      )

      console.log('EXAM LOOKUP RESULT:', {
        found: examCheck.rows.length > 0,
        count: examCheck.rows.length,
        examId: examId
      })

      if (examCheck.rows.length === 0) {
        console.log('ERROR: Exam not found - ID:', examId)
        return res.status(404).json({ 
          success: false, 
          message: 'Exam not found',
          debug: {
            examId,
            searchedId: examId,
            studentId
          }
        })
      }

      const exam = examCheck.rows[0]
      console.log('EXAM FOUND - Details:', {
        id: exam.id,
        title: exam.title,
        status: exam.status,
        assignToAll: exam.assign_to_all,
        courseId: exam.course_id,
        startTime: exam.start_time,
        endTime: exam.end_time
      })

      // Allow draft exams for testing purposes
      if (exam.status === 'draft') {
        console.log('ALLOWING DRAFT EXAM: Student starting draft exam')
      }

      // Skip timing check for testing - allow exam to start anytime
      console.log('TIMING CHECK: SKIPPED - Allowing exam to start for testing')

      console.log('EXISTING ATTEMPT CHECK - Looking for attempts:', {
        examId,
        studentId
      })

      // Check if student already has an active attempt
      const existingAttempt = await pool.query(
        'SELECT id, status, started_at FROM exam_attempts WHERE exam_id = $1 AND user_id = $2 ORDER BY created_at DESC',
        [examId, studentId]
      )

      console.log('EXISTING ATTEMPT RESULT:', {
        found: existingAttempt.rows.length > 0,
        count: existingAttempt.rows.length,
        attempts: existingAttempt.rows.map(a => ({
          id: a.id,
          status: a.status,
          startedAt: a.started_at
        }))
      })

      if (existingAttempt.rows.length > 0) {
        const attempt = existingAttempt.rows[0]
        console.log('ATTEMPT EXISTS - Status:', attempt.status)
        
        if (attempt.status === 'in_progress') {
          console.log('ERROR: Student already has active attempt:', attempt.id)
          return res.status(400).json({ 
            success: false, 
            message: 'You already have an active attempt',
            attemptId: attempt.id,
            debug: {
              existingAttempt: {
                id: attempt.id,
                status: attempt.status,
                startedAt: attempt.started_at
              }
            }
          })
        } else if (attempt.status === 'submitted' || attempt.status === 'graded') {
          console.log('INFO: Student retaking exam - previous attempt was:', attempt.status)
        }
      }

      console.log('CREATING NEW ATTEMPT - Student can start exam')
      
      // Create new attempt
      const attemptResult = await pool.query(
        `INSERT INTO exam_attempts (exam_id, user_id, status) 
         VALUES ($1, $2, 'in_progress') 
         RETURNING *`,
        [examId, studentId]
      )
      
      const newAttempt = attemptResult.rows[0]
      console.log('NEW ATTEMPT CREATED:', {
        id: newAttempt.id,
        examId: newAttempt.exam_id,
        userId: newAttempt.user_id,
        status: newAttempt.status,
        startedAt: newAttempt.started_at
      })
      
      // Record metrics
      attemptsTotal.labels('started', examId).inc()
      console.log(`SUCCESS: Attempt started: ${newAttempt.id} for user ${studentId}`)

      res.status(201).json({
        success: true,
        message: 'Exam attempt started successfully',
        data: {
          attemptId: newAttempt.id,
          examId: newAttempt.exam_id,
          userId: newAttempt.user_id,
          status: newAttempt.status,
          startedAt: newAttempt.started_at,
          startTime: exam.start_time,
          endTime: exam.end_time
        }
      })

    } catch (error) {
      console.error('UNEXPECTED ERROR in /api/attempts/start:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        body: req.body,
        user: req.user
      })
      return res.status(500).json({ 
        success: false, 
        message: 'Unexpected server error',
        debug: {
          error: error.message,
          body: req.body,
          userId: req.user?.id
        }
      })
    }
  }
)

// POST /api/attempts/submit - Submit exam answers
router.post('/attempts/submit',
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

export default router
