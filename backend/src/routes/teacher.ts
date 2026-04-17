import { Router } from 'express'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher } from '../middleware/auth'

const router = Router()

// Teacher: Get all students
router.get('/teacher/students',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const r = await pool.query(
        `SELECT id, name, email, registration_number, student_id, created_at
         FROM users 
         WHERE role = 'student' 
         ORDER BY created_at DESC`
      )
      res.json(r.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        registrationNumber: row.registration_number,
        studentId: row.registration_number || row.student_id, // Use registration_number as primary
        createdAt: row.created_at
      })))
    } catch (error) {
      console.error('GET /api/teacher/students - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Remove student from course
router.delete('/courses/:courseId/students/:studentId',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const { courseId, studentId } = req.params

      // Check if course belongs to teacher
      const courseCheck = await pool.query(
        'SELECT teacher_id FROM courses WHERE id = $1',
        [courseId]
      )

      if (courseCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Course not found' })
      }

      if (courseCheck.rows[0].teacher_id !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized to modify this course' })
      }

      // Remove student from course
      const result = await pool.query(
        'DELETE FROM enrollments WHERE course_id = $1 AND student_id = $2 RETURNING *',
        [courseId, studentId]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Student not enrolled in this course' })
      }

      res.json({ message: 'Student removed from course successfully' })
    } catch (error) {
      console.error('DELETE /api/courses/:courseId/students/:studentId - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get dashboard stats
router.get('/teacher/stats',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const teacherId = req.user!.id
      console.log('=== TEACHER STATS DEBUG ===')
      console.log('Teacher ID:', teacherId)
      
      // Total Exams
      const totalExamsResult = await pool.query(
        'SELECT COUNT(*) as count FROM exams WHERE teacher_id = $1',
        [teacherId]
      )
      
      // Ongoing Exams (exams that are currently running)
      const ongoingExamsResult = await pool.query(
        `SELECT COUNT(*) as count 
         FROM exams 
         WHERE teacher_id = $1 
         AND start_time <= NOW() 
         AND end_time >= NOW()`,
        [teacherId]
      )
      
      // Total Questions (from teacher's exams)
      const totalQuestionsResult = await pool.query(
        `SELECT COUNT(*) as count 
         FROM questions q 
         JOIN exams e ON q.exam_id = e.id 
         WHERE e.teacher_id = $1`,
        [teacherId]
      )
      
      // Total Students in teacher's courses
      const totalStudentsResult = await pool.query(
        `SELECT COUNT(DISTINCT en.student_id) as count 
         FROM enrollments en 
         JOIN courses c ON en.course_id = c.id 
         WHERE c.teacher_id = $1`,
        [teacherId]
      )
      
      const stats = {
        totalExams: parseInt(totalExamsResult.rows[0].count),
        ongoingExams: parseInt(ongoingExamsResult.rows[0].count),
        totalQuestions: parseInt(totalQuestionsResult.rows[0].count),
        totalStudents: parseInt(totalStudentsResult.rows[0].count)
      }
      
      console.log('Stats calculated:', JSON.stringify(stats, null, 2))
      console.log('=== END TEACHER STATS DEBUG ===')
      
      res.json(stats)
    } catch (error) {
      console.error('GET /api/teacher/stats - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Get all exams for this teacher
router.get('/teacher/exams',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const teacherId = req.user!.id
      
      const result = await pool.query(
        `SELECT e.*, 
                c.name as course_name,
                COUNT(q.id) as question_count,
                COUNT(ea.id) as attempt_count
         FROM exams e
         LEFT JOIN courses c ON e.course_id = c.id
         LEFT JOIN questions q ON e.id = q.exam_id
         LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
         WHERE e.teacher_id = $1
         GROUP BY e.id, c.name
         ORDER BY e.created_at DESC`,
        [teacherId]
      )
      
      const exams = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        durationMinutes: row.duration_minutes,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        createdAt: row.created_at,
        courseId: row.course_id,
        courseName: row.course_name,
        questionCount: parseInt(row.question_count),
        attemptCount: parseInt(row.attempt_count)
      }))
      
      res.json(exams)
    } catch (error) {
      console.error('GET /api/teacher/exams - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher: Delete student
router.delete('/students/:id',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      const studentId = req.params.id

      // Check if student exists
      const studentCheck = await client.query(
        'SELECT id FROM users WHERE id = $1 AND role = \'student\'',
        [studentId]
      )

      if (studentCheck.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Student not found' })
      }

      // Delete in correct order with proper cascade logic
      await client.query('DELETE FROM enrollments WHERE user_id = $1', [studentId])
      await client.query('DELETE FROM exam_attempts WHERE user_id = $1', [studentId])
      await client.query('DELETE FROM users WHERE id = $1', [studentId])

      await client.query('COMMIT')
      
      res.json({ message: 'Student deleted successfully' })
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Delete student error:', error)
      res.status(500).json({ message: 'Internal server error' })
    } finally {
      client.release()
    }
  }
)

export { router as teacherRoutes }
