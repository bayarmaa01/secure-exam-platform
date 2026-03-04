import { Router } from 'express'
import { pool } from '../db'
import { auth } from '../middleware/auth'

const router = Router()

router.get('/exams', auth, async (req, res) => {
  const r = await pool.query(
    "SELECT id, title, description, duration_minutes, scheduled_at, status FROM exams WHERE status = 'published'"
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

router.get('/exams/:id', auth, async (req, res) => {
  const r = await pool.query(
    'SELECT id, title, description, duration_minutes, scheduled_at, status FROM exams WHERE id = $1 AND status = $2',
    [req.params.id, 'published']
  )
  const row = r.rows[0]
  if (!row) return res.status(404).json({ message: 'Exam not found' })
  res.json({
    id: row.id,
    title: row.title,
    description: row.description,
    durationMinutes: row.duration_minutes,
    scheduledAt: row.scheduled_at,
    status: row.status
  })
})

router.get('/exams/:id/questions', auth, async (req, res) => {
  const r = await pool.query(
    'SELECT id, text, options, type FROM questions WHERE exam_id = $1',
    [req.params.id]
  )
  res.json(r.rows.map((row) => ({
    id: row.id,
    text: row.text,
    options: row.options || [],
    type: row.type || 'mcq'
  })))
})

router.post('/exams/:id/start', auth, async (req, res) => {
  const userId = (req as { user?: { userId: string } }).user!.userId
  const examId = req.params.id
  const r = await pool.query(
    'INSERT INTO exam_attempts (exam_id, user_id) VALUES ($1, $2) RETURNING id',
    [examId, userId]
  )
  res.json({ attemptId: r.rows[0].id })
})

router.post('/exams/attempts/:attemptId/answers', auth, async (req, res) => {
  const { questionId, answer } = req.body
  const attemptId = req.params.attemptId
  const ans = Array.isArray(answer) ? JSON.stringify(answer) : String(answer)
  await pool.query(
    'INSERT INTO answers (attempt_id, question_id, answer) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [attemptId, questionId, ans]
  )
  res.json({ ok: true })
})

router.post('/exams/attempts/:attemptId/submit', auth, async (req, res) => {
  const attemptId = req.params.attemptId
  await pool.query(
    'UPDATE exam_attempts SET submitted_at = NOW() WHERE id = $1',
    [attemptId]
  )
  res.json({ ok: true })
})

router.get('/exams/attempts/:attemptId', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM exam_attempts WHERE id = $1', [req.params.attemptId])
  if (!r.rows[0]) return res.status(404).json({ message: 'Attempt not found' })
  res.json(r.rows[0])
})

export { router as examRoutes }
