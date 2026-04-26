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

// Simple test endpoint without auth to verify basic routing
router.post('/attempts/ping', (req, res) => {
  console.log('PING ENDPOINT - Request received:', req.body)
  res.json({ 
    success: true, 
    message: 'Ping endpoint working',
    body: req.body,
    timestamp: new Date().toISOString()
  })
})

// Health check for attempts-api
router.get('/attempts/health', (req, res) => {
  console.log('ATTEMPTS-API HEALTH CHECK')
  res.json({ 
    success: true, 
    message: 'Attempts API is working',
    timestamp: new Date().toISOString()
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

// POST /api/attempts/start - Start a new exam attempt (PRODUCTION-SAFE IDEMPOTENT)
router.post('/attempts/start',
  auth,
  requireStudent,
  [
    body('examId').notEmpty().withMessage('Exam ID is required')
  ],
  async (req: AuthRequest, res) => {
    const { examId } = req.body;
    const userId = req.user!.id;

    try {
      console.log(`[${new Date().toISOString()}] POST /api/attempts/start - Production-safe attempt start`);
      console.log(`[${new Date().toISOString()}] User: ${userId}, Exam: ${examId}`);

      // 1. Check if an in_progress attempt exists (CRITICAL FOR IDEMPOTENCY)
      const existing = await pool.query(
        `SELECT * FROM exam_attempts
         WHERE exam_id = $1 AND user_id = $2 AND status = 'in_progress'
         LIMIT 1`,
        [examId, userId]
      );

      // 2. IF exists: Return existing attempt (NO 400 ERROR)
      if (existing.rows.length > 0) {
        console.log(`[${new Date().toISOString()}] Resuming existing attempt: ${existing.rows[0].id}`);
        
        attemptsTotal.labels('reused', examId).inc();
        
        return res.status(200).json({
          success: true,
          message: 'Resuming existing attempt',
          data: existing.rows[0],
        });
      }

      // 3. ELSE: Create new attempt
      console.log(`[${new Date().toISOString()}] Creating new attempt for user ${userId}`);
      
      const result = await pool.query(
        `INSERT INTO exam_attempts (exam_id, user_id, status, started_at)
         VALUES ($1, $2, 'in_progress', NOW())
         RETURNING *`,
        [examId, userId]
      );

      const newAttempt = result.rows[0];
      console.log(`[${new Date().toISOString()}] SUCCESS: New attempt created: ${newAttempt.id}`);

      attemptsTotal.labels('started', examId).inc();

      return res.status(200).json({
        success: true,
        message: 'New attempt started',
        data: newAttempt,
      });

    } catch (err) {
      console.error(`[${new Date().toISOString()}] Start attempt error:`, err);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to start attempt',
      });
    }
  }
)

// POST /api/attempts/:attemptId/answers - Submit individual answer
router.post('/attempts/:attemptId/answers',
  auth,
  requireStudent,
  [
    body('questionId').notEmpty().withMessage('Question ID is required'),
    body('answer').notEmpty().withMessage('Answer is required')
  ],
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/attempts/${req.params.attemptId}/answers - User: ${req.user?.id}`)
    
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array())
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        })
      }

      const { questionId, answer } = req.body
      const attemptId = req.params.attemptId
      const studentId = req.user!.id

      // Verify attempt belongs to student and is in progress
      const attemptCheck = await pool.query(
        'SELECT id, status, exam_id FROM exam_attempts WHERE id = $1 AND user_id = $2',
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
        console.log(`Attempt ${attemptId} is not in progress: ${attempt.status}`)
        return res.status(400).json({ 
          success: false, 
          message: 'Attempt is not active' 
        })
      }

      // Get question details for grading
      const questionQuery = await pool.query(
        'SELECT id, correct_answer, points FROM questions WHERE id = $1 AND exam_id = $2',
        [questionId, attempt.exam_id]
      )

      if (questionQuery.rows.length === 0) {
        console.log(`Question ${questionId} not found for exam ${attempt.exam_id}`)
        return res.status(404).json({ 
          success: false, 
          message: 'Question not found' 
        })
      }

      const question = questionQuery.rows[0]
      
      // Grade the answer
      let isCorrect = false
      let pointsEarned = 0

      if (question.correct_answer && question.correct_answer.toLowerCase() === answer.toLowerCase()) {
        isCorrect = true
        pointsEarned = question.points
      }

      // Save the answer
      await pool.query(
        `INSERT INTO answers (attempt_id, question_id, answer, is_correct, points_earned)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (attempt_id, question_id) 
         DO UPDATE SET 
           answer = EXCLUDED.answer,
           is_correct = EXCLUDED.is_correct,
           points_earned = EXCLUDED.points_earned`,
        [attemptId, questionId, answer, isCorrect, pointsEarned]
      )

      console.log(`✅ Answer saved: Attempt ${attemptId}, Question ${questionId}, Correct: ${isCorrect}`)

      res.json({
        success: true,
        message: 'Answer submitted successfully',
        data: {
          questionId,
          answer,
          isCorrect,
          pointsEarned
        }
      })

    } catch (error) {
      console.error(`POST /api/attempts/${req.params.attemptId}/answers - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

// GET /api/attempts/:attemptId - Get attempt details
router.get('/attempts/:attemptId',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      const attemptId = req.params.attemptId
      const studentId = req.user!.id

      console.log(`[${new Date().toISOString()}] GET /api/attempts/${attemptId} - User: ${studentId}`)

      // Get attempt details with exam info
      const attemptQuery = await pool.query(
        `SELECT a.*, e.title as exam_title, e.duration_minutes, e.end_time, e.passing_threshold
         FROM exam_attempts a
         JOIN exams e ON a.exam_id = e.id
         WHERE a.id = $1 AND a.user_id = $2`,
        [attemptId, studentId]
      )

      if (attemptQuery.rows.length === 0) {
        console.log(`Attempt ${attemptId} not found for user ${studentId}`)
        return res.status(404).json({ 
          success: false, 
          message: 'Attempt not found' 
        })
      }

      const attempt = attemptQuery.rows[0]

      // Get answers for this attempt
      const answersQuery = await pool.query(
        `SELECT question_id, answer, is_correct, points_earned
         FROM answers 
         WHERE attempt_id = $1`,
        [attemptId]
      )

      res.json({
        success: true,
        data: {
          ...attempt,
          answers: answersQuery.rows
        }
      })

    } catch (error) {
      console.error(`GET /api/attempts/${req.params.attemptId} - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
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
    const startTime = Date.now()
    console.log(`[${new Date().toISOString()}] POST /api/attempts/submit - User: ${req.user?.id}, Attempt: ${req.body.attemptId}`)
    console.log(`[SUBMIT] Request body:`, JSON.stringify(req.body, null, 2))
    
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
        `SELECT a.*, e.title as exam_title, e.end_time, e.passing_threshold
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
      
      // Debug log: Attempt state before submission
      console.log(`[SUBMIT DEBUG] Attempt before submission:`, {
        attemptId,
        status: attempt.status,
        currentScore: attempt.score,
        currentPercentage: attempt.percentage,
        submittedAt: attempt.submitted_at,
        answersCount: answers.length
      })

      if (attempt.status !== 'in_progress') {
        return res.status(400).json({ 
          success: false, 
          message: 'Attempt is not active or already submitted' 
        })
      }

      // Get exam total points for proper scoring (even if no answers submitted)
      const examPointsQuery = await pool.query(
        'SELECT COALESCE(SUM(points), 0) as total_points FROM questions WHERE exam_id = $1',
        [attempt.exam_id]
      )
      const examTotalPoints = examPointsQuery.rows[0].total_points

      // Calculate score and save answers
      let totalPoints = 0
      let earnedPoints = 0
      const processedAnswers = []

      console.log(`[SUBMIT DEBUG] Processing ${answers.length} answers for exam total points: ${examTotalPoints}`)

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

      // Fix scoring calculation: always use exam total points as denominator
      // If no answers submitted, score should be 0/examTotalPoints = 0%
      const finalTotalPoints = examTotalPoints
      const percentage = finalTotalPoints > 0 ? (earnedPoints / finalTotalPoints) * 100 : 0
      
      console.log(`[SUBMIT DEBUG] Score calculation:`, {
        earnedPoints,
        totalPoints,
        finalTotalPoints,
        percentage,
        passingThreshold: attempt.passing_threshold
      })

      // Get exam details to determine grading approach
      const examQuery = await pool.query(
        'SELECT type FROM exams WHERE id = $1',
        [attempt.exam_id]
      )
      
      const examType = examQuery.rows[0]?.type
      console.log(`[SUBMIT DEBUG] Exam type: ${examType}`)
      
      // Writing and coding exams are NEVER auto-graded
      
      // Set status based on exam type
      let finalStatus: string
      let scoreToSave: number | null = null
      let percentageToSave: number | null = null
      
      if (['writing', 'coding'].includes(examType)) {
        finalStatus = 'pending_review'
        scoreToSave = null
        percentageToSave = null
        console.log(`[SUBMIT DEBUG] ${examType} exam set to pending_review`)
      } else {
        // For MCQ and other auto-gradable exams, calculate score
        const questionsQuery = await pool.query(
          'SELECT correct_answer FROM questions WHERE exam_id = $1',
          [attempt.exam_id]
        )
        
        const hasCorrectAnswers = questionsQuery.rows.some(q => q.correct_answer !== null && q.correct_answer !== '')
        finalStatus = (hasCorrectAnswers && questionsQuery.rows.length > 0) ? 'submitted' : 'pending_review'
        
        if (finalStatus === 'submitted') {
          scoreToSave = earnedPoints
          percentageToSave = percentage
        } else {
          scoreToSave = null
          percentageToSave = null
        }
      }
      
      // Update the attempt with final status and score
      try {
        await pool.query(
          `UPDATE exam_attempts 
           SET status = $1, submitted_at = NOW(), score = $2, total_points = $3, percentage = $4
           WHERE id = $5`,
          [finalStatus, scoreToSave, finalTotalPoints, percentageToSave, attemptId]
        )
      } catch (constraintError) {
        // Handle constraint violation - use 'submitted' as fallback
        if (constraintError.message.includes('exam_attempts_status_check')) {
          console.log(`[SUBMIT] Constraint violation, using 'submitted' as fallback status`)
          await pool.query(
            `UPDATE exam_attempts 
             SET status = 'submitted', submitted_at = NOW(), score = $2, total_points = $3, percentage = $4
             WHERE id = $5`,
            ['submitted', scoreToSave, finalTotalPoints, percentageToSave, attemptId]
          )
        } else {
          throw constraintError
        }
      }

      // Determine pass/fail status using exam's passing threshold
      const passingThreshold = attempt.passing_threshold || 50 // Default to 50 if not set
      const passed = percentage >= passingThreshold
      
      console.log(`[SUBMIT DEBUG] Pass/Fail determination:`, {
        percentage,
        passingThreshold,
        passed
      })

      // Create result record only for auto-graded exams (finalStatus === 'submitted')
      if (finalStatus === 'submitted') {
        await pool.query(
          `INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [studentId, attempt.exam_id, attemptId, scoreToSave, finalTotalPoints, percentageToSave, passed ? 'passed' : 'failed']
        )
        console.log(`[SUBMIT DEBUG] Result record created for auto-graded attempt ${attemptId}`)
      } else {
        console.log(`[SUBMIT DEBUG] No result record created for ${examType} exam - pending review`)
      }

      // Calculate attempt duration
      const duration = Math.floor((new Date().getTime() - new Date(attempt.started_at).getTime()) / 1000)
      
      // Record metrics with try/catch protection
      try {
        attemptDuration.labels(attempt.exam_id).observe(duration)
        submissionsTotal.labels(attempt.exam_id).inc()
        attemptsTotal.labels('submitted', attempt.exam_id).inc()
      } catch (metricsError) {
        console.warn('[METRICS] Failed to record submission metrics:', metricsError)
      }

      // Debug log: Verify attempt state after submission
      const finalAttemptCheck = await pool.query(
        'SELECT status, score, percentage, submitted_at FROM exam_attempts WHERE id = $1',
        [attemptId]
      )
      
      console.log(`[SUBMIT DEBUG] Attempt after submission:`, finalAttemptCheck.rows[0])
      const durationMs = Date.now() - startTime
      console.log(`Attempt ${attemptId} submitted successfully. Score: ${earnedPoints}/${finalTotalPoints} (${percentage.toFixed(2)}%) - Status: ${passed ? 'PASSED' : 'FAILED'}`)
      console.log(`[SUBMIT] Submission completed in ${durationMs}ms for user ${studentId}`)

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
      const durationMs = Date.now() - startTime
      console.error(`[${new Date().toISOString()}] POST /api/attempts/submit - Error after ${durationMs}ms:`, error)
      console.error(`[SUBMIT] Error details:`, {
        message: error.message,
        stack: error.stack,
        attemptId: req.body.attemptId,
        userId: req.user?.id
      })
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

// POST /api/attempts/:attemptId/submit - Submit exam attempt (alternative endpoint)
router.post('/attempts/:attemptId/submit',
  auth,
  requireStudent,
  [
    body('answers').optional().isArray().withMessage('Answers must be an array'),
    body('answers.*.questionId').notEmpty().withMessage('Question ID is required'),
    body('answers.*.answer').notEmpty().withMessage('Answer is required')
  ],
  async (req: AuthRequest, res) => {
    const startTime = Date.now()
    console.log(`[${new Date().toISOString()}] POST /api/attempts/:attemptId/submit - User: ${req.user?.id}, Attempt: ${req.params.attemptId}`)
    
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array())
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        })
      }

      const attemptId = req.params.attemptId
      const { answers, cheatingWarnings, sessionId } = req.body
      const studentId = req.user!.id

      // Verify attempt belongs to student
      const attemptCheck = await pool.query(
        'SELECT id, exam_id, status, created_at FROM exam_attempts WHERE id = $1 AND user_id = $2',
        [attemptId, studentId]
      )

      if (attemptCheck.rows.length === 0) {
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

      // Process answers similar to the main submit endpoint
      const examPointsQuery = await pool.query(
        'SELECT COALESCE(SUM(points), 0) as total_points FROM questions WHERE exam_id = $1',
        [attempt.exam_id]
      )
      const examTotalPoints = examPointsQuery.rows[0].total_points

      let earnedPoints = 0
      const processedAnswers = []

      if (answers && Array.isArray(answers)) {
        for (const answerData of answers) {
          const { questionId, answer } = answerData
          
          const questionQuery = await pool.query(
            'SELECT id, type, points, correct_answer FROM questions WHERE id = $1 AND exam_id = $2',
            [questionId, attempt.exam_id]
          )
          
          if (questionQuery.rows.length > 0) {
            const question = questionQuery.rows[0]
            let isCorrect = false
            let pointsEarned = 0
            
            if (question.type === 'mcq' && question.correct_answer) {
              isCorrect = answer === question.correct_answer
              pointsEarned = isCorrect ? question.points : 0
            } else {
              pointsEarned = answer && answer.trim() ? question.points : 0
            }
            
            earnedPoints += pointsEarned
            
            // Insert or update answer
            await pool.query(
              `INSERT INTO answers (attempt_id, question_id, answer, is_correct, points_earned)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (attempt_id, question_id) 
               DO UPDATE SET 
                 answer = EXCLUDED.answer,
                 is_correct = EXCLUDED.is_correct,
                 points_earned = EXCLUDED.points_earned`,
              [attemptId, questionId, answer, isCorrect, pointsEarned]
            )
            
            processedAnswers.push({
              questionId,
              answer,
              isCorrect,
              pointsEarned
            })
          }
        }
      }

      const percentage = examTotalPoints > 0 ? (earnedPoints / examTotalPoints) * 100 : 0
      const finalStatus = 'submitted'

      // Update attempt
      await pool.query(
        `UPDATE exam_attempts 
         SET status = $1, submitted_at = NOW(), score = $2, total_points = $3, percentage = $4
         WHERE id = $5`,
        [finalStatus, earnedPoints, examTotalPoints, percentage, attemptId]
      )

      // Create result record
      await pool.query(
        `INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [studentId, attempt.exam_id, attemptId, earnedPoints, examTotalPoints, percentage, percentage >= 50 ? 'passed' : 'failed']
      )

      const durationMs = Date.now() - startTime
      console.log(`Attempt ${attemptId} submitted successfully via :attemptId/submit endpoint. Score: ${earnedPoints}/${examTotalPoints} (${percentage.toFixed(2)}%) - Status: ${percentage >= 50 ? 'PASSED' : 'FAILED'}`)

      res.json({
        success: true,
        data: {
          attemptId,
          score: earnedPoints,
          totalPoints: examTotalPoints,
          percentage: Math.round(percentage * 100) / 100,
          status: percentage >= 50 ? 'passed' : 'failed',
          submittedAt: new Date().toISOString(),
          answers: processedAnswers
        }
      })

    } catch (error) {
      const durationMs = Date.now() - startTime
      console.error(`[${new Date().toISOString()}] POST /api/attempts/:attemptId/submit - Error after ${durationMs}ms:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Failed to submit exam', 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

export const attemptsApiRoutes = router
export default router
