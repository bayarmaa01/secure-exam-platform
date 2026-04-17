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
        r.id,
        r.score,
        r.total_points,
        r.percentage,
        r.status,
        r.created_at,
        e.title as exam_title,
        e.type as exam_type,
        e.difficulty,
        e.start_time,
        e.end_time,
        u.name as student_name,
        u.email as student_email,
        u.student_id as student_roll_number,
        ea.started_at as attempt_started_at,
        ea.submitted_at as attempt_submitted_at
      FROM results r
      JOIN exams e ON r.exam_id = e.id
      JOIN users u ON r.student_id = u.id
      LEFT JOIN exam_attempts ea ON r.exam_id = ea.exam_id AND ea.user_id = r.student_id
      WHERE e.teacher_id = $1
      ORDER BY r.created_at DESC
    `, [teacherId])

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
        submittedAt: row.attempt_submitted_at
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
    
    // Verify teacher owns this exam
    const examCheck = await pool.query(
      'SELECT teacher_id FROM exams WHERE id = $1',
      [examId]
    )
    
    if (examCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Exam not found' })
    }
    
    if (examCheck.rows[0].teacher_id !== teacherId) {
      return res.status(403).json({ message: 'Access denied' })
    }
    
    const r = await pool.query(`
      SELECT 
        u.name as student_name,
        u.email as student_email,
        e.title as exam_title,
        a.score,
        a.total_points,
        a.percentage,
        a.submitted_at
      FROM exam_attempts a
      JOIN users u ON u.id = a.student_id
      JOIN exams e ON e.id = a.exam_id
      WHERE e.teacher_id = $1 AND a.status = 'completed'
      ORDER BY a.submitted_at DESC
    `, [teacherId])

    const results = r.rows.map(row => ({
      id: row.id,
      score: parseFloat(row.score),
      totalPoints: parseFloat(row.total_points),
      percentage: parseFloat(row.percentage),
      status: row.status,
      createdAt: row.created_at,
      student: {
        name: row.student_name,
        email: row.student_email,
        rollNumber: row.student_roll_number
      },
      attempt: {
        startedAt: row.attempt_started_at,
        submittedAt: row.attempt_submitted_at
      }
    }))

    res.json({
      success: true,
      results,
      total: results.length,
      averageScore: results.length > 0 ? results.reduce((sum, r) => sum + r.percentage, 0) / results.length : 0
    })
  } catch (error) {
    console.error('Get exam results error:', error)
    res.status(500).json({ message: 'Internal server error' })
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
