import { Router } from 'express'
import { pool } from '../db'
import { auth, AuthRequest, requireTeacher, requireStudent } from '../middleware/auth'

interface TopicPerformance {
  topic: string
  totalQuestions: number
  correctAnswers: number
  accuracy: number
  status: string
}

interface ProgressData {
  examName: string
  date: string
  score: number
}

interface OverallStats {
  totalExams: number
  totalQuestionsAnswered: number
  totalCorrectAnswers: number
  averageScore: number
  examsPassed: number
}

interface DashboardData {
  topicPerformance: TopicPerformance[]
  progressOverTime: ProgressData[]
  overallStats: OverallStats
}

const router = Router()

// Student weak topics analysis
router.get('/analytics/weak-topics',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      const studentId = req.user!.id

      const r = await pool.query(`
        SELECT 
          q.topic,
          COUNT(a.id) as total_questions_attempted,
          COUNT(CASE WHEN a.is_correct = true THEN 1 END) as correct_answers,
          ROUND(
            (COUNT(CASE WHEN a.is_correct = true THEN 1 END) * 100.0 / 
             NULLIF(COUNT(a.id), 0)), 2
          ) as accuracy
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        JOIN exam_attempts ea ON a.attempt_id = ea.id
        WHERE ea.user_id = $1 AND a.is_correct IS NOT NULL
        GROUP BY q.topic
        HAVING COUNT(a.id) > 0
        ORDER BY accuracy ASC
      `, [studentId])

      const weakTopics = r.rows.map(row => ({
        topic: row.topic,
        totalQuestionsAttempted: parseInt(row.total_questions_attempted),
        correctAnswers: parseInt(row.correct_answers),
        accuracy: parseFloat(row.accuracy),
        errorRate: 100 - parseFloat(row.accuracy),
        status: getWeakTopicStatus(100 - parseFloat(row.accuracy))
      }))

      res.json(weakTopics)
    } catch (error) {
      console.error('Weak topics analysis error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Student learning dashboard data
router.get('/analytics/student-dashboard',
  auth,
  requireStudent,
  async (req: AuthRequest, res) => {
    try {
      const studentId = req.user!.id

      // Topic-wise performance
      const topicPerformance = await pool.query(`
        SELECT 
          q.topic,
          COUNT(a.id) as total_questions,
          COUNT(CASE WHEN a.is_correct = true THEN 1 END) as correct_answers,
          ROUND(
            (COUNT(CASE WHEN a.is_correct = true THEN 1 END) * 100.0 / 
             NULLIF(COUNT(a.id), 0)), 2
          ) as accuracy
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        JOIN exam_attempts ea ON a.attempt_id = ea.id
        WHERE ea.user_id = $1 AND a.is_correct IS NOT NULL
        GROUP BY q.topic
        ORDER BY accuracy DESC
      `, [studentId])

      // Progress over time
      const progressData = await pool.query(`
        SELECT 
          e.title as exam_name,
          e.start_time,
          r.percentage as score
        FROM results r
        JOIN exams e ON r.exam_id = e.id
        WHERE r.student_id = $1
        ORDER BY e.start_time ASC
      `, [studentId])

      // Overall statistics
      const overallStats = await pool.query(`
        SELECT 
          COUNT(DISTINCT e.id) as total_exams,
          COUNT(a.id) as total_questions_answered,
          COUNT(CASE WHEN a.is_correct = true THEN 1 END) as total_correct_answers,
          ROUND(AVG(r.percentage), 2) as average_score,
          COUNT(CASE WHEN r.percentage >= r.passing_marks THEN 1 END) as exams_passed
        FROM results r
        JOIN exams e ON r.exam_id = e.id
        LEFT JOIN answers a ON r.exam_id = e.exam_id
        LEFT JOIN exam_attempts ea ON a.attempt_id = ea.id AND ea.user_id = r.student_id
        WHERE r.student_id = $1
      `, [studentId])

      const dashboardData = {
        topicPerformance: topicPerformance.rows.map(row => ({
          topic: row.topic,
          totalQuestions: parseInt(row.total_questions),
          correctAnswers: parseInt(row.correct_answers),
          accuracy: parseFloat(row.accuracy),
          status: getPerformanceStatus(parseFloat(row.accuracy))
        })),
        progressOverTime: progressData.rows.map(row => ({
          examName: row.exam_name,
          date: row.start_time,
          score: parseFloat(row.score)
        })),
        overallStats: {
          totalExams: parseInt(overallStats.rows[0].total_exams),
          totalQuestionsAnswered: parseInt(overallStats.rows[0].total_questions_answered),
          totalCorrectAnswers: parseInt(overallStats.rows[0].total_correct_answers),
          averageScore: parseFloat(overallStats.rows[0].average_score) || 0,
          examsPassed: parseInt(overallStats.rows[0].exams_passed)
        }
      } as DashboardData

      res.json(dashboardData)
    } catch (error) {
      console.error('Student dashboard analytics error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Teacher analytics overview
router.get('/analytics/teacher-overview',
  auth,
  requireTeacher,
  async (req: AuthRequest, res) => {
    try {
      const teacherId = req.user!.id

      // Topic-wise student performance
      const topicAnalysis = await pool.query(`
        SELECT 
          q.topic,
          COUNT(a.id) as total_answers,
          COUNT(CASE WHEN a.is_correct = false THEN 1 END) as wrong_answers,
          COUNT(DISTINCT ea.user_id) as students_attempted
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        JOIN exam_attempts ea ON a.attempt_id = ea.id
        JOIN exams e ON q.exam_id = e.id
        WHERE e.teacher_id = $1 AND a.is_correct IS NOT NULL
        GROUP BY q.topic
        ORDER BY (COUNT(CASE WHEN a.is_correct = false THEN 1 END) * 100.0 / COUNT(a.id)) DESC
      `, [teacherId])

      // Class performance metrics
      const classMetrics = await pool.query(`
        SELECT 
          COUNT(DISTINCT e.id) as total_exams,
          COUNT(DISTINCT ea.user_id) as total_students,
          COUNT(a.id) as total_questions_answered,
          COUNT(CASE WHEN a.is_correct = true THEN 1 END) as total_correct_answers,
          ROUND(AVG(r.percentage), 2) as class_average,
          COUNT(CASE WHEN r.percentage >= r.passing_marks THEN 1 END) as total_passes
        FROM exams e
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
        LEFT JOIN answers a ON ea.id = a.attempt_id
        LEFT JOIN results r ON e.id = r.exam_id AND ea.user_id = r.student_id
        WHERE e.teacher_id = $1
      `, [teacherId])

      // Weak topics with struggling students
      const weakTopicsWithStudents = await pool.query(`
        SELECT 
          q.topic,
          COUNT(CASE WHEN a.is_correct = false THEN 1 END) as wrong_answers,
          COUNT(a.id) as total_answers,
          ROUND((COUNT(CASE WHEN a.is_correct = false THEN 1 END) * 100.0 / COUNT(a.id)), 2) as error_rate,
          COUNT(DISTINCT ea.user_id) as struggling_students
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        JOIN exam_attempts ea ON a.attempt_id = ea.id
        JOIN exams e ON q.exam_id = e.id
        WHERE e.teacher_id = $1 AND a.is_correct = false
        GROUP BY q.topic
        HAVING COUNT(CASE WHEN a.is_correct = false THEN 1 END) > 0
        ORDER BY error_rate DESC
        LIMIT 10
      `, [teacherId])

      const teacherAnalytics = {
        topicAnalysis: topicAnalysis.rows.map(row => ({
          topic: row.topic,
          totalAnswers: parseInt(row.total_answers),
          wrongAnswers: parseInt(row.wrong_answers),
          errorRate: parseFloat(row.wrong_answers) * 100 / parseFloat(row.total_answers),
          studentsAttempted: parseInt(row.students_attempted),
          status: getWeakTopicStatus(parseFloat(row.wrong_answers) * 100 / parseFloat(row.total_answers))
        })),
        classMetrics: {
          totalExams: parseInt(classMetrics.rows[0].total_exams),
          totalStudents: parseInt(classMetrics.rows[0].total_students),
          totalQuestionsAnswered: parseInt(classMetrics.rows[0].total_questions_answered),
          totalCorrectAnswers: parseInt(classMetrics.rows[0].total_correct_answers),
          classAverage: parseFloat(classMetrics.rows[0].class_average) || 0,
          totalPasses: parseInt(classMetrics.rows[0].total_passes),
          passRate: classMetrics.rows[0].total_exams > 0 ? 
            (parseInt(classMetrics.rows[0].total_passes) * 100 / parseInt(classMetrics.rows[0].total_exams)) : 0
        },
        weakTopicsWithStudents: weakTopicsWithStudents.rows.map(row => ({
          topic: row.topic,
          wrongAnswers: parseInt(row.wrong_answers),
          totalAnswers: parseInt(row.total_answers),
          errorRate: parseFloat(row.error_rate),
          strugglingStudents: parseInt(row.struggling_students),
          recommendation: getRecommendation(parseFloat(row.error_rate))
        }))
      }

      res.json(teacherAnalytics)
    } catch (error) {
      console.error('Teacher analytics overview error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Leaderboard
router.get('/analytics/leaderboard',
  auth,
  async (req: AuthRequest, res) => {
    try {
      const { limit = 10 } = req.query

      let query = ''
      let params: any[] = []

      if (req.user!.role === 'teacher') {
        // Show leaderboard for teacher's students only
        query = `
          SELECT 
            u.id,
            u.name,
            u.student_id,
            COALESCE(l.total_score, 0) as total_score,
            COALESCE(l.exams_attempted, 0) as exams_attempted,
            COALESCE(l.average_score, 0) as average_score,
            COALESCE(l.rank, 0) as rank
          FROM users u
          LEFT JOIN leaderboard l ON u.id = l.student_id
          WHERE u.role = 'student'
          ORDER BY total_score DESC, average_score DESC
          LIMIT $1
        `
        params = [limit]
      } else {
        // Global leaderboard for students and admins
        query = `
          SELECT 
            u.id,
            u.name,
            u.student_id,
            COALESCE(l.total_score, 0) as total_score,
            COALESCE(l.exams_attempted, 0) as exams_attempted,
            COALESCE(l.average_score, 0) as average_score,
            COALESCE(l.rank, 0) as rank
          FROM users u
          LEFT JOIN leaderboard l ON u.id = l.student_id
          WHERE u.role = 'student'
          ORDER BY total_score DESC, average_score DESC
          LIMIT $1
        `
        params = [limit]
      }

      const r = await pool.query(query, params)

      res.json(r.rows)
    } catch (error) {
      console.error('Leaderboard error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Update analytics after exam submission
router.post('/analytics/update',
  auth,
  async (req: AuthRequest, res) => {
    try {
      const { examId, studentId } = req.body

      // Update analytics table
      await pool.query(`
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
        JOIN exam_attempts ea ON a.attempt_id = ea.id
        WHERE ea.exam_id = $2 AND ea.user_id = $1 AND a.is_correct IS NOT NULL
        GROUP BY q.topic
        ON CONFLICT (student_id, exam_id, topic) 
        DO UPDATE SET 
          total_questions = EXCLUDED.total_questions,
          correct_answers = EXCLUDED.correct_answers,
          accuracy = EXCLUDED.accuracy,
          last_updated = NOW()
      `, [studentId, examId])

      // Update leaderboard
      await pool.query(`
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
      `, [studentId])

      res.json({ message: 'Analytics updated successfully' })
    } catch (error) {
      console.error('Analytics update error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Helper functions
function getWeakTopicStatus(errorRate: number): string {
  if (errorRate > 70) return 'Critical'
  if (errorRate >= 40) return 'Needs Improvement'
  return 'Good'
}

function getPerformanceStatus(accuracy: number): string {
  if (accuracy >= 70) return 'Strong'
  if (accuracy >= 40) return 'Moderate'
  return 'Weak'
}

function getRecommendation(errorRate: number): string {
  if (errorRate > 70) {
    return 'Critical: Immediate remedial teaching required for this topic'
  } else if (errorRate >= 40) {
    return 'Needs Improvement: Provide additional practice and review materials'
  }
  return 'Good Performance: Continue with current teaching approach'
}

export { router as analyticsRoutes }
