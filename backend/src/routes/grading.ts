import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher } from '../middleware/auth'

const router = Router()

// Teacher: Get all exams that have attempts for grading
router.get('/grading/exams', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const teacherId = req.user!.id
    
    console.log(`[GRADING] Fetching exams with attempts for teacher: ${teacherId}`)
    
    const query = `
      SELECT 
        e.id, 
        e.title, 
        e.course_id, 
        c.name as course_name, 
        e.type,
        COUNT(a.id) as total_attempts,
        COUNT(CASE WHEN a.status = 'pending_review' THEN 1 END) as pending_count,
        COUNT(CASE WHEN a.status = 'graded' THEN 1 END) as graded_count,
        COUNT(CASE WHEN a.status = 'submitted' THEN 1 END) as submitted_count,
        MAX(a.submitted_at) as latest_submission
      FROM exams e
      JOIN exam_attempts a ON a.exam_id = e.id
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE e.teacher_id = $1
      GROUP BY e.id, c.name
      ORDER BY MAX(a.submitted_at) DESC NULLS LAST
    `
    
    const result = await pool.query(query, [teacherId])
    
    console.log(`[GRADING] Found ${result.rows.length} exams with attempts`)
    
    const exams = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      courseId: row.course_id,
      courseName: row.course_name || 'Unknown Course',
      type: row.type,
      totalAttempts: parseInt(row.total_attempts),
      pendingCount: parseInt(row.pending_count),
      gradedCount: parseInt(row.graded_count),
      submittedCount: parseInt(row.submitted_count),
      latestSubmission: row.latest_submission
    }))
    
    res.json({
      success: true,
      exams
    })
    
  } catch (error) {
    console.error('[GRADING] Error fetching exams:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch exams' 
    })
  }
})

// Teacher: Get students who attempted a specific exam
router.get('/grading/exams/:examId/students', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const { examId } = req.params
    const teacherId = req.user!.id
    
    console.log(`[GRADING] Fetching students for exam: ${examId}, teacher: ${teacherId}`)
    
    // Verify teacher owns this exam
    const examCheck = await pool.query(
      'SELECT id, title FROM exams WHERE id = $1 AND teacher_id = $2',
      [examId, teacherId]
    )
    
    if (examCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Exam not found or access denied' 
      })
    }
    
    const query = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.student_id,
        a.id as attempt_id,
        a.status,
        a.score,
        a.submitted_at,
        a.graded_at,
        a.feedback
      FROM exam_attempts a
      JOIN users u ON a.user_id = u.id
      WHERE a.exam_id = $1
      ORDER BY a.submitted_at DESC
    `
    
    const result = await pool.query(query, [examId])
    
    console.log(`[GRADING] Found ${result.rows.length} students for exam ${examId}`)
    
    const students = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      studentId: row.student_id,
      attemptId: row.attempt_id,
      status: row.status,
      score: row.score ? parseFloat(row.score) : null,
      submittedAt: row.submitted_at,
      gradedAt: row.graded_at,
      feedback: row.feedback
    }))
    
    res.json({
      success: true,
      exam: {
        id: examCheck.rows[0].id,
        title: examCheck.rows[0].title
      },
      students
    })
    
  } catch (error) {
    console.error('[GRADING] Error fetching students:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch students' 
    })
  }
})

// Teacher: Get pending grading attempts for writing/coding exams
router.get('/grading/pending', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const teacherId = req.user!.id
    
    console.log(`[GRADING] Fetching pending grading attempts for teacher: ${teacherId}`)
    
    const query = `
      SELECT 
        ea.id as attempt_id,
        ea.exam_id,
        ea.user_id as student_id,
        ea.answers,
        ea.submitted_at,
        ea.status,
        ea.score,
        ea.percentage,
        ea.violations_count,
        COALESCE(violation_details.violations, '[]') as violations,
        COALESCE(violation_details.risk_score, 0) as risk_score,
        e.title as exam_title,
        e.type as exam_type,
        e.total_marks,
        e.passing_marks,
        u.name as student_name,
        u.email as student_email,
        u.student_id as student_roll_number
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN users u ON ea.user_id = u.id
      LEFT JOIN (
        SELECT 
          pv.attempt_id,
          COUNT(pv.id) as violation_count,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'type', pv.type,
              'time', pv.timestamp,
              'details', pv.details
            ) ORDER BY pv.timestamp DESC
          ) as violations,
          COALESCE(SUM(pv.risk_score), 0) as risk_score
        FROM proctoring_violations pv
        GROUP BY pv.attempt_id
      ) violation_details ON violation_details.attempt_id = ea.id
      WHERE e.teacher_id = $1
      AND ea.status IN ('pending_review', 'submitted')
      AND e.type IN ('writing', 'coding')
      ORDER BY ea.submitted_at DESC
    `
    
    const result = await pool.query(query, [teacherId])
    
    console.log(`[GRADING] Found ${result.rows.length} pending attempts`)
    
    res.json({
      success: true,
      pendingAttempts: result.rows,
      total: result.rows.length
    })
    
  } catch (error) {
    console.error('[GRADING] Error fetching pending attempts:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pending attempts' 
    })
  }
})

// Teacher: Get specific attempt details for grading
router.get('/grading/attempts/:attemptId', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const { attemptId } = req.params
    const teacherId = req.user!.id
    
    console.log(`[GRADING] Fetching attempt details: ${attemptId} for teacher: ${teacherId}`)
    
    // Verify teacher owns this exam and get full attempt details
    const query = `
      SELECT 
        a.id,
        a.answers,
        a.score,
        a.status,
        a.submitted_at,
        a.started_at,
        a.feedback,
        a.total_points,
        a.percentage,
        e.title,
        e.type,
        e.total_marks,
        e.description,
        u.name as student_name,
        u.email as student_email,
        u.student_id as student_roll_number
      FROM exam_attempts a
      JOIN exams e ON a.exam_id = e.id
      JOIN users u ON a.user_id = u.id
      WHERE a.id = $1
      AND e.teacher_id = $2
    `
    
    const result = await pool.query(query, [attemptId, teacherId])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Attempt not found or access denied' 
      })
    }
    
    const attempt = result.rows[0]
    
    // Get questions for context
    const questionsQuery = `
      SELECT id, question_text, points, type, options, correct_answer
      FROM questions
      WHERE exam_id = $1
      ORDER BY id
    `
    
    const questionsResult = await pool.query(questionsQuery, [attempt.exam_id])
    
    // Get student answers from answers table
    const answersQuery = `
      SELECT question_id, answer, points_earned, is_correct
      FROM answers
      WHERE attempt_id = $1
    `
    
    const answersResult = await pool.query(answersQuery, [attemptId])
    
    // Format answers as question_id -> answer mapping for frontend
    const formattedAnswers: Record<string, string> = {}
    answersResult.rows.forEach(answer => {
      formattedAnswers[answer.question_id] = answer.answer
    })
    
    console.log(`[GRADING] Retrieved attempt ${attemptId} with ${questionsResult.rows.length} questions and ${answersResult.rows.length} answers`)
    
    res.json({
      success: true,
      attempt: {
        id: attempt.id,
        answers: formattedAnswers, // Use formatted answers from answers table
        score: attempt.score ? parseFloat(attempt.score) : null,
        status: attempt.status,
        submittedAt: attempt.submitted_at,
        startedAt: attempt.started_at,
        feedback: attempt.feedback,
        totalPoints: parseInt(attempt.total_points) || 0,
        percentage: attempt.percentage ? parseFloat(attempt.percentage) : null,
        exam: {
          title: attempt.title,
          type: attempt.type,
          totalMarks: parseInt(attempt.total_marks) || 0,
          description: attempt.description
        },
        student: {
          name: attempt.student_name,
          email: attempt.student_email,
          studentId: attempt.student_roll_number
        },
        questions: questionsResult.rows
      }
    })
    
  } catch (error) {
    console.error('[GRADING] Error fetching attempt details:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch attempt details',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Teacher: Submit grade for an attempt
router.post('/grading/attempts/:attemptId/grade', 
  auth, 
  requireTeacher,
  [
    body('score').isFloat({ min: 0 }).withMessage('Score must be a non-negative number'),
    body('feedback').optional().isString().withMessage('Feedback must be a string'),
    body('maxScore').isFloat({ min: 0 }).withMessage('Max score must be a non-negative number')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { attemptId } = req.params
      const { score, feedback, maxScore } = req.body
      const teacherId = req.user!.id
      
      console.log(`[GRADING] Submitting grade for attempt: ${attemptId}, score: ${score}/${maxScore}`)
      
      // Verify teacher owns this exam and attempt is pending review or submitted
      const verifyQuery = `
        SELECT ea.id, ea.exam_id, ea.user_id, e.total_marks, e.teacher_id, e.passing_marks
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        WHERE ea.id = $1
        AND e.teacher_id = $2
        AND ea.status IN ('pending_review', 'submitted')
      `
      
      const verifyResult = await pool.query(verifyQuery, [attemptId, teacherId])
      
      if (verifyResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Attempt not found, not gradable, or access denied' 
        })
      }
      
      const attempt = verifyResult.rows[0]
      const examTotalMarks = attempt.total_marks || maxScore
      
      // Validate score doesn't exceed exam total marks
      if (score > examTotalMarks) {
        return res.status(400).json({ 
          success: false, 
          message: `Score cannot exceed exam total marks (${examTotalMarks})` 
        })
      }
      
      // Calculate percentage
      const percentage = examTotalMarks > 0 ? (score / examTotalMarks) * 100 : 0
      
      console.log(`[GRADING] Grade calculation:`, {
        score,
        maxScore: examTotalMarks,
        percentage,
        passingThreshold: attempt.passing_marks
      })
      
      // Update attempt with grade using simple UPDATE (no INSERT...ON CONFLICT)
      const updateResult = await pool.query(
        `UPDATE exam_attempts 
         SET score = $1,
             total_points = $2,
             percentage = ($1::float / NULLIF($2,0)) * 100,
             status = 'graded',
             feedback = $3,
             graded_at = NOW(),
             graded_by = $4
         WHERE id = $5
         RETURNING *`,
        [score, examTotalMarks, feedback, teacherId, attemptId]
      )
      
      const updatedAttempt = updateResult.rows[0]
      
      console.log(`[GRADING] Successfully graded attempt ${attemptId}`)
      
      res.json({
        success: true,
        attempt: {
          id: updatedAttempt.id,
          score: parseFloat(updatedAttempt.score),
          totalPoints: parseInt(updatedAttempt.total_points),
          percentage: parseFloat(updatedAttempt.percentage),
          status: updatedAttempt.status,
          feedback: updatedAttempt.feedback,
          gradedAt: updatedAttempt.graded_at
        }
      })
      
    } catch (error) {
      console.error('[GRADING] Error grading attempt:', error)
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          message: 'Constraint violation - attempt may already be graded'
        })
      }
      res.status(500).json({ 
        success: false, 
        message: 'Failed to grade attempt',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

// Teacher: Get all graded attempts for review
router.get('/grading/graded', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const teacherId = req.user!.id
    
    console.log(`[GRADING] Fetching graded attempts for teacher: ${teacherId}`)
    
    const query = `
      SELECT 
        ea.id as attempt_id,
        ea.exam_id,
        ea.user_id as student_id,
        ea.submitted_at,
        ea.graded_at,
        ea.score,
        ea.percentage,
        ea.feedback,
        e.title as exam_title,
        e.type as exam_type,
        u.name as student_name,
        u.email as student_email,
        u.student_id as student_roll_number
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN users u ON ea.user_id = u.id
      WHERE e.teacher_id = $1
      AND ea.status = 'graded'
      AND e.type IN ('writing', 'coding')
      ORDER BY ea.graded_at DESC
    `
    
    const result = await pool.query(query, [teacherId])
    
    console.log(`[GRADING] Found ${result.rows.length} graded attempts`)
    
    res.json({
      success: true,
      gradedAttempts: result.rows,
      total: result.rows.length
    })
    
  } catch (error) {
    console.error('[GRADING] Error fetching graded attempts:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch graded attempts' 
    })
  }
})

export default router
