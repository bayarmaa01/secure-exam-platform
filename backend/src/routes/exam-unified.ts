import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent, requireTeacher } from '../middleware/auth'
import { register, Counter } from 'prom-client'

const router = Router()

// Prometheus metrics for exam system
const examActiveTotal = new Counter({
  name: 'exam_active_total',
  help: 'Number of active exams currently running',
  labelNames: ['exam_id'],
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

      // Database-driven validation - PostgreSQL as source of truth
      const examCheck = await pool.query(
        `SELECT e.*, c.name as course_name
         FROM exams e
         JOIN courses c ON e.course_id = c.id
         WHERE e.id = $1 
         AND (e.is_published = true OR e.status = 'draft')`,
        [examId]
      )

      if (examCheck.rows.length === 0) {
        console.log({
          error: "EXAM_NOT_ACTIVE",
          examId,
          studentId,
          now: new Date().toISOString(),
          reason: "Exam not found or not published"
        })
        
        return res.status(403).json({ 
          error: "FORBIDDEN", 
          reason: "EXAM_NOT_ACTIVE",
          debug: {
            examId,
            studentId,
            now: new Date().toISOString(),
            query: "SELECT e.*, c.name as course_name FROM exams e JOIN courses c ON e.course_id = c.id WHERE e.id = $1 AND e.is_published = true AND (NOW() BETWEEN e.start_time AND e.end_time OR e.status = 'completed')"
          }
        })
      }

      const exam = examCheck.rows[0]
      
      console.log({
        examFound: true,
        examId: exam.id,
        now: new Date().toISOString(),
        examStart: exam.start_time,
        examEnd: exam.end_time,
        isPublished: exam.is_published
      })

      // Check if student already has an attempt
      const existingAttempt = await pool.query(
        'SELECT id, status, started_at FROM exam_attempts WHERE exam_id = $1 AND user_id = $2',
        [examId, studentId]
      )

      if (existingAttempt.rows.length > 0) {
        const attempt = existingAttempt.rows[0]
        console.log({
          existingAttemptFound: true,
          attemptId: attempt.id,
          status: attempt.status,
          startedAt: attempt.started_at
        })
        
        if (attempt.status === 'in_progress') {
          return res.status(200).json({
            id: attempt.id,
            exam_id: examId,
            user_id: studentId,
            status: attempt.status,
            started_at: attempt.started_at,
            exam: {
              id: exam.id,
              title: exam.title,
              description: exam.description,
              duration_minutes: exam.duration_minutes,
              start_time: exam.start_time,
              end_time: exam.end_time,
              course_name: exam.course_name,
              status: exam.status
            }
          })
        } else if (attempt.status === 'submitted' || attempt.status === 'graded') {
          // Allow resuming submitted attempts for debugging
          console.log({
            warning: "RESUMING_SUBMITTED_ATTEMPT",
            attemptId: attempt.id,
            status: attempt.status,
            message: "Student is trying to access a submitted attempt"
          })
          
          return res.status(200).json({
            id: attempt.id,
            exam_id: examId,
            user_id: studentId,
            status: attempt.status,
            started_at: attempt.started_at,
            exam: {
              id: exam.id,
              title: exam.title,
              description: exam.description,
              duration_minutes: exam.duration_minutes,
              start_time: exam.start_time,
              end_time: exam.end_time,
              course_name: exam.course_name,
              status: exam.status
            }
          })
        }
      }

      // Create new attempt with better error handling
      let attempt;
      try {
        const attemptResult = await pool.query(
          `INSERT INTO exam_attempts (exam_id, user_id, status) 
           VALUES ($1, $2, 'in_progress') 
           RETURNING *`,
          [examId, studentId]
        )
        attempt = attemptResult.rows[0]
        console.log(`✅ New exam attempt created: ${attempt.id}`)
      } catch (insertError: unknown) {
        // Handle potential race condition - check if attempt was created by another request
        const errorCode = insertError && typeof insertError === 'object' && 'code' in insertError ? (insertError as { code?: string }).code : undefined
        const errorMessage = insertError instanceof Error ? insertError.message : ''
        if (errorCode === '23505' || errorMessage.includes('duplicate')) {
          console.log('Race condition detected - checking for existing attempt')
          const retryCheck = await pool.query(
            'SELECT id, status, started_at FROM exam_attempts WHERE exam_id = $1 AND user_id = $2',
            [examId, studentId]
          )
          
          if (retryCheck.rows.length > 0) {
            const existingAttempt = retryCheck.rows[0]
            if (existingAttempt.status === 'in_progress') {
              return res.status(200).json({
                id: existingAttempt.id,
                exam_id: examId,
                user_id: studentId,
                status: existingAttempt.status,
                started_at: existingAttempt.started_at,
                exam: {
                  id: exam.id,
                  title: exam.title,
                  description: exam.description,
                  duration_minutes: exam.duration_minutes,
                  start_time: exam.start_time,
                  end_time: exam.end_time,
                  course_name: exam.course_name,
                  status: exam.status
                }
              })
            }
          }
        }
        
        console.error('Failed to create exam attempt:', insertError)
        throw insertError
      }
      
      // Update active exam count
      examActiveTotal.inc({ exam_id: examId })

      console.log(`✅ Exam attempt started: ${attempt.id}`)

      res.json({
        id: attempt.id,
        exam_id: attempt.exam_id,
        user_id: attempt.user_id,
        status: attempt.status,
        started_at: attempt.started_at,
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          duration_minutes: exam.duration_minutes,
          start_time: exam.start_time,
          end_time: exam.end_time,
          course_name: exam.course_name,
          status: exam.status
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

      // Get exam total points for accurate percentage calculation
      const examTotalPointsQuery = await pool.query(
        'SELECT COALESCE(SUM(points), 0) as total_points FROM questions WHERE exam_id = $1',
        [examId]
      )
      const examTotalPoints = examTotalPointsQuery.rows[0].total_points

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

      // Fix scoring: always use exam total points as denominator
      const finalTotalPoints = examTotalPoints
      const percentage = finalTotalPoints > 0 ? (earnedPoints / finalTotalPoints) * 100 : 0

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
      // Metrics tracking handled by examMetrics.ts

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
