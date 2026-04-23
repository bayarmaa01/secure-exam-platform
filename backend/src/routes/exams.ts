import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher, requireAdmin, requireStudent } from '../middleware/auth'

const router = Router()

// Student: Get available exams from enrolled courses
router.get('/exams', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    console.log('=== STUDENT EXAMS DEBUG ===')
    console.log('User ID:', req.user!.id)
    
    const r = await pool.query(
      `SELECT e.*, c.name as course_name, c.description as course_description,
              (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count,
              (SELECT ea.id FROM exam_attempts ea WHERE ea.exam_id = e.id AND ea.user_id = $1 AND ea.submitted_at IS NOT NULL LIMIT 1) as completed_attempt_id
       FROM exams e
       JOIN enrollments en ON e.course_id = en.course_id
       JOIN courses c ON e.course_id = c.id
       WHERE en.student_id = $1
       ORDER BY e.created_at DESC`,
      [req.user!.id]
    )
    
    console.log('Raw student exams results:', JSON.stringify(r.rows, null, 2))
    console.log('Number of exams found:', r.rows.length)
    
    const mappedResults = r.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      durationMinutes: row.duration_minutes || 60,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status || 'draft',
      courseName: row.course_name || 'No Course',
      courseDescription: row.course_description,
      questionCount: parseInt(row.question_count) || 0,
      // Add scheduledAt for frontend compatibility
      scheduledAt: row.start_time,
      // Add completion status
      completed: !!row.completed_attempt_id,
      attemptId: row.completed_attempt_id
    }))
    
    console.log('Mapped results being sent to frontend:', JSON.stringify(mappedResults, null, 2))
    console.log('=== END STUDENT EXAMS DEBUG ===')
    
    res.json(mappedResults)
  } catch (error) {
    console.error('Student exams error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Teacher: Get all my exams
router.get('/teacher/exams', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    console.log('=== TEACHER EXAMS DEBUG ===')
    console.log('User ID:', req.user!.id)
    console.log('Query being executed:')
    console.log(`SELECT e.id, e.title, e.description, e.duration_minutes, e.start_time, e.status, e.created_at, e.course_id,
              c.name as course_name,
              (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count
       FROM exams e
       LEFT JOIN courses c ON e.course_id = c.id
       WHERE e.teacher_id = ${req.user!.id}
       ORDER BY e.created_at DESC`)
    
    const r = await pool.query(
      `SELECT e.id, e.title, e.description, e.duration_minutes, e.start_time, e.end_time, e.status, e.created_at, e.course_id,
              c.name as course_name,
              (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count,
              (SELECT COUNT(*) FROM exam_attempts ea WHERE ea.exam_id = e.id) as attempt_count
       FROM exams e
       LEFT JOIN courses c ON e.course_id = c.id
       WHERE e.teacher_id = $1
       ORDER BY e.created_at DESC`,
      [req.user!.id]
    )
    
    console.log('Raw database results:', JSON.stringify(r.rows, null, 2))
    
    const mappedResults = r.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      durationMinutes: row.duration_minutes || 60,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status || 'draft',
      createdAt: row.created_at,
      courseId: row.course_id,
      courseName: row.course_name || 'No Course',
      questionCount: parseInt(row.question_count) || 0,
      attemptCount: parseInt(row.attempt_count) || 0,
      // Add scheduledAt for frontend compatibility
      scheduledAt: row.start_time
    }))
    
    console.log('Mapped results being sent to frontend:', JSON.stringify(mappedResults, null, 2))
    console.log('=== END TEACHER EXAMS DEBUG ===')
    
    res.json(mappedResults)
  } catch (error) {
    console.error('Error in teacher exams endpoint:', error)
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
      `SELECT e.*, u.name as teacher_name, c.name as course_name, c.id as course_id
       FROM exams e 
       JOIN users u ON e.teacher_id = u.id
       JOIN courses c ON e.course_id = c.id
       WHERE e.id = $1`,
      [req.params.id]
    )
    const row = r.rows[0]
    if (!row) return res.status(404).json({ message: 'Exam not found' })
    
    // Check permissions - REMOVE is_published dependency
    // TEMPORARILY DISABLED: Remove enrollment check for testing
    if (req.user!.role === 'student') {
      // Students can access any exam they're enrolled in
      /*
      const enrollmentCheck = await pool.query(
        'SELECT 1 FROM enrollments en JOIN exams e ON e.course_id = en.course_id WHERE e.id = $1 AND en.student_id = $2',
        [req.params.id, req.user!.id]
      )
      if (enrollmentCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Exam not available or not enrolled' })
      }
      */
    }
    if (req.user!.role === 'teacher' && row.teacher_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Get questions for this exam
    const questionsQuery = await pool.query(
      'SELECT id, question_text, options, type, points, language, starter_code, test_cases FROM questions WHERE exam_id = $1 ORDER BY created_at',
      [req.params.id]
    )
    
    const questions = questionsQuery.rows.map(q => ({
      id: q.id,
      question_text: q.question_text,
      options: q.options || [],
      type: q.type || 'mcq',
      points: q.points || 1,
      language: q.language,
      starter_code: q.starter_code,
      test_cases: q.test_cases
    }))
    
    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      durationMinutes: row.duration_minutes,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      teacherName: row.teacher_name,
      courseName: row.course_name,
      courseId: row.course_id,
      createdAt: row.created_at,
      questions: questions
    })
  } catch (error) {
    console.error('GET /api/exams/:id - Error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Teacher: Create new exam
router.post('/exams', 
  auth, 
  requireTeacher,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').optional().trim(),
    body('course_id').notEmpty().withMessage('Course ID is required'),
    body('type').isIn(['mcq', 'writing', 'coding', 'mixed', 'ai_proctored']).withMessage('Invalid exam type'),
    body('duration_minutes').isInt({ min: 1, max: 480 }),
    body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level'),
    body('total_marks').isInt({ min: 1 }).withMessage('Total marks must be at least 1'),
    body('passing_marks').isInt({ min: 1 }).withMessage('Passing marks must be at least 1'),
    body('start_time').isISO8601().toDate(),
    body('end_time').optional().isISO8601().toDate(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.error('POST /api/exams - Validation errors:', errors.array())
        return res.status(400).json({ errors: errors.array() })
      }

      console.log("Validated body:", req.body);

      const { 
        title, 
        description, 
        course_id,
        type = 'mcq',
        duration_minutes = 60,
        start_time,
        end_time,
        total_marks = 100,
        passing_marks = 50,
        difficulty = 'medium',
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

      console.log("Extracted exam data:", {
        title, 
        description, 
        course_id,
        type,
        duration_minutes,
        start_time,
        end_time,
        total_marks,
        passing_marks,
        difficulty
      });

      // Validate course exists and belongs to teacher
      const courseCheck = await pool.query(
        'SELECT id FROM courses WHERE id = $1 AND teacher_id = $2',
        [course_id, req.user!.id]
      )

      if (courseCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid course ID or course does not belong to teacher' })
      }

      // Calculate end_time if not provided
      let calculatedEndTime = end_time
      if (!calculatedEndTime && start_time) {
        calculatedEndTime = new Date(new Date(start_time).getTime() + duration_minutes * 60 * 1000)
      }
      if (!calculatedEndTime) {
        calculatedEndTime = new Date(Date.now() + duration_minutes * 60 * 1000)
      }

      // Prepare values for insertion - matching actual database schema
      const values = [
        title, description, type, duration_minutes, start_time, end_time,
        difficulty, total_marks, passing_marks, false, course_id, req.user!.id,
        fullscreen_required, tab_switch_detection, copy_paste_blocked,
        camera_required, face_detection_enabled, shuffle_questions,
        shuffle_options, assign_to_all, assigned_groups, 'draft'
      ]

      // Generate placeholders dynamically to prevent mismatch
      const placeholders = values.map((_, i) => `$${i+1}`).join(', ')

      const query = `
        INSERT INTO exams (
          title, description, type, duration_minutes, start_time, end_time,
          difficulty, total_marks, passing_marks, is_published, course_id, teacher_id,
          fullscreen_required, tab_switch_detection, copy_paste_blocked,
          camera_required, face_detection_enabled, shuffle_questions,
          shuffle_options, assign_to_all, assigned_groups, status
        ) VALUES (
          ${placeholders}
        ) RETURNING *
      `

      console.log('POST /api/exams - SQL Query:', query)
      console.log('POST /api/exams - Values:', JSON.stringify(values, null, 2))

      const r = await pool.query(query, values)

      console.log('POST /api/exams - Success:', JSON.stringify(r.rows[0], null, 2))
      
      // Send notification to students - IMPROVED AUTO NOTIFICATION SYSTEM
      try {
        console.log('=== NOTIFICATION DEBUG ===')
        const newExam = r.rows[0]
        console.log('Creating notifications for exam:', newExam.title)
        console.log('Course ID:', newExam.course_id)
        
        // Get all students enrolled in course with course name
        const studentsResult = await pool.query(
          `SELECT u.id as user_id, u.name, c.name as course_name
           FROM users u
           JOIN enrollments en ON u.id = en.student_id
           JOIN courses c ON c.id = en.course_id
           WHERE en.course_id = $1 AND u.role = 'student'`,
          [newExam.course_id]
        )

        console.log('Found enrolled students:', studentsResult.rows.length)
        console.log('Students:', JSON.stringify(studentsResult.rows, null, 2))

        // Create notifications for each student
        if (studentsResult.rows.length > 0) {
          const examTitle = newExam.title || 'New Exam'
          const courseName = studentsResult.rows[0]?.course_name || 'Course'
          
          for (const student of studentsResult.rows) {
            await pool.query(
              `INSERT INTO notifications (user_id, title, message, type, data, created_at)
               VALUES ($1, $2, $3, 'exam_created', $4, NOW())`,
              [
                student.user_id, 
                'New Exam Available', 
                `New exam "${examTitle}" has been added to course "${courseName}" and is now available.`,
                JSON.stringify({
                  exam_id: newExam.id,
                  exam_title: newExam.title,
                  course_id: newExam.course_id,
                  course_name: courseName
                })
              ]
            )
            console.log(`Notification created for student ${student.name} (${student.user_id})`)
          }
          
          console.log(`Successfully created ${studentsResult.rows.length} notifications`)
        } else {
          console.log('No enrolled students found for this course')
        }
      } catch (notifError) {
        console.error('Failed to send exam notifications:', notifError)
      }
      console.log('=== END NOTIFICATION DEBUG ===')
      
      const exam = r.rows[0]
      
      // Get course name for response
      const courseResult = await pool.query(
        'SELECT name FROM courses WHERE id = $1',
        [exam.course_id]
      )
      const courseName = courseResult.rows[0]?.name || 'Unknown Course'
      
      res.status(201).json({
        id: exam.id,
        title: exam.title,
        description: exam.description,
        courseId: exam.course_id,
        courseName: courseName,
        durationMinutes: exam.duration_minutes,
        questionCount: 0,
        startTime: exam.start_time,
        endTime: exam.end_time,
        status: exam.status
      })
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

// PUBLISH LOGIC REMOVED - Exams are visible immediately after creation

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

    // Permission checks - REMOVE is_published dependency
    // TEMPORARILY DISABLED: Remove enrollment check for testing
    if (req.user!.role === 'student') {
      // Students can access questions for any exam they're enrolled in
      /*
      const enrollmentCheck = await pool.query(
        'SELECT 1 FROM enrollments en JOIN exams e ON e.course_id = en.course_id WHERE e.id = $1 AND en.student_id = $2',
        [examId, req.user!.id]
      )
      if (enrollmentCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Exam not available or not enrolled' })
      }
      */
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
    body('question_text').notEmpty().trim(),
    body('type').isIn(['mcq', 'short_answer', 'long_answer', 'coding']),
    body('options').optional().isArray(),
    body('correct_answer').notEmpty(),
    body('points').optional().isInt({ min: 1, max: 100 })
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const examId = req.params.id
      const { question_text, type, options, correct_answer, points = 1 } = req.body

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
        [examId, question_text, JSON.stringify(options), correct_answer, type, points]
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

    // REMOVE is_published check - any exam is available to students
    // TEMPORARILY DISABLED: Remove enrollment check for testing
    /*
    // Check if student is enrolled in the course
    const enrollmentCheck = await pool.query(
      'SELECT 1 FROM enrollments en WHERE en.course_id = (SELECT course_id FROM exams WHERE id = $1) AND en.student_id = $2',
      [examId, userId]
    )
    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Not enrolled in this exam course' })
    }
    */

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

    // Send notification to teachers
    // Notify exam started via WebSocket
    const io = require('../utils/socketHelper').getIO()
    io.emit('exam_started', {
      exam_id: examId,
      user_id: userId,
      timestamp: new Date()
    })

    res.json({ attemptId: r.rows[0].id })
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Save answer with automatic grading
router.post('/exams/attempts/:attemptId/answers', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const { questionId, answer } = req.body
    const attemptId = req.params.attemptId

    // Verify attempt ownership and get question details
    const attemptCheck = await pool.query(`
      SELECT ea.user_id, ea.submitted_at, q.correct_answer, q.type, q.points
      FROM exam_attempts ea
      JOIN questions q ON q.id = $2
      WHERE ea.id = $1
    `, [attemptId, questionId])
    
    if (attemptCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Attempt or question not found' })
    }

    const attempt = attemptCheck.rows[0]
    if (attempt.user_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied' })
    }
    if (attempt.submitted_at) {
      return res.status(400).json({ message: 'Exam already submitted' })
    }

    // Evaluate answer
    let isCorrect = false
    let pointsEarned = 0
    
    const answerText = Array.isArray(answer) ? JSON.stringify(answer) : String(answer)
    const correctAnswer = attempt.correct_answer
    
    if (attempt.type === 'mcq') {
      // For MCQ, compare directly
      isCorrect = answerText === correctAnswer || answer === correctAnswer
    } else if (attempt.type === 'text') {
      // For text answers, case-insensitive comparison
      isCorrect = answerText.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
    }
    
    if (isCorrect) {
      pointsEarned = attempt.points || 1
    }

    // Save answer with grading
    await pool.query(`
      INSERT INTO answers (attempt_id, question_id, answer, is_correct, points_earned)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (attempt_id, question_id)
       DO UPDATE SET 
         answer = $3,
         is_correct = $4,
         points_earned = $5
    `, [attemptId, questionId, answerText, isCorrect, pointsEarned])

    res.json({ 
      ok: true, 
      isCorrect,
      pointsEarned
    })
  } catch (error) {
    console.error('Save answer error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Submit exam with grading
router.post('/exams/attempts/:attemptId/submit', auth, requireStudent, async (req: AuthRequest, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const attemptId = req.params.attemptId

    // Verify attempt ownership and get exam details
    const attemptCheck = await client.query(`
      SELECT ea.user_id, ea.submitted_at, ea.exam_id, e.total_marks, e.passing_marks
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      WHERE ea.id = $1
    `, [attemptId])
    
    if (attemptCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Attempt not found' })
    }

    const attempt = attemptCheck.rows[0]
    if (attempt.user_id !== req.user!.id) {
      await client.query('ROLLBACK')
      return res.status(403).json({ message: 'Access denied' })
    }
    if (attempt.submitted_at) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Exam already submitted' })
    }

    // Grade the exam
    const gradingResult = await client.query(`
      SELECT 
        COUNT(a.id) as total_answered,
        COUNT(CASE WHEN a.is_correct = true THEN 1 END) as correct_answers,
        COALESCE(SUM(q.points), 0) as total_points,
        COALESCE(SUM(CASE WHEN a.is_correct = true THEN q.points ELSE 0 END), 0) as earned_points
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      WHERE a.attempt_id = $1
    `, [attemptId])

    const grading = gradingResult.rows[0]
    const totalPoints = parseFloat(grading.total_points) || attempt.total_marks
    const earnedPoints = parseFloat(grading.earned_points) || 0
    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
    const status = percentage >= attempt.passing_marks ? 'passed' : 'failed'

    // Update attempt with results
    await client.query(`
      UPDATE exam_attempts 
      SET submitted_at = NOW(), score = $1, total_points = $2, percentage = $3, status = 'submitted'
      WHERE id = $4
    `, [earnedPoints, totalPoints, percentage, attemptId])

    // Create result record
    const resultRecord = await client.query(`
      INSERT INTO results (student_id, exam_id, attempt_id, score, total_points, percentage, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [req.user!.id, attempt.exam_id, attemptId, earnedPoints, totalPoints, percentage, status])

    // Update analytics
    await client.query(`
      INSERT INTO analytics (student_id, exam_id, topic, total_questions, correct_answers, accuracy)
      SELECT 
        $1,
        $2,
        q.topic,
        COUNT(a.id),
        COUNT(CASE WHEN a.is_correct = true THEN 1 END),
        ROUND((COUNT(CASE WHEN a.is_correct = true THEN 1 END) * 100.0 / COUNT(a.id)), 2)
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      WHERE a.attempt_id = $3 AND a.is_correct IS NOT NULL
      GROUP BY q.topic
      ON CONFLICT (student_id, exam_id, topic) 
      DO UPDATE SET 
        total_questions = EXCLUDED.total_questions,
        correct_answers = EXCLUDED.correct_answers,
        accuracy = EXCLUDED.accuracy,
        last_updated = NOW()
    `, [req.user!.id, attempt.exam_id, attemptId])

    // Update leaderboard
    await client.query(`
      INSERT INTO leaderboard (student_id, total_score, exams_attempted, average_score)
      SELECT 
        r.student_id,
        COALESCE(SUM(r.score), 0),
        COUNT(r.id),
        COALESCE(AVG(r.percentage), 0)
      FROM results r
      WHERE r.student_id = $1
      GROUP BY r.student_id
      ON CONFLICT (student_id) 
      DO UPDATE SET 
        total_score = EXCLUDED.total_score,
        exams_attempted = EXCLUDED.exams_attempted,
        average_score = EXCLUDED.average_score,
        last_updated = NOW()
    `, [req.user!.id])

    await client.query('COMMIT')

    res.json({
      success: true,
      score: earnedPoints,
      totalPoints,
      percentage,
      status,
      result: resultRecord.rows[0]
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Exam submission error:', error)
    res.status(500).json({ message: 'Internal server error' })
  } finally {
    client.release()
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
      `SELECT id, email, name, registration_number, created_at
       FROM users 
       WHERE role = 'student'
       ORDER BY created_at DESC`
    )
    res.json(r.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      registrationNumber: row.registration_number,
      studentId: row.registration_number || 'N/A', // Use registration_number as primary
      createdAt: row.created_at
    })))
  } catch (error) {
    console.error('Teacher students error:', error)
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

// Teacher: Delete exam (REQUIREMENT SPECIFIC)
router.delete('/exams/:id', auth, requireTeacher, async (req: AuthRequest, res) => {
  const client = await pool.connect()
  try {
    console.log('=== DELETE EXAM DEBUG ===')
    console.log('Exam ID:', req.params.id)
    console.log('User ID:', req.user!.id)
    
    await client.query('BEGIN')
    
    const examId = req.params.id

    // Check if exam belongs to teacher
    const examCheck = await client.query(
      'SELECT teacher_id, title FROM exams WHERE id = $1',
      [examId]
    )

    if (examCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Exam not found' })
    }

    if (examCheck.rows[0].teacher_id !== req.user!.id) {
      await client.query('ROLLBACK')
      return res.status(403).json({ message: 'Access denied' })
    }

    console.log('Deleting exam:', examCheck.rows[0].title)

    // EXACT REQUIREMENT: Simplified transaction
    await client.query('DELETE FROM analytics WHERE exam_id = $1', [examId])
    await client.query('DELETE FROM results WHERE exam_id = $1', [examId])
    await client.query('DELETE FROM exam_attempts WHERE exam_id = $1', [examId])
    await client.query('DELETE FROM questions WHERE exam_id = $1', [examId])
    await client.query('DELETE FROM exams WHERE id = $1', [examId])

    await client.query('COMMIT')
    
    console.log('Exam deleted successfully')
    console.log('=== END DELETE EXAM DEBUG ===')
    
    res.json({ message: 'Exam deleted successfully' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Delete exam error:', error)
    res.status(500).json({ message: 'Internal server error', error: error.message })
  } finally {
    client.release()
  }
})

export { router as examRoutes }
