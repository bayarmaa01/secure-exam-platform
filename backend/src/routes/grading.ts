import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher } from '../middleware/auth'

const router = Router()

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
        0 as violations_count,
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
    
    // Verify teacher owns this exam
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
        0 as violations_count,
        ea.started_at,
        e.title as exam_title,
        e.type as exam_type,
        e.total_marks,
        e.passing_marks,
        e.description as exam_description,
        u.name as student_name,
        u.email as student_email,
        u.student_id as student_roll_number
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN users u ON ea.user_id = u.id
      WHERE ea.id = $1
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
      SELECT id, question_text, points, type
      FROM questions
      WHERE exam_id = $1
      ORDER BY id
    `
    
    const questionsResult = await pool.query(questionsQuery, [attempt.exam_id])
    
    console.log(`[GRADING] Retrieved attempt ${attemptId} with ${questionsResult.rows.length} questions`)
    
    res.json({
      success: true,
      attempt: {
        ...attempt,
        questions: questionsResult.rows
      }
    })
    
  } catch (error) {
    console.error('[GRADING] Error fetching attempt details:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch attempt details' 
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
      
      // Verify teacher owns this exam and attempt is pending review
      const verifyQuery = `
        SELECT ea.id, ea.exam_id, ea.user_id, e.total_marks, e.teacher_id
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        WHERE ea.id = $1
        AND e.teacher_id = $2
        AND ea.status = 'pending_review'
      `
      
      const verifyResult = await pool.query(verifyQuery, [attemptId, teacherId])
      
      if (verifyResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Attempt not found, not pending review, or access denied' 
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
      
      // Determine pass/fail status
      const passed = score >= (attempt.passing_marks || (examTotalMarks * 0.5))
      
      console.log(`[GRADING] Grade calculation:`, {
        score,
        maxScore: examTotalMarks,
        percentage,
        passed,
        passingThreshold: attempt.passing_marks
      })
      
      // Update attempt with grade
      await pool.query(
        `UPDATE exam_attempts 
         SET score = $1,
             total_points = $2,
             percentage = $3,
             status = 'graded',
             graded_at = NOW(),
             graded_by = $4,
             feedback = $5
         WHERE id = $6`,
        [score, examTotalMarks, percentage, teacherId, feedback, attemptId]
      )
      
      // Create or update result record
      await pool.query(
        `INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status, feedback)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (attempt_id) 
         DO UPDATE SET
           score = EXCLUDED.score,
           total_points = EXCLUDED.total_points,
           percentage = EXCLUDED.percentage,
           status = EXCLUDED.status,
           feedback = EXCLUDED.feedback,
           graded_at = NOW()`,
        [attempt.user_id, attempt.exam_id, attemptId, score, examTotalMarks, percentage, passed ? 'passed' : 'failed', feedback]
      )
      
      console.log(`[GRADING] Successfully graded attempt ${attemptId}`)
      
      res.json({
        success: true,
        message: 'Attempt graded successfully',
        grade: {
          score,
          totalPoints: examTotalMarks,
          percentage: Math.round(percentage * 100) / 100,
          status: passed ? 'passed' : 'failed',
          gradedAt: new Date().toISOString()
        }
      })
      
    } catch (error) {
      console.error('[GRADING] Error grading attempt:', error)
      res.status(500).json({ 
        success: false, 
        message: 'Failed to grade attempt' 
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
