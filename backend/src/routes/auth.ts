import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { auth } from '../middleware/auth'

const router = Router()

const secret = process.env.JWT_SECRET || 'dev-secret-change-in-prod'
const refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret'

/**
 * LOGIN
 */
router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { email, password } = req.body

      const r = await pool.query('SELECT * FROM users WHERE email = $1', [email])
      const user = r.rows[0]

      // ✅ FIX: prevent bcrypt crash
      if (!user || !user.password_hash) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      const isMatch = await bcrypt.compare(password, user.password_hash)

      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        secret,
        { expiresIn: '15m' }
      )

      const refreshToken = jwt.sign(
        { userId: user.id },
        refreshSecret,
        { expiresIn: '7d' }
      )

      await pool.query(
        `INSERT INTO refresh_tokens (token, user_id, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
        [refreshToken, user.id]
      )

      return res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      })
    } catch (err) {
      console.error('Login error:', err)
      return res.status(500).json({ message: 'Internal server error' })
    }
  }
)

/**
 * REGISTER
 */
router.post(
  '/register',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty(),
    body('role').optional().isIn(['student', 'teacher', 'admin']),
    body('student_id').optional().isString(),
    body('teacher_id').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { email, password, name, role = 'student', student_id, teacher_id } = req.body

      const hash = await bcrypt.hash(password, 10)

      const r = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, student_id, teacher_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, name, role, student_id, teacher_id`,
        [email, hash, name, role, student_id || null, teacher_id || null]
      )

      const user = r.rows[0]

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        secret,
        { expiresIn: '15m' }
      )

      const refreshToken = jwt.sign(
        { userId: user.id },
        refreshSecret,
        { expiresIn: '7d' }
      )

      await pool.query(
        `INSERT INTO refresh_tokens (token, user_id, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
        [refreshToken, user.id]
      )

      return res.json({
        accessToken,
        refreshToken,
        user
      })
    } catch (e: any) {
      if (e.code === '23505') {
        return res.status(400).json({ message: 'Email already registered' })
      }

      console.error('Register error:', e)
      return res.status(500).json({ message: 'Internal server error' })
    }
  }
)

/**
 * REFRESH TOKEN
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(401).json({ message: 'Missing refresh token' })
    }

    const { userId } = jwt.verify(refreshToken, refreshSecret) as { userId: string }

    const r = await pool.query(
      `SELECT u.id, u.email, u.role
       FROM users u
       JOIN refresh_tokens rt ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.user_id = $2 AND rt.expires_at > NOW()`,
      [refreshToken, userId]
    )

    const user = r.rows[0]

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' })
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn: '15m' }
    )

    return res.json({ accessToken })
  } catch (err) {
    return res.status(401).json({ message: 'Invalid refresh token' })
  }
})

/**
 * GET CURRENT USER
 */
router.get('/me', auth, async (req, res) => {
  try {
    const u = (req as any).user

    const r = await pool.query(
      'SELECT id, email, name, role, student_id, teacher_id FROM users WHERE id = $1',
      [u.id]
    )

    const user = r.rows[0]

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json(user)
  } catch (err) {
    console.error('Me error:', err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

export { router as authRoutes }