import { Router } from 'express'
import { pool } from '../db'
import { auth, requireAdmin } from '../middleware/auth'

const router = Router()
router.use(auth)
router.use(requireAdmin)

router.get('/exams', async (_, res) => {
  const r = await pool.query(
    'SELECT id, title, description, duration_minutes, scheduled_at, status FROM exams ORDER BY scheduled_at DESC'
  )
  res.json(r.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    durationMinutes: row.duration_minutes,
    scheduledAt: row.scheduled_at,
    status: row.status
  })))
})

router.get('/results', async (_, res) => {
  const r = await pool.query(`
    SELECT ea.id, u.name as student_name, e.title as exam_title, ea.cheating_score, ea.submitted_at
    FROM exam_attempts ea
    JOIN users u ON ea.user_id = u.id
    JOIN exams e ON ea.exam_id = e.id
    WHERE ea.submitted_at IS NOT NULL
    ORDER BY ea.submitted_at DESC
  `)
  res.json(r.rows.map((row) => ({
    id: row.id,
    studentName: row.student_name,
    examTitle: row.exam_title,
    score: 0,
    cheatingScore: row.cheating_score ? parseFloat(row.cheating_score) : null,
    submittedAt: row.submitted_at
  })))
})
