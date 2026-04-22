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
  console.log('DEBUG: Auth middleware called:', {
    path: req.path,
    method: req.method,
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader?.substring(0, 20) + '...'
  })
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('DEBUG: No valid Authorization header found')
    return res.status(401).json({ message: 'Unauthorized - No valid token provided' })
  }
  const token = authHeader.slice(7)
  
  try {
    console.log('DEBUG: Verifying JWT token...')
    const payload = jwt.verify(token, secret) as JWTPayload
    console.log('DEBUG: JWT token verified successfully:', {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    })
    
    const userResult = await pool.query(
      'SELECT id, email, role, name FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.rows.length === 0) {
      console.log('DEBUG: User not found in database for userId:', payload.userId)
      return res.status(401).json({ message: 'Invalid token - User not found' })
    }

    console.log('DEBUG: User authenticated successfully:', {
      id: userResult.rows[0].id,
      email: userResult.rows[0].email,
      role: userResult.rows[0].role
    })
    
    req.user = userResult.rows[0]
    next()
  } catch (error) {
    console.log('DEBUG: JWT verification failed:', error)
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token expired' })
    } else if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token' })
    } else {
      console.log('DEBUG: Unexpected auth error:', error)
      return res.status(401).json({ message: 'Authentication failed' })
    }
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
