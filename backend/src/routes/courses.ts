import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher, requireAdmin } from '../middleware/auth'

const router = Router()

// Teacher: Create new course
router.post('/courses',
  auth,
  requireTeacher,
  [
    body('name').notEmpty().trim(),
    body('description').optional().trim()
  ],
  async (req: AuthRequest, res) => {
    try {
      console.log('POST /api/courses - Request body:', JSON.stringify(req.body, null, 2))
      console.log('POST /api/courses - User:', JSON.stringify(req.user, null, 2))

      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.error('POST /api/courses - Validation errors:', errors.array())
        return res.status(400).json({ errors: errors.array() })
      }

      const { name, description } = req.body

      const query = `
        INSERT INTO courses (name, description, teacher_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `
      
      const values = [name, description, req.user!.id]

      console.log('POST /api/courses - SQL Query:', query)
      console.log('POST /api/courses - Values:', JSON.stringify(values, null, 2))

      const r = await pool.query(query, values)

      console.log('POST /api/courses - Success:', JSON.stringify(r.rows[0], null, 2))
      
      res.status(201).json(r.rows[0])
    } catch (error) {
      console.error('POST /api/courses - Database error:', {
        message: error.message,
        stack: error.stack,
        query: error.query,
        parameters: error.parameters,
        severity: error.severity,
        detail: error.detail,
        hint: error.hint
      })
      console.error('POST /api/courses - Request body that failed:', JSON.stringify(req.body, null, 2))
      console.error('POST /api/courses - User that failed:', JSON.stringify(req.user, null, 2))
      
      res.status(500).json({ 
        message: 'Internal server error', 
        error: error.message,
        details: 'Failed to create course in database',
        timestamp: new Date().toISOString()
      })
    }
  }
)

// Teacher: Get own courses
router.get('/teacher/courses',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      console.log('=== TEACHER COURSES DEBUG ===')
      console.log('User ID:', req.user!.id)
      console.log('User role:', req.user!.role)
      
      const r = await pool.query(
        `SELECT c.*, 
                COUNT(DISTINCT e.id) as exam_count,
                COUNT(DISTINCT en.student_id) as student_count
         FROM courses c
         LEFT JOIN exams e ON c.id = e.course_id
         LEFT JOIN enrollments en ON c.id = en.course_id
         WHERE c.teacher_id = $1
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
        [req.user!.id]
      )
      
      console.log('Raw teacher courses results:', JSON.stringify(r.rows, null, 2))
      console.log('Number of courses found:', r.rows.length)
      
      // Also check enrollments table directly
      const enrollmentsCheck = await pool.query(
        'SELECT course_id, COUNT(*) as student_count FROM enrollments GROUP BY course_id'
      )
      console.log('Direct enrollments check:', JSON.stringify(enrollmentsCheck.rows, null, 2))
      
      console.log('=== END TEACHER COURSES DEBUG ===')
      
      res.json(r.rows)
    } catch (error) {
      console.error('GET /api/teacher/courses - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student: Get enrolled courses
router.get('/student/courses',
  auth,
  async (req: AuthRequest, res) => {
    try {
      console.log('=== STUDENT COURSES DEBUG ===')
      console.log('User ID:', req.user!.id)
      console.log('User role:', req.user!.role)
      
      const r = await pool.query(
        `SELECT c.*, 
                u.name as teacher_name,
                COUNT(DISTINCT e.id) as exam_count
         FROM courses c
         JOIN enrollments en ON c.id = en.course_id
         JOIN users u ON c.teacher_id = u.id
         LEFT JOIN exams e ON c.id = e.course_id
         WHERE en.student_id = $1
         GROUP BY c.id, u.name
         ORDER BY c.created_at DESC`,
        [req.user!.id]
      )
      
      console.log('Raw student courses results:', JSON.stringify(r.rows, null, 2))
      console.log('Number of courses found:', r.rows.length)
      console.log('=== END STUDENT COURSES DEBUG ===')
      
      res.json(r.rows)
    } catch (error) {
      console.error('GET /api/student/courses - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Delete course
router.delete('/courses/:id',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      const courseId = req.params.id

      // Check if course belongs to teacher and get course details
      const courseCheck = await client.query(
        'SELECT teacher_id, name FROM courses WHERE id = $1',
        [courseId]
      )

      if (courseCheck.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Course not found' })
      }

      if (courseCheck.rows[0].teacher_id !== req.user!.id) {
        await client.query('ROLLBACK')
        return res.status(403).json({ message: 'Not authorized to delete this course' })
      }

      console.log(`Deleting course: ${courseCheck.rows[0].name} (${courseId})`)

      // Get all exams in this course for logging
      const examsInCourse = await client.query(
        'SELECT id, title FROM exams WHERE course_id = $1',
        [courseId]
      )

      // Delete related records in correct order to avoid foreign key constraints
      // 1. Delete exam-related records
      for (const exam of examsInCourse.rows) {
        // Note: exam_violations table doesn't exist in current schema
        await client.query('DELETE FROM exam_sessions WHERE exam_id = $1', [exam.id])
        await client.query('DELETE FROM exam_attempts WHERE exam_id = $1', [exam.id])
        await client.query('DELETE FROM results WHERE exam_id = $1', [exam.id])
        await client.query('DELETE FROM questions WHERE exam_id = $1', [exam.id])
        console.log(`  Deleted exam: ${exam.title} (${exam.id})`)
      }

      // 2. Delete exams themselves
      await client.query('DELETE FROM exams WHERE course_id = $1', [courseId])

      // 3. Delete enrollments for this course
      const enrollmentResult = await client.query('DELETE FROM enrollments WHERE course_id = $1', [courseId])
      console.log(`  Deleted ${enrollmentResult.rowCount} enrollments`)

      // 4. Delete notifications related to this course
      await client.query('DELETE FROM notifications WHERE course_id = $1', [courseId])

      // 5. Delete the course
      const deleteResult = await client.query('DELETE FROM courses WHERE id = $1', [courseId])
      
      if (deleteResult.rowCount === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Course not found' })
      }
      
      await client.query('COMMIT')
      console.log(`Successfully deleted course: ${courseId}`)
      res.json({ 
        message: 'Course deleted successfully',
        deletedExams: examsInCourse.rows.length,
        deletedEnrollments: enrollmentResult.rowCount
      })
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('DELETE /api/courses/:id - Error:', {
        message: error.message,
        stack: error.stack,
        courseId: req.params.id,
        userId: req.user?.id
      })
      res.status(500).json({ 
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    } finally {
      client.release()
    }
  }
)

// Teacher: Enroll student in course
router.post('/courses/:courseId/enroll',
  auth,
  requireTeacher,
  [
    body('registration_number').notEmpty().trim()
  ],
  async (req: AuthRequest, res) => {
    try {
      const courseId = req.params.courseId
      const { registration_number } = req.body

      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      // Check if course belongs to teacher
      const courseCheck = await pool.query(
        'SELECT teacher_id FROM courses WHERE id = $1',
        [courseId]
      )

      if (courseCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Course not found' })
      }

      if (courseCheck.rows[0].teacher_id !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to enroll students in this course' })
      }

      // Find student by registration_number
      const studentCheck = await pool.query(
        'SELECT id FROM users WHERE registration_number = $1 AND role = $2',
        [registration_number, 'student']
      )

      if (studentCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Student not found' })
      }

      const studentUuid = studentCheck.rows[0].id

      // Check if already enrolled
      const existingEnrollment = await pool.query(
        'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2',
        [courseId, studentUuid]
      )

      if (existingEnrollment.rows.length > 0) {
        return res.status(409).json({ message: 'Student already enrolled in this course' })
      }

      // Enroll student
      await pool.query(
        'INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2)',
        [courseId, studentUuid]
      )

      // Create notification for enrolled student
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, created_at)
         VALUES ($1, $2, $3, 'enrollment', NOW())`,
        [
          studentUuid,
          'Course Enrollment',
          `You have been enrolled in course: ${courseCheck.rows[0].name}`
        ]
      )

      // Verify enrollment and return updated course data
      const updatedCourseResult = await pool.query(
        `SELECT c.*, 
                COUNT(DISTINCT en.student_id) as student_count,
                COUNT(DISTINCT e.id) as exam_count
         FROM courses c
         LEFT JOIN enrollments en ON c.id = en.course_id
         LEFT JOIN exams e ON c.id = e.course_id
         WHERE c.id = $1
         GROUP BY c.id`,
        [courseId]
      )

      const updatedCourse = updatedCourseResult.rows[0]
      res.status(201).json({ 
        message: 'Student enrolled successfully',
        course: {
          id: updatedCourse.id,
          name: updatedCourse.name,
          description: updatedCourse.description,
          studentCount: parseInt(updatedCourse.student_count) || 0,
          examCount: parseInt(updatedCourse.exam_count) || 0,
          createdAt: updatedCourse.created_at
        }
      })
    } catch (error) {
      console.error('POST /api/courses/:courseId/enroll - Error:', error)
      
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ message: 'Student already enrolled in this course' })
      }
      
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get students in course
router.get('/courses/:courseId/students',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const courseId = req.params.courseId

      // Check if course belongs to teacher
      const courseCheck = await pool.query(
        'SELECT teacher_id FROM courses WHERE id = $1',
        [courseId]
      )

      if (courseCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Course not found' })
      }

      if (courseCheck.rows[0].teacher_id !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to view students in this course' })
      }

      const r = await pool.query(
        `SELECT u.id, u.name, u.email, u.student_id, en.enrolled_at
         FROM users u
         JOIN enrollments en ON u.id = en.student_id
         WHERE en.course_id = $1
         ORDER BY en.enrolled_at ASC`,
        [courseId]
      )

      res.json(r.rows)
    } catch (error) {
      console.error('GET /api/courses/:courseId/students - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Admin: Get all courses
router.get('/admin/courses',
  auth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const r = await pool.query(
        `SELECT c.*, u.name as teacher_name 
         FROM courses c 
         JOIN users u ON c.teacher_id = u.id
         ORDER BY c.created_at DESC`
      )
      res.json(r.rows)
    } catch (error) {
      console.error('GET /api/admin/courses - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

export default router
