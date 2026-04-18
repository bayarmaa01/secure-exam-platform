import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import multer from 'multer'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher } from '../middleware/auth'

const router = Router()

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept JSON and CSV files
    if (file.mimetype === 'application/json' || file.mimetype === 'text/csv') {
      cb(null, true)
    } else {
      cb(new Error('Only JSON and CSV files are allowed'))
    }
  }
})

// Teacher: Add question manually to exam
router.post('/exams/:examId/questions',
  auth,
  requireTeacher,
  [
    body('question_text').notEmpty().trim(),
    body('type').isIn(['mcq', 'written', 'coding']),
    body('options').optional().isArray(),
    body('correct_answer').notEmpty().trim(),
    body('points').optional().isInt({ min: 1 })
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const examId = req.params.examId
      const { question_text, type, options, correct_answer, points = 1 } = req.body

      // Check if exam belongs to teacher
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

      // Validate MCQ questions have options
      if (type === 'mcq' && (!options || options.length < 2)) {
        return res.status(400).json({ message: 'MCQ questions must have at least 2 options' })
      }

      const query = `
        INSERT INTO questions (exam_id, question_text, type, options, correct_answer, points)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `

      const values = [examId, question_text, type, options, correct_answer, points]
      const r = await pool.query(query, values)

      res.status(201).json(r.rows[0])
    } catch (error) {
      console.error('POST /api/exams/:examId/questions - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Upload questions from file (JSON/CSV)
router.post('/exams/:examId/questions/upload',
  auth,
  requireTeacher,
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const examId = req.params.examId

      // Check if exam belongs to teacher
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

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' })
      }

      let questions = []

      // Parse file based on type
      if (req.file.mimetype === 'application/json') {
        try {
          const fileContent = req.file.buffer.toString('utf-8')
          questions = JSON.parse(fileContent)
        } catch (error) {
          return res.status(400).json({ message: 'Invalid JSON format' })
        }
      } else if (req.file.mimetype === 'text/csv') {
        try {
          const fileContent = req.file.buffer.toString('utf-8')
          const lines = fileContent.split('\n').filter(line => line.trim())
          
          // Skip header if present
          const startIndex = lines[0].toLowerCase().includes('question') ? 1 : 0
          
          questions = lines.slice(startIndex).map(line => {
            const [question, type, optionsStr, answer] = line.split(',').map(s => s.trim())
            const options = optionsStr ? optionsStr.split(';').map(o => o.trim()) : []
            
            return {
              type: type || 'mcq',
              question: question,
              options: options,
              answer: answer
            }
          })
        } catch (error) {
          return res.status(400).json({ message: 'Invalid CSV format' })
        }
      }

      // Validate questions array
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: 'No valid questions found in file' })
      }

      // Process and insert questions
      const insertedQuestions = []
      
      for (const q of questions) {
        // Validate question structure
        if (!q.question || !q.type || !q.answer) {
          continue // Skip invalid questions
        }

        const question_text = q.question
        const type = q.type
        const options = q.options || []
        const correct_answer = q.answer
        const points = q.points || 1

        // Validate MCQ questions have options
        if (type === 'mcq' && options.length < 2) {
          continue // Skip invalid MCQ questions
        }

        try {
          const query = `
            INSERT INTO questions (exam_id, question_text, type, options, correct_answer, points)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `
          const values = [examId, question_text, type, JSON.stringify(options), correct_answer, points]
          const r = await pool.query(query, values)
          insertedQuestions.push(r.rows[0])
        } catch (error) {
          console.error('Error inserting question:', error)
          // Continue with other questions
        }
      }

      res.status(201).json({
        message: `Successfully uploaded ${insertedQuestions.length} questions`,
        questions: insertedQuestions
      })
    } catch (error) {
      console.error('POST /api/exams/:examId/questions/upload - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get all questions for exam
router.get('/exams/:examId/questions',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const examId = req.params.examId

      // Check if exam belongs to teacher
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
        'SELECT * FROM questions WHERE exam_id = $1 ORDER BY created_at',
        [examId]
      )

      res.json(r.rows)
    } catch (error) {
      console.error('GET /api/exams/:examId/questions - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Delete question
router.delete('/questions/:questionId',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const questionId = req.params.questionId

      // Check if question belongs to teacher's exam
      const questionCheck = await pool.query(
        `SELECT q.exam_id, e.teacher_id 
         FROM questions q 
         JOIN exams e ON q.exam_id = e.id 
         WHERE q.id = $1`,
        [questionId]
      )

      if (questionCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Question not found' })
      }

      if (questionCheck.rows[0].teacher_id !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied' })
      }

      await pool.query('DELETE FROM questions WHERE id = $1', [questionId])

      res.json({ message: 'Question deleted successfully' })
    } catch (error) {
      console.error('DELETE /api/questions/:questionId - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student: Get questions for exam (without correct answers)
router.get('/exams/:examId/questions/student',
  auth,
  async (req: AuthRequest, res) => {
    try {
      const examId = req.params.examId

      // Check if student is enrolled in course
      const enrollmentCheck = await pool.query(
        `SELECT 1 FROM enrollments en
         JOIN exams e ON en.course_id = e.course_id
         WHERE e.id = $1 AND en.student_id = $2`,
        [examId, req.user!.id]
      )

      if (enrollmentCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied - not enrolled in course' })
      }

      const r = await pool.query(
        'SELECT id, question_text, type, options, points FROM questions WHERE exam_id = $1 ORDER BY created_at',
        [examId]
      )

      res.json(r.rows)
    } catch (error) {
      console.error('GET /api/exams/:examId/questions/student - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

export default router
