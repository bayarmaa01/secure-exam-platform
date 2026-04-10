import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth, requireAdmin, AuthRequest } from '../middleware/auth'
import bcrypt from 'bcrypt'

const router = Router()

router.use(auth)
router.use(requireAdmin)

// Get all users
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(
      'SELECT id, email, name, role, student_id, teacher_id, created_at FROM users ORDER BY created_at DESC'
    )
    res.json(r.rows)
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Create user (admin only)
router.post('/users',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty().trim(),
    body('role').isIn(['student', 'teacher', 'admin']),
    body('student_id').optional().isString(),
    body('teacher_id').optional().isString()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { email, password, name, role, student_id, teacher_id } = req.body

      const hash = await bcrypt.hash(password, 10)

      const r = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, student_id, teacher_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, name, role, student_id, teacher_id, created_at`,
        [email, hash, name, role, student_id || null, teacher_id || null]
      )

      res.status(201).json(r.rows[0])
    } catch (error: unknown) {
      const err = error as Error & { code?: string }
      if (err.code === '23505') {
        return res.status(400).json({ message: 'Email already registered' })
      }
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Update user
router.put('/users/:id',
  [
    body('email').optional().isEmail(),
    body('name').optional().notEmpty().trim(),
    body('role').optional().isIn(['student', 'teacher', 'admin']),
    body('student_id').optional().isString(),
    body('teacher_id').optional().isString()
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const userId = req.params.id
      const { email, name, role, student_id, teacher_id } = req.body

      const updates = []
      const values = []
      let paramIndex = 1

      if (email !== undefined) {
        updates.push(`email = $${paramIndex++}`)
        values.push(email)
      }
      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(name)
      }
      if (role !== undefined) {
        updates.push(`role = $${paramIndex++}`)
        values.push(role)
      }
      if (student_id !== undefined) {
        updates.push(`student_id = $${paramIndex++}`)
        values.push(student_id)
      }
      if (teacher_id !== undefined) {
        updates.push(`teacher_id = $${paramIndex++}`)
        values.push(teacher_id)
      }

      updates.push(`updated_at = NOW()`)
      values.push(userId)

      const r = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, name, role, student_id, teacher_id, created_at`,
        values
      )

      if (r.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' })
      }

      res.json(r.rows[0])
    } catch (error: unknown) {
      const err = error as Error & { code?: string }
      if (err.code === '23505') {
        return res.status(400).json({ message: 'Email already registered' })
      }
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.params.id

    // Prevent self-deletion
    if (userId === req.user!.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' })
    }

    const r = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId])

    if (r.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({ message: 'User deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Get all exams (admin view)
router.get('/exams', async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(`
      SELECT e.*, u.name as teacher_name,
             COUNT(DISTINCT q.id) as question_count,
             COUNT(DISTINCT ea.id) as attempt_count
      FROM exams e
      LEFT JOIN users u ON e.teacher_id = u.id
      LEFT JOIN questions q ON e.id = q.exam_id
      LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
      GROUP BY e.id, u.name
      ORDER BY e.created_at DESC
    `)
    
    res.json(r.rows)
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Get exam results with detailed analytics
router.get('/results', async (req: AuthRequest, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        ea.id,
        ea.cheating_score,
        ea.submitted_at,
        ea.started_at,
        u.name as student_name,
        u.email as student_email,
        e.title as exam_title,
        e.duration_minutes,
        CASE 
          WHEN ea.submitted_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (ea.submitted_at - ea.started_at))/60
          ELSE NULL
        END as time_taken_minutes
      FROM exam_attempts ea
      JOIN users u ON ea.user_id = u.id
      JOIN exams e ON ea.exam_id = e.id
      ORDER BY ea.submitted_at DESC NULLS LAST, ea.started_at DESC
    `)

    const results = r.rows.map(row => ({
      id: row.id,
      studentName: row.student_name,
      studentEmail: row.student_email,
      examTitle: row.exam_title,
      cheatingScore: row.cheating_score ? parseFloat(row.cheating_score) : null,
      submittedAt: row.submitted_at,
      startedAt: row.started_at,
      timeTakenMinutes: row.time_taken_minutes ? Math.round(row.time_taken_minutes * 100) / 100 : null,
      durationMinutes: row.duration_minutes,
      status: row.submitted_at ? 'submitted' : 'in_progress'
    }))

    res.json(results)
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Get system analytics
router.get('/analytics', async (req: AuthRequest, res) => {
  try {
    const userStats = await pool.query(`
      SELECT 
        role,
        COUNT(*) as count
      FROM users
      GROUP BY role
    `)

    const examStats = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM exams
      GROUP BY status
    `)

    const attemptStats = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN submitted_at IS NOT NULL THEN 1 END) as completed_attempts,
        COUNT(CASE WHEN submitted_at IS NULL THEN 1 END) as in_progress_attempts,
        AVG(CASE WHEN cheating_score IS NOT NULL THEN cheating_score END) as avg_cheating_score
      FROM exam_attempts
    `)

    const recentActivity = await pool.query(`
      SELECT 
        'exam_created' as activity_type,
        e.title as description,
        e.created_at as timestamp,
        u.name as user_name
      FROM exams e
      JOIN users u ON e.teacher_id = u.id
      WHERE e.created_at > NOW() - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        'exam_submitted' as activity_type,
        CONCAT('Submitted ', e.title) as description,
        ea.submitted_at as timestamp,
        u.name as user_name
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN users u ON ea.user_id = u.id
      WHERE ea.submitted_at > NOW() - INTERVAL '7 days'
      
      ORDER BY timestamp DESC
      LIMIT 20
    `)

    res.json({
      users: userStats.rows,
      exams: examStats.rows,
      attempts: attemptStats.rows[0],
      recentActivity: recentActivity.rows
    })
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' })
  }
})

export { router as adminRoutes }