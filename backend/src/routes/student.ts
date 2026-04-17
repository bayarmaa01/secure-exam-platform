import { Router } from 'express'
import { pool } from '../db'
import { auth, AuthRequest, requireStudent } from '../middleware/auth'

const router = Router()

// Student: Get dashboard data with enrolled courses, exams, and notifications
router.get('/student/dashboard', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const studentId = req.user!.id
    console.log('=== STUDENT DASHBOARD DEBUG ===')
    console.log('Student ID:', studentId)

    // Get enrolled courses with proper joins
    const coursesResult = await pool.query(
      `SELECT c.id, c.name, c.description, c.teacher_id, c.created_at,
              u.name as teacher_name,
              COUNT(DISTINCT e.id) as exam_count
       FROM courses c
       JOIN enrollments en ON c.id = en.course_id
       JOIN users u ON c.teacher_id = u.id
       LEFT JOIN exams e ON c.id = e.course_id
       WHERE en.student_id = $1
       GROUP BY c.id, u.name
       ORDER BY c.created_at DESC`,
      [studentId]
    )

    console.log('Enrolled courses found:', coursesResult.rows.length)

    // Get available exams from enrolled courses with proper joins - REMOVE is_published dependency
    const examsResult = await pool.query(
      `SELECT e.id, e.title, e.description, e.duration_minutes, e.start_time, e.end_time,
              e.status, e.created_at, e.course_id,
              c.name as course_name,
              (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count
       FROM exams e
       JOIN enrollments en ON e.course_id = en.course_id
       JOIN courses c ON e.course_id = c.id
       WHERE en.student_id = $1
       ORDER BY e.created_at DESC`,
      [studentId]
    )

    console.log('Available exams found:', examsResult.rows.length)
    console.log('Raw exams data:', JSON.stringify(examsResult.rows, null, 2))

    // Get notifications
    const notificationsResult = await pool.query(
      `SELECT id, title, message, type, read, created_at
       FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [studentId]
    )

    console.log('Notifications found:', notificationsResult.rows.length)

    const dashboardData = {
      enrolledCourses: coursesResult.rows.map(course => ({
        id: course.id,
        name: course.name,
        description: course.description,
        teacherName: course.teacher_name,
        examCount: parseInt(course.exam_count) || 0,
        createdAt: course.created_at
      })),
      availableExams: examsResult.rows.map(exam => ({
        id: exam.id,
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.duration_minutes,
        startTime: exam.start_time,
        endTime: exam.end_time,
        status: exam.status,
        courseId: exam.course_id,
        courseName: exam.course_name,
        questionCount: parseInt(exam.question_count) || 0,
        createdAt: exam.created_at
      })),
      notifications: notificationsResult.rows.map(notif => ({
        id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        read: notif.read,
        createdAt: notif.created_at
      })),
      stats: {
        totalCourses: coursesResult.rows.length,
        totalExams: examsResult.rows.length,
        unreadNotifications: notificationsResult.rows.filter(n => !n.read).length
      }
    }

    console.log('=== END STUDENT DASHBOARD DEBUG ===')
    res.json(dashboardData)
  } catch (error) {
    console.error('Student dashboard error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Student: Get enrolled courses (fixed version)
router.get('/student/courses', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const studentId = req.user!.id
    
    const result = await pool.query(
      `SELECT c.id, c.name, c.description, c.teacher_id, c.created_at,
              u.name as teacher_name,
              COUNT(DISTINCT e.id) as exam_count,
              COUNT(DISTINCT CASE WHEN e.id IS NOT NULL THEN e.id END) as available_exam_count
       FROM courses c
       JOIN enrollments en ON c.id = en.course_id
       JOIN users u ON c.teacher_id = u.id
       LEFT JOIN exams e ON c.id = e.course_id
       WHERE en.student_id = $1
       GROUP BY c.id, u.name
       ORDER BY c.created_at DESC`,
      [studentId]
    )

    res.json(result.rows.map(course => ({
      id: course.id,
      name: course.name,
      description: course.description,
      teacherName: course.teacher_name,
      examCount: parseInt(course.exam_count) || 0,
      publishedExamCount: parseInt(course.published_exam_count) || 0,
      createdAt: course.created_at
    })))
  } catch (error) {
    console.error('Student courses error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Student: Get available exams (fixed version)
router.get('/student/exams', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const studentId = req.user!.id
    
    const result = await pool.query(
      `SELECT e.id, e.title, e.description, e.duration_minutes, e.start_time, e.end_time,
              e.status, e.created_at, e.course_id,
              c.name as course_name,
              (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count
       FROM exams e
       JOIN courses c ON e.course_id = c.id
       JOIN enrollments en ON c.id = en.course_id
       WHERE en.student_id = $1
       ORDER BY e.created_at DESC`,
      [studentId]
    )
    
    console.log('=== STUDENT EXAMS DEBUG ===')
    console.log('User ID:', studentId)
    console.log('Raw student exams results:', JSON.stringify(result.rows, null, 2))
    console.log('Number of exams found:', result.rows.length)

    console.log('Mapped results being sent to frontend:', JSON.stringify(result.rows.map(exam => ({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.duration_minutes,
      startTime: exam.start_time,
      endTime: exam.end_time,
      status: exam.status,
      courseId: exam.course_id,
      courseName: exam.course_name,
      questionCount: parseInt(exam.question_count) || 0,
      createdAt: exam.created_at
    })), null, 2))
    console.log('=== END STUDENT EXAMS DEBUG ===')
    
    res.json(result.rows.map(exam => ({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.duration_minutes,
      startTime: exam.start_time,
      endTime: exam.end_time,
      status: exam.status,
      courseId: exam.course_id,
      courseName: exam.course_name,
      questionCount: parseInt(exam.question_count) || 0,
      createdAt: exam.created_at
    })))
  } catch (error) {
    console.error('Student exams error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Student: Get notifications
router.get('/student/notifications', auth, requireStudent, async (req: AuthRequest, res) => {
  try {
    const studentId = req.user!.id
    
    const result = await pool.query(
      `SELECT id, title, message, type, read, created_at
       FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [studentId]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Student notifications error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export { router as studentRoutes }
