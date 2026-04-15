import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../db'

const secret = process.env.JWT_SECRET || 'dev-secret-change-in-prod'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: 'student' | 'teacher' | 'admin'
    name: string
  }
  file?: Express.Multer.File
}

export interface JWTPayload {
  userId: string
  email: string
  role: 'student' | 'teacher' | 'admin'
}

export async function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, secret) as JWTPayload
    const userResult = await pool.query(
      'SELECT id, email, role, name FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    req.user = userResult.rows[0]
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

export function requireStudent(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ message: 'Student access required' })
  }
  next()
}

export function requireTeacher(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ message: 'Teacher access required' })
  }
  next()
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' })
  }
  next()
}

export function requireTeacherOrAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'teacher' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Teacher or Admin access required' })
  }
  next()
}
