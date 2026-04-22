import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher } from '../middleware/auth'

interface ExamFormData {
  title: string
  description?: string
  type: 'mcq' | 'writing' | 'coding' | 'mixed' | 'ai_proctored'
  duration_minutes: number
  start_time: string
  end_time: string
  difficulty: 'easy' | 'medium' | 'hard'
  total_marks: number
  passing_marks: number
  is_published: boolean
  fullscreen_required: boolean
  tab_switch_detection: boolean
  copy_paste_blocked: boolean
  camera_required: boolean
  face_detection_enabled: boolean
  shuffle_questions: boolean
  shuffle_options: boolean
  assign_to_all: boolean
  assigned_groups: string[]
}

const router = Router()

// Advanced exam creation with all new fields
router.post('/exams/advanced',
  auth,
  requireTeacher,
  [
    body('title').notEmpty().trim(),
    body('description').optional().trim(),
    body('type').isIn(['mcq', 'writing', 'coding', 'mixed', 'ai_proctored']),
    body('duration_minutes').isInt({ min: 1, max: 480 }),
    body('start_time').isISO8601().toDate(),
    body('end_time').isISO8601().toDate(),
    body('difficulty').isIn(['easy', 'medium', 'hard']),
    body('total_marks').isInt({ min: 1, max: 1000 }),
    body('passing_marks').isInt({ min: 1, max: 1000 }),
    body('is_published').optional().isBoolean(),
    
    // Security settings
    body('fullscreen_required').optional().isBoolean(),
    body('tab_switch_detection').optional().isBoolean(),
    body('copy_paste_blocked').optional().isBoolean(),
    body('camera_required').optional().isBoolean(),
    body('face_detection_enabled').optional().isBoolean(),
    
    // Randomization settings
    body('shuffle_questions').optional().isBoolean(),
    body('shuffle_options').optional().isBoolean(),
    
    // Assignment settings
    body('assign_to_all').optional().isBoolean(),
    body('assigned_groups').optional().isArray()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const {
        title,
        description,
        type = 'mcq',
        duration_minutes,
        start_time,
        end_time,
        difficulty = 'medium',
        total_marks = 100,
        passing_marks = 50,
        is_published = false,
        
        // Security settings
        fullscreen_required = false,
        tab_switch_detection = false,
        copy_paste_blocked = false,
        camera_required = false,
        face_detection_enabled = false,
        
        // Randomization settings
        shuffle_questions = false,
        shuffle_options = false,
        
        // Assignment settings
        assign_to_all = true,
        assigned_groups = []
      }: ExamFormData = req.body

      // Validate that end_time is after start_time
      if (new Date(end_time) <= new Date(start_time)) {
        return res.status(400).json({ message: 'End time must be after start time' })
      }

      // Validate that passing_marks <= total_marks
      if (passing_marks > total_marks) {
        return res.status(400).json({ message: 'Passing marks cannot exceed total marks' })
      }

      const r = await pool.query(
        `INSERT INTO exams (
          title, description, type, duration_minutes, start_time, end_time,
          difficulty, total_marks, passing_marks, is_published, teacher_id,
          fullscreen_required, tab_switch_detection, copy_paste_blocked,
          camera_required, face_detection_enabled,
          shuffle_questions, shuffle_options,
          assign_to_all, assigned_groups, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'draft')
        RETURNING *`,
        [
          title, description, type, duration_minutes, start_time, end_time,
          difficulty, total_marks, passing_marks, is_published, req.user!.id,
          fullscreen_required, tab_switch_detection, copy_paste_blocked,
          camera_required, face_detection_enabled,
          shuffle_questions, shuffle_options,
          assign_to_all, JSON.stringify(assigned_groups)
        ]
      )

      res.status(201).json(r.rows[0])
    } catch (error) {
      console.error('Advanced exam creation error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Enhanced question creation with topic and coding support
router.post('/exams/:id/questions/advanced',
  auth,
  requireTeacher,
  [
    body('question_text').notEmpty().trim(),
    body('topic').notEmpty().trim(),
    body('type').isIn(['mcq', 'short_answer', 'long_answer', 'coding']),
    body('options').optional().isArray(),
    body('correct_answer').notEmpty(),
    body('points').optional().isInt({ min: 1, max: 100 }),
    
    // Coding question specific
    body('languages').optional().isArray(),
    body('test_cases').optional().isArray(),
    body('template_code').optional().isObject()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const examId = req.params.id
      const {
        question_text,
        topic,
        type,
        options,
        correct_answer,
        points = 1,
        
        // Coding question specific
        languages = ['python', 'javascript', 'cpp'],
        test_cases = [],
        template_code = {}
      } = req.body

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

      // Validate coding question requirements
      if (type === 'coding' && (!test_cases || test_cases.length === 0)) {
        return res.status(400).json({ message: 'Coding questions require test cases' })
      }

      const r = await pool.query(
        `INSERT INTO questions (
          exam_id, question_text, topic, options, correct_answer, type, points,
          languages, test_cases, template_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          examId, question_text, topic, JSON.stringify(options), correct_answer, type, points,
          JSON.stringify(languages), JSON.stringify(test_cases), JSON.stringify(template_code)
        ]
      )

      res.status(201).json(r.rows[0])
    } catch (error) {
      console.error('Advanced question creation error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Get exams with pagination and filters
router.get('/exams/advanced', auth, async (req: AuthRequest, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      difficulty,
      status,
      search
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)
    let whereClause = 'WHERE 1=1'
    const params: (string | number)[] = []
    let paramIndex = 1

    // Add filters
    if (type) {
      whereClause += ` AND e.type = $${paramIndex++}`
      params.push(String(type))
    }
    if (difficulty) {
      whereClause += ` AND e.difficulty = $${paramIndex++}`
      params.push(String(difficulty))
    }
    if (status) {
      whereClause += ` AND e.status = $${paramIndex++}`
      params.push(String(status))
    }
    if (search) {
      whereClause += ` AND (e.title ILIKE $${paramIndex++} OR e.description ILIKE $${paramIndex++})`
      params.push(`%${String(search)}%`, `%${String(search)}%`)
    }

    // Add role-based filtering
    if (req.user!.role === 'teacher') {
      whereClause += ` AND e.teacher_id = $${paramIndex++}`
      params.push(req.user!.id)
    } else if (req.user!.role === 'student') {
      whereClause += ` AND e.start_time <= NOW() AND e.end_time >= NOW()`
    }

    const r = await pool.query(
      `SELECT e.*, u.name as teacher_name
       FROM exams e
       JOIN users u ON e.teacher_id = u.id
       ${whereClause}
       ORDER BY e.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, Number(limit), offset]
    )

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM exams e
       JOIN users u ON e.teacher_id = u.id
       ${whereClause}`,
      params
    )

    res.json({
      exams: r.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / Number(limit))
      }
    })
  } catch (error) {
    console.error('Advanced exam listing error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Get exam with security settings and questions
router.get('/exams/:id/advanced', auth, async (req: AuthRequest, res) => {
  try {
    const examId = req.params.id

    const r = await pool.query(
      `SELECT e.*, u.name as teacher_name
       FROM exams e
       JOIN users u ON e.teacher_id = u.id
       WHERE e.id = $1`,
      [examId]
    )

    const exam = r.rows[0]
    if (!exam) return res.status(404).json({ message: 'Exam not found' })

    // Check permissions (PUBLISH LOGIC REMOVED)
    if (req.user!.role === 'student') {
      // Check if student is enrolled in the course
      const enrollmentCheck = await pool.query(
        'SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2',
        [exam.course_id, req.user!.id]
      )
      if (enrollmentCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Not enrolled in this exam course' })
      }
    }
    if (req.user!.role === 'teacher' && exam.teacher_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Get questions
    const questionsQuery = await pool.query(
      `SELECT id, question_text, topic, options, type, points, languages
       FROM questions
       WHERE exam_id = $1
       ORDER BY created_at`,
      [examId]
    )

    // For students, don't send correct answers
    interface TestCase {
      input: string
      expectedOutput: string
      description?: string
    }
    
    interface AdvancedQuestionResponse {
      id: string
      text: string
      topic: string
      options: string[]
      type: string
      points: number
      languages: string[]
      correctAnswer?: string | string[]
      testCases?: TestCase[]
      templateCode?: Record<string, string>
    }
    
    const questions = questionsQuery.rows.map((row): AdvancedQuestionResponse => {
      const question: AdvancedQuestionResponse = {
        id: row.id,
        text: row.question_text,
        topic: row.topic,
        options: row.options || [],
        type: row.type || 'mcq',
        points: row.points || 1,
        languages: row.languages || ['python', 'javascript', 'cpp']
      }
      
      if (req.user!.role !== 'student') {
        question.correctAnswer = row.correct_answer
        question.testCases = row.test_cases
        question.templateCode = row.template_code
      }
      
      return question
    })

    res.json({
      ...exam,
      questions
    })
  } catch (error) {
    console.error('Advanced exam details error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// PUBLISH ENDPOINT REMOVED - Exams are visible immediately after creation

export { router as advancedExamRoutes }
