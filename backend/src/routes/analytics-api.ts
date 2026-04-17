import { Router } from 'express'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher } from '../middleware/auth'

const router = Router()

// GET /api/teacher/analytics - Comprehensive analytics for teacher dashboard
router.get('/teacher/analytics',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/teacher/analytics - User: ${req.user?.id}`)
    
    try {
      const teacherId = req.user!.id

      // Get basic stats
      const statsQuery = await pool.query(
        `SELECT 
           COUNT(DISTINCT e.id) as total_exams,
           COUNT(DISTINCT CASE WHEN e.status = 'ongoing' THEN e.id END) as active_exams,
           COUNT(DISTINCT en.student_id) as total_students
         FROM exams e
         LEFT JOIN enrollments en ON e.course_id = en.course_id
         WHERE e.teacher_id = $1`,
        [teacherId]
      )

      // Get average score
      const avgScoreQuery = await pool.query(
        `SELECT AVG(r.percentage) as avg_score
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         WHERE e.teacher_id = $1`,
        [teacherId]
      )

      // Get top scorers
      const topScorersQuery = await pool.query(
        `SELECT 
           u.name as student_name,
           e.title as exam_title,
           r.percentage as score,
           r.graded_at as submitted_at
         FROM results r
         JOIN users u ON r.student_id = u.id
         JOIN exams e ON r.exam_id = e.id
         WHERE e.teacher_id = $1
         ORDER BY r.percentage DESC
         LIMIT 10`,
        [teacherId]
      )

      // Get lowest scores
      const lowestScoresQuery = await pool.query(
        `SELECT 
           u.name as student_name,
           e.title as exam_title,
           r.percentage as score,
           r.graded_at as submitted_at
         FROM results r
         JOIN users u ON r.student_id = u.id
         JOIN exams e ON r.exam_id = e.id
         WHERE e.teacher_id = $1
         ORDER BY r.percentage ASC
         LIMIT 10`,
        [teacherId]
      )

      // Get score distribution
      const scoreDistributionQuery = await pool.query(
        `SELECT 
           CASE 
             WHEN r.percentage >= 90 THEN '90-100%'
             WHEN r.percentage >= 80 THEN '80-89%'
             WHEN r.percentage >= 70 THEN '70-79%'
             WHEN r.percentage >= 60 THEN '60-69%'
             WHEN r.percentage >= 50 THEN '50-59%'
             ELSE 'Below 50%'
           END as range,
           COUNT(*) as count
         FROM results r
         JOIN exams e ON r.exam_id = e.id
         WHERE e.teacher_id = $1
         GROUP BY 
           CASE 
             WHEN r.percentage >= 90 THEN '90-100%'
             WHEN r.percentage >= 80 THEN '80-89%'
             WHEN r.percentage >= 70 THEN '70-79%'
             WHEN r.percentage >= 60 THEN '60-69%'
             WHEN r.percentage >= 50 THEN '50-59%'
             ELSE 'Below 50%'
           END
         ORDER BY range`,
        [teacherId]
      )

      const stats = statsQuery.rows[0]
      const avgScore = avgScoreQuery.rows[0]?.avg_score || 0

      const analytics = {
        totalExams: parseInt(stats.total_exams) || 0,
        totalStudents: parseInt(stats.total_students) || 0,
        activeExams: parseInt(stats.active_exams) || 0,
        averageScore: parseFloat(avgScore) || 0,
        topScorers: topScorersQuery.rows.map(row => ({
          studentName: row.student_name,
          examTitle: row.exam_title,
          score: parseFloat(row.score),
          submittedAt: row.submitted_at
        })),
        lowestScores: lowestScoresQuery.rows.map(row => ({
          studentName: row.student_name,
          examTitle: row.exam_title,
          score: parseFloat(row.score),
          submittedAt: row.submitted_at
        })),
        scoreDistribution: scoreDistributionQuery.rows.map(row => ({
          range: row.range,
          count: parseInt(row.count)
        }))
      }

      console.log(`Analytics generated for teacher ${teacherId}:`, {
        totalExams: analytics.totalExams,
        totalStudents: analytics.totalStudents,
        averageScore: analytics.averageScore
      })

      res.json(analytics)

    } catch (error) {
      console.error(`[${new Date().toISOString()}] GET /api/teacher/analytics - Error:`, error)
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      })
    }
  }
)

export { router as analyticsApiRoutes }
