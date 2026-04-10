import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher, requireStudent, requireAdmin } from '../middleware/auth'

const router = Router()

// Student: Get available exams
router.get('/exams', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, description, duration_minutes, start_time, status 
       FROM exams 
       WHERE status = 'published' AND start_time <= NOW()
       ORDER BY start_time ASC`
    )
    res.json(r.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      durationMinutes: row.duration_minutes,
      startTime: row.start_time,
      status: row.status
    })))
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Teacher: Get all my exams
router.get('/teacher/exams', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, description, duration_minutes, start_time, status, created_at
       FROM exams 
       WHERE teacher_id = $1
       ORDER BY created_at DESC`,
      [req.user!.id]
    )
    res.json(r.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      durationMinutes: row.duration_minutes,
      startTime: row.start_time,
      status: row.status,
      createdAt: row.created_at
    })))
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Admin: Get all exams
router.get('/admin/exams', auth, requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT e.*, u.name as teacher_name 
       FROM exams e 
       JOIN users u ON e.teacher_id = u.id
       ORDER BY e.created_at DESC`
    )
    res.json(r.rows)
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Get specific exam details
router.get('/exams/:id', auth, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT e.*, u.name as teacher_name 
       FROM exams e 
       JOIN users u ON e.teacher_id = u.id
       WHERE e.id = $1`,
      [req.params.id]
    )
    const row = r.rows[0]
    if (!row) return res.status(404).json({ message: 'Exam not found' })
    
    // Check permissions
    if (req.user!.role === 'student' && row.status !== 'published') {
      return res.status(403).json({ message: 'Exam not available' })
    }
    if (req.user!.role === 'teacher' && row.teacher_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied' })
    }
    
    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      durationMinutes: row.duration_minutes,
      startTime: row.start_time,
      status: row.status,
      teacherName: row.teacher_name,
      createdAt: row.created_at
    })
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Teacher: Create new exam
router.post('/exams', 
  auth, 
  requireTeacher,
  [
    body('title').notEmpty().trim(),
    body('description').optional().trim(),
    body('type').optional().isIn(['mcq', 'written', 'coding', 'mixed', 'ai_proctored']),
    body('duration_minutes').isInt({ min: 1, max: 480 }),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    body('total_marks').optional().isInt({ min: 1 }),
    body('passing_marks').optional().isInt({ min: 1 }),
    body('start_time').optional().isISO8601().toDate(),
    body('end_time').optional().isISO8601().toDate(),
    body('fullscreen_required').optional().isBoolean(),
    body('tab_switch_detection').optional().isBoolean(),
    body('copy_paste_blocked').optional().isBoolean(),
    body('camera_required').optional().isBoolean(),
    body('face_detection_enabled').optional().isBoolean(),
    body('shuffle_questions').optional().isBoolean(),
    body('shuffle_options').optional().isBoolean(),
    body('assign_to_all').optional().isBoolean(),
    body('assigned_groups').optional().isArray()
  ],
  async (req: AuthRequest, res) => {
    try {
      console.log('POST /api/exams - Request body:', JSON.stringify(req.body, null, 2))
      console.log('POST /api/exams - User:', JSON.stringify(req.user, null, 2))
      
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.error('POST /api/exams - Validation errors:', errors.array())
        return res.status(400).json({ errors: errors.array() })
      }

      console.log("Validated body:", req.body);

      const { 
        title, 
        description, 
        type = 'mcq',
        duration_minutes = 60,
        difficulty = 'medium',
        total_marks = 100,
        passing_marks = 50,
        start_time,
        end_time,
        fullscreen_required = false,
        tab_switch_detection = false,
        copy_paste_blocked = false,
        camera_required = false,
        face_detection_enabled = false,
        shuffle_questions = false,
        shuffle_options = false,
        assign_to_all = true,
        assigned_groups = []
      } = req.body

      // Calculate end_time if not provided
      const calculatedEndTime = end_time || new Date(new Date(start_time).getTime() + duration_minutes * 60 * 1000)

      const query = `
        INSERT INTO exams (
          title, description, type, duration_minutes, teacher_id, 
          start_time, end_time, difficulty, total_marks, passing_marks,
          fullscreen_required, tab_switch_detection, copy_paste_blocked,
          camera_required, face_detection_enabled, shuffle_questions,
          shuffle_options, assign_to_all, assigned_groups, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, 'draft'
        ) RETURNING *
      `
      
      const values = [
        title, description, type, duration_minutes, req.user!.id,
        start_time, calculatedEndTime, difficulty, total_marks, passing_marks,
        fullscreen_required, tab_switch_detection, copy_paste_blocked,
        camera_required, face_detection_enabled, shuffle_questions,
        shuffle_options, assign_to_all, assigned_groups
      ]

      console.log('POST /api/exams - SQL Query:', query)
      console.log('POST /api/exams - Values:', JSON.stringify(values, null, 2))

      const r = await pool.query(query, values)

      console.log('POST /api/exams - Success:', JSON.stringify(r.rows[0], null, 2))
      res.status(201).json(r.rows[0])
    } catch (error) {
      console.error('POST /api/exams - Database error:', {
        message: error.message,
        stack: error.stack,
        query: error.query,
        parameters: error.parameters,
        severity: error.severity,
        detail: error.detail,
        hint: error.hint
      })
      console.error('POST /api/exams - Request body that failed:', JSON.stringify(req.body, null, 2))
      console.error('POST /api/exams - User that failed:', JSON.stringify(req.user, null, 2))
      
      res.status(500).json({ 
        message: 'Internal server error', 
        error: error.message,
        details: 'Failed to create exam in database',
        timestamp: new Date().toISOString()
      })
    }
  }
)

// Teacher: Update exam
router.put('/exams/:id', 
  auth, 
  requireTeacher,
  [
    body('title').optional().notEmpty().trim(),
    body('description').optional().trim(),
    body('duration_minutes').optional().isInt({ min: 1, max: 480 }),
    body('start_time').optional().isISO8601().toDate(),
    body('end_time').optional().isISO8601().toDate(),
    body('status').optional().isIn(['draft', 'published', 'ongoing', 'completed'])
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const examId = req.params.id
      const { title, description, duration_minutes, start_time, end_time, status } = req.body

      // Check ownership
      const examCheck = await pool.query(
        'SELECT teacher_id FROM exams WHERE id = $1',
        [examId]
      )
      if (examCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Exam not found' })
      }
      if (examCheck.rows[0].teacher_id !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied' })
      }

      const updates = []
      const values = []
      let paramIndex = 1

      if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`)
        values.push(title)
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(description)
      }
      if (duration_minutes !== undefined) {
        updates.push(`duration_minutes = $${paramIndex++}`)
        values.push(duration_minutes)
      }
      if (start_time !== undefined) {
        updates.push(`start_time = $${paramIndex++}`)
        values.push(start_time)
      }
      if (end_time !== undefined) {
        updates.push(`end_time = $${paramIndex++}`)
        values.push(end_time)
      }
      if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`)
        values.push(status)
      }

      updates.push(`updated_at = NOW()`)
      values.push(examId)

      const r = await pool.query(
        `UPDATE exams SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      )

      res.json(r.rows[0])
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Get exam questions
router.get('/exams/:id/questions', auth, async (req: AuthRequest, res) => {
  try {
    const examId = req.params.id

    // Check exam access
    const examCheck = await pool.query(
      'SELECT teacher_id, status FROM exams WHERE id = $1',
      [examId]
    )
    if (examCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Exam not found' })
    }

    const exam = examCheck.rows[0]

    // Permission checks
    if (req.user!.role === 'student' && exam.status !== 'published') {
      return res.status(403).json({ message: 'Exam not available' })
    }
    if (req.user!.role === 'teacher' && exam.teacher_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const r = await pool.query(
      'SELECT id, question_text, options, type, points FROM questions WHERE exam_id = $1 ORDER BY created_at',
      [examId]
    )

    // For students, don't send correct answers
    interface QuestionResponse {
      id: string
      text: string
      options: string[]
      type: string
      points: number
      correctAnswer?: string | string[]
    }
    
    const questions = r.rows.map((row): QuestionResponse => {
      const question: QuestionResponse = {
        id: row.id,
        text: row.question_text,
        options: row.options || [],
        type: row.type || 'mcq',
        points: row.points || 1
      }
      
      if (req.user!.role !== 'student') {
        question.correctAnswer = row.correct_answer
      }
      
      return question
    })

    res.json(questions)
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Teacher: Add question to exam
router.post('/exams/:id/questions',
  auth,
  requireTeacher,
  [
    body('questionText').notEmpty().trim(),
    body('type').isIn(['mcq', 'text']),
    body('options').optional().isArray(),
    body('correctAnswer').notEmpty(),
    body('points').optional().isInt({ min: 1, max: 100 })
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const examId = req.params.id
      const { questionText, type, options, correctAnswer, points = 1 } = req.body

      // Check ownership
      const examCheck = await pool.query(
        'SELECT teacher_id FROM exams WHERE id = $1',
        [examId]
      )
      if (examCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Exam not found' })
      }
      if (examCheck.rows[0].teacher_id !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied' })
      }

      const r = await pool.query(
        `INSERT INTO questions (exam_id, question_text, options, correct_answer, type, points)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [examId, questionText, JSON.stringify(options), correctAnswer, type, points]
      )

      res.status(201).json(r.rows[0])
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student: Start exam attempt
router.post('/exams/:id/start', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const examId = req.params.id
    const userId = req.user!.id

    // Check if exam is available
    const examCheck = await pool.query(
      'SELECT status, start_time FROM exams WHERE id = $1',
      [examId]
    )
    if (examCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Exam not found' })
    }

    const exam = examCheck.rows[0]
    if (exam.status !== 'published') {
      return res.status(403).json({ message: 'Exam not available' })
    }

    // Check if already attempted
    const existingAttempt = await pool.query(
      'SELECT id FROM exam_attempts WHERE exam_id = $1 AND user_id = $2',
      [examId, userId]
    )
    if (existingAttempt.rows.length > 0) {
      return res.status(400).json({ message: 'Exam already attempted' })
    }

    const r = await pool.query(
      'INSERT INTO exam_attempts (exam_id, user_id) VALUES ($1, $2) RETURNING id',
      [examId, userId]
    )

    res.json({ attemptId: r.rows[0].id })
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Save answer
router.post('/exams/attempts/:attemptId/answers', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const { questionId, answer } = req.body
    const attemptId = req.params.attemptId

    // Verify attempt ownership
    const attemptCheck = await pool.query(
      'SELECT user_id, submitted_at FROM exam_attempts WHERE id = $1',
      [attemptId]
    )
    if (attemptCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Attempt not found' })
    }

    const attempt = attemptCheck.rows[0]
    if (attempt.user_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied' })
    }
    if (attempt.submitted_at) {
      return res.status(400).json({ message: 'Exam already submitted' })
    }

    const answerText = Array.isArray(answer) ? JSON.stringify(answer) : String(answer)

    await pool.query(
      `INSERT INTO answers (attempt_id, question_id, answer) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (attempt_id, question_id) 
       DO UPDATE SET answer = $3`,
      [attemptId, questionId, answerText]
    )

    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Submit exam
router.post('/exams/attempts/:attemptId/submit', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const attemptId = req.params.attemptId

    // Verify attempt ownership
    const attemptCheck = await pool.query(
      'SELECT user_id, submitted_at FROM exam_attempts WHERE id = $1',
      [attemptId]
    )
    if (attemptCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Attempt not found' })
    }

    const attempt = attemptCheck.rows[0]
    if (attempt.user_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied' })
    }
    if (attempt.submitted_at) {
      return res.status(400).json({ message: 'Exam already submitted' })
    }

    await pool.query(
      'UPDATE exam_attempts SET submitted_at = NOW() WHERE id = $1',
      [attemptId]
    )

    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Get attempt details
router.get('/exams/attempts/:attemptId', auth, async (req: AuthRequest, res) => {
  try {
    const attemptId = req.params.attemptId

    const r = await pool.query(
      `SELECT ea.*, e.title as exam_title, u.name as student_name
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       JOIN users u ON ea.user_id = u.id
       WHERE ea.id = $1`,
      [attemptId]
    )

    if (r.rows.length === 0) {
      return res.status(404).json({ message: 'Attempt not found' })
    }

    const attempt = r.rows[0]

    // Permission checks
    if (req.user!.role === 'student' && attempt.user_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied' })
    }
    if (req.user!.role === 'teacher') {
      const examCheck = await pool.query(
        'SELECT teacher_id FROM exams WHERE id = $1',
        [attempt.exam_id]
      )
      if (examCheck.rows[0].teacher_id !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied' })
      }
    }

    res.json(attempt)
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Teacher: Get all students
router.get('/teacher/students', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT id, email, name, student_id, created_at
       FROM users 
       WHERE role = 'student'
       ORDER BY created_at DESC`
    )
    res.json(r.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      studentId: row.student_id,
      createdAt: row.created_at
    })))
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Teacher: Create exam (legacy route - redirects to main route)
router.post('/teacher/exams', auth, requireTeacher, [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').optional(),
  body('duration_minutes').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  body('start_time').isISO8601().withMessage('Valid start date required')
], async (req: AuthRequest, res) => {
try {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }

  const { title, description, duration_minutes, start_time } = req.body

  // Calculate end_time if not provided (default to duration_minutes after start_time)
  const end_time = new Date(new Date(start_time).getTime() + duration_minutes * 60 * 1000).toISOString()

  const r = await pool.query(
    `INSERT INTO exams (title, description, duration_minutes, teacher_id, start_time, end_time, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft')
     RETURNING id, title, description, duration_minutes, teacher_id, start_time, end_time, status, created_at`,
    [title, description, parseInt(duration_minutes), req.user!.id, start_time, end_time]
  )

  const exam = r.rows[0]
  res.status(201).json({
    id: exam.id,
    title: exam.title,
    description: exam.description,
    durationMinutes: exam.duration_minutes,
    startTime: exam.start_time,
    endTime: exam.end_time,
    status: exam.status,
    createdAt: exam.created_at
  })
} catch (error) {
  console.error('Error creating exam:', error)
  res.status(500).json({ message: 'Internal server error' })
}
})

// Teacher: Get results with student names
router.get('/teacher/results', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT r.id, r.score, r.total_points, r.percentage, r.status, r.created_at,
              u.name as student_name, e.title as exam_title
       FROM results r
       JOIN users u ON r.student_id = u.id
       JOIN exams e ON r.exam_id = e.id
       WHERE e.teacher_id = $1
       ORDER BY r.created_at DESC`,
      [req.user!.id]
    )

    res.json(r.rows.map((row) => ({
      id: row.id,
      score: parseFloat(row.score),
      totalPoints: parseFloat(row.total_points),
      percentage: parseFloat(row.percentage),
      status: row.status,
      studentName: row.student_name,
      examTitle: row.exam_title,
      createdAt: row.created_at
    })))
  } catch (error) {
    console.error('Get results error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Student: Submit exam
router.post('/student/submit', auth, requireStudent, [
  body('examId').isUUID().withMessage('Valid exam ID required'),
  body('answers').isArray().withMessage('Answers array required')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { examId, answers } = req.body
    const studentId = req.user!.id

    // Start exam attempt
    const attemptResult = await pool.query(
      `INSERT INTO exam_attempts (exam_id, user_id, started_at)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [examId, studentId]
    )

    const attemptId = attemptResult.rows[0].id

    // Save answers
    for (const answer of answers) {
      await pool.query(
        `INSERT INTO answers (attempt_id, question_id, answer)
         VALUES ($1, $2, $3)`,
        [attemptId, answer.questionId, answer.answer]
      )
    }

    // Calculate score (simplified - you can enhance this)
    const score = Math.random() * 100 // Replace with actual scoring logic
    const totalPoints = 100

    // Create result
    await pool.query(
      `INSERT INTO results (student_id, exam_id, score, total_points, percentage, status)
       VALUES ($1, $2, $3, $4, $5, 'completed')`,
      [studentId, examId, score, totalPoints, (score / totalPoints) * 100]
    )

    // Mark attempt as submitted
    await pool.query(
      `UPDATE exam_attempts SET submitted_at = NOW() WHERE id = $1`,
      [attemptId]
    )

    res.json({
      success: true,
      score,
      totalPoints,
      percentage: (score / totalPoints) * 100
    })
  } catch (error) {
    console.error('Submit exam error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export { router as examRoutes }
