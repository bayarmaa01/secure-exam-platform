import { Router } from 'express'
import { auth, AuthRequest, requireTeacher, requireStudent, requireAdmin } from '../middleware/auth'
import { pool } from '../db'

const router = Router()

// Student: Get my results
router.get('/student', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const studentId = req.user!.id
    
    const r = await pool.query(`
      SELECT 
        r.id,
        r.score,
        r.total_points,
        r.percentage,
        r.status,
        r.created_at,
        a.submitted_at,
        e.title as exam_title,
        e.type as exam_type,
        e.difficulty,
        e.start_time,
        e.end_time,
        t.name as teacher_name
      FROM results r
      JOIN exam_attempts a ON r.attempt_id = a.id
      JOIN exams e ON r.exam_id = e.id
      JOIN users t ON e.teacher_id = t.id
      WHERE r.student_id = $1
      ORDER BY r.created_at DESC
    `, [studentId])

    const results = r.rows.map(row => ({
      id: row.id,
      examTitle: row.exam_title,
      score: parseFloat(row.score),
      totalPoints: parseFloat(row.total_points),
      percentage: parseFloat(row.percentage),
      status: row.status,
      submittedAt: row.submitted_at,
      cheatingScore: null, // TODO: Calculate from proctoring logs
      startedAt: row.created_at,
      timeTakenMinutes: row.submitted_at ? Math.round((new Date(row.submitted_at).getTime() - new Date(row.created_at).getTime()) / 60000) : null,
      durationMinutes: 0, // Will be set from exam data if needed
      exam: {
        title: row.exam_title,
        type: row.exam_type,
        difficulty: row.difficulty,
        startTime: row.start_time,
        endTime: row.end_time,
        teacherName: row.teacher_name
      }
    }))

    res.json({
      success: true,
      data: results,
      total: results.length,
      averageScore: results.length > 0 ? results.reduce((sum, r) => sum + r.percentage, 0) / results.length : 0
    })
  } catch (error) {
    console.error('Get student results error:', error)
    res.status(500).json({ message: 'Failed to fetch results', error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Student: Get result by ID
router.get('/student/:resultId', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const { resultId } = req.params
    const studentId = req.user!.id
    
    const r = await pool.query(`
      SELECT 
        r.*,
        e.title as exam_title,
        e.description as exam_description,
        e.type as exam_type,
        e.difficulty,
        e.start_time,
        e.end_time,
        e.total_marks as exam_total_marks,
        e.passing_marks as exam_passing_marks,
        t.name as teacher_name,
        ea.started_at as attempt_started_at,
        ea.submitted_at as attempt_submitted_at
      FROM results r
      JOIN exams e ON r.exam_id = e.id
      JOIN users t ON e.teacher_id = t.id
      LEFT JOIN exam_attempts ea ON r.exam_id = ea.exam_id AND ea.user_id = r.student_id
      WHERE r.id = $1 AND r.student_id = $2
    `, [resultId, studentId])

    if (r.rows.length === 0) {
      return res.status(404).json({ message: 'Result not found' })
    }

    const result = r.rows[0]
    
    // Get answers for this attempt if available
    const answersQuery = await pool.query(`
      SELECT 
        a.answer,
        a.created_at as answered_at,
        q.question_text,
        q.options,
        q.correct_answer,
        q.type as question_type,
        q.points as question_points
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      JOIN exam_attempts ea ON a.attempt_id = ea.id
      WHERE ea.exam_id = $1 AND ea.user_id = $2
      ORDER BY a.created_at ASC
    `, [result.exam_id, studentId])

    res.json({
      success: true,
      result: {
        id: result.id,
        score: parseFloat(result.score),
        totalPoints: parseFloat(result.total_points),
        percentage: parseFloat(result.percentage),
        status: result.status,
        createdAt: result.created_at,
        exam: {
          title: result.exam_title,
          description: result.exam_description,
          type: result.exam_type,
          difficulty: result.difficulty,
          startTime: result.start_time,
          endTime: result.end_time,
          totalMarks: result.exam_total_marks,
          passingMarks: result.exam_passing_marks,
          teacherName: result.teacher_name
        },
        attempt: {
          startedAt: result.attempt_started_at,
          submittedAt: result.attempt_submitted_at
        },
        answers: answersQuery.rows.map(answer => ({
          answer: answer.answer,
          answeredAt: answer.answered_at,
          question: {
            text: answer.question_text,
            options: answer.options,
            correctAnswer: answer.correct_answer,
            type: answer.question_type,
            points: answer.question_points
          }
        }))
      }
    })
  } catch (error) {
    console.error('Get student result error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Teacher: Get all results for my exams
router.get('/teacher', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const teacherId = req.user!.id
    
    const r = await pool.query(`
      SELECT 
        ea.id as attempt_id,
        COALESCE(r.score, ea.score) as score,
        COALESCE(r.total_points, ea.total_points) as total_points,
        COALESCE(r.percentage, ea.percentage) as percentage,
        ea.status,
        ea.submitted_at,
        ea.graded_at,
        ea.feedback,
        ea.violations_count,
        e.title as exam_title,
        e.type as exam_type,
        e.difficulty,
        e.start_time,
        e.end_time,
        u.name as student_name,
        u.email as student_email,
        u.student_id as student_roll_number,
        ea.started_at as attempt_started_at,
        r.created_at as result_created_at
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN users u ON ea.user_id = u.id
      LEFT JOIN results r ON ea.id = r.attempt_id
      WHERE e.teacher_id = $1
      AND ea.status IN ('submitted', 'terminated', 'pending_review', 'graded')
      AND ea.submitted_at IS NOT NULL
      ORDER BY ea.submitted_at DESC
    `, [teacherId])

    const results = r.rows.map(row => ({
      id: row.attempt_id,
      score: row.score ? parseFloat(row.score) : null,
      totalPoints: parseFloat(row.total_points) || 0,
      percentage: row.percentage ? parseFloat(row.percentage) : null,
      status: row.status,
      createdAt: row.submitted_at,
      gradedAt: row.graded_at,
      feedback: row.feedback,
      violationsCount: row.violations_count || 0,
      exam: {
        title: row.exam_title,
        type: row.exam_type,
        difficulty: row.difficulty,
        startTime: row.start_time,
        endTime: row.end_time
      },
      student: {
        name: row.student_name,
        email: row.student_email,
        rollNumber: row.student_roll_number
      },
      attempt: {
        startedAt: row.attempt_started_at,
        submittedAt: row.submitted_at
      }
    }))

    res.json({
      success: true,
      results,
      total: results.length,
      averageScore: results.length > 0 ? results.reduce((sum, r) => sum + r.percentage, 0) / results.length : 0
    })
  } catch (error) {
    console.error('Get teacher results error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Teacher: Get results for specific exam
router.get('/teacher/exam/:examId', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const { examId } = req.params
    const teacherId = req.user!.id
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(examId)) {
      console.log(`[RESULTS DEBUG] Invalid examId format: ${examId}`)
      return res.status(400).json({ message: 'Invalid exam ID format' })
    }
    
    console.log(`[RESULTS DEBUG] Querying exam results for examId: ${examId}, teacherId: ${teacherId}`)
    
    // Verify teacher owns this exam and exam is completed
    const examCheck = await pool.query(
      'SELECT teacher_id, status, title FROM exams WHERE id = $1',
      [examId]
    )
    
    if (examCheck.rows.length === 0) {
      console.log(`[RESULTS DEBUG] Exam not found: ${examId}`)
      return res.status(404).json({ message: 'Exam not found' })
    }
    
    const exam = examCheck.rows[0]
    if (exam.teacher_id !== teacherId) {
      console.log(`[RESULTS DEBUG] Access denied for teacher ${teacherId} on exam ${examId}`)
      return res.status(403).json({ message: 'Access denied' })
    }
    
    console.log(`[RESULTS DEBUG] Exam found: ${exam.title}, status: ${exam.status}`)
    
    // Use the exact query provided in requirements - NO DATE FILTERING
    const resultsQuery = `
      SELECT
        u.name,
        u.email,
        u.student_id,
        a.score,
        a.percentage,
        a.status,
        a.submitted_at,
        a.graded_at,
        a.feedback,
        a.violations_count
      FROM exam_attempts a
      JOIN users u ON a.user_id = u.id
      WHERE a.exam_id = $1
      AND a.status IN ('submitted', 'terminated', 'pending_review', 'graded')
      AND a.submitted_at IS NOT NULL
      ORDER BY a.submitted_at DESC
    `
    
    console.log(`[RESULTS DEBUG] Executing results query for exam: ${examId}`)
    const r = await pool.query(resultsQuery, [examId])
    
    console.log(`[RESULTS DEBUG] Query returned ${r.rows.length} results for exam ${examId}`)
    
    // Get total enrolled students for attendance calculation
    const enrolledQuery = `
      SELECT COUNT(DISTINCT en.student_id) as total_enrolled
      FROM enrollments en
      JOIN courses c ON en.course_id = c.id
      JOIN exams e ON e.course_id = c.id
      WHERE e.id = $1
    `
    
    const enrolledResult = await pool.query(enrolledQuery, [examId])
    const totalEnrolled = parseInt(enrolledResult.rows[0]?.total_enrolled) || 0
    const attendedCount = r.rows.length
    const notAttendedCount = Math.max(0, totalEnrolled - attendedCount)
    
    console.log(`[RESULTS DEBUG] Enrollment stats - Total: ${totalEnrolled}, Attended: ${attendedCount}, Not Attended: ${notAttendedCount}`)
    
    // Map results to match frontend format
    const results = r.rows.map(row => ({
      student: {
        name: row.name,
        email: row.email,
        rollNumber: row.student_id
      },
      score: parseFloat(row.score) || 0,
      percentage: parseFloat(row.percentage) || 0,
      status: row.status,
      submittedAt: row.submitted_at
    }))
    
    // Return summary counts along with results
    res.json({
      success: true,
      results,
      summary: {
        total: totalEnrolled,
        attended: attendedCount,
        notAttended: notAttendedCount
      },
      examInfo: {
        id: examId,
        title: exam.title,
        status: exam.status
      }
    })
    
    console.log(`[RESULTS DEBUG] Successfully returned ${results.length} results with summary`)
    
  } catch (error) {
    console.error('[RESULTS DEBUG] Get exam results error:', {
      message: error.message,
      stack: error.stack,
      examId: req.params.examId,
      teacherId: req.user?.id
    })
    
    // Don't swallow SQL errors - log them clearly and return proper error
    if (error.code === '42703') {
      // Column does not exist error
      console.error('[RESULTS DEBUG] SQL Column Error:', error.detail)
      return res.status(500).json({ 
        message: 'Database query error - column does not exist', 
        error: error.message,
        detail: error.detail
      })
    }
    
    res.status(500).json({ 
      message: 'Failed to fetch exam results', 
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Admin: Get all results (admin only)
router.get('/admin', auth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        r.id,
        r.score,
        r.total_points,
        r.percentage,
        r.status,
        r.created_at,
        e.title as exam_title,
        e.type as exam_type,
        e.difficulty,
        u.name as student_name,
        u.email as student_email,
        u.student_id as student_roll_number,
        t.name as teacher_name,
        t.email as teacher_email
      FROM results r
      JOIN exams e ON r.exam_id = e.id
      JOIN users u ON r.student_id = u.id
      JOIN users t ON e.teacher_id = t.id
      ORDER BY r.created_at DESC
      LIMIT 100
    `)

    const results = r.rows.map(row => ({
      id: row.id,
      score: parseFloat(row.score),
      totalPoints: parseFloat(row.total_points),
      percentage: parseFloat(row.percentage),
      status: row.status,
      createdAt: row.created_at,
      exam: {
        title: row.exam_title,
        type: row.exam_type,
        difficulty: row.difficulty
      },
      student: {
        name: row.student_name,
        email: row.student_email,
        rollNumber: row.student_roll_number
      },
      teacher: {
        name: row.teacher_name,
        email: row.teacher_email
      }
    }))

    res.json({
      success: true,
      results,
      total: results.length
    })
  } catch (error) {
    console.error('Get admin results error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export { router as resultsRoutes }
