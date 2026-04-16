import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../db'
import { examViolationsTotal } from '../metrics/examMetrics'

interface ExamSecurityOptions {
  requireFullscreen?: boolean
  preventMultipleSessions?: boolean
  validateTimeIntegrity?: boolean
  maxViolationThreshold?: number
}

interface ExamSession {
  id: string
  user_id: string
  exam_id: string
  start_time: Date
  end_time: Date
  status: string
  violation_count: number
  server_time: Date
}

export const examSecurityMiddleware = (options: ExamSecurityOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No valid authorization header' })
      }

      const token = authHeader.substring(7)
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any
      
      // Check if user has active exam session
      if (options.preventMultipleSessions) {
        const activeSessionCheck = await pool.query(
          'SELECT id FROM exam_sessions WHERE user_id = $1 AND end_time IS NULL',
          [decoded.userId]
        )

        if (activeSessionCheck.rows.length > 0) {
          // Check if this is the same session
          const currentSessionId = req.headers['x-exam-session-id']
          const isSameSession = activeSessionCheck.rows.some(
            (session: any) => session.id === currentSessionId
          )

          if (!isSameSession) {
            // Record security violation
            await pool.query(
              `INSERT INTO exam_violations (session_id, user_id, type, details, timestamp)
               VALUES ($1, $2, 'multiple_sessions', 'Multiple exam sessions detected', NOW())`,
              [activeSessionCheck.rows[0].id, decoded.userId]
            )

            examViolationsTotal.inc({ 
              type: 'multiple_sessions', 
              exam_id: 'unknown',
              course_id: 'unknown',
              user_id: decoded.userId 
            })

            return res.status(403).json({ 
              message: 'Multiple exam sessions detected',
              violation: 'multiple_sessions'
            })
          }
        }
      }

      // Validate exam session integrity
      if (options.validateTimeIntegrity) {
        const sessionId = req.headers['x-exam-session-id']
        if (sessionId) {
          const sessionCheck = await pool.query<ExamSession[]>(
            'SELECT * FROM exam_sessions WHERE id = $1 AND user_id = $2',
            [sessionId, decoded.userId]
          )

          if (sessionCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Exam session not found' })
          }

          const session = sessionCheck.rows[0]
          const now = new Date()
          const sessionAge = now.getTime() - new Date(session.start_time).getTime()
          const maxSessionAge = 24 * 60 * 60 * 1000 // 24 hours

          if (sessionAge > maxSessionAge) {
            return res.status(403).json({ 
              message: 'Exam session expired',
              violation: 'session_timeout'
            })
          }

          // Check for time manipulation
          const clientTimeHeader = req.headers['x-client-time']
          if (clientTimeHeader) {
            const clientTime = new Date(clientTimeHeader as string)
            const timeDifference = Math.abs(clientTime.getTime() - now.getTime())
            const maxTimeDifference = 60000 // 1 minute tolerance

            if (timeDifference > maxTimeDifference) {
              await pool.query(
                `INSERT INTO exam_violations (session_id, user_id, type, details, timestamp)
                 VALUES ($1, $2, 'time_manipulation', 'Time manipulation detected', NOW())`,
                [sessionId, decoded.userId]
              )

              examViolationsTotal.inc({ 
                type: 'time_manipulation', 
                exam_id: session.exam_id,
                course_id: 'unknown',
                user_id: decoded.userId 
              })

              return res.status(403).json({ 
                message: 'Time manipulation detected',
                violation: 'time_manipulation'
              })
            }
          }

          // Check violation threshold
          if (options.maxViolationThreshold && session.violation_count >= options.maxViolationThreshold) {
            return res.status(403).json({ 
              message: 'Maximum violations exceeded',
              violation: 'threshold_exceeded'
            })
          }

          // Attach session data to request for downstream middleware
          req.examSession = session
        }
      }

      // Check fullscreen requirement
      if (options.requireFullscreen) {
        const fullscreenHeader = req.headers['x-fullscreen-status']
        if (fullscreenHeader !== 'true') {
          const sessionId = req.headers['x-exam-session-id']
          if (sessionId) {
            await pool.query(
              `INSERT INTO exam_violations (session_id, user_id, type, details, timestamp)
               VALUES ($1, $2, 'fullscreen_violation', 'Fullscreen required but not active', NOW())`,
              [sessionId, decoded.userId]
            )

            examViolationsTotal.inc({ 
              type: 'fullscreen_violation', 
              exam_id: 'unknown',
              course_id: 'unknown',
              user_id: decoded.userId 
            })

            return res.status(403).json({ 
              message: 'Fullscreen required',
              violation: 'fullscreen_violation'
            })
          }
        }
      }

      // Validate request origin and timing
      const origin = req.headers.origin
      const referer = req.headers.referer
      const userAgent = req.headers['user-agent']

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /bot/i,
        /crawler/i,
        /scraper/i,
        /curl/i,
        /wget/i,
        /python/i,
        /node/i,
        /postman/i
      ]

      const isSuspiciousUserAgent = userAgent && suspiciousPatterns.some(pattern => pattern.test(userAgent))
      const isSuspiciousOrigin = origin && !origin.includes(process.env.FRONTEND_URL || 'http://localhost:3005')

      if (isSuspiciousUserAgent || isSuspiciousOrigin) {
        await pool.query(
          `INSERT INTO exam_violations (session_id, user_id, type, details, timestamp)
           VALUES ($1, $2, 'suspicious_request', 'Suspicious request detected', NOW())`,
          [req.headers['x-exam-session-id'] || 'unknown', decoded.userId]
        )

        examViolationsTotal.inc({ 
          type: 'suspicious_request', 
          exam_id: 'unknown',
          course_id: 'unknown',
          user_id: decoded.userId 
        })

        return res.status(403).json({ 
          message: 'Suspicious request detected',
          violation: 'suspicious_request'
        })
      }

      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-Frame-Options', 'DENY')
      res.setHeader('X-XSS-Protection', '1; mode=block')
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';")
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

      next()
    } catch (error) {
      console.error('Exam security middleware error:', error)
      return res.status(500).json({ message: 'Internal server error' })
    }
  }
}

// Helper function to generate security tokens
export const generateExamToken = (sessionId: string, userId: string): string => {
  return jwt.sign(
    { 
      sessionId, 
      userId, 
      type: 'exam_session',
      timestamp: Date.now()
    },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '2h' }
  )
}

// Helper function to validate exam token
export const validateExamToken = (token: string): any => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
  } catch (error) {
    return null
  }
}
