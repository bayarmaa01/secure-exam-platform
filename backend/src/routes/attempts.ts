import { Router } from 'express'
import { body } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent, requireTeacher } from '../middleware/auth'

const router = Router()

// Student: Start exam attempt
router.post('/exams/:examId/start',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      const examId = req.params.examId
      const studentId = req.user!.id

      // Check if student is enrolled in the course
      const enrollmentCheck = await pool.query(
        `SELECT 1 FROM enrollments en
         JOIN exams e ON en.course_id = e.course_id
         WHERE e.id = $1 AND en.student_id = $2`,
        [examId, studentId]
      )

      if (enrollmentCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied - not enrolled in course' })
      }

      // Check exam details with completion status
      const examCheck = await pool.query(
        'SELECT start_time, end_time, status FROM exams WHERE id = $1',
        [examId]
      )

      if (examCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Exam not found' })
      }

      const exam = examCheck.rows[0]
      const now = new Date()

      if (new Date(exam.start_time) > now) {
        return res.status(403).json({ message: 'Exam has not started yet' })
      }

      if (new Date(exam.end_time) < now) {
        return res.status(403).json({ message: 'Exam has ended' })
      }

      // Check if student already has any attempt (completed or in_progress)
      const existingAttempt = await pool.query(
        'SELECT id, status, submitted_at FROM exam_attempts WHERE exam_id = $1 AND user_id = $2',
        [examId, studentId]
      )

      if (existingAttempt.rows.length > 0) {
        const attempt = existingAttempt.rows[0]
        if (attempt.status === 'in_progress') {
          return res.status(400).json({ message: 'You already have an active attempt' })
        } else if (attempt.status === 'completed' || attempt.status === 'submitted' || attempt.submitted_at) {
          return res.status(403).json({ message: 'You have already completed this exam' })
        }
      }

      // Create new attempt
      const attemptResult = await pool.query(
        `INSERT INTO exam_attempts (exam_id, user_id) 
         VALUES ($1, $2) 
         RETURNING *`,
        [examId, studentId]
      )

      res.status(201).json(attemptResult.rows[0])
    } catch (error) {
      console.error('POST /api/exams/:examId/start - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student: Submit answer for a question
router.post('/attempts/:attemptId/answers',
  auth,
  requireStudent,
  [
    body('question_id').notEmpty().withMessage('Question ID is required'),
    body('answer').notEmpty().withMessage('Answer is required')
  ],
  async (req: AuthRequest, res) => {
    try {
      const attemptId = req.params.attemptId
      const { question_id, answer } = req.body
      const studentId = req.user!.id

      // Verify attempt belongs to student
      const attemptCheck = await pool.query(
        'SELECT id, status FROM exam_attempts WHERE id = $1 AND user_id = $2',
        [attemptId, studentId]
      )

      if (attemptCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Attempt not found' })
      }

      const attempt = attemptCheck.rows[0]
      if (attempt.status !== 'in_progress') {
        return res.status(400).json({ message: 'Attempt is not active' })
      }

      // Get question details for grading
      const questionResult = await pool.query(
        'SELECT type, correct_answer, points FROM questions WHERE id = $1',
        [question_id]
      )

      if (questionResult.rows.length === 0) {
        return res.status(404).json({ message: 'Question not found' })
      }

      const question = questionResult.rows[0]
      let is_correct = false
      let points_earned = 0

      // Auto-grade based on question type
      if (question.type === 'mcq') {
        is_correct = answer === question.correct_answer
        points_earned = is_correct ? question.points : 0
      } else if (question.type === 'written') {
        // Written questions need manual grading
        is_correct = null
        points_earned = 0
      } else if (question.type === 'coding') {
        // Basic coding validation - check if answer is not empty
        is_correct = answer && answer.trim().length > 0
        points_earned = is_correct ? question.points : 0
      }

      // Insert or update answer
      await pool.query(
        `INSERT INTO answers (attempt_id, question_id, answer, is_correct, points_earned)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (attempt_id, question_id) 
         DO UPDATE SET 
           answer = EXCLUDED.answer,
           is_correct = EXCLUDED.is_correct,
           points_earned = EXCLUDED.points_earned`,
        [attemptId, question_id, answer, is_correct, points_earned]
      )

      res.json({ message: 'Answer submitted successfully', is_correct, points_earned })
    } catch (error) {
      console.error('POST /api/attempts/:attemptId/answers - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student: Submit exam attempt
router.post('/attempts/:attemptId/submit',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      const attemptId = req.params.attemptId
      const studentId = req.user!.id

      // Verify attempt belongs to student
      const attemptCheck = await pool.query(
        'SELECT id, exam_id, status FROM exam_attempts WHERE id = $1 AND user_id = $2',
        [attemptId, studentId]
      )

      if (attemptCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Attempt not found' })
      }

      const attempt = attemptCheck.rows[0]
      if (attempt.status !== 'in_progress') {
        return res.status(400).json({ message: 'Attempt is already submitted' })
      }

      // Calculate total score and points
      const scoreResult = await pool.query(
        `SELECT 
           SUM(points_earned) as total_earned,
           SUM(q.points) as total_points,
           COUNT(*) as total_questions
         FROM answers a
         JOIN questions q ON a.question_id = q.id
         WHERE a.attempt_id = $1`,
        [attemptId]
      )

      const scoreData = scoreResult.rows[0]
      const totalPoints = scoreData.total_points || 0
      const totalEarned = scoreData.total_earned || 0
      const percentage = totalPoints > 0 ? (totalEarned / totalPoints) * 100 : 0

      // Update attempt with submission data
      await pool.query(
        `UPDATE exam_attempts 
         SET submitted_at = NOW(), 
             score = $1,
             total_points = $2,
             percentage = $3,
             status = 'completed'
         WHERE id = $4`,
        [totalEarned, totalPoints, percentage, attemptId]
      )

      // Create result record
      await pool.query(
        `INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [studentId, attempt.exam_id, attemptId, totalEarned, totalPoints, percentage, percentage >= 50 ? 'passed' : 'failed']
      )

      // Increment exam submissions metric
      const metrics = req.app.get('metrics') as {
        examSubmissionsTotal?: { inc: () => void }
      }
      
      if (metrics.examSubmissionsTotal) {
        metrics.examSubmissionsTotal.inc()
      }

      res.json({ 
        message: 'Exam submitted successfully',
        score: totalEarned,
        totalPoints,
        percentage
      })
    } catch (error) {
      console.error('POST /api/attempts/:attemptId/submit - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student: Get attempt details
router.get('/attempts/:attemptId',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      const attemptId = req.params.attemptId
      const studentId = req.user!.id

      // Verify attempt belongs to student
      const attemptCheck = await pool.query(
        `SELECT a.*, e.title as exam_title, e.duration_minutes, e.start_time, e.end_time,
                CASE
                  WHEN a.status = 'completed' THEN 'completed'
                  WHEN NOW() BETWEEN e.start_time AND e.end_time THEN 'ongoing'
                  ELSE 'upcoming'
                END as exam_status
         FROM exam_attempts a
         JOIN exams e ON a.exam_id = e.id
         WHERE a.id = $1 AND a.user_id = $2`,
        [attemptId, studentId]
      )

      if (attemptCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Attempt not found' })
      }

      const attempt = attemptCheck.rows[0]

      // Auto-submit if exam time has expired and attempt is still in progress
      if (attempt.status === 'in_progress' && new Date(attempt.end_time) < new Date()) {
        await pool.query(
          `UPDATE exam_attempts 
           SET submitted_at = NOW(), 
               status = 'completed'
           WHERE id = $1`,
          [attemptId]
        )

        // Calculate and save score
        const scoreResult = await pool.query(
          `SELECT 
             SUM(points_earned) as total_earned,
             SUM(q.points) as total_points
           FROM answers a
           JOIN questions q ON a.question_id = q.id
           WHERE a.attempt_id = $1`,
          [attemptId]
        )

        const scoreData = scoreResult.rows[0]
        const totalPoints = scoreData.total_points || 0
        const totalEarned = scoreData.total_earned || 0
        const percentage = totalPoints > 0 ? (totalEarned / totalPoints) * 100 : 0

        await pool.query(
          `UPDATE exam_attempts 
           SET score = $1, total_points = $2, percentage = $3
           WHERE id = $4`,
          [totalEarned, totalPoints, percentage, attemptId]
        )

        // Create result record
        await pool.query(
          `INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [studentId, attempt.exam_id, attemptId, totalEarned, totalPoints, percentage, percentage >= 50 ? 'passed' : 'failed']
        )

        return res.json({
          ...attempt,
          status: 'completed',
          autoSubmitted: true,
          message: 'Exam auto-submitted due to time expiration'
        })
      }

      // Get answers with questions
      const answersResult = await pool.query(
        `SELECT a.*, q.question_text, q.type, q.options, q.correct_answer, q.points
         FROM answers a
         JOIN questions q ON a.question_id = q.id
         WHERE a.attempt_id = $1`,
        [attemptId]
      )

      res.json({
        ...attempt,
        answers: answersResult.rows
      })
    } catch (error) {
      console.error('GET /api/attempts/:attemptId - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get all attempts for an exam
router.get('/exams/:examId/attempts',
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

      const attemptsResult = await pool.query(
        `SELECT a.*, u.name as student_name, u.email, u.student_id
         FROM exam_attempts a
         JOIN users u ON a.user_id = u.id
         WHERE a.exam_id = $1
         ORDER BY a.created_at DESC`,
        [examId]
      )

      res.json(attemptsResult.rows)
    } catch (error) {
      console.error('GET /api/exams/:examId/attempts - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Grade written questions
router.post('/answers/:answerId/grade',
  auth,
  requireTeacher,
  [
    body('points_earned').isInt({ min: 0 }),
    body('is_correct').isBoolean()
  ],
  async (req: AuthRequest, res) => {
    try {
      const answerId = req.params.answerId
      const { points_earned, is_correct } = req.body
      const teacherId = req.user!.id

      // Verify answer belongs to teacher's exam
      const answerCheck = await pool.query(
        `SELECT a.id, a.attempt_id, a.question_id
         FROM answers a
         JOIN exam_attempts ea ON a.attempt_id = ea.id
         JOIN exams e ON ea.exam_id = e.id
         WHERE a.id = $1 AND e.teacher_id = $2`,
        [answerId, teacherId]
      )

      if (answerCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied' })
      }

      // Update answer with grading
      await pool.query(
        `UPDATE answers 
         SET points_earned = $1, is_correct = $2
         WHERE id = $3`,
        [points_earned, is_correct, answerId]
      )

      // Recalculate attempt score
      const attemptId = answerCheck.rows[0].attempt_id
      const scoreResult = await pool.query(
        `SELECT 
           SUM(points_earned) as total_earned,
           SUM(q.points) as total_points
         FROM answers a
         JOIN questions q ON a.question_id = q.id
         WHERE a.attempt_id = $1`,
        [attemptId]
      )

      const scoreData = scoreResult.rows[0]
      const totalPoints = scoreData.total_points || 0
      const totalEarned = scoreData.total_earned || 0
      const percentage = totalPoints > 0 ? (totalEarned / totalPoints) * 100 : 0

      // Update attempt and result
      await pool.query(
        `UPDATE exam_attempts 
         SET score = $1, total_points = $2, percentage = $3
         WHERE id = $4`,
        [totalEarned, totalPoints, percentage, attemptId]
      )

      await pool.query(
        `UPDATE results 
         SET score = $1, total_points = $2, percentage = $3, status = $4
         WHERE attempt_id = $5`,
        [totalEarned, totalPoints, percentage, percentage >= 50 ? 'passed' : 'failed', attemptId]
      )

      res.json({ message: 'Answer graded successfully' })
    } catch (error) {
      console.error('POST /api/answers/:answerId/grade - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

export default router
