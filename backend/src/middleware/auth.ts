import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET || 'dev-secret-change-in-prod'

export interface JWTPayload {
  userId: string
  email: string
  role: 'student' | 'admin'
}

export function auth(req: Request, res: Response, next: NextFunction) {
  const authHeader = (req as Request & { user?: JWTPayload }).headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, secret) as JWTPayload
    ;(req as Request & { user?: JWTPayload }).user = payload
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const u = (req as Request & { user?: JWTPayload }).user
  if (u?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' })
  }
  next()
}
