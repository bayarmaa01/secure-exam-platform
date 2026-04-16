import { Router } from 'express'
import { body, validationResult } from 'express-validator'
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
      res.json(r.rows)
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

export { router as teacherRoutes }
