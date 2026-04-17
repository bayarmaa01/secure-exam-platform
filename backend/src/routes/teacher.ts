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
        studentId: row.student_id,
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
      
      // Get total exams
      const totalExamsResult = await pool.query(
        'SELECT COUNT(*) as count FROM exams WHERE teacher_id = $1',
        [teacherId]
      )
      
      // Get published exams
      const publishedExamsResult = await pool.query(
        'SELECT COUNT(*) as count FROM exams WHERE teacher_id = $1 AND status = \'published\'',
        [teacherId]
      )
      
      // Get ongoing exams
      const ongoingExamsResult = await pool.query(
        'SELECT COUNT(*) as count FROM exams WHERE teacher_id = $1 AND status = \'published\' AND start_time <= NOW() AND end_time > NOW()',
        [teacherId]
      )
      
      // Get total questions
      const totalQuestionsResult = await pool.query(
        `SELECT COUNT(*) as count 
         FROM questions q 
         JOIN exams e ON q.exam_id = e.id 
         WHERE e.teacher_id = $1`,
        [teacherId]
      )
      
      // Get total students in teacher's courses
      const totalStudentsResult = await pool.query(
        `SELECT COUNT(DISTINCT en.student_id) as count 
         FROM enrollments en 
         JOIN courses c ON en.course_id = c.id 
         WHERE c.teacher_id = $1`,
        [teacherId]
      )
      
      const stats = {
        totalExams: parseInt(totalExamsResult.rows[0].count),
        publishedExams: parseInt(publishedExamsResult.rows[0].count),
        ongoingExams: parseInt(ongoingExamsResult.rows[0].count),
        totalQuestions: parseInt(totalQuestionsResult.rows[0].count),
        totalStudents: parseInt(totalStudentsResult.rows[0].count)
      }
      
      res.json(stats)
    } catch (error) {
      console.error('GET /api/teacher/stats - Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

export { router as teacherRoutes }
